// Shared intake + extraction library.
//
// Used by: /api/import/paste (existing), /api/applications/intake (one-call
// application intake), and scripts/import-qaapplication-corpus.ts mirrors its
// find-or-create contract.
//
// Everything here was extracted verbatim from app/api/import/paste/route.ts
// during the pound-out sprint — behavior preserved, plus embed-on-create for
// newly archived questions so the match flywheel keeps working.

import Anthropic from '@anthropic-ai/sdk'
import { decryptKey } from '@/lib/encryption'
import { embedAndStoreQuestion, type ByokIntegration } from '@/lib/embed'
import { normalizeQuestion } from '@/lib/catalog/normalize'
import { matchOccurrence, type CatalogQuestion, type MatchResult, type MatchTier } from '@/lib/catalog/match'

export const MODEL = 'claude-haiku-4-5-20251001'

// ─── Pure contract ────────────────────────────────────────────────────────────
// All pure pieces (enums, types, prompts, validators, deterministic parsers)
// live in lib/intake-extract-shared.ts — client-safe, no server deps.
// Re-exported here so existing callers' imports keep working.

import {
  SYSTEM_PROMPT, buildQuestionsOnlyPrompt, isExtractedQuestion,
  stripJsonFences, DB_THEME_FALLBACK,
} from './intake-extract-shared'
import type {
  SourceKind, SpecTheme, ExtractedQuestion, ExtractedPair, Confidence,
} from './intake-extract-shared'
export * from './intake-extract-shared'

// ─── AI provider resolution (BYOK first, platform fallback) ──────────────────

type SupabaseLike = { from: (t: string) => any }

export async function resolveAnthropicClient(
  supabase: SupabaseLike,
  userId: string
): Promise<Anthropic | null> {
  const { data: integrations } = await supabase
    .from('user_integrations')
    .select('key_encrypted, key_storage_ref')
    .eq('user_id', userId)
    .eq('provider', 'anthropic')
    .eq('status', 'active')
    .limit(1)

  if (integrations?.[0]?.key_encrypted && integrations[0]?.key_storage_ref) {
    try {
      const apiKey = decryptKey(integrations[0].key_encrypted, integrations[0].key_storage_ref)
      if (apiKey) return new Anthropic({ apiKey })
    } catch {
      // fall through to platform key
    }
  }

  const platformKey = process.env.ANTHROPIC_API_KEY
  return platformKey ? new Anthropic({ apiKey: platformKey }) : null
}

// ─── Groq (Llama) extraction fallback ───────────────────────────────────────

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? ''
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'

export async function extractQuestionsWithGroq(
  text: string,
  sourceKind: SourceKind,
  programName: string
): Promise<ExtractedQuestion[]> {
  if (!GROQ_API_KEY) return []

  const prompt = buildQuestionsOnlyPrompt(text, sourceKind, programName)
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 4096,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data.choices?.[0]?.message?.content ?? '[]'
    // Groq json_object mode may wrap array in {questions: [...]}
    let parsed: unknown
    try {
      parsed = JSON.parse(stripJsonFences(raw))
    } catch {
      return []
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>
      for (const key of ['questions', 'data', 'results', 'items']) {
        if (Array.isArray(obj[key])) { parsed = obj[key]; break }
      }
    }
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isExtractedQuestion)
  } catch {
    return []
  }
}

export async function loadEmbeddingIntegrations(
  supabase: SupabaseLike,
  userId: string
): Promise<ByokIntegration[]> {
  const { data } = await supabase
    .from('user_integrations')
    .select('provider, base_url, model_preference, key_encrypted, key_storage_ref')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('provider', ['ollama', 'openai'])

  return (data ?? []).map((row: any) => ({
    provider: row.provider,
    base_url: row.base_url,
    model_preference: row.model_preference,
    decrypted_key:
      row.provider === 'openai' && row.key_encrypted
        ? (() => {
            try {
              return decryptKey(row.key_encrypted, row.key_storage_ref)
            } catch {
              return null
            }
          })()
        : null,
  }))
}

// ─── Archived question find-or-create (with embed-on-create) ─────────────────
//
// M09 W2: the old ILIKE first-60/first-30-char prefix lookup returned the
// FIRST hit and merged silently (false-merge risk: "Tell us about your team"
// would swallow "Tell us about your team's hiring plan"). Candidates are now
// only RETRIEVED by ILIKE; the decision is made by the tiered matcher in
// lib/catalog/match.ts:
//   exact / normalized (unambiguous) → link the existing canonical question
//   semantic / ambiguous / near miss → insert a NEW canonical question and
//                                      report the decision as needs_review
//   novel                             → insert a new canonical question

export type ArchivedQuestionDecision = {
  tier: MatchTier
  needs_review: boolean
  /** existing canonical the occurrence resembles (semantic / near miss), never auto-linked */
  candidate_question_id: string | null
  confidence: number
  reasons: string[]
  differences: MatchResult['differences']
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}

