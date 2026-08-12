import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  MODEL,
  SYSTEM_PROMPT,
  SOURCE_KINDS,
  buildQuestionsOnlyPrompt,
  parseQuestions,
  parseStructuredText,
  resolveAnthropicClient,
  extractQuestionsWithGroq,
  loadEmbeddingIntegrations,
  findOrCreateArchivedQuestion,
  findOrCreateProgram,
  type SourceKind,
  type ExtractedQuestion,
} from '@/lib/intake-extract'

// ============================================================
// POST /api/applications/intake
// ============================================================
// The pound-out loop, step 1: grab an application.
//
// One call: paste the raw application text → the source is archived
// (app_import_sessions), the program is indexed (programs), every question
// is indexed individually (archived_questions + program_questions with the
// exact wording in asked_as), questions are embedded for matching, and a
// user_applications row is opened so the workspace lights up.
//
// Then: /api/applications/[id]/fill fills it from the answer bank.
//
// Request:  {
//   program_name: string (required)
//   program_url?: string
//   text: string (required, the raw application form/questions)
//   source_kind?: accelerator | job | school | grant | other
//   program_type?: program_type enum override (e.g. 'vc')
//   organization?: string (defaults to program_name)
// }
// Response: { program_id, program_slug, application_id, question_count,
//             new_questions, reused_questions, extraction, workspace_url }
// ============================================================

