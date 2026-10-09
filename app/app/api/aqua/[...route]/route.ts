import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/aqua/<bridge-route> — AQUA staging proxy (AP-M04-SITE).
//
// Rollback flag: the entire surface exists only while AQUA_STAGING=1 is set;
// unsetting the env returns every route here to 404 with zero code changes.
//
// Identity: the caller's authenticated Supabase user id IS the site_user_id
// passed to the bridge. The bridge (localhost dev-mirror) resolves
// site_user_id -> subject -> scope through the ownership-proven binding —
// this route never forwards caller-supplied subject/scope claims.

const BRIDGE = process.env.AQUA_BRIDGE_URL ?? 'http://127.0.0.1:8771'

const ROUTES = new Set([
  'snapshot', 'projection', 'draft', 'approve', 'assess', 'prepare', 'packets', 'status',
])

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ route: string[] }> },
) {
  if (process.env.AQUA_STAGING !== '1')
    return NextResponse.json({ error: 'not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { route } = await params
  const name = (route ?? []).join('/')
  if (!ROUTES.has(name))
    return NextResponse.json({ error: 'unknown route' }, { status: 404 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty body ok */ }
  body.site_user_id = user.id

  try {
    const r = await fetch(`${BRIDGE}/aqua/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch (e) {
    return NextResponse.json(
      { error: 'aqua bridge unreachable', detail: String(e).slice(0, 200) },
      { status: 502 },
    )
  }
}
