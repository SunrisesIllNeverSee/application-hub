// Hosted personal-workspace MCP endpoint — the authenticated surface of the
// same public URL: a POST to /mcp carrying `Authorization: Bearer <Supabase
// access token>` is dispatched here from ../route.ts instead of the catalog
// handler. Same stateless Streamable HTTP rules as hosted.ts (one JSON-RPC
// message per POST, one JSON response, no SSE, no session id), plus:
//
//   - auth required: the JWT is verified locally against Supabase JWKS
//     (app/lib/verify-jwt.ts). Missing or invalid -> 401 with
//     WWW-Authenticate pointing at the RFC 9728 metadata
//     (/.well-known/oauth-protected-resource);
//   - rate-limited twice: per client IP (mcp_hosted, shared with the catalog
//     surface) and per verified user (mcp_workspace, sha256 of the user id);
//   - 10 MB body cap: private_write workspace tools carry content arguments
//     (draft text, extracted files), unlike the read-only catalog surface;
//   - workspace tools resolve against the caller's hosted workspace: a
//     supabase-js client built with the caller's own JWT (anon/publishable
//     key only — the service role is never used) over the migration-064
//     tables, so Postgres RLS does the account isolation;
//   - catalog tools, resources and prompts keep working identically to the
//     unauthenticated surface (anon key, read-only).
//
// No ambient authority: callers must hold the token, so the Origin check is
// the same DNS-rebinding guard as the public surface — a Bearer credential
// is never sent by a browser on behalf of another origin's page.

import { createHash } from 'node:crypto'
import { McpDispatcher, SUPPORTED_PROTOCOL_VERSIONS } from '../_vendor/catalog/protocol.mjs'
import { catalogBackend, CATALOG_INSTRUCTIONS } from '../_vendor/catalog/backend.mjs'
import { readCappedText } from '../_vendor/catalog/rest.mjs'
import { ResourceNotFound } from '../_vendor/catalog/resources.mjs'
import { assertAnonKey } from '../_vendor/catalog/key.mjs'
import { WORKSPACE_TOOL_DEFS } from '../_vendor/workspace/workspace-tools.mjs'
import { createSupabaseStore } from '../_vendor/workspace/companion/src/store/workspace-store.mjs'
import {
  acceptsJson, ASSUMED_PROTOCOL_VERSION, clientKey, hostedCatalog, json, originAllowed, rpcError, type Env,
} from './hosted.ts'
import { rateLimitAllow, type RateLimitAction } from '../../../../lib/rate-limit.ts'

/** Private-write tools accept content arguments (drafts, evidence files): bigger cap than the catalog surface. */
// covers the content-arg upload tools (5MB decoded ~= 6.7MB b64);
// evidence/packet/vault-export uploads exceed any JSON-RPC transport and
// need the staged-blob path (HOSTED-MCP-FEASIBILITY.md) — not this cap
export const MAX_WORKSPACE_BODY_BYTES = 10 * 1024 * 1024
export const WORKSPACE_RESOURCE_METADATA = 'https://aquaidp.xyz/.well-known/oauth-protected-resource'
const WORKSPACE_STATUS_URI = 'aqua://workspace/status'

export const WORKSPACE_INSTRUCTIONS = [
  CATALOG_INSTRUCTIONS,
  'This is the hosted workspace endpoint (POST https://aquaidp.xyz/mcp with a Bearer token): the public catalog tools plus the AQUA workspace tools, resolved per request against the caller\'s own hosted workspace (migration-064 tables; the server stores ciphertext at rest; plaintext transiently in-request (server-held passphrase)). Approvals, signatures and submission still happen in the AQUA browser app, by the user. When no hosted workspace exists for the account, workspace tools answer workspace_not_initialized.',
].join('\n')

type Limiter = (key: string, action: RateLimitAction) => boolean
type VerifiedToken = { id: string }
type WorkspaceRow = { id: string; workspace_key?: string }
/** Minimal shape of the supabase-js client + the hosted store, for dep injection. */
type SupabaseLike = { from: (t: string) => any; rpc?: (fn: string, args?: any) => any }
type StoreLike = { loadManifest: () => Promise<{ manifest: unknown; rev: number | null } | null> }
/** The future store-backed companion session must satisfy this contract. */
export type HostedSession = {
  callTool: (name: string, args: unknown) => Promise<{ result: unknown; isError?: boolean }>
  readStatus?: () => Promise<unknown>
}
type WorkspaceCtx = { row: WorkspaceRow; store: StoreLike; manifest: unknown }

