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

export const MODEL = 'claude-haiku-4-5-20251001'

// ─── Enums / contracts ────────────────────────────────────────────────────────

export const SOURCE_KINDS = ['accelerator', 'job', 'school', 'grant', 'other'] as const
export type SourceKind = (typeof SOURCE_KINDS)[number]

export const MODES = ['questions_only', 'qa_pairs'] as const
export type Mode = (typeof MODES)[number]

export const SPEC_THEMES = [
  'team', 'traction', 'problem', 'solution', 'market', 'vision', 'personal',
  'fit', 'leadership', 'technical', 'career_goals', 'why_this_school',
  'ethics', 'other',
] as const
export type SpecTheme = (typeof SPEC_THEMES)[number]

export const DB_THEME_FALLBACK = new Map<string, string>([
  ['team', 'team'],
  ['traction', 'traction'],
  ['problem', 'problem'],
  ['solution', 'solution'],
  ['market', 'market'],
  ['vision', 'vision'],
  ['personal', 'personal'],
  ['fit', 'fit'],
  ['leadership', 'team'],
  ['technical', 'technical'],
  ['career_goals', 'vision'],
  ['why_this_school', 'fit'],
  ['ethics', 'personal'],
  ['other', 'personal'],
])

export const CONFIDENCES = ['draft', 'solid', 'locked'] as const
export type Confidence = (typeof CONFIDENCES)[number]

export type ExtractedPair = {
  question_text: string
  answer_text: string
  theme: SpecTheme
  confidence: Confidence
}

export type ExtractedQuestion = {
  question_text: string
  theme: SpecTheme
}

// ─── LLM extraction prompts ───────────────────────────────────────────────────

export const SYSTEM_PROMPT =
  'You are an expert at parsing applications — accelerator forms, job applications, school essays, grant proposals. You extract structured information from messy pasted text and return it as strict JSON.'

export function buildQAPairsPrompt(text: string, sourceKind: SourceKind, programName?: string): string {
  return `Source: ${sourceKind}${programName ? ` — ${programName}` : ''}

Find every distinct question-answer pair in the application text below. A "pair" is any place the applicant was asked something — explicitly (e.g. "Q: ...", "1. Tell us...", "Why X?") or implicitly (e.g. a labeled section like "Summary:" followed by content the applicant wrote). Include cover-letter paragraphs and resume sections as Q&A pairs where the section heading is the implicit question.

For each pair, output an object with these exact fields:

- "question_text": the question as asked, cleaned up (no "Q:" prefix, no numbering). If the question is implicit, write a natural-language version. Max 280 chars.
- "answer_text": the applicant's full answer text, verbatim. Preserve paragraph breaks. Do not summarize.
- "theme": ONE of: team, traction, problem, solution, market, vision, personal, fit, leadership, technical, career_goals, why_this_school, ethics, other. Pick the single best fit.
- "confidence": ONE of: draft, solid, locked. Default to "draft" for short or rough answers, "solid" for complete and polished answers, and "locked" only for answers that look final-form and well-edited.

Output rules:
- Return ONLY a JSON array. No prose, no markdown fences, no commentary.
- Empty array [] if there are no extractable pairs.
- Skip pairs where the answer is blank or under 10 characters.
- Skip duplicate questions; merge their answers into one pair.

Application text:
"""
${text}
"""`
}

export function buildQuestionsOnlyPrompt(text: string, sourceKind: SourceKind, programName?: string): string {
  return `Source: ${sourceKind}${programName ? ` — ${programName}` : ''}

Extract every distinct question from this application form. Questions may be:
- Explicitly labeled ("1.", "Q:", "Tell us...", "Why...?")
- Section headings followed by a blank space the applicant fills in
- Essay prompts or short answer prompts

For each question output an object with:
- "question_text": the question exactly as written, cleaned (no numbering, no "Q:"). Max 300 chars.
- "theme": ONE of: team, traction, problem, solution, market, vision, personal, fit, leadership, technical, career_goals, why_this_school, ethics, other

Rules:
- Return ONLY a JSON array. No prose, no markdown.
- Skip logistics questions (name, email, phone, address, company website).
- Deduplicate — if the same question appears twice, include it once.
- Empty array [] if no extractable questions found.

Application text:
"""
${text}
"""`
}

// ─── Output validation ────────────────────────────────────────────────────────

export function isExtractedPair(x: unknown): x is ExtractedPair {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (typeof o.question_text !== 'string' || o.question_text.length === 0) return false
  if (typeof o.answer_text !== 'string' || o.answer_text.length < 10) return false
  if (typeof o.theme !== 'string' || !SPEC_THEMES.includes(o.theme as SpecTheme)) return false
  if (typeof o.confidence !== 'string' || !CONFIDENCES.includes(o.confidence as Confidence)) return false
  return true
}

export function isExtractedQuestion(x: unknown): x is ExtractedQuestion {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (typeof o.question_text !== 'string' || o.question_text.length === 0) return false
  if (typeof o.theme !== 'string' || !SPEC_THEMES.includes(o.theme as SpecTheme)) return false
  return true
}

export function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

