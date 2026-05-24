import { NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/supabase/request-auth'
import {
  buildIntakeMeta,
  extractManualIntake,
  type IntakePayload,
  type IntakeMetaBlob,
  type IntakeVertical,
} from '@/lib/intake/manual-intake'

async function callCanonicalHub(body: Record<string, unknown>, accessToken?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Supabase environment is not configured' }, { status: 500 })
  }

  const resp = await fetch(`${supabaseUrl}/functions/v1/canonical-hub`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${anonKey}`,
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  })

  const payload = await resp.json().catch(() => ({}))
  return NextResponse.json(payload, { status: resp.status })
}

function mapLegacyVertical(value: unknown): IntakeVertical {
  switch (value) {
    case 'founder':
      return 'tech'
    case 'college':
      return 'university'
    case 'grants':
      return 'grants'
    case 'jobs':
      return 'jobs'
    case 'tech':
    case 'university':
      return value
    default:
      return 'unknown'
  }
}

function isManualPayload(body: Record<string, unknown>) {
  return typeof body.raw_input === 'string' || typeof body.source_type === 'string' || body.manual_mode === true
}

async function createManualSubmission(req: Request, body: Record<string, unknown>) {
  const { supabase, user } = await getRequestUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawInput = typeof body.raw_input === 'string'
    ? body.raw_input.trim()
    : typeof body.content === 'string'
    ? body.content.trim()
    : ''
  if (rawInput.length < 20) {
    return NextResponse.json({ error: 'raw_input must be at least 20 characters' }, { status: 400 })
  }

  const sourceType = typeof body.source_type === 'string' ? body.source_type : 'manual_paste'
  const sourceUrl = typeof body.source_url === 'string'
    ? body.source_url
    : typeof body.source === 'string'
    ? body.source
    : null
  const sourceTitle = typeof body.source_title === 'string'
    ? body.source_title
    : typeof body.entity === 'string'
    ? body.entity
    : null
  const payloadBase: Omit<IntakePayload, 'metadata'> = {
    source_type: sourceType as IntakePayload['source_type'],
    raw_input: rawInput,
    source_url: sourceUrl,
    source_title: sourceTitle,
    vertical_hint: mapLegacyVertical(body.vertical),
    kind_hint: typeof body.kind_hint === 'string' ? body.kind_hint : null,
    captured_at: typeof body.captured_at === 'string' ? body.captured_at : new Date().toISOString(),
    capture_method: typeof body.capture_method === 'string' ? body.capture_method as IntakePayload['capture_method'] : 'paste',
  }

  const requestId = req.headers.get('x-request-id')
  const metadata: IntakeMetaBlob = body.metadata && typeof body.metadata === 'object'
    ? body.metadata as IntakeMetaBlob
    : buildIntakeMeta({
        adapterName: 'manual-ingestion-ui',
        actorId: user.id,
        route: '/api/hub/ingest',
        payload: payloadBase,
        requestId,
      })

  const payload: IntakePayload = {
    ...payloadBase,
    metadata,
  }

  const extraction = extractManualIntake(payload)

  const { data: submission, error: submissionError } = await supabase
    .from('intake_submissions')
    .insert({
      user_id: user.id,
      source_type: payload.source_type,
      raw_input: payload.raw_input,
      source_url: payload.source_url,
      source_title: payload.source_title,
      vertical_hint: payload.vertical_hint,
      kind_hint: payload.kind_hint,
      captured_at: payload.captured_at,
      capture_method: payload.capture_method,
      metadata: payload.metadata,
      workflow_status: 'pending_review',
      current_checkpoint: 'entity_checkpoint',
    } as unknown as Record<string, unknown>)
    .select('id, ref, workflow_status, current_checkpoint, created_at')
    .single()

  if (submissionError || !submission) {
    console.error('[/api/hub/ingest] submission insert failed:', submissionError)
    return NextResponse.json({ error: 'Unable to create intake submission' }, { status: 500 })
  }

  const { data: entity, error: entityError } = await supabase
    .from('intake_entities')
    .insert({
      submission_id: submission.id,
      name: extraction.entity.name,
      slug: extraction.entity.slug,
      host_domain: extraction.entity.host_domain,
      entity_type: extraction.entity.entity_type,
      vertical: extraction.entity.vertical,
      payload: extraction.entity.payload,
      review_status: 'pending_review',
    } as unknown as Record<string, unknown>)
    .select('id, ref, name, slug, host_domain, vertical, review_status, payload')
    .single()

  if (entityError || !entity) {
    console.error('[/api/hub/ingest] entity insert failed:', entityError)
    return NextResponse.json({ error: 'Unable to stage entity layer' }, { status: 500 })
  }

  const { data: application, error: applicationError } = await supabase
    .from('intake_applications')
    .insert({
      submission_id: submission.id,
      entity_id: entity.id,
      vertical: extraction.application.vertical,
      title: extraction.application.title,
      cycle_label: extraction.application.cycle_label,
      deadline_at: extraction.application.deadline_at,
      application_status: extraction.application.application_status,
      source_url: extraction.application.source_url,
      payload: extraction.application.payload,
      review_status: 'pending_review',
    } as unknown as Record<string, unknown>)
    .select('id, ref, vertical, title, cycle_label, deadline_at, application_status, review_status, payload')
    .single()

  if (applicationError || !application) {
    console.error('[/api/hub/ingest] application insert failed:', applicationError)
    return NextResponse.json({ error: 'Unable to stage application layer' }, { status: 500 })
  }

  const layerRows = extraction.layers.map((layer) => ({
    submission_id: submission.id,
    application_id: application.id,
    layer_key: layer.layer_key,
    layer_order: layer.layer_order,
    payload: layer.payload,
    review_status: 'pending_review',
  }))
  const { data: layers, error: layerError } = await supabase
    .from('intake_application_layers')
    .insert(layerRows as unknown as Record<string, unknown>[])
    .select('id, layer_key, layer_order, payload, review_status')

  if (layerError) {
    console.error('[/api/hub/ingest] layer insert failed:', layerError)
    return NextResponse.json({ error: 'Unable to stage structured layers' }, { status: 500 })
  }

  const questionRows = extraction.questions.map((question) => ({
    submission_id: submission.id,
    application_id: application.id,
    question_text: question.question_text,
    normalized_text: question.normalized_text,
    order_index: question.order_index,
    is_required: question.is_required,
    word_limit: question.word_limit,
    char_limit: question.char_limit,
    payload: question.payload,
    review_status: 'pending_review',
  }))

  const insertedQuestions = questionRows.length > 0
    ? await supabase
        .from('intake_questions')
        .insert(questionRows as unknown as Record<string, unknown>[])
        .select('id, ref, question_text, normalized_text, order_index, is_required, word_limit, char_limit, payload, review_status')
    : { data: [], error: null }

  if (insertedQuestions.error) {
    console.error('[/api/hub/ingest] question insert failed:', insertedQuestions.error)
    return NextResponse.json({ error: 'Unable to stage question layer' }, { status: 500 })
  }

  const eventRows = [
    {
      submission_id: submission.id,
      event_type: 'submission_created',
      layer_number: 0,
      layer_name: 'input',
      checkpoint: 'entity_checkpoint',
      actor_type: 'user',
      actor_id: user.id,
      payload_after: payload,
      notes: 'Manual intake submission staged.',
    },
    {
      submission_id: submission.id,
      event_type: 'entity_extracted',
      layer_number: 1,
      layer_name: 'entity',
      checkpoint: 'entity_checkpoint',
      actor_type: 'system',
      actor_id: user.id,
      payload_after: entity,
      notes: 'Entity candidate created from manual input.',
    },
    {
      submission_id: submission.id,
      event_type: 'application_staged',
      layer_number: 3,
      layer_name: 'application',
      checkpoint: 'application_checkpoint',
      actor_type: 'system',
      actor_id: user.id,
      payload_after: application,
      notes: 'Application record staged for review.',
    },
    {
      submission_id: submission.id,
      event_type: 'structured_layers_staged',
      layer_number: 6,
      layer_name: 'structured_layers',
      checkpoint: 'structured_layers_checkpoint',
      actor_type: 'system',
      actor_id: user.id,
      payload_after: layers ?? [],
      notes: 'Obtained, terms, and requirements layers staged.',
    },
    {
      submission_id: submission.id,
      event_type: 'questions_staged',
      layer_number: 7,
      layer_name: 'questions',
      checkpoint: 'questions_checkpoint',
      actor_type: 'system',
      actor_id: user.id,
      payload_after: insertedQuestions.data ?? [],
      notes: 'Question layer staged for manual approval.',
    },
  ]

  const { error: eventError } = await supabase
    .from('intake_events')
    .insert(eventRows as unknown as Record<string, unknown>[])

  if (eventError) {
    console.error('[/api/hub/ingest] event insert failed:', eventError)
  }

  return NextResponse.json({
    submission,
    entity,
    application,
    layers: layers ?? [],
    questions: insertedQuestions.data ?? [],
    workflow: {
      current_checkpoint: submission.current_checkpoint,
      workflow_status: submission.workflow_status,
    },
  })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  if (body && typeof body === 'object' && isManualPayload(body as Record<string, unknown>)) {
    return createManualSubmission(req, body as Record<string, unknown>)
  }

  const { user, accessToken } = await getRequestUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return callCanonicalHub({
    ...body,
    action: 'ingest',
    user_id: user.id,
  }, accessToken ?? undefined)
}
