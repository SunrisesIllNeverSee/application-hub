import { NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/supabase/request-auth'

export async function POST(req: Request) {
  const { user, accessToken } = await getRequestUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Supabase environment is not configured' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  // IR-009: never spread the raw caller body into an edge-function hop —
  // forward an explicit allowlist of operational fields only, so private
  // text can never ride along (applies unconditionally, not just flag-on).
  // IR-025: allowlisted keys still carry untrusted values — validate shape
  // per field contract so free text cannot transit through an allowed name.
  const { program_id, submission_id, limit, min_score, modes, deadline_days } =
    body as Record<string, unknown>
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const MODE_ENUM = new Set(['deadline', 'fit', 'dna', 'new', 'high_score'])
  const bad = (why: string) =>
    NextResponse.json({ error: `invalid field: ${why}` }, { status: 400 })
  const forwarded: Record<string, unknown> = { user_id: user.id }
  if (program_id !== undefined) {
    if (typeof program_id !== 'string' || !UUID_RE.test(program_id)) return bad('program_id must be a uuid')
    forwarded.program_id = program_id
  }
  if (submission_id !== undefined) {
    if (typeof submission_id !== 'string' || !UUID_RE.test(submission_id)) return bad('submission_id must be a uuid')
    forwarded.submission_id = submission_id
  }
  if (limit !== undefined) {
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 100) return bad('limit must be an integer 1-100')
    forwarded.limit = limit
  }
  if (min_score !== undefined) {
    if (typeof min_score !== 'number' || min_score < 0 || min_score > 1) return bad('min_score must be a number 0-1')
    forwarded.min_score = min_score
  }
  if (modes !== undefined) {
    if (!Array.isArray(modes) || modes.some((m) => typeof m !== 'string' || !MODE_ENUM.has(m))) {
      return bad('modes must be an array of known mode names')
    }
    forwarded.modes = modes
  }
  if (deadline_days !== undefined) {
    if (typeof deadline_days !== 'number' || deadline_days < 0 || deadline_days > 3650) return bad('deadline_days must be a number 0-3650')
    forwarded.deadline_days = deadline_days
  }
  const resp = await fetch(`${supabaseUrl}/functions/v1/smart-matcher`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${anonKey}`,
    },
    body: JSON.stringify(forwarded),
  })

  const payload = await resp.json().catch(() => ({}))
  return NextResponse.json(payload, { status: resp.status })
}
