// Hosted read-only MCP endpoint (aqua-mcp-server 2.0), served at
// https://aquaidp.xyz/mcp (middleware rewrites MCP transport requests on
// /mcp to /api/mcp). Streamable HTTP, stateless: every POST carries one
// JSON-RPC message and gets one JSON response; no SSE stream, no session id.
//
//   - public catalog tools, resources and prompts only (the vendored catalog
//     core from application-hub-mcp-server/src/catalog); no workspace tools;
//   - no auth: a server-side client with the public anon key only, refused
//     outright if the configured key is anything else;
//   - rate-limited per client IP (app/lib/rate-limit.ts, mcp_hosted);
//   - logs nothing that came from the request: the only log line is a fixed
//     string plus an error class name.

import { createHash } from 'node:crypto'
import { McpDispatcher, SUPPORTED_PROTOCOL_VERSIONS } from '../_vendor/catalog/protocol.mjs'
import { catalogBackend, CATALOG_INSTRUCTIONS } from '../_vendor/catalog/backend.mjs'
import { CatalogClient, readCappedText } from '../_vendor/catalog/rest.mjs'
import { CatalogData } from '../_vendor/catalog/data.mjs'
import { parseCatalogConfig } from '../_vendor/catalog/key.mjs'
import { CANONICAL_PROGRAM_SLUGS } from '../../../../lib/canonical-catalog.ts'
import { rateLimitAllow } from '../../../../lib/rate-limit.ts'

export const MAX_BODY_BYTES = 64 * 1024
/** Spec default when a request carries no MCP-Protocol-Version header. */
const ASSUMED_PROTOCOL_VERSION = '2025-03-26'
const DEFAULT_ALLOWED_ORIGINS = ['https://aquaidp.xyz', 'https://www.aquaidp.xyz']

export const HOSTED_INSTRUCTIONS = [
  CATALOG_INSTRUCTIONS,
  'This is the hosted read-only endpoint (https://aquaidp.xyz/mcp): public catalog tools only. For workspace tools the user runs npx -y aqua-mcp-server --workspace <dir> locally; steps at https://aquaidp.xyz/mcp.',
].join('\n')

type Env = Record<string, string | undefined>
type Limiter = (key: string) => boolean
export type HostedDeps = { env?: Env; fetchImpl?: typeof fetch; allow?: Limiter; now?: () => number }

const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } })
}
const rpcError = (status: number, code: number, message: string, extra: Record<string, string> = {}) =>
  json(status, { jsonrpc: '2.0', id: null, error: { code, message } }, extra)

let cached: { fingerprint: string; data: InstanceType<typeof CatalogData> | null } | null = null

/** The catalog for this instance: anon key only; null (tools answer "not configured") on any problem. */
export function hostedCatalog(env: Env, fetchImpl?: typeof fetch): InstanceType<typeof CatalogData> | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const fingerprint = createHash('sha256').update(`${url ?? ''}\n${key ?? ''}`).digest('hex')
  if (cached && cached.fingerprint === fingerprint && !fetchImpl) return cached.data
  let data: InstanceType<typeof CatalogData> | null = null
  try {
    const cfg = parseCatalogConfig({ supabase_url: url, publishable_key: key })
    data = new CatalogData(new CatalogClient(cfg, fetchImpl ? { fetchImpl } : {}), { allowSlugs: [...CANONICAL_PROGRAM_SLUGS] })
  } catch (e) {
    // a non-anon key (or a bad URL) is never used; the log names only the error class
    console.error('mcp hosted: catalog disabled', (e as Error)?.name ?? 'Error')
    data = null
  }
  if (!fetchImpl) cached = { fingerprint, data }
  return data
}

/**
 * Rate-limit key. Vercel sets x-vercel-forwarded-for and x-real-ip itself
 * (client values are overwritten); x-forwarded-for is the last resort, and
 * there its LAST entry (added by the nearest proxy) is used, not the
 * client-supplied first one. No IP at all shares one bucket.
 */
function clientKey(req: Request): string {
  const last = (h: string | null) => h?.split(',').map((s) => s.trim()).filter(Boolean).at(-1)
  const ip = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim() || last(req.headers.get('x-forwarded-for')) || 'unknown'
  return `mcp-ip:${createHash('sha256').update(ip).digest('hex').slice(0, 24)}`
}

