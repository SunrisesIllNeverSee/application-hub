// POST /api/workspace/init — provision a hosted workspace for the caller.
// Server-side init builds the manifest the way init_workspace does and
// stores it under caller-JWT RLS. Idempotent: existing row → already_initialized.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return json(401, { error: 'unauthorized', detail: 'Bearer token required' })
  const { verifySupabaseJWT } = await import('../../../../lib/verify-jwt.ts')
  let user: { id: string } | null = null
  try { user = await verifySupabaseJWT(token) } catch { /* falls through */ }
  if (!user?.id) return json(401, { error: 'unauthorized' })
  const { rateLimitAllow } = await import('../../../../lib/rate-limit.ts')
  if (!rateLimitAllow(user.id, 'hosted_approve')) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '60' } })

  // Hosted workspace is an explicit opt-in — the request must carry the
  // consent flag; a bare Bearer token alone never provisions storage.
  let body: Record<string, unknown> = {}
  try { body = JSON.parse((await req.text()).slice(0, 64 * 1024)) } catch { /* empty */ }
  if (body.consent_hosted_workspace !== true) {
    return json(400, { error: 'consent_required', detail: 'POST {"consent_hosted_workspace": true} to explicitly enable a hosted workspace' })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.AQUA_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.AQUA_PUBLISHABLE_KEY
  if (!url || !key) return json(503, { error: 'not_configured' })

  const { assertAnonKey } = await import('../../mcp/_vendor/catalog/key.mjs')
  try { assertAnonKey(key) } catch { return json(503, { error: 'not_configured', detail: 'the configured key is not an anon/publishable key' }) }
  const client = createClient(url, key, { global: { headers: { authorization: `Bearer ${token}` } } })
  const { data: existing } = await client
    .from('aqua_workspaces').select('id, workspace_key')
    .eq('account_id', user.id).limit(1)
  if (existing?.length) {
    return json(200, { status: 'ok', already_initialized: true, workspace_id: existing[0].id })
  }

  const ws = await import('../../mcp/_vendor/workspace/companion/src/workspace.mjs') as any
  const passphrase = process.env.AQUA_PASSPHRASE
  if (!passphrase || typeof ws?.newManifest !== 'function') {
    return json(503, { error: 'hosted_backend_unavailable', detail: 'companion init primitives unavailable' })
  }
  const { manifest, keys } = await ws.newManifest(passphrase)
  manifest.hosted_consent = { at: new Date().toISOString(), account_id: user.id }
  // newManifest produces no manifest_mac — unlock() refuses a manifest whose
  // MAC is absent/mismatched. Stamp it the same way the CLI init path does,
  // AFTER every stored field is set (the MAC covers the whole document).
  const crypto = await import('../../mcp/_vendor/workspace/companion/src/crypto.mjs') as any
  const { manifest_mac: _omit, ...macBase } = manifest
  manifest.manifest_mac = await crypto.macHex(keys, crypto.canonicalJson(macBase))
  const { data, error } = await client.from('aqua_workspaces')
    .insert({ workspace_key: manifest.workspace_id, manifest })
    .select('id').single()
  if (error) {
    if (error.code === '23505') return json(200, { status: 'ok', already_initialized: true })
    return json(500, { error: 'write_failed', detail: error.message })
  }
  return json(201, { status: 'ok', workspace_id: data.id })
}
