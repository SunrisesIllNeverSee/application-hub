'use client'

// AM-0032 — vault-side AQUAscore computation.
//
// The hosted AQUAscore (lib/aquascore.ts) is computed server-side from
// hosted profile_answers/applications — under local-first those records no
// longer reflect the user's actual bank, which lives encrypted in the
// vault. This module computes the SAME formula over vault-derived inputs
// where the field maps honestly, and zero where it does not:
//
//   applicationsStarted/Submitted — local intake applications count as
//     started (they are real application workspaces); submitted stays 0 —
//     there is no submission transport under local-first.
//   programTypesCovered — 0 (vault intake carries a vertical, not a hosted
//     program type; no conflation).
//   themesCovered — 0 (vault question occurrences do not map to hosted
//     archived_question themes without a hosted join — honest absence).
//   questionsAnswered / totalAnswers — answers with ≥1 non-empty version.
//   questionsUnlocked — 0 (hosted concept).
//   lockedConfidenceCount — human-approved versions (the vault's 'locked'
//     equivalent: a deliberate human commitment to the content).
//   solidConfidenceCount — 0 (vault approval is binary; no 'solid' state).
//   averageWordCount — computed over decrypted vault bodies.
//   stressTestCount — 0 (no stress-test lane under local-first).
//
// The result is ALWAYS labeled vault-only in the UI — never merged into
// the hosted composite (that would double-count hosted answers and
// fabricate a unified number neither dataset supports).

import { computeAquaScore, type AquaScoreInputs } from '@/lib/aquascore'
import { decryptText } from '@/lib/aqua-local/crypto'
import { compareApprovals } from '@/lib/aqua-local/repo'
import type { VaultStorage } from '@/lib/aqua-local/vault'
import type {
  AnswerRecord,
  VersionRecord,
  ApprovalRecord,
  CatalogCacheRecord,
} from '@/lib/aqua-local/schema'

export interface VaultScoreBreakdown {
  composite: number
  applications: number
  questions: number
  answers: number
  answeredCount: number
  approvedCount: number
}

export async function computeVaultScore(
  storage: VaultStorage,
  secret: string,
): Promise<VaultScoreBreakdown> {
  const [answers, versions, approvals, cache] = await Promise.all([
    storage.getAll<AnswerRecord>('answers'),
    storage.getAll<VersionRecord>('versions'),
    storage.getAll<ApprovalRecord>('approvals'),
    storage.getAll<CatalogCacheRecord>('catalog_cache'),
  ])

  const versionsByAnswer = new Map<string, VersionRecord[]>()
  for (const v of versions) {
    const list = versionsByAnswer.get(v.answer_id) ?? []
    list.push(v)
    versionsByAnswer.set(v.answer_id, list)
  }

  let answeredCount = 0
  let totalWords = 0
  let wordCountN = 0
  for (const a of answers) {
    const vs = versionsByAnswer.get(a.id) ?? []
    // Hosted semantics: averageWordCount is per-ANSWER (latest body), not
    // per-version — dividing by version count would over-weight heavily
    // edited answers vs the hosted formula.
    const latest = [...vs].sort((x, y) => x.created_at.localeCompare(y.created_at) || x.id.localeCompare(y.id)).at(-1)
    if (!latest) continue
    try {
      const body = await decryptText(secret, JSON.parse(latest.body))
      const words = body.trim().split(/\s+/).filter(Boolean).length
      if (words > 0) {
        answeredCount++
        totalWords += words
        wordCountN++
      }
    } catch {
      /* undecryptable — skip */
    }
  }

  // Latest decision wins, then exclude — mirror the freeze gate semantics
  // exactly (IR-034): LF-18 ordering, take the LATEST record, then require
  // it to be human+approved and not restored. Filtering before the latest
  // pick would let an older approval shadow a newer restored row.
  const latestByVersion = new Map<string, ApprovalRecord>()
  for (const ap of [...approvals].sort(compareApprovals)) {
    latestByVersion.set(ap.version_id, ap)
  }
  const approvedCount = [...latestByVersion.values()].filter(
    (a) => a.decision === 'approved' && a.actor_class === 'human' && !a.restored_from_backup,
  ).length

  const intakeApps = cache.filter((r) => r.key.startsWith('intake:')).length

  const inputs: AquaScoreInputs = {
    applicationsStarted: intakeApps,
    applicationsSubmitted: 0,
    programTypesCovered: 0,
    themesCovered: 0,
    questionsAnswered: answeredCount,
    questionsUnlocked: 0,
    totalAnswers: answeredCount,
    lockedConfidenceCount: approvedCount,
    solidConfidenceCount: 0,
    averageWordCount: wordCountN > 0 ? Math.round(totalWords / wordCountN) : 0,
    stressTestCount: 0,
  }
  const score = computeAquaScore(inputs)
  return { ...score, answeredCount, approvedCount }
}
