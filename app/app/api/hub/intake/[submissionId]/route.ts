import { NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/supabase/request-auth'

export async function GET(req: Request, context: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await context.params
  const { supabase, user } = await getRequestUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: submission, error: submissionError } = await supabase
    .from('intake_submissions')
    .select('*')
    .eq('id', submissionId)
    .eq('user_id', user.id)
    .single()

  if (submissionError || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  const [{ data: entity }, { data: application }, { data: layers }, { data: questions }, { data: reviews }, { data: events }] = await Promise.all([
    supabase.from('intake_entities').select('*').eq('submission_id', submissionId).maybeSingle(),
    supabase.from('intake_applications').select('*').eq('submission_id', submissionId).maybeSingle(),
    supabase.from('intake_application_layers').select('*').eq('submission_id', submissionId).order('layer_order', { ascending: true }),
    supabase.from('intake_questions').select('*').eq('submission_id', submissionId).order('order_index', { ascending: true }),
    supabase.from('intake_gate_reviews').select('*').eq('submission_id', submissionId).order('created_at', { ascending: false }),
    supabase.from('intake_events').select('*').eq('submission_id', submissionId).order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    submission,
    entity,
    application,
    layers: layers ?? [],
    questions: questions ?? [],
    reviews: reviews ?? [],
    events: events ?? [],
  })
}