export async function POST(req: NextRequest) {
  try {
    // Auth: session cookie (browser) OR Authorization: Bearer <jwt> (extension/MCP)
    const authHeader = req.headers.get('authorization')
    let supabase = await createClient()
    let user = (await supabase.auth.getUser()).data.user

    if (!user && authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.slice(7)
      // Try Supabase auth API first, then fall back to local JWKS verification
      // (Supabase has a known bug rejecting ES256 JWTs via /auth/v1/user)
      const { createClient: createBrowserClient } = await import('@supabase/supabase-js').then(m => m)
      const extClient = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${jwt}` } } }
      )
      const { data } = await extClient.auth.getUser(jwt)
      if (data.user) {
        user = data.user
        supabase = extClient as typeof supabase
      } else {
        // Local JWKS verification fallback for ES256 tokens
        const { verifySupabaseJWT } = await import('@/lib/verify-jwt')
        const verified = await verifySupabaseJWT(jwt)
        user = { id: verified.id, email: verified.email } as unknown as typeof user
        supabase = extClient as typeof supabase
      }
    }

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { program_name, program_url, text, source_kind, program_type, organization } =
      body as Record<string, unknown>

    if (typeof program_name !== 'string' || program_name.trim().length < 2) {
      return NextResponse.json({ error: 'program_name is required' }, { status: 400 })
    }
    if (typeof text !== 'string' || text.length < 50) {
      return NextResponse.json({ error: 'text must be at least 50 characters' }, { status: 400 })
    }
    if (text.length > 50_000) {
      return NextResponse.json({ error: 'text must be 50,000 characters or fewer' }, { status: 400 })
    }
    const sourceKind: SourceKind =
      typeof source_kind === 'string' && SOURCE_KINDS.includes(source_kind as SourceKind)
        ? (source_kind as SourceKind)
        : 'other'

    // ── 1. Extract questions ────────────────────────────────────────────────
    const anthropic = await resolveAnthropicClient(supabase, user.id)
    let questions: ExtractedQuestion[] = []
    let extraction: 'ai' | 'regex' = 'regex'
    let extractionError: string | null = null

    if (anthropic) {
      try {
        const message = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [
            { role: 'user', content: buildQuestionsOnlyPrompt(text, sourceKind, program_name) },
          ],
        })
        const raw = message.content[0]?.type === 'text' ? message.content[0].text : '[]'
        questions = parseQuestions(raw)
        extraction = 'ai'
        if (questions.length === 0) extractionError = 'AI extraction returned no questions'
      } catch (err) {
        extractionError = err instanceof Error ? err.message : 'AI extraction failed'
      }
    }

    // Groq fallback (if Anthropic not configured or failed)
    if (questions.length === 0) {
      const groqQuestions = await extractQuestionsWithGroq(text, sourceKind, program_name)
      if (groqQuestions.length > 0) {
        questions = groqQuestions
        extraction = 'ai'
        extractionError = null
      }
    }

    if (questions.length === 0 && !anthropic) {
      // No AI key — deterministic fallback: use question side of Q&A parsing.
      const pairs = parseStructuredText(text)
      questions = pairs.map((p) => ({ question_text: p.question_text, theme: p.theme }))
      extraction = 'regex'
      if (questions.length === 0) {
        extractionError =
          'No AI key configured and no Q&A structure detected. Format as "Q: ... / A: ..." or markdown headers, or connect Anthropic in Profile → Integrations.'
      }
    }

    // ── 2. Archive the source (always, even on extraction failure) ──────────
    const { data: sessionRow } = await supabase
      .from('app_import_sessions')
      .insert({
        user_id: user.id,
        source_kind: sourceKind,
        program_name: program_name.trim(),
        raw_text: text,
        extracted_count: questions.length,
        error_text: extractionError,
        status: extractionError ? 'failed' : 'complete',
      })
      .select('id')
      .single()

    if (questions.length === 0) {
      return NextResponse.json(
        { error: extractionError ?? 'No extractable questions found', session_id: sessionRow?.id ?? null },
        { status: 422 }
      )
    }

    // Shared-infra writes (programs, program_questions, archived_questions) go
    // through the admin client when available — archive tables are shared
    // infrastructure, and RLS may not grant direct user inserts. User-owned
    // writes (user_applications, unlocks) stay on the user-scoped client.
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const infraClient = serviceKey
      ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
      : supabase

    // ── 3. Index the program ────────────────────────────────────────────────
    const program = await findOrCreateProgram(infraClient, {
      name: program_name.trim(),
      organization: typeof organization === 'string' ? organization.trim() : undefined,
      applyUrl: typeof program_url === 'string' ? program_url.trim() : undefined,
      sourceKind,
      programType: typeof program_type === 'string' ? program_type : undefined,
    })
    if (!program) {
      return NextResponse.json(
        { error: 'Failed to create program record', session_id: sessionRow?.id ?? null },
        { status: 500 }
      )
    }

    // ── 4. Index the questions, individually ────────────────────────────────
    const embedByok = await loadEmbeddingIntegrations(supabase, user.id)

    let newQuestions = 0
    let reusedQuestions = 0
    let linked = 0
    const failures: string[] = []

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const archived = await findOrCreateArchivedQuestion(infraClient, q.question_text, q.theme, embedByok)
      if (!archived) {
        failures.push(q.question_text.slice(0, 80))
        continue
      }
      if (archived.wasNew) newQuestions++
      else reusedQuestions++

      // Link occurrence to program (exact wording preserved in asked_as)
      const { data: existingLink } = await infraClient
        .from('program_questions')
        .select('id')
        .eq('program_id', program.id)
        .eq('archived_question_id', archived.id)
        .maybeSingle()

      if (!existingLink) {
        const { error: linkError } = await infraClient.from('program_questions').insert({
          program_id: program.id,
          archived_question_id: archived.id,
          asked_as: q.question_text,
          order_index: i,
          is_required: true,
        })
        if (linkError) failures.push(q.question_text.slice(0, 80))
        else linked++
      }

      // Unlock for the user (bank visibility)
      const { data: existingUnlock } = await supabase
        .from('user_question_unlocks')
        .select('id')
        .eq('user_id', user.id)
        .eq('archived_question_id', archived.id)
        .maybeSingle()
      if (!existingUnlock) {
        await supabase.from('user_question_unlocks').insert({
          user_id: user.id,
          archived_question_id: archived.id,
          source: 'manual',
        })
      }
    }

    // ── 5. Open the application for the user ────────────────────────────────
    const { data: existingApp } = await supabase
      .from('user_applications')
      .select('id')
      .eq('user_id', user.id)
      .eq('program_id', program.id)
      .maybeSingle()

    let applicationId = existingApp?.id ?? null
    if (!applicationId) {
      const { data: appRow } = await supabase
        .from('user_applications')
        .insert({
          user_id: user.id,
          program_id: program.id,
          status: 'drafting',
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      applicationId = appRow?.id ?? null
    }

    return NextResponse.json({
      program_id: program.id,
      program_slug: program.slug,
      program_was_new: program.wasNew,
      application_id: applicationId,
      session_id: sessionRow?.id ?? null,
      question_count: questions.length,
      linked,
      new_questions: newQuestions,
      reused_questions: reusedQuestions,
      failures,
      extraction,
      workspace_url: `/workspace/${program.id}`,
      fill_url: applicationId ? `/api/applications/${applicationId}/fill` : null,
    })
  } catch (err) {
    console.error('[/api/applications/intake] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