function originAllowed(origin: string | null, env: Env): boolean {
  // Non-browser clients send no Origin. Without one there is no DNS-rebinding
  // vector, and the endpoint is unauthenticated and read-only anyway.
  if (!origin) return true
  const extra = (env.AQUA_MCP_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const local = env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : []
  return [...DEFAULT_ALLOWED_ORIGINS, ...extra, ...local].includes(origin)
}

function acceptsJson(accept: string | null): boolean {
  if (!accept) return true
  return accept.split(',').map((s) => s.split(';')[0].trim().toLowerCase()).some((t) => t === 'application/json' || t === 'application/*' || t === '*/*')
}

export async function handleMcpPost(req: Request, deps: HostedDeps = {}): Promise<Response> {
  const env = deps.env ?? (process.env as Env)
  const allow: Limiter = deps.allow ?? ((key) => rateLimitAllow(key, 'mcp_hosted'))
  try {
    // DNS-rebinding protection (MCP Streamable HTTP: servers must validate Origin)
    if (!originAllowed(req.headers.get('origin'), env)) return rpcError(403, -32600, 'Forbidden origin')
    const pv = req.headers.get('mcp-protocol-version')
    if (pv && !SUPPORTED_PROTOCOL_VERSIONS.includes(pv)) return rpcError(400, -32600, `Unsupported MCP-Protocol-Version. Supported: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')}`)
    if (!acceptsJson(req.headers.get('accept'))) return rpcError(406, -32600, 'Not Acceptable: this endpoint answers application/json')
    const ctype = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (ctype !== 'application/json') return rpcError(415, -32600, 'Unsupported Media Type: send application/json')
    if (!allow(clientKey(req))) return rpcError(429, -32000, 'Rate limit exceeded; retry in a minute', { 'retry-after': '60' })
    // streamed with a byte cap: a chunked body without Content-Length cannot exceed it
    const raw = await readCappedText(req, MAX_BODY_BYTES)
    if (raw === null) return rpcError(413, -32600, 'Request too large')
    let msg: unknown
    try {
      msg = JSON.parse(raw)
    } catch {
      return rpcError(400, -32700, 'Parse error')
    }
    if (Array.isArray(msg)) return rpcError(400, -32600, 'Invalid Request: JSON-RPC batches are not supported')
    const m = msg as { id?: unknown; method?: unknown; result?: unknown; error?: unknown } | null
    // notifications and responses: accepted, nothing to return
    if (m && typeof m === 'object' && (!('id' in m) || (!('method' in m) && ('result' in m || 'error' in m)))) {
      return new Response(null, { status: 202, headers: { 'cache-control': 'no-store' } })
    }
    const backend = catalogBackend({ data: hostedCatalog(env, deps.fetchImpl), instructions: HOSTED_INSTRUCTIONS, hasWorkspace: false, ...(deps.now ? { now: deps.now } : {}) })
    const dispatcher = new McpDispatcher(backend, { requireInitialize: false, allowBatch: false, defaultProtocolVersion: pv ?? ASSUMED_PROTOCOL_VERSION })
    const out = await dispatcher.handleMessage(msg)
    if (!out) return new Response(null, { status: 202, headers: { 'cache-control': 'no-store' } })
    return json(200, out)
  } catch (e) {
    console.error('mcp hosted: internal error', (e as Error)?.name ?? 'Error')
    return rpcError(500, -32603, 'Internal error')
  }
}

/** GET: no server-initiated SSE stream on this endpoint (stateless). */
export function handleMcpGet(): Response {
  return new Response('This MCP endpoint does not offer an SSE stream. POST JSON-RPC to /mcp. Docs: https://aquaidp.xyz/mcp\n', {
    status: 405,
    headers: { allow: 'POST, OPTIONS', 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** DELETE: there are no sessions to end. */
export function handleMcpDelete(): Response {
  return new Response(null, { status: 405, headers: { allow: 'POST, OPTIONS', 'cache-control': 'no-store' } })
}

export function handleMcpOptions(): Response {
  return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS', 'cache-control': 'no-store' } })
}
