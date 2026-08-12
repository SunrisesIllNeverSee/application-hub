import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { loadEmbeddingIntegrations } from '@/lib/intake-extract'
import { embedQuestionText } from '@/lib/embed'

// ============================================================
// POST /api/applications/[id]/fill
// ============================================================
// The pound-out loop, step 2: fill the application from the answer bank.
//
// For every question on the application (program_questions, in order):
//   1. DIRECT  — you already have a profile_answer for this exact archived
//      question → it shows in the workspace as-is. Nothing to do.
//   2. BORROW  — vector-match the question's exact wording (asked_as)
//      against the rest of the archive; if a near-identical question has
//      one of your answers, that answer is copied in as a NEW draft version
//      keyed to THIS question. Never overwrites; drafts are yours to edit.
//   3. GAP     — nothing in the bank → left empty for work-through.
//
// Deterministic only. No generated text is written into your bank — AI
// adaptation stays where it belongs: the per-question "Draft with AI"
// button in the workspace, with you in the loop.
//
// Request:  { borrow_threshold?: number (default 0.80), dry_run?: boolean }
// Response: { total, direct, borrowed: [...], gaps: [...], coverage_pct,
//             workspace_url }
// ============================================================

const DEFAULT_BORROW_THRESHOLD = 0.8

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // Auth: session cookie (browser) OR Authorization: Bearer <jwt> (extension/MCP)
    const authHeader = req.headers.get('authorization')
    let supabase = await createClient()
    let user = (await supabase.auth.getUser()).data.user

    if (!user && authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.slice(7)
      const { createClient: createBrowserClient } = await import('@supabase/supabase-js').then(m => m)
      const extClient = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${jwt}` } } }
      )
      const { data } = await extClient.auth.getUser(jwt)
      if (data.user) { user = data.user; supabase = extClient as typeof supabase }
    }

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { borrow_threshold = DEFAULT_BORROW_THRESHOLD, dry_run = false } = body as {
      borrow_threshold?: number
      dry_run?: boolean
    }

    // ── 1. Load the application (must be yours) ─────────────────────────────
    const { data: application } = await supabase
      .from('user_applications')
      .select('id, program_id, user_id, status')
      .eq('id', id)
      .maybeSingle()
    if (!application || application.user_id !== user.id) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // ── 2. Load its questions, in order ─────────────────────────────────────
    const { data: questionRows } = await supabase
      .from('program_questions')
      .select('id, archived_question_id, asked_as, order_index, word_limit, char_limit, is_required')
      .eq('program_id', application.program_id)
      .order('order_index', { ascending: true })

    const questions = questionRows ?? []
    if (questions.length === 0) {
      return NextResponse.json(
        { error: 'No questions indexed for this program — run intake first' },
        { status: 422 }
      )
    }

    const archivedIds = questions.map((q) => q.archived_question_id)

    // ── 3. Direct hits: latest bank answer per question ─────────────────────
    type AnswerRow = {
      id: string
      archived_question_id: string
      answer_content: string | null
      content: string | null
      confidence: string
      version: number | null
      word_count: number | null
    }
    const { data: directAnswers } = await supabase
      .from('profile_answers')
      .select('id, archived_question_id, answer_content, content, confidence, version, word_count')
      .eq('user_id', user.id)
      .in('archived_question_id', archivedIds)
      .order('version', { ascending: false })

    const latestByQuestion = new Map<string, AnswerRow>()
    for (const a of (directAnswers ?? []) as AnswerRow[]) {
      if (!latestByQuestion.has(a.archived_question_id)) latestByQuestion.set(a.archived_question_id, a)
    }

    // ── 4. Borrow pass for the misses ───────────────────────────────────────
    const misses = questions.filter((q) => !latestByQuestion.has(q.archived_question_id))
    const embedByok = await loadEmbeddingIntegrations(supabase, user.id)

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    type BorrowPlan = {
      archived_question_id: string
      asked_as: string
      source_question_id: string
      source_question_text: string
      similarity: number
      source_answer: string
      word_limit: number | null
    }
    const borrowPlan: BorrowPlan[] = []
    const gaps: string[] = []
    let embedAvailable = true

    for (const q of misses) {
      let borrowed = false

      if (embedAvailable) {
        const embedResult = await embedQuestionText(q.asked_as, embedByok)
        if (!embedResult) {
          embedAvailable = false // don't retry a dead provider for every question
        } else {
          const { data: matches } = await adminClient.rpc('match_archived_questions', {
            query_embedding: JSON.stringify(embedResult.embedding),
            match_threshold: borrow_threshold,
            match_count: 6,
          })

          const candidates = ((matches ?? []) as Array<{ id: string; text: string; similarity: number }>).filter(
            (m) => m.id !== q.archived_question_id
          )

          if (candidates.length > 0) {
            const { data: sourceAnswers } = await supabase
              .from('profile_answers')
              .select('archived_question_id, answer_content, content, version')
              .eq('user_id', user.id)
              .in('archived_question_id', candidates.map((c) => c.id))
              .order('version', { ascending: false })

            const sourceByQuestion = new Map<string, string>()
            for (const sa of sourceAnswers ?? []) {
              if (!sourceByQuestion.has(sa.archived_question_id)) {
                sourceByQuestion.set(sa.archived_question_id, sa.answer_content ?? sa.content ?? '')
              }
            }

            for (const candidate of candidates) {
              const source = sourceByQuestion.get(candidate.id)
              if (source && source.trim().length >= 10) {
                borrowPlan.push({
                  archived_question_id: q.archived_question_id,
                  asked_as: q.asked_as,
                  source_question_id: candidate.id,
                  source_question_text: candidate.text,
                  similarity: candidate.similarity,
                  source_answer: source,
                  word_limit: q.word_limit,
                })
                borrowed = true
                break
              }
            }
          }
        }
      }

      if (!borrowed) gaps.push(q.asked_as)
    }

    // ── 5. Write borrowed drafts (unless dry run) ───────────────────────────
    // Upsert: profile_answers has UNIQUE(user_id, archived_question_id) —
    // one row per user+question. UPDATE in place; the
    // profile_answer_history_snapshot trigger archives each new version.
    let written = 0
    const writeErrors: string[] = []

    if (!dry_run && borrowPlan.length > 0) {
      for (const plan of borrowPlan) {
        const { data: existing } = await supabase
          .from('profile_answers')
          .select('id, version, answer_content, content')
          .eq('user_id', user.id)
          .eq('archived_question_id', plan.archived_question_id)
          .order('version', { ascending: false })
          .limit(1)

        const nextVersion = existing && existing.length > 0 ? (existing[0].version ?? 1) + 1 : 1

        // Skip identical content (idempotent re-runs)
        if (existing && existing.length > 0) {
          const latestContent = existing[0].answer_content ?? existing[0].content ?? ''
          if (latestContent.trim() === plan.source_answer.trim()) continue
        }

        const trimmed = plan.source_answer.trim()
        const wordCount = trimmed.split(/\s+/).filter(Boolean).length
        const payload = {
          content: trimmed,
          answer_content: trimmed,
          question_text: plan.asked_as,
          word_count: wordCount,
          version: nextVersion,
          confidence: 'draft' as const,
        }

        let error
        if (existing && existing.length > 0) {
          ;({ error } = await supabase
            .from('profile_answers')
            .update(payload)
            .eq('id', existing[0].id))
        } else {
          ;({ error } = await supabase.from('profile_answers').insert({
            user_id: user.id,
            archived_question_id: plan.archived_question_id,
            ...payload,
          }))
        }
        if (error) writeErrors.push(plan.asked_as.slice(0, 80))
        else written++
      }
    }

    const direct = questions.length - misses.length
    const filled = direct + (dry_run ? borrowPlan.length : written)
    const coveragePct = Math.round((filled / questions.length) * 100)

    return NextResponse.json({
      application_id: application.id,
      program_id: application.program_id,
      total: questions.length,
      direct,
      borrowed: borrowPlan.map((b) => ({
        asked_as: b.asked_as,
        source_question: b.source_question_text,
        similarity: Math.round(b.similarity * 1000) / 1000,
        over_word_limit: b.word_limit
          ? b.source_answer.trim().split(/\s+/).filter(Boolean).length > b.word_limit
          : false,
      })),
      borrowed_written: dry_run ? 0 : written,
      gaps,
      coverage_pct: coveragePct,
      dry_run,
      embedding_available: embedAvailable,
      write_errors: writeErrors,
      workspace_url: `/workspace/${application.program_id}`,
    })
  } catch (err) {
    console.error('[/api/applications/[id]/fill] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
