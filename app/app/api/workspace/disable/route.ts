// POST /api/workspace/disable — delete the caller's hosted workspace row.
// RLS scopes the delete to the caller's account; the cascade FKs on
// aqua_workspace_records and aqua_workspace_audit remove every hosted
// record and audit line with it — the retention/deletion control the
// hosted surface was missing.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { refuseHostedWrite } from '../../../../lib/local-first-guard.ts'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export async function POST(req: Request) {
  const lfRefusal = refuseHostedWrite({ surface: 'hosted_workspace_disable' })
  if (lfRefusal) return lfRefusal
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return json(401, { error: 'unauthorized', detail: 'Bearer token required' })
  const { verifySupabaseJWT } = await import('../../../../lib/verify-jwt.ts')
  let user: { id: string } | null = null
  try { user = await verifySupabaseJWT(token) } catch { /* falls through */ }
  if (!user?.id) return json(401, { error: 'unauthorized' })
  const { rateLimitAllow } = await import('../../../../lib/rate-limit.ts')
  if (!rateLimitAllow(user.id, 'hosted_init')) return json(429, { error: 'rate_limited' })

  // Explicit opt-out mirrors explicit opt-in: the request must carry a
  // confirm flag so a stray call can never delete storage.
  let body: Record<string, unknown> = {}
  try { body = JSON.parse((await req.text()).slice(0, 64 * 1024)) } catch { /* empty */ }
  if (body.confirm_disable !== true) {
    return json(400, { error: 'confirm_required', detail: 'POST {"confirm_disable": true} to permanently delete your hosted workspace and every record in it' })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.AQUA_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.AQUA_PUBLISHABLE_KEY
  if (!url || !key) return json(503, { error: 'not_configured' })
  const { assertAnonKey } = await import('../../mcp/_vendor/catalog/key.mjs')
  try { assertAnonKey(key) } catch { return json(503, { error: 'not_configured', detail: 'the configured key is not an anon/publishable key' }) }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { authorization: `Bearer ${token}` } },
  })

  // The RLS WITH CHECK restricts the delete to the caller's own row;
  // foreign-key cascades then remove records + audit lines in the same tx.
  const { data: deleted, error } = await client
    .from('aqua_workspaces')
    .delete()
    .eq('account_id', user.id)
    .select('workspace_key')
  if (error) return json(500, { error: 'write_failed', detail: (error as { code?: string }).code ?? 'unknown' })
  if (!deleted?.length) return json(404, { error: 'not_found', detail: 'no hosted workspace exists for this account' })
  return json(200, { status: 'ok', deleted: deleted[0].workspace_key })
}
