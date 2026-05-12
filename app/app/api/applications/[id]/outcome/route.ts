import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type OutcomeStatus = 'accepted' | 'rejected' | 'waitlisted' | 'submitted' | 'withdrawn'

interface OutcomeBody {
  status: OutcomeStatus
  is_public_result?: boolean
}

// PATCH /api/applications/[id]/outcome — log an outcome for a user application
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  if (!body.status || !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  // Verify the application belongs to this user before updating
  const { data: existing, error: lookupError } = await supabase
    .from('user_applications')
    .select('id, user_id')
    .eq('id', (await params).id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 })
  }

  if (!existing) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  // Map 'withdrawn' -> 'saved' since the DB enum doesn't have a withdrawn value;
  // treat it as reverting to saved state so the UI still makes sense
  const dbStatus = body.status === 'withdrawn' ? 'saved' : body.status

  const updatePayload: Record<string, unknown> = {
    status: dbStatus,
    updated_at: new Date().toISOString(),
  }

  if (typeof body.is_public_result === 'boolean') {
    updatePayload.is_public_result = body.is_public_result
  }

  const { data: updated, error: updateError } = await supabase
    .from('user_applications')
    .update(updatePayload)
    .eq('id', (await params).id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ application: updated })
}