export type WorkspaceDeps = {
  env?: Env
  fetchImpl?: typeof fetch
  allow?: Limiter
  now?: () => number
  verifyToken?: (token: string) => Promise<VerifiedToken>
  createClient?: (env: Env, jwt: string) => SupabaseLike | Promise<SupabaseLike>
  findWorkspace?: (client: SupabaseLike) => Promise<WorkspaceRow | null>
  storeFactory?: (client: SupabaseLike, workspaceRowId: string) => StoreLike
  sessionFactory?: (ws: WorkspaceCtx) => HostedSession | Promise<HostedSession>
}

/** The Bearer credential, or null when the request carries none (RFC 6750 header form). */
export function bearerToken(req: Request): string | null {
  const m = /^Bearer[ \t]+(\S+)/i.exec((req.headers.get('authorization') ?? '').trim())
  return m ? m[1] : null
}

function unauthorized(invalid: boolean): Response {
  const challenge = `Bearer resource_metadata="${WORKSPACE_RESOURCE_METADATA}"` + (invalid ? ', error="invalid_token"' : '')
  return rpcError(401, -32000, invalid ? 'Unauthorized: the bearer token did not verify' : 'Unauthorized: this endpoint needs Authorization: Bearer <access token>', {
    'www-authenticate': challenge,
  })
}

async function defaultVerifyToken(token: string): Promise<VerifiedToken> {
  const { verifySupabaseJWT } = await import('../../../../lib/verify-jwt.ts')
  return verifySupabaseJWT(token)
}

/**
 * The caller-scoped Data API client: anon/publishable key plus the caller's
 * own JWT, so every query runs under that user's RLS. The anon key goes
 * through the same role check as the catalog client — a service-role or
 * secret key in the environment is refused before any request is made.
 */
async function defaultCreateClient(env: Env, jwt: string): Promise<SupabaseLike> {
  const { createClient } = await import('@supabase/supabase-js')
  assertAnonKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  return createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  }) as unknown as SupabaseLike
}

/**
 * The caller's hosted workspace row. RLS restricts the query to the caller's
 * own rows; when an account has several (unique(account_id, workspace_key))
 * the earliest created is the personal default until the app grows a
 * workspace picker.
 */
async function findWorkspaceRow(client: SupabaseLike): Promise<WorkspaceRow | null> {
  const { data, error } = await client
    .from('aqua_workspaces')
    .select('id, workspace_key')
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw new Error(`aqua_workspaces lookup failed: ${error.code ?? error.message ?? 'unknown'}`)
  return data && data.length ? (data[0] as WorkspaceRow) : null
}

/**
 * Session-init failures that map to a clean hosted_backend_unavailable tool
 * result instead of a 500: missing deployment secrets, a passphrase that does
 * not open the workspace, a corrupt/absent manifest mid-flight. Anything else
 * is a bug and propagates to the outer 500 handler.
 */
const SESSION_INIT_ERRORS = new Set(['SecretUnavailableError', 'DecryptError', 'WorkspaceError', 'StoreUnsupportedError'])

/**
 * Per-request session over the caller's hosted store: the real companion
 * engine — a store-backed aqua-companion Session (Workspace.openStore over
 * createSupabaseStore; vendored at ../_vendor/workspace/companion/). Every
 * tool call re-opens the workspace through the store (same re-open-per-call
 * semantics as the stdio server), and the store only ever sees ciphertext:
 * the workspace passphrase comes from the deployment environment
 * (AQUA_PASSPHRASE), never from the request.
 *
 * Honest limits on this surface: tools that need a local filesystem refuse
 * with a named store_unsupported:<method> error — inbox file reads (`file`
 * args; content uploads via file_name + content_base64 work), inbox folder
 * walks, vault-backup import (sync_from_vault_export), and exports/ file
 * writes (present_review_decisions, assemble_application,
 * prepare_catalog_candidate skip saving the file — its payload still returns
 * in untrusted_content where the tool has one).
 */