async function findArchivedQuestionCandidates(
  supabase: SupabaseLike,
  questionText: string
): Promise<CatalogQuestion[]> {
  const trimmed = questionText.trim()
  const core = normalizeQuestion(trimmed).core
  const patterns = new Set<string>()
  const head = trimmed.slice(0, 60)
  if (head.length >= 8) patterns.add(`%${escapeLike(head)}%`)
  const corePrefix = core.replace(/[\s?.!:;,*]+$/, '').slice(0, 40)
  if (corePrefix.length >= 8) patterns.add(`${escapeLike(corePrefix)}%`)
  const prefix = trimmed.slice(0, 30)
  if (prefix.length >= 8) patterns.add(`${escapeLike(prefix)}%`)

  const byId = new Map<string, CatalogQuestion>()
  for (const pattern of patterns) {
    const { data } = await supabase
      .from('archived_questions')
      .select('id, text, typical_word_limit')
      .ilike('text', pattern)
      .limit(25)
    for (const row of (data ?? []) as Array<{ id: string; text: string; typical_word_limit?: number | null }>) {
      if (!byId.has(row.id)) byId.set(row.id, { id: row.id, text: row.text })
    }
  }
  return [...byId.values()]
}

/** Decide (read-only) whether an occurrence links to an existing canonical question. */
export async function decideArchivedQuestion(
  supabase: SupabaseLike,
  questionText: string
): Promise<{ linkId: string | null; decision: ArchivedQuestionDecision }> {
  const candidates = await findArchivedQuestionCandidates(supabase, questionText)
  const m = matchOccurrence({ asked_as: questionText }, candidates)
  const linkable = (m.tier === 'exact' || m.tier === 'normalized') && m.auto_link && !!m.canonical_question_id
  return {
    linkId: linkable ? m.canonical_question_id! : null,
    decision: {
      tier: m.tier,
      needs_review: m.needs_review || m.tier === 'semantic',
      candidate_question_id: linkable ? null : m.canonical_question_id ?? m.candidates[0]?.id ?? null,
      confidence: m.confidence,
      reasons: m.reasons,
      differences: m.differences,
    },
  }
}

export async function findOrCreateArchivedQuestion(
  supabase: SupabaseLike,
  questionText: string,
  theme: SpecTheme,
  embedByok?: ByokIntegration[] | null
): Promise<{ id: string; wasNew: boolean; decision: ArchivedQuestionDecision } | null> {
  const { linkId, decision } = await decideArchivedQuestion(supabase, questionText)
  if (linkId) return { id: linkId, wasNew: false, decision }

  const dbTheme = DB_THEME_FALLBACK.get(theme) ?? 'personal'

  type InsertedRow = { id: string }
  type InsertResp = { data: InsertedRow | null; error: { message?: string } | null }

  const insert = (await supabase
    .from('archived_questions')
    .insert({ text: questionText, theme: dbTheme })
    .select('id')
    .single()) as unknown as InsertResp

  if (insert.error || !insert.data) return null
  const created = insert.data

  // Flywheel: a new question without an embedding is invisible to future
  // matching. Best-effort — never block intake on embedding availability.
  await embedAndStoreQuestion(supabase, created.id, questionText, embedByok)

  return { id: created.id, wasNew: true, decision }
}

// ─── Program find-or-create ───────────────────────────────────────────────────

export function slugifyProgramName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

const SOURCE_KIND_TO_PROGRAM_TYPE: Record<SourceKind, string> = {
  accelerator: 'accel',
  grant: 'grant',
  job: 'job',
  school: 'uni',
  other: 'other',
}

const SOURCE_KIND_TO_OPPORTUNITY_KIND: Record<SourceKind, string> = {
  accelerator: 'accelerator',
  grant: 'grant',
  job: 'job_fulltime',
  school: 'other',
  other: 'other',
}

export async function findOrCreateProgram(
  supabase: SupabaseLike,
  opts: {
    name: string
    organization?: string
    applyUrl?: string
    sourceKind?: SourceKind
    programType?: string
    opportunityKind?: string
  }
): Promise<{ id: string; slug: string; wasNew: boolean } | null> {
  const slug = slugifyProgramName(opts.name)
  if (!slug) return null

  const { data: existing } = await supabase
    .from('programs')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle()
  if (existing) return { id: existing.id, slug: existing.slug, wasNew: false }

  const sourceKind = opts.sourceKind ?? 'other'
  const insert = {
    name: opts.name,
    organization: opts.organization ?? opts.name,
    slug,
    type: opts.programType ?? SOURCE_KIND_TO_PROGRAM_TYPE[sourceKind],
    kind: opts.opportunityKind ?? SOURCE_KIND_TO_OPPORTUNITY_KIND[sourceKind],
    apply_url: opts.applyUrl ?? null,
  }

  const { data, error } = await supabase
    .from('programs')
    .insert(insert)
    .select('id, slug')
    .single()
  if (error || !data) return null

  return { id: data.id, slug: data.slug, wasNew: true }
}
