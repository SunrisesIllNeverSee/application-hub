import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5-20251001'

// ─── Source-kind enum (paste-import contract) ─────────────────────────────────

const SOURCE_KINDS = ['accelerator', 'job', 'school', 'grant', 'other'] as const
type SourceKind = (typeof SOURCE_KINDS)[number]

// ─── Mode enum ────────────────────────────────────────────────────────────────

const MODES = ['questions_only', 'qa_pairs'] as const
type Mode = (typeof MODES)[number]

// ─── Themes the LLM is allowed to emit ────────────────────────────────────────
// Spec calls for an expanded set (career_goals, why_this_school, ethics, etc.).
// The DB enum `QuestionTheme` does NOT yet include some of these — we accept
// the full spec list from the model and store them on archived_questions.theme
// only when they intersect the DB enum; otherwise we fall back to 'personal'
// for new rows. This keeps the contract flexible without breaking schema.

const SPEC_THEMES = [
  'team', 'traction', 'problem', 'solution', 'market', 'vision', 'personal',
  'fit', 'leadership', 'technical', 'career_goals', 'why_this_school',
  'ethics', 'other',
] as const
type SpecTheme = (typeof SPEC_THEMES)[number]

const DB_THEME_FALLBACK = new Map<string, string>([
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

const CONFIDENCES = ['draft', 'solid', 'locked'] as const
type Confidence = (typeof CONFIDENCES)[number]

// ─── Input validation (hand-rolled, zod isn't installed) ──────────────────────

type ParsedInput = {
  pasted_text: string
  source_kind: SourceKind
  mode: Mode
  program_name?: string
  program_url?: string
}

function validateInput(raw: unknown): ParsedInput | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Invalid request body' }
  const obj = raw as Record<string, unknown>
  const pasted = obj.pasted_text
  const kind = obj.source_kind
  const mode = obj.mode ?? 'qa_pairs'
  const programName = obj.program_name
  const programUrl = obj.program_url

  if (typeof pasted !== 'string') {
    return { error: 'pasted_text must be a string' }
  }
  if (pasted.length < 50) {
    return { error: 'pasted_text must be at least 50 characters' }
  }
  if (pasted.length > 50_000) {
    return { error: 'pasted_text must be 50,000 characters or fewer' }
  }
  if (typeof kind !== 'string' || !SOURCE_KINDS.includes(kind as SourceKind)) {
    return { error: `source_kind must be one of: ${SOURCE_KINDS.join(', ')}` }
  }
  if (typeof mode !== 'string' || !MODES.includes(mode as Mode)) {
    return { error: `mode must be one of: ${MODES.join(', ')}` }
  }
  if (programName !== undefined && typeof programName !== 'string') {
    return { error: 'program_name must be a string' }
  }
  if (programUrl !== undefined && typeof programUrl !== 'string') {
    return { error: 'program_url must be a string' }
  }

  // Reject extra top-level fields to mirror zod `.strict()`.
  const allowed = new Set(['pasted_text', 'source_kind', 'mode', 'program_name', 'program_url'])
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      return { error: `Unexpected field: ${key}` }
    }
  }

  return {
    pasted_text: pasted,
    source_kind: kind as SourceKind,
    mode: mode as Mode,
    program_name: typeof programName === 'string' && programName.length > 0 ? programName : undefined,
    program_url: typeof programUrl === 'string' && programUrl.length > 0 ? programUrl : undefined,
  }
}

// ─── LLM extraction prompts ───────────────────────────────────────────────────

const SYSTEM_PROMPT =
  'You are an expert at parsing applications — accelerator forms, job applications, school essays, grant proposals. You extract structured information from messy pasted text and return it as strict JSON.'

