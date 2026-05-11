import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5-20251001'

// ─── Source-kind enum (paste-import contract) ─────────────────────────────────

const SOURCE_KINDS = ['accelerator', 'job', 'school', 'grant', 'other'] as const
type SourceKind = (typeof SOURCE_KINDS)[number]

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

type ParsedInput = { pasted_text: string; source_kind: SourceKind }

function validateInput(raw: unknown): ParsedInput | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Invalid request body' }
  const obj = raw as Record<string, unknown>
  const pasted = obj.pasted_text
  const kind = obj.source_kind

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

  // Reject extra top-level fields to mirror zod `.strict()`.
  for (const key of Object.keys(obj)) {
    if (key !== 'pasted_text' && key !== 'source_kind') {
      return { error: `Unexpected field: ${key}` }
    }
  }

  return { pasted_text: pasted, source_kind: kind as SourceKind }
}

// ─── LLM extraction prompt ────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  'You are an expert at parsing applications — accelerator forms, job applications, school essays, grant proposals. You extract clean question-answer pairs from messy pasted text and return them as strict JSON.'

function buildUserPrompt(text: string, sourceKind: SourceKind): string {
  return `Source kind: ${sourceKind}

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

// ─── Output validation ────────────────────────────────────────────────────────

type ExtractedPair = {
  question_text: string
  answer_text: string
  theme: SpecTheme
  confidence: Confidence
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

function parsePairs(rawText: string): ExtractedPair[] {
  const stripped = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
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

// ─── Fuzzy-match helper ───────────────────────────────────────────────────────
// Tries the trigram operator first (requires pg_trgm). Falls back to a simple
// case-insensitive substring search if pg_trgm is unavailable or returns 0.

async function findArchivedQuestion(
  supabase: ReturnType<typeof createClient>,
  questionText: string
): Promise<{ id: string } | null> {
  // 1) Trigram similarity via the % operator + similarity() function. We use
  //    raw SQL via .rpc(...) only if a helper exists; otherwise fall through.
  //    Since we don't ship an RPC for this, jump straight to ILIKE.

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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
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
    const { pasted_text, source_kind } = parsed

    // 2. AI config — fail closed if no platform key (paste-import is a
    //    platform-side AI call; BYOK can be layered in later).
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI extraction not configured' },
        { status: 503 }
      )
    }
    const anthropic = new Anthropic({ apiKey })

    // 3. Call Claude
    let pairs: ExtractedPair[] = []
    let llmErrorText: string | null = null
    try {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(pasted_text, source_kind) }],
      })
      const raw = message.content[0]?.type === 'text' ? message.content[0].text : '[]'
      pairs = parsePairs(raw)
    } catch (err) {
      llmErrorText =
        err instanceof Error ? err.message : 'Unknown error calling Anthropic'
      console.error('[/api/import/paste] Anthropic call failed:', err)
    }

    // 4. Record the import session (always — even on LLM failure, so the
    //    user has a trace of what they tried).
    type SessionRow = { id: string }
    const sessionInsertResult = await supabase
      .from('app_import_sessions')
      .insert({
        user_id: user.id,
        source_kind,
        raw_text: pasted_text,
        extracted_count: pairs.length,
        error_text: llmErrorText,
      })
      .select('id')
      .single<SessionRow>()

    const sessionId = sessionInsertResult.data?.id ?? null
    if (sessionInsertResult.error) {
      console.error(
        '[/api/import/paste] session insert failed:',
        sessionInsertResult.error
      )
    }

    if (llmErrorText) {
      return NextResponse.json(
        { error: 'AI extraction failed — please try again', session_id: sessionId },
        { status: 502 }
      )
    }

    // 5. For each pair: find-or-create archived_question, upsert profile_answer
    //    (DO NOTHING on conflict), and record an unlock.
    type ResultItem = {
      question_text: string
      theme: string
      was_new_question: boolean
      was_new_answer: boolean
    }
    const items: ResultItem[] = []

    for (const pair of pairs) {
      // 5a. Match or create archived_question
      let archivedId: string | null = null
      let wasNewQuestion = false

      const matched = await findArchivedQuestion(supabase, pair.question_text)
      if (matched) {
        archivedId = matched.id
      } else {
        const dbTheme = DB_THEME_FALLBACK.get(pair.theme) ?? 'personal'

        // Try insert with is_user_contributed; fall back if column missing.
        type InsertedRow = { id: string }
        type InsertResp = { data: InsertedRow | null; error: { message?: string } | null }
        const richInsert = (await supabase
          .from('archived_questions')
          .insert({
            text: pair.question_text,
            theme: dbTheme,
            is_user_contributed: true,
          })
          .select('id')
          .single()) as unknown as InsertResp

        if (richInsert.error || !richInsert.data) {
          const fallbackInsert = (await supabase
            .from('archived_questions')
            .insert({
              text: pair.question_text,
              theme: dbTheme,
            })
            .select('id')
            .single()) as unknown as InsertResp
          if (!fallbackInsert.error && fallbackInsert.data) {
            archivedId = fallbackInsert.data.id
            wasNewQuestion = true
          }
        } else {
          archivedId = richInsert.data.id
          wasNewQuestion = true
        }
      }

      if (!archivedId) {
        items.push({
          question_text: pair.question_text,
          theme: pair.theme,
          was_new_question: false,
          was_new_answer: false,
        })
        continue
      }

      // 5b. Insert profile_answer ONLY if the user has no existing answer.
      const { data: existingAnswer } = await supabase
        .from('profile_answers')
        .select('id')
        .eq('user_id', user.id)
        .eq('archived_question_id', archivedId)
        .maybeSingle()

      let wasNewAnswer = false
      if (!existingAnswer) {
        const wordCount = pair.answer_text.trim().split(/\s+/).filter(Boolean).length
        const { error: paErr } = await supabase
          .from('profile_answers')
          .insert({
            user_id: user.id,
            archived_question_id: archivedId,
            content: pair.answer_text,
            word_count: wordCount,
            confidence: pair.confidence,
          })
        if (!paErr) {
          wasNewAnswer = true
        } else {
          console.error('[/api/import/paste] profile_answer insert failed:', paErr)
        }
      }

      // 5c. Record an unlock (idempotent via UNIQUE constraint).
      const { data: existingUnlock } = await supabase
        .from('user_question_unlocks')
        .select('id')
        .eq('user_id', user.id)
        .eq('archived_question_id', archivedId)
        .maybeSingle()
      if (!existingUnlock) {
        await supabase.from('user_question_unlocks').insert({
          user_id: user.id,
          archived_question_id: archivedId,
          source: 'manual',
        })
      }

      items.push({
        question_text: pair.question_text,
        theme: pair.theme,
        was_new_question: wasNewQuestion,
        was_new_answer: wasNewAnswer,
      })
    }

    const extractedCount = items.filter((i) => i.was_new_answer).length

    // 6. Update session row with the actual saved-answer count (cheap correction).
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
    })
  } catch (err) {
    console.error('[/api/import/paste] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
