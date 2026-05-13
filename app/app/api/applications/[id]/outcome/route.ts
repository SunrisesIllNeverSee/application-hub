import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/sanitize'

type OutcomeStatus = 'accepted' | 'rejected' | 'waitlisted' | 'submitted' | 'withdrawn'

interface OutcomeBody {
  status?: OutcomeStatus
  is_public_result?: boolean
  outcome_notes?: string | null
  interview_date?: string | null
  program_feedback?: string | null
  would_recommend?: number | null
}

const TERMINAL_STATUSES: ReadonlySet<string> = new Set(['accepted', 'rejected', 'waitlisted'])

// PATCH /api/applications/[id]/outcome — log an outcome for a user application
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: OutcomeBody
  try {
    body = (await req.json()) as OutcomeBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const ALLOWED_STATUSES: OutcomeStatus[] = [
    'accepted',
    'rejected',
    'waitlisted',
    'submitted',
    'withdrawn',
  ]

  if (body.status !== undefined && !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  if (body.would_recommend !== undefined && body.would_recommend !== null) {
    const n = body.would_recommend
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return NextResponse.json(
        { error: 'would_recommend must be an integer 1-5 or null' },
        { status: 400 }
      )
    }
  }

  if (body.interview_date !== undefined && body.interview_date !== null) {
    const d = new Date(body.interview_date)
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { error: 'interview_date must be a valid ISO date or null' },
        { status: 400 }
      )
    }
  }

  const { data: existing, error: lookupError } = await supabase
    .from('user_applications')
    .select('id, user_id, status, outcome_logged_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle<{ id: string; user_id: string; status: string; outcome_logged_at: string | null }>()

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 })
  }

  if (!existing) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  let nextStatus: string | undefined
  if (body.status !== undefined) {
    nextStatus = body.status === 'withdrawn' ? 'saved' : body.status
    updates.status = nextStatus
  }

  if (typeof body.is_public_result === 'boolean') {
    updates.is_public_result = body.is_public_result
  }

  if (body.outcome_notes !== undefined) {
    updates.outcome_notes = body.outcome_notes === null ? null : sanitizeText(body.outcome_notes, 2000)
  }

  if (body.program_feedback !== undefined) {
    updates.program_feedback = body.program_feedback === null ? null : sanitizeText(body.program_feedback, 2000)
  }

  if (body.interview_date !== undefined) {
    updates.interview_date = body.interview_date
  }

  if (body.would_recommend !== undefined) {
    updates.would_recommend = body.would_recommend
  }

  if (existing.outcome_logged_at == null) {
    const transitioningToTerminal =
      nextStatus !== undefined &&
      TERMINAL_STATUSES.has(nextStatus) &&
      !TERMINAL_STATUSES.has(existing.status)
    const notesFirstWritten =
      (typeof body.outcome_notes === 'string' && body.outcome_notes.trim().length > 0) ||
      (typeof body.program_feedback === 'string' && body.program_feedback.trim().length > 0)
    if (transitioningToTerminal || notesFirstWritten) {
      updates.outcome_logged_at = new Date().toISOString()
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('user_applications')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ application: updated })
}
