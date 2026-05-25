import { NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/supabase/request-auth'
import {
  nextCheckpoint,
  type IntakeCheckpoint,
  type IntakeReviewDecision,
} from '@/lib/intake/manual-intake'

const CHECKPOINTS: IntakeCheckpoint[] = [
  'entity_checkpoint',
  'application_checkpoint',
  'structured_layers_checkpoint',
  'questions_checkpoint',
  'finalized',
]

function isCheckpoint(value: unknown): value is IntakeCheckpoint {
  return typeof value === 'string' && CHECKPOINTS.includes(value as IntakeCheckpoint)
}

function isDecision(value: unknown): value is IntakeReviewDecision {
  return value === 'approve' || value === 'reject' || value === 'needs_revision'
}

async function applyEdits(
  supabase: Awaited<ReturnType<typeof getRequestUser>>['supabase'],
  submissionId: string,
  checkpoint: IntakeCheckpoint,
  editedPayload: Record<string, unknown>,
) {
  if (Object.keys(editedPayload).length === 0) return null

  if (checkpoint === 'entity_checkpoint') {
    const update: Record<string, unknown> = {}
    if (typeof editedPayload.name === 'string') update.name = editedPayload.name
    if (typeof editedPayload.slug === 'string') update.slug = editedPayload.slug
    if (typeof editedPayload.host_domain === 'string') update.host_domain = editedPayload.host_domain
    if (typeof editedPayload.entity_type === 'string') update.entity_type = editedPayload.entity_type
    if (typeof editedPayload.vertical === 'string') update.vertical = editedPayload.vertical
    if (editedPayload.payload && typeof editedPayload.payload === 'object') update.payload = editedPayload.payload
    if (Object.keys(update).length > 0) {
      await supabase.from('intake_entities').update(update).eq('submission_id', submissionId)
    }
    return update
  }

  if (checkpoint === 'application_checkpoint') {
    const update: Record<string, unknown> = {}
    if (typeof editedPayload.title === 'string') update.title = editedPayload.title
    if (typeof editedPayload.cycle_label === 'string') update.cycle_label = editedPayload.cycle_label
    if (typeof editedPayload.deadline_at === 'string') update.deadline_at = editedPayload.deadline_at
    if (typeof editedPayload.application_status === 'string') update.application_status = editedPayload.application_status
    if (typeof editedPayload.source_url === 'string') update.source_url = editedPayload.source_url
    if (editedPayload.payload && typeof editedPayload.payload === 'object') update.payload = editedPayload.payload
    if (Object.keys(update).length > 0) {
      await supabase.from('intake_applications').update(update).eq('submission_id', submissionId)
    }
    return update
  }

  if (checkpoint === 'structured_layers_checkpoint') {
    const layers = Array.isArray(editedPayload.layers) ? editedPayload.layers : []
    for (const layer of layers) {
      if (!layer || typeof layer !== 'object') continue
      const record = layer as Record<string, unknown>
      if (typeof record.id !== 'string' || !record.payload || typeof record.payload !== 'object') continue
      await supabase
        .from('intake_application_layers')
        .update({ payload: record.payload })
        .eq('id', record.id)
        .eq('submission_id', submissionId)
    }
    return { layers_edited: layers.length }
  }

  if (checkpoint === 'questions_checkpoint') {
    const questions = Array.isArray(editedPayload.questions) ? editedPayload.questions : []
    for (const question of questions) {
      if (!question || typeof question !== 'object') continue
      const record = question as Record<string, unknown>
      if (typeof record.id !== 'string') continue
      const update: Record<string, unknown> = {}
      if (typeof record.question_text === 'string') update.question_text = record.question_text
      if (typeof record.normalized_text === 'string') update.normalized_text = record.normalized_text
      if (typeof record.is_required === 'boolean') update.is_required = record.is_required
      if (typeof record.word_limit === 'number' || record.word_limit === null) update.word_limit = record.word_limit
      if (typeof record.char_limit === 'number' || record.char_limit === null) update.char_limit = record.char_limit
      if (record.payload && typeof record.payload === 'object') update.payload = record.payload
      if (Object.keys(update).length > 0) {
        await supabase
          .from('intake_questions')
          .update(update)
          .eq('id', record.id)
          .eq('submission_id', submissionId)
      }
    }
    return { questions_edited: questions.length }
  }

  return null
}

export async function POST(req: Request) {
  const { supabase, user } = await getRequestUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const submissionId = typeof body.submission_id === 'string' ? body.submission_id : null
  const checkpoint = body.checkpoint
  const decision = body.decision
  const notes = typeof body.notes === 'string' ? body.notes : null
  const editedPayload = body.edited_payload && typeof body.edited_payload === 'object'
    ? body.edited_payload as Record<string, unknown>
    : {}

  if (!submissionId || !isCheckpoint(checkpoint) || !isDecision(decision)) {
    return NextResponse.json({ error: 'submission_id, checkpoint, and decision are required' }, { status: 400 })
  }

  const { data: submission, error: submissionError } = await supabase
    .from('intake_submissions')
    .select('*')
    .eq('id', submissionId)
    .eq('user_id', user.id)
    .single()

  if (submissionError || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  if (submission.current_checkpoint !== checkpoint && checkpoint !== 'finalized') {
    return NextResponse.json({
      error: `Checkpoint mismatch. Current checkpoint is ${submission.current_checkpoint}.`,
    }, { status: 409 })
  }

  const editedResult = await applyEdits(supabase, submissionId, checkpoint, editedPayload)

  const reviewInsert = {
    submission_id: submissionId,
    checkpoint,
    decision,
    notes,
    edited_payload: editedPayload,
    reviewed_by: user.id,
  }
  await supabase.from('intake_gate_reviews').insert(reviewInsert as unknown as Record<string, unknown>)

  const now = new Date().toISOString()
  let submissionUpdate: Record<string, unknown> = {}
  let eventLayerNumber = 0
  let eventLayerName = checkpoint as string

  if (checkpoint === 'entity_checkpoint') {
    eventLayerNumber = 1
    eventLayerName = 'entity'
    await supabase
      .from('intake_entities')
      .update({
        review_status: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'needs_revision',
        approved_by: decision === 'approve' ? user.id : null,
        approved_at: decision === 'approve' ? now : null,
      })
      .eq('submission_id', submissionId)
  } else if (checkpoint === 'application_checkpoint') {
    eventLayerNumber = 3
    eventLayerName = 'application'
    await supabase
      .from('intake_applications')
      .update({
        review_status: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'needs_revision',
        approved_by: decision === 'approve' ? user.id : null,
        approved_at: decision === 'approve' ? now : null,
      })
      .eq('submission_id', submissionId)
  } else if (checkpoint === 'structured_layers_checkpoint') {
    eventLayerNumber = 6
    eventLayerName = 'structured_layers'
    await supabase
      .from('intake_application_layers')
      .update({
        review_status: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'needs_revision',
        approved_by: decision === 'approve' ? user.id : null,
        approved_at: decision === 'approve' ? now : null,
      })
      .eq('submission_id', submissionId)
  } else if (checkpoint === 'questions_checkpoint') {
    eventLayerNumber = 7
    eventLayerName = 'questions'
    await supabase
      .from('intake_questions')
      .update({
        review_status: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'needs_revision',
        approved_by: decision === 'approve' ? user.id : null,
        approved_at: decision === 'approve' ? now : null,
      })
      .eq('submission_id', submissionId)
  }

  if (decision === 'approve') {
    if (checkpoint === 'questions_checkpoint') {
      submissionUpdate = {
        current_checkpoint: 'finalized',
        workflow_status: 'finalized',
      }
    } else if (checkpoint !== 'finalized') {
      submissionUpdate = {
        current_checkpoint: nextCheckpoint(checkpoint),
        workflow_status: 'in_progress',
      }
    }
  } else if (decision === 'reject') {
    submissionUpdate = {
      workflow_status: 'rejected',
    }
  } else {
    submissionUpdate = {
      workflow_status: 'needs_revision',
    }
  }

  if (Object.keys(submissionUpdate).length > 0) {
    await supabase
      .from('intake_submissions')
      .update(submissionUpdate)
      .eq('id', submissionId)
      .eq('user_id', user.id)
  }

  await supabase.from('intake_events').insert({
    submission_id: submissionId,
    event_type: `checkpoint_${decision}`,
    layer_number: eventLayerNumber,
    layer_name: eventLayerName,
    checkpoint,
    actor_type: 'user',
    actor_id: user.id,
    payload_before: {
      workflow_status: submission.workflow_status,
      current_checkpoint: submission.current_checkpoint,
    },
    payload_after: {
      ...submissionUpdate,
      edited_result: editedResult,
    },
    notes,
  } as unknown as Record<string, unknown>)

  const { data: updatedSubmission } = await supabase
    .from('intake_submissions')
    .select('*')
    .eq('id', submissionId)
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    ok: true,
    submission: updatedSubmission,
  })
}
