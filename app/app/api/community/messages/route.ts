import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeText, sanitizeSubject } from '@/lib/sanitize'
import { rateLimitAllow } from '@/lib/rate-limit'

// GET /api/community/messages?box=inbox|sent
// POST /api/community/messages

interface MessageRow {
  id: string
  from_user_id: string
  to_user_id: string | null
  subject: string
  body: string
  is_read: boolean
  created_at: string
  submission_id: string | null
  parent_id: string | null
  from_user?: { email: string | null } | { email: string | null }[] | null
  to_user?: { email: string | null } | { email: string | null }[] | null
}

function pickEmail(rel: MessageRow['from_user'] | MessageRow['to_user']): string | null {
  if (!rel) return null
  const r = Array.isArray(rel) ? rel[0] : rel
  return (r && 'email' in r ? r.email : null) ?? null
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const box = searchParams.get('box') === 'sent' ? 'sent' : 'inbox'

  let query = supabase
    .from('community_messages')
    .select(`
      id, from_user_id, to_user_id, subject, body, is_read, created_at, submission_id, parent_id,
      from_user:from_user_id(email),
      to_user:to_user_id(email)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (box === 'inbox') {
    query = query.eq('to_user_id', user.id)
  } else {
    query = query.eq('from_user_id', user.id)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as unknown as MessageRow[]
  const messages = rows.map((r) => ({
    id: r.id,
    from_user_id: r.from_user_id,
    to_user_id: r.to_user_id,
    from_email: pickEmail(r.from_user),
    to_email: pickEmail(r.to_user),
    subject: r.subject,
    body: r.body,
    is_read: r.is_read,
    created_at: r.created_at,
    submission_id: r.submission_id,
    parent_id: r.parent_id,
  }))

  return NextResponse.json({ messages })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await rateLimitAllow(user.id, 'community_message')
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many messages — try again later' },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const subjectRaw = (body as { subject?: string }).subject ?? ''
  const bodyRaw    = (body as { body?: string }).body ?? ''
  let toUserId   = (body as { to_user_id?: string }).to_user_id ?? null
  const submissionId = (body as { submission_id?: string }).submission_id ?? null
  const parentId     = (body as { parent_id?: string }).parent_id ?? null

  const subject = sanitizeSubject(subjectRaw)
  const text    = sanitizeText(bodyRaw, 5000)

  if (subject.length < 1) {
    return NextResponse.json({ error: 'Subject required' }, { status: 400 })
  }
  if (text.length < 1) {
    return NextResponse.json({ error: 'Body required' }, { status: 400 })
  }
  if (!toUserId && !submissionId) {
    return NextResponse.json(
      { error: 'Recipient or submission required' },
      { status: 400 }
    )
  }

  if (submissionId && !toUserId) {
    const { data: sub, error: subErr } = await supabase
      .from('import_queue')
      .select('submitted_by')
      .eq('id', submissionId)
      .single()
    if (subErr || !sub) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }
    toUserId = (sub as { submitted_by: string | null }).submitted_by ?? null
    if (!toUserId) {
      return NextResponse.json(
        { error: 'Submission has no submitter to message' },
        { status: 400 }
      )
    }
  }

  if (toUserId === user.id) {
    return NextResponse.json({ error: "You can't message yourself" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('community_messages')
    .insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      submission_id: submissionId,
      parent_id: parentId,
      subject,
      body: text,
    })
    .select('id, from_user_id, to_user_id, submission_id, parent_id, subject, body, is_read, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: data })
}
