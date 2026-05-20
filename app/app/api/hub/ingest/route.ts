import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  return callCanonicalHub(
    {
      ...body,
      action: 'ingest',
      user_id: user.id,
    },
    session?.access_token
  )
}