function buildQAPairsPrompt(text: string, sourceKind: SourceKind, programName?: string): string {
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

function buildQuestionsOnlyPrompt(text: string, sourceKind: SourceKind, programName?: string): string {
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

type ExtractedPair = {
  question_text: string
  answer_text: string
  theme: SpecTheme
  confidence: Confidence
}

type ExtractedQuestion = {
  question_text: string
  theme: SpecTheme
}

function isExtractedPair(x: unknown): x is ExtractedPair {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (typeof o.question_text !== 'string' || o.question_text.length === 0) return false
  if (typeof o.answer_text !== 'string' || o.answer_text.length < 10) return false
  if (typeof o.theme !== 'string' || !SPEC_THEMES.includes(o.theme as SpecTheme)) return false
  if (typeof o.confidence !== 'string' || !CONFIDENCES.includes(o.confidence as Confidence)) {
    return false
  }
  return true
}

function isExtractedQuestion(x: unknown): x is ExtractedQuestion {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (typeof o.question_text !== 'string' || o.question_text.length === 0) return false
  if (typeof o.theme !== 'string' || !SPEC_THEMES.includes(o.theme as SpecTheme)) return false
  return true
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function parsePairs(rawText: string): ExtractedPair[] {
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

function parseQuestions(rawText: string): ExtractedQuestion[] {
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

// ─── Fuzzy-match helper ───────────────────────────────────────────────────────
// Tries the trigram operator first (requires pg_trgm). Falls back to a simple
// case-insensitive substring search if pg_trgm is unavailable or returns 0.

async function findArchivedQuestion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  questionText: string
): Promise<{ id: string } | null> {
  const trimmed = questionText.trim()
  const head = trimmed.slice(0, 60)

  // Try a partial ILIKE on the head of the question text.
  if (head.length >= 8) {
    const { data } = await supabase
      .from('archived_questions')
      .select('id, text')
      .ilike('text', `%${head}%`)
      .limit(1)
    if (data && data.length > 0) {
      return { id: data[0].id }
    }
  }

  // Fall back to a tighter prefix match.
  const prefix = trimmed.slice(0, 30)
  if (prefix.length >= 8) {
    const { data } = await supabase
      .from('archived_questions')
      .select('id, text')
      .ilike('text', `${prefix}%`)
      .limit(1)
    if (data && data.length > 0) {
      return { id: data[0].id }
    }
  }

  return null
}

// ─── Find-or-create archived_question helper ──────────────────────────────────

async function findOrCreateArchivedQuestion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  questionText: string,
  theme: SpecTheme
): Promise<{ id: string; wasNew: boolean } | null> {
  const matched = await findArchivedQuestion(supabase, questionText)
  if (matched) return { id: matched.id, wasNew: false }

  const dbTheme = DB_THEME_FALLBACK.get(theme) ?? 'personal'

  type InsertedRow = { id: string }
  type InsertResp = { data: InsertedRow | null; error: { message?: string } | null }

  const richInsert = (await supabase
    .from('archived_questions')
    .insert({ text: questionText, theme: dbTheme, is_user_contributed: true })
    .select('id')
    .single()) as unknown as InsertResp

  if (!richInsert.error && richInsert.data) {
    return { id: richInsert.data.id, wasNew: true }
  }

  // Fallback without is_user_contributed (column may not exist yet).
  const fallbackInsert = (await supabase
    .from('archived_questions')
    .insert({ text: questionText, theme: dbTheme })
    .select('id')
    .single()) as unknown as InsertResp

  if (!fallbackInsert.error && fallbackInsert.data) {
    return { id: fallbackInsert.data.id, wasNew: true }
  }

  return null
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Input validation
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const parsed = validateInput(body)
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { pasted_text, source_kind, mode, program_name } = parsed

    // 2. AI config — fail closed if no platform key.
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI extraction not configured' },
        { status: 503 }
      )
    }
    const anthropic = new Anthropic({ apiKey })

    // 3. Call Claude — prompt differs by mode
    let llmErrorText: string | null = null
    let pairs: ExtractedPair[] = []
    let questions: ExtractedQuestion[] = []

    try {
      if (mode === 'questions_only') {
        const message = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildQuestionsOnlyPrompt(pasted_text, source_kind, program_name) }],
        })
        const raw = message.content[0]?.type === 'text' ? message.content[0].text : '[]'
        questions = parseQuestions(raw)
      } else {
        const message = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildQAPairsPrompt(pasted_text, source_kind, program_name) }],
        })
        const raw = message.content[0]?.type === 'text' ? message.content[0].text : '[]'
        pairs = parsePairs(raw)
      }
    } catch (err) {
      llmErrorText =
        err instanceof Error ? err.message : 'Unknown error calling Anthropic'
      console.error('[/api/import/paste] Anthropic call failed:', err)
    }

    const rawItemCount = mode === 'questions_only' ? questions.length : pairs.length

    // 4. Record the import session (always — even on LLM failure).
    type SessionRow = { id: string }
    const sessionInsertResult = await supabase
      .from('app_import_sessions')
      .insert({
        user_id: user.id,
        source_kind,
        raw_text: pasted_text,
        extracted_count: rawItemCount,
        error_text: llmErrorText,
      })
      .select('id')
      .single<SessionRow>()

    const sessionId = sessionInsertResult.data?.id ?? null
    if (sessionInsertResult.error) {
      console.error('[/api/import/paste] session insert failed:', sessionInsertResult.error)
    }

    if (llmErrorText) {
      return NextResponse.json(
        { error: 'AI extraction failed — please try again', session_id: sessionId },
        { status: 502 }
      )
    }

    // 5. Process items based on mode.
    type ResultItem = {
      question_text: string
      theme: string
      was_new_question: boolean
      was_new_answer: boolean
    }
    const items: ResultItem[] = []

    if (mode === 'questions_only') {
      // Questions-only: find-or-create archived_question + unlock. No profile_answer.
      for (const q of questions) {
        const result = await findOrCreateArchivedQuestion(supabase, q.question_text, q.theme)
        if (!result) {
          items.push({ question_text: q.question_text, theme: q.theme, was_new_question: false, was_new_answer: false })
          continue
        }

        const { data: existingUnlock } = await supabase
          .from('user_question_unlocks')
          .select('id')
          .eq('user_id', user.id)
          .eq('archived_question_id', result.id)
          .maybeSingle()
        if (!existingUnlock) {
          await supabase.from('user_question_unlocks').insert({
            user_id: user.id,
            archived_question_id: result.id,
            source: 'manual',
          })
        }

        items.push({
          question_text: q.question_text,
          theme: q.theme,
          was_new_question: result.wasNew,
          was_new_answer: false,
        })
      }
    } else {
      // QA pairs: find-or-create archived_question, upsert profile_answer, unlock.
      for (const pair of pairs) {
        const result = await findOrCreateArchivedQuestion(supabase, pair.question_text, pair.theme)
        if (!result) {
          items.push({ question_text: pair.question_text, theme: pair.theme, was_new_question: false, was_new_answer: false })
          continue
        }

        // Insert profile_answer ONLY if the user has no existing answer.
        const { data: existingAnswer } = await supabase
          .from('profile_answers')
          .select('id')
          .eq('user_id', user.id)
          .eq('archived_question_id', result.id)
          .maybeSingle()

        let wasNewAnswer = false
        if (!existingAnswer) {
          const wordCount = pair.answer_text.trim().split(/\s+/).filter(Boolean).length
          const { error: paErr } = await supabase
            .from('profile_answers')
            .insert({
              user_id: user.id,
              archived_question_id: result.id,
              answer_content: pair.answer_text,
              content: pair.answer_text,
              question_text: '',
              word_count: wordCount,
              confidence: pair.confidence,
            })
          if (!paErr) {
            wasNewAnswer = true
          } else {
            console.error('[/api/import/paste] profile_answer insert failed:', paErr)
          }
        }

        // Record an unlock (idempotent via UNIQUE constraint).
        const { data: existingUnlock } = await supabase
          .from('user_question_unlocks')
          .select('id')
          .eq('user_id', user.id)
          .eq('archived_question_id', result.id)
          .maybeSingle()
        if (!existingUnlock) {
          await supabase.from('user_question_unlocks').insert({
            user_id: user.id,
            archived_question_id: result.id,
            source: 'manual',
          })
        }

        items.push({
          question_text: pair.question_text,
          theme: pair.theme,
          was_new_question: result.wasNew,
          was_new_answer: wasNewAnswer,
        })
      }
    }

    // For questions_only: count = total questions unlocked.
    // For qa_pairs: count = new answers saved.
    const extractedCount = mode === 'questions_only'
      ? items.length
      : items.filter((i) => i.was_new_answer).length

    // 6. Update session row with the actual saved count.
    if (sessionId) {
      await supabase
        .from('app_import_sessions')
        .update({ extracted_count: extractedCount })
        .eq('id', sessionId)
    }

    return NextResponse.json({
      session_id: sessionId,
      extracted_count: extractedCount,
      items,
      mode,
    })
  } catch (err) {
    console.error('[/api/import/paste] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
