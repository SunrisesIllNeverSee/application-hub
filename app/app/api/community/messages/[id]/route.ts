import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET    /api/community/messages/[id]
// PATCH  /api/community/messages/[id]   body: { is_read: boolean }
// DELETE /api/community/messages/[id]   sender-only

interface Ctx {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('community_messages')
    .select(`
      id, from_user_id, to_user_id, subject, body, is_read, created_at, submission_id, parent_id,
      from_user:from_user_id(email),
      to_user:to_user_id(email)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ message: data })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const isRead = (body as { is_read?: unknown }).is_read
  if (typeof isRead !== 'boolean') {
    return NextResponse.json({ error: 'is_read (boolean) required' }, { status: 400 })
  }

  // RLS restricts UPDATE to recipient
  const { data, error } = await supabase
    .from('community_messages')
    .update({ is_read: isRead })
    .eq('id', id)
    .eq('to_user_id', user.id)
    .select('id, is_read')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 })
  return NextResponse.json({ message: data })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Sender-only delete — verify ownership first
  const { data: row, error: fetchErr } = await supabase
    .from('community_messages')
    .select('id, from_user_id')
    .eq('id', id)
    .eq('from_user_id', user.id)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 })

  const { error } = await supabase
    .from('community_messages')
    .delete()
    .eq('id', id)
    .eq('from_user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
