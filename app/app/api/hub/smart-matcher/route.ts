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
  const { program_id, submission_id, limit, min_score, modes, deadline_days } =
    body as Record<string, unknown>
  const resp = await fetch(`${supabaseUrl}/functions/v1/smart-matcher`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      user_id: user.id,
      ...(program_id !== undefined ? { program_id } : {}),
      ...(submission_id !== undefined ? { submission_id } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(min_score !== undefined ? { min_score } : {}),
      ...(modes !== undefined ? { modes } : {}),
      ...(deadline_days !== undefined ? { deadline_days } : {}),
    }),
  })

  const payload = await resp.json().catch(() => ({}))
  return NextResponse.json(payload, { status: resp.status })
}
