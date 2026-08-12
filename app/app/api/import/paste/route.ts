import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  MODEL,
  SYSTEM_PROMPT,
  SOURCE_KINDS,
  MODES,
  buildQAPairsPrompt,
  buildQuestionsOnlyPrompt,
  parsePairs,
  parseQuestions,
  parseStructuredText,
  resolveAnthropicClient,
  loadEmbeddingIntegrations,
  findOrCreateArchivedQuestion,
  type SourceKind,
  type Mode,
  type ExtractedPair,
  type ExtractedQuestion,
} from '@/lib/intake-extract'

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

    // 2. AI config — BYOK first, then platform key.
    const anthropic = await resolveAnthropicClient(supabase, user.id)

    // No Anthropic key — fall back to regex parser if mode is qa_pairs.
    // Questions-only mode still needs AI for theme classification.
    const useRegexFallback = !anthropic && mode === 'qa_pairs'

    if (!anthropic && mode === 'questions_only') {
      return NextResponse.json(
        { error: 'Questions-only mode requires AI. Connect Anthropic in Profile → Integrations or paste in Q:/A: format.' },
        { status: 503 }
      )
    }

    // 3. Call Claude — prompt differs by mode
    let llmErrorText: string | null = null
    let pairs: ExtractedPair[] = []
    let questions: ExtractedQuestion[] = []

    try {
      if (useRegexFallback) {
        // No AI configured — use deterministic regex parser
        pairs = parseStructuredText(pasted_text)
        if (pairs.length === 0) {
          llmErrorText = 'No Q&A pairs detected. Format your text as "Q: ... / A: ..." or "Question: ... / Answer: ...", or use Markdown headers.'
        }
      } else if (anthropic && mode === 'questions_only') {
        const message = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildQuestionsOnlyPrompt(pasted_text, source_kind, program_name) }],
        })
        const raw = message.content[0]?.type === 'text' ? message.content[0].text : '[]'
        questions = parseQuestions(raw)
      } else if (anthropic) {
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
      console.error('[/api/import/paste] extraction failed:', err)
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
    const embedByok = await loadEmbeddingIntegrations(supabase, user.id)

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
        const result = await findOrCreateArchivedQuestion(supabase, q.question_text, q.theme, embedByok)
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
        const result = await findOrCreateArchivedQuestion(supabase, pair.question_text, pair.theme, embedByok)
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
