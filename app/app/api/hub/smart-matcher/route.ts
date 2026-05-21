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
  const resp = await fetch(`${supabaseUrl}/functions/v1/smart-matcher`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      ...body,
      user_id: user.id,
    }),
  })

  const payload = await resp.json().catch(() => ({}))
  return NextResponse.json(payload, { status: resp.status })
}
