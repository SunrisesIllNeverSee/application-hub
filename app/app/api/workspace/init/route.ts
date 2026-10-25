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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.AQUA_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.AQUA_PUBLISHABLE_KEY
  if (!url || !key) return json(503, { error: 'not_configured' })

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
  const { manifest } = await ws.newManifest(passphrase)
  const { data, error } = await client.from('aqua_workspaces')
    .insert({ workspace_key: manifest.workspace_id, manifest })
    .select('id').single()
  if (error) return json(500, { error: 'write_failed', detail: error.message })
  return json(201, { status: 'ok', workspace_id: data.id })
}
