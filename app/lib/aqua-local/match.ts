// SP024 — local-first question matching. Deterministic token-overlap
// similarity computed ON DEVICE over the public question catalog and the
// user's own vault answers. No text leaves the device; no embedding API is
// consulted. This is honest text similarity — NOT the hosted semantic
// embedding matcher (/api/match-question refuses under the flag because its
// transport carried private content to an embedding provider).
//
// Contract carried over from the hosted matcher:
//   - normalized question ids (archived_question_id) stay distinct from
//     exact program occurrences (program_questions.id);
//   - similarity ≠ verified coverage;
//   - no auto-fill from a similarity threshold;
//   - source identifiers and provenance are preserved on every result.

import type { VaultStorage } from './vault.ts'
import type { AnswerRecord, VersionRecord } from './schema.ts'
import { readVersion } from './repo.ts'

export interface MatchCandidate {
  /** normalized question id (archived_questions.id) */
  question_id: string
  question_text: string
  theme: string | null
  significance_score: number | null
  similarity: number // 0..1 Jaccard-weighted overlap score
  confidence: 'high' | 'medium' | 'low'
  /** The user's own vault version for this question scope, if one exists. */
  vault_version_id: string | null
  vault_answer_preview: string | null // first 200 chars of the body
  /** Declared, not verified: the flag means only that a local version exists. */
  has_local_answer: boolean
}

const STOPWORDS = new Set(
  ('a an the and or but of to in for on with at by from as is are was were be been ' +
    'your you we i my our their its it this that these those what who how why describe ' +
    'tell us about explain discuss provide do does did can could should would will')
    .split(' '),
)

function tokenize(text: string): Set<string> {
  const out = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^a-z0-9']+/)) {
    const t = raw.replace(/^'+|'+$/g, '')
    if (t.length < 3 || STOPWORDS.has(t)) continue
    out.add(t)
  }
  return out
}

/** Weighted overlap: |A∩B| / |A ∪ B| biased toward coverage of the query. */
export function similarityScore(query: string, candidate: string): number {
  const a = tokenize(query)
  const b = tokenize(candidate)
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  const jaccard = inter / (a.size + b.size - inter)
  const recall = inter / a.size
  // emphasize coverage of the question being asked
  return Math.min(1, jaccard * 0.6 + recall * 0.4)
}

function confidenceOf(score: number): MatchCandidate['confidence'] {
  if (score >= 0.55) return 'high'
  if (score >= 0.3) return 'medium'
  return 'low'
}

export interface CatalogQuestion {
  id: string // archived_questions.id — normalized id
  text: string
  theme?: string | null
  significance_score?: number | null
  asked_by_count?: number | null
}

/**
 * Match a question (or free text) against the PUBLIC catalog and, where a
 * vault version exists for the same normalized question scope, attach the
 * local answer provenance. Never sends anything anywhere — pure local read.
 */
export async function matchQuestionLocally(
  storage: VaultStorage,
  secret: string,
  queryText: string,
  catalog: CatalogQuestion[],
  opts?: { limit?: number; threshold?: number },
): Promise<MatchCandidate[]> {
  const limit = opts?.limit ?? 10
  const threshold = opts?.threshold ?? 0.05

  // Index vault versions by question scope (question_occurrence_id stores
  // the normalized archived question id for site-authored answers).
  const answers = await storage.getAll<AnswerRecord>('answers')
  const versions = await storage.getAll<VersionRecord>('versions')
  const versionById = new Map(versions.map((v) => [v.id, v]))
  const latestVersionByOccurrence = new Map<string, VersionRecord>()
  for (const a of answers) {
    const scoped = versions
      .filter((v) => v.answer_id === a.id)
      .sort((x, y) => x.created_at.localeCompare(y.created_at) || x.id.localeCompare(y.id))
    const latest = scoped.at(-1)
    if (latest) {
      latestVersionByOccurrence.set(a.scope.question_occurrence_id, latest)
    }
  }

  const scored: MatchCandidate[] = []
  for (const q of catalog) {
    const similarity = similarityScore(queryText, q.text)
    if (similarity < threshold) continue
    const local = latestVersionByOccurrence.get(q.id) ?? null
    let preview: string | null = null
    if (local && versionById.has(local.id)) {
      try {
        const { body } = await readVersion(storage, secret, local.id)
        preview = body.slice(0, 200)
      } catch {
        preview = null // decrypt failure must not break matching
      }
    }
    scored.push({
      question_id: q.id,
      question_text: q.text,
      theme: q.theme ?? null,
      significance_score: q.significance_score ?? null,
      similarity,
      confidence: confidenceOf(similarity),
      vault_version_id: local?.id ?? null,
      vault_answer_preview: preview,
      has_local_answer: Boolean(local),
    })
  }

  return scored
    .sort((a, b) => b.similarity - a.similarity || a.question_id.localeCompare(b.question_id))
    .slice(0, limit)
}

/**
 * Find which vault answers are topically closest to a question — the
 * "related answers" surface. Compares the question text to each version's
 * title+body plaintext, locally.
 */
export interface RelatedAnswer {
  answer_id: string
  version_id: string
  version_sha256: string
  title: string
  similarity: number
  confidence: 'high' | 'medium' | 'low'
  preview: string
}

export async function findRelatedVaultAnswers(
  storage: VaultStorage,
  secret: string,
  queryText: string,
  opts?: { limit?: number; threshold?: number },
): Promise<RelatedAnswer[]> {
  const limit = opts?.limit ?? 5
  const threshold = opts?.threshold ?? 0.12
  const answers = await storage.getAll<AnswerRecord>('answers')
  const versions = await storage.getAll<VersionRecord>('versions')
  const out: RelatedAnswer[] = []
  for (const a of answers) {
    const latest = versions
      .filter((v) => v.answer_id === a.id)
      .sort((x, y) => x.created_at.localeCompare(y.created_at) || x.id.localeCompare(y.id))
      .at(-1)
    if (!latest) continue
    try {
      const { title, body } = await readVersion(storage, secret, latest.id)
      const similarity = similarityScore(queryText, `${title}\n${body}`)
      if (similarity < threshold) continue
      out.push({
        answer_id: a.id,
        version_id: latest.id,
        version_sha256: latest.sha256,
        title,
        similarity,
        confidence: confidenceOf(similarity),
        preview: body.slice(0, 200),
      })
    } catch {
      // undecryptable version — skip, don't fail the whole match
    }
  }
  return out
    .sort((a, b) => b.similarity - a.similarity || a.answer_id.localeCompare(b.answer_id))
    .slice(0, limit)
}