async function defaultSessionFactory(ws: WorkspaceCtx, env: Env, fetchImpl?: typeof fetch): Promise<HostedSession> {
  // vendored .mjs: untyped on purpose (the companions's JSDoc types are not the TS contract here)
  const { Session } = (await import('../_vendor/workspace/companion/src/registry.mjs')) as any
  const { loadModel } = (await import('../_vendor/workspace/companion/src/mcp-model.mjs')) as any
  const sessionEnv = {
    ...process.env,
    // public-catalog config for the store session: same project, the
    // anon/publishable key only (the companion key check enforces the role)
    AQUA_SUPABASE_URL: process.env.AQUA_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
    AQUA_PUBLISHABLE_KEY: process.env.AQUA_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
  const session = await new Session(
    { env: sessionEnv, cwd: process.cwd(), stderr: { write: () => true } },
    { fetchImpl },
  ).init({ store: ws.store, workspaceRef: ws.row.id })
  return {
    async callTool(name: string, args: unknown) {
      const r = await session.callTool(name, args)
      if (r?.unknown) return { result: { tool: name, status: 'error', error: 'unknown_tool' }, isError: true }
      return { result: r.result, isError: Boolean(r.isError) }
    },
    async readStatus() {
      const w = await session.openWorkspace()
      const model = await loadModel(w, session.vaultSecret)
      const applications = []
      for (const instance_id of model.instances.keys()) {
        applications.push((await session.callTool('read_review_status', { application_id: instance_id })).result)
      }
      return { status: 'ok', workspace_id: session.workspaceId ?? null, applications }
    },
  }
}

/** Result mirroring the companion's notInitialized shape (registry.mjs). */
function notInitializedResult(def: { name: string; tier: string }) {
  return {
    tool: def.name,
    tier: def.tier,
    status: 'workspace_not_initialized',
    message: 'No hosted AQUA workspace exists for this account. Workspace tools work once one is provisioned.',
    next_steps: [
      'Provision a hosted workspace for this account in the AQUA app (hosted workspace creation is part of the same m10 rollout).',
      'Approvals, signatures and submission always happen in the AQUA browser app, by the user — never through this endpoint.',
    ],
  }
}

/** Result when a hosted workspace exists but its tool session could not be opened. */
function backendUnavailableResult(def: { name: string; tier: string }, detail: string | null = null) {
  return {
    tool: def.name,
    tier: def.tier,
    status: 'error',
    error: 'hosted_backend_unavailable',
    message: `The hosted workspace exists, but its tool session could not be opened${detail ? ` (${detail})` : ''}. The workspace passphrase must be in the server environment (AQUA_PASSPHRASE) and must open this workspace.`,
  }
}

/**
 * The per-request backend: public catalog plus the workspace tool set
 * resolved against the caller's hosted store. With no hosted workspace the
 * tools stay callable (answering workspace_not_initialized) but unlisted —
 * the same contract the stdio server uses in its no-workspace mode.
 */
const defaultStoreFactory = (client: SupabaseLike, workspaceRowId: string): StoreLike =>
  createSupabaseStore(client, workspaceRowId) as StoreLike

async function workspaceBackend(env: Env, jwt: string, deps: WorkspaceDeps) {
  const client = await (deps.createClient ?? defaultCreateClient)(env, jwt)
  const row = await (deps.findWorkspace ?? findWorkspaceRow)(client)
  let ws: WorkspaceCtx | null = null
  if (row) {
    const store = (deps.storeFactory ?? defaultStoreFactory)(client, row.id)
    const loaded = await store.loadManifest()
    if (loaded) ws = { row, store, manifest: loaded.manifest }
  }
  let session: HostedSession | null = null
  let sessionError: string | null = null
  if (ws) {
    try {
      session = await (deps.sessionFactory ?? ((w: WorkspaceCtx) => defaultSessionFactory(w, env, deps.fetchImpl)))(ws)
    } catch (e) {
      if (!SESSION_INIT_ERRORS.has((e as Error)?.name ?? '')) throw e
      sessionError = (e as Error).name
      console.error('mcp workspace: session init failed', sessionError)
    }
  }
  const defs = WORKSPACE_TOOL_DEFS.filter((d) => !d.setup) as Array<{ name: string; tier: string; description: string; inputSchema: unknown; title?: string }>
  const extraTools = defs.map((def) => ({
    def,
    call: async (args: unknown) => {
      if (!ws) return { result: notInitializedResult(def), isError: true }
      if (!session) return { result: backendUnavailableResult(def, sessionError), isError: true }
      return session.callTool(def.name, args)
    },
  }))
  const base = catalogBackend({
    data: hostedCatalog(env, deps.fetchImpl),
    extraTools,
    instructions: WORKSPACE_INSTRUCTIONS,
    hasWorkspace: Boolean(ws),
    ...(deps.now ? { now: deps.now } : {}),
  })
  const wsNames = new Set(defs.map((d) => d.name))
  const statusResource = {
    uri: WORKSPACE_STATUS_URI,
    name: 'workspace-status',
    title: 'Workspace review status',
    description: 'Review status of every application in the hosted workspace (gap, suggested, needs evidence, under review, approved) from read_review_status.',
    mimeType: 'application/json',
  }
  return {
    ...base,
    listTools: (pv: string) => base.listTools(pv).filter((t: { name: string }) => Boolean(ws) || !wsNames.has(t.name)),
    listResources: () => [...(session?.readStatus ? [statusResource] : []), ...base.listResources()],
    async readResource(uri: string) {
      if (uri === WORKSPACE_STATUS_URI) {
        if (session?.readStatus) {
          return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(await session.readStatus(), null, 2) }] }
        }
        throw new ResourceNotFound(uri)
      }
      return base.readResource(uri)
    },
  }
}

