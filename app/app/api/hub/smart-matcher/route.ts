import { NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/supabase/request-auth'
import { refusePrivateTextFields } from '@/lib/local-first-guard'

// The actual edge-function contract (supabase/functions/smart-matcher):
//   user_persona:   record — persona descriptors for matching
//   vertical_filter: string (default 'founder')
//   match_limit:    integer 1-50 (default 10)
//
// IR-009/IR-025: forward an allowlist of the REAL contract fields with
// validated shapes — never spread the raw caller body. user_persona is a
// record, so it is shape-bounded (key count, scalar/short-array values,
// string length) rather than open-ended: legitimate persona descriptors
// are small scalars; a private answer body cannot fit the bound.

function isPersonaValue(v: unknown): boolean {
  if (v == null) return true
  const t = typeof v
  if (t === 'boolean') return true
  if (t === 'number') return Number.isFinite(v as number)
  if (t === 'string') return (v as string).length <= 500
  if (Array.isArray(v)) {
    return v.length <= 50 && v.every((x) => typeof x === 'string' && x.length <= 200)
  }
  return false
}

export async function POST(req: Request) {
  const { user, accessToken } = await getRequestUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Supabase environment is not configured' }, { status: 500 })
  }

  const bad = (why: string) => NextResponse.json({ error: `invalid field: ${why}` }, { status: 400 })

  const raw = await req.json().catch(() => null)
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return bad('JSON object body required')
  }
  const body = raw as Record<string, unknown>

  // IR-038: user_persona is free-text caller content forwarded to the edge
  // function — under local-first that is exactly the class of private text
  // that must not leave the device without an explicit consent boundary.
  // Persona-less calls (public catalog matching) stay allowed.
  const lfRefusal = refusePrivateTextFields(body, ['user_persona'], {
    detail: 'persona matching runs on-device in local-first mode — no private text leaves the vault',
  })
  if (lfRefusal) return lfRefusal

  const { user_persona, vertical_filter, match_limit } = body
  const forwarded: Record<string, unknown> = { user_id: user.id }

  if (user_persona !== undefined) {
    if (typeof user_persona !== 'object' || user_persona === null || Array.isArray(user_persona)) {
      return bad('user_persona must be an object')
    }
    const entries = Object.entries(user_persona as Record<string, unknown>)
    if (entries.length > 50) return bad('user_persona exceeds 50 keys')
    // Total-size cap — shape bounds alone still permit ~25KB through an
    // allowlisted field; bound the serialized persona.
    if (JSON.stringify(user_persona).length > 8192) return bad('user_persona exceeds 8KB')
    if (entries.some(([k, v]) => typeof k !== 'string' || k.length > 80 || !isPersonaValue(v))) {
      return bad('user_persona values must be scalars or short string arrays')
    }
    forwarded.user_persona = user_persona
  }
  if (vertical_filter !== undefined) {
    if (typeof vertical_filter !== 'string' || vertical_filter.length > 64) {
      return bad('vertical_filter must be a short string')
    }
    forwarded.vertical_filter = vertical_filter
  }
  if (match_limit !== undefined) {
    if (typeof match_limit !== 'number' || !Number.isInteger(match_limit) || match_limit < 1 || match_limit > 50) {
      return bad('match_limit must be an integer 1-50')
    }
    forwarded.match_limit = match_limit
  }
  const extra = Object.keys(body).filter(
    (k) => !['user_persona', 'vertical_filter', 'match_limit'].includes(k),
  )
  if (extra.length > 0) {
    return NextResponse.json({ error: `unsupported field(s): ${extra.join(', ')}` }, { status: 400 })
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