export function parsePairs(rawText: string): ExtractedPair[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFences(rawText))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const out: ExtractedPair[] = []
  for (const item of parsed) {
    if (isExtractedPair(item)) out.push(item)
  }
  return out
}

export function parseQuestions(rawText: string): ExtractedQuestion[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFences(rawText))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const out: ExtractedQuestion[] = []
  for (const item of parsed) {
    if (isExtractedQuestion(item)) out.push(item)
  }
  return out
}

// ─── Regex-based structured parser (no AI required) ──────────────────────────

export function parseStructuredText(text: string): ExtractedPair[] {
  const cleaned = text.replace(/\r\n/g, '\n').trim()
  if (!cleaned) return []

  const pairs: ExtractedPair[] = []

  const qaRegex = /(?:^|\n)\s*(?:\*\*)?\s*(?:Q|Question)(?:\*\*)?\s*[:\.]\s*([\s\S]*?)\n\s*(?:\*\*)?\s*(?:A|Answer)(?:\*\*)?\s*[:\.]\s*([\s\S]*?)(?=\n\s*(?:\*\*)?\s*(?:Q|Question)(?:\*\*)?\s*[:\.]|$)/gi

  let m: RegExpExecArray | null
  while ((m = qaRegex.exec(cleaned)) !== null) {
    const q = m[1].trim().replace(/\s+/g, ' ')
    const a = m[2].trim()
    if (q.length > 0 && a.length >= 10) {
      pairs.push({ question_text: q, answer_text: a, theme: 'personal', confidence: 'draft' })
    }
  }
  if (pairs.length > 0) return pairs

  const mdRegex = /(?:^|\n)#{1,3}\s+(.+?)\n+([\s\S]+?)(?=\n#{1,3}\s+|$)/g
  while ((m = mdRegex.exec(cleaned)) !== null) {
    const q = m[1].trim().replace(/\?$/, '?').replace(/\s+/g, ' ')
    const a = m[2].trim()
    if (q.length > 0 && a.length >= 10) {
      pairs.push({
        question_text: q.endsWith('?') ? q : q + '?',
        answer_text: a,
        theme: 'personal',
        confidence: 'draft',
      })
    }
  }
  if (pairs.length > 0) return pairs

  const blocks = cleaned.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean)
  for (let i = 0; i < blocks.length - 1; i++) {
    const possibleQ = blocks[i].replace(/^\d+[\.\)]\s*/, '').trim()
    if (possibleQ.endsWith('?') && possibleQ.length < 500) {
      const possibleA = blocks[i + 1].replace(/^\d+[\.\)]\s*/, '').trim()
      if (possibleA.length >= 10 && !possibleA.endsWith('?')) {
        pairs.push({
          question_text: possibleQ.replace(/\s+/g, ' '),
          answer_text: possibleA,
          theme: 'personal',
          confidence: 'draft',
        })
        i++
      }
    }
  }

  return pairs
}

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

async function findArchivedQuestion(
  supabase: SupabaseLike,
  questionText: string
): Promise<{ id: string } | null> {
  const trimmed = questionText.trim()
  const head = trimmed.slice(0, 60)

  if (head.length >= 8) {
    const { data } = await supabase
      .from('archived_questions')
      .select('id, text')
      .ilike('text', `%${head}%`)
      .limit(1)
    if (data && data.length > 0) return { id: data[0].id }
  }

  const prefix = trimmed.slice(0, 30)
  if (prefix.length >= 8) {
    const { data } = await supabase
      .from('archived_questions')
      .select('id, text')
      .ilike('text', `${prefix}%`)
      .limit(1)
    if (data && data.length > 0) return { id: data[0].id }
  }

  return null
}

export async function findOrCreateArchivedQuestion(
  supabase: SupabaseLike,
  questionText: string,
  theme: SpecTheme,
  embedByok?: ByokIntegration[] | null
): Promise<{ id: string; wasNew: boolean } | null> {
  const matched = await findArchivedQuestion(supabase, questionText)
  if (matched) return { id: matched.id, wasNew: false }

  const dbTheme = DB_THEME_FALLBACK.get(theme) ?? 'personal'

  type InsertedRow = { id: string }
  type InsertResp = { data: InsertedRow | null; error: { message?: string } | null }

  const richInsert = (await supabase
    .from('archived_questions')
    .insert({ text: questionText, theme: dbTheme })
    .select('id')
    .single()) as unknown as InsertResp

  let created: InsertedRow | null = null
  if (!richInsert.error && richInsert.data) {
    created = richInsert.data
  } else {
    const fallbackInsert = (await supabase
      .from('archived_questions')
      .insert({ text: questionText, theme: dbTheme })
      .select('id')
      .single()) as unknown as InsertResp
    if (!fallbackInsert.error && fallbackInsert.data) created = fallbackInsert.data
  }

  if (!created) return null

  // Flywheel: a new question without an embedding is invisible to future
  // matching. Best-effort — never block intake on embedding availability.
  await embedAndStoreQuestion(supabase, created.id, questionText, embedByok)

  return { id: created.id, wasNew: true }
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