export async function handleWorkspaceMcpPost(req: Request, deps: WorkspaceDeps = {}): Promise<Response> {
  const env = deps.env ?? (process.env as Env)
  const allow: Limiter = deps.allow ?? ((key, action) => rateLimitAllow(key, action))
  try {
    // Same guard chain as the catalog surface (./hosted.ts).
    if (!originAllowed(req.headers.get('origin'), env)) return rpcError(403, -32600, 'Forbidden origin')
    const pv = req.headers.get('mcp-protocol-version')
    if (pv && !SUPPORTED_PROTOCOL_VERSIONS.includes(pv)) return rpcError(400, -32600, `Unsupported MCP-Protocol-Version. Supported: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')}`)
    if (!acceptsJson(req.headers.get('accept'))) return rpcError(406, -32600, 'Not Acceptable: this endpoint answers application/json')
    const ctype = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (ctype !== 'application/json') return rpcError(415, -32600, 'Unsupported Media Type: send application/json')
    if (!allow(clientKey(req), 'mcp_hosted')) return rpcError(429, -32000, 'Rate limit exceeded; retry in a minute', { 'retry-after': '60' })
    // Bearer required, verified locally (JWKS); the user id keys the per-user limit.
    const jwt = bearerToken(req)
    if (!jwt) return unauthorized(false)
    let user: VerifiedToken
    try {
      user = await (deps.verifyToken ?? defaultVerifyToken)(jwt)
    } catch {
      return unauthorized(true)
    }
    if (!user?.id) return unauthorized(true)
    const userKey = `mcp-user:${createHash('sha256').update(user.id).digest('hex').slice(0, 24)}`
    if (!allow(userKey, 'mcp_workspace')) return rpcError(429, -32000, 'Rate limit exceeded; retry in a minute', { 'retry-after': '60' })
    // Streamed with a byte cap: a chunked body without Content-Length cannot exceed it.
    const raw = await readCappedText(req, MAX_WORKSPACE_BODY_BYTES)
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
    const backend = await workspaceBackend(env, jwt, deps)
    const dispatcher = new McpDispatcher(backend, { requireInitialize: false, allowBatch: false, defaultProtocolVersion: pv ?? ASSUMED_PROTOCOL_VERSION })
    const out = await dispatcher.handleMessage(msg)
    if (!out) return new Response(null, { status: 202, headers: { 'cache-control': 'no-store' } })
    return json(200, out)
  } catch (e) {
    console.error('mcp workspace: internal error', (e as Error)?.name ?? 'Error')
    return rpcError(500, -32603, 'Internal error')
  }
}
