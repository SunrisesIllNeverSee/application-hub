import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EXPORT_FORMATS = new Set(['json', 'markdown'])

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Supabase environment is not configured' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  // AM-0057: the canonical export contract is exactly {canonical_id,
  // export_format}. Arbitrary caller fields are refused — not spread —
  // so the hosted read path can never carry private text upstream under
  // any flag state. (Applies unconditionally; local-first additionally
  // never writes caller content to the hub.)
  const { canonical_id, export_format } = body as Record<string, unknown>
  if (typeof canonical_id !== 'string' || !UUID_RE.test(canonical_id)) {
    return NextResponse.json({ error: 'canonical_id must be a uuid' }, { status: 400 })
  }
  const format = export_format === undefined ? 'json' : export_format
  if (typeof format !== 'string' || !EXPORT_FORMATS.has(format)) {
    return NextResponse.json(
      { error: `export_format must be one of ${[...EXPORT_FORMATS].join(', ')}` },
      { status: 400 },
    )
  }
  const allowedKeys = new Set(['canonical_id', 'export_format'])
  const extra = Object.keys(body as Record<string, unknown>).filter((k) => !allowedKeys.has(k))
  if (extra.length > 0) {
    return NextResponse.json(
      { error: `unsupported field(s): ${extra.join(', ')}` },
      { status: 400 },
    )
  }

  const resp = await fetch(`${supabaseUrl}/functions/v1/canonical-hub`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      canonical_id,
      export_format: format,
      action: 'export',
      user_id: user.id,
    }),
  })

  const payload = await resp.json().catch(() => ({}))
  return NextResponse.json(payload, { status: resp.status })
}
