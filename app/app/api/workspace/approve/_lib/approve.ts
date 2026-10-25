// Hosted human-approval write path (m10) — POST /api/workspace/approve.
//
// The remote equivalent of recordHumanApproval (app/lib/aqua-local/repo.ts):
// the client renders the exact wording, hashes the version record bytes it
// was shown, and POSTs that claim. The server NEVER computes the reviewed
// hash — it cannot (record bodies are client-encrypted) and must not try.
// What it enforces, the hard floor, is the stored-vs-claimed check: the
// sha256 already stored on the version row must equal the caller's
// expected_sha256, or the decision is refused. On a match the client-built
// encrypted approval record file lands as a new aqua_workspace_records row
// (unique path = O_EXCL) and a server-stamped receipt is appended to
// aqua_workspace_audit in the same request.
//
//   - Auth: Bearer Supabase JWT verified locally (lib/verify-jwt.ts). The
//     caller's identity comes only from the verified token; a body actor_id
//     is an advisory label, never the actor.
//   - Isolation: every PostgREST call carries the caller's own JWT + the
//     anon key — RLS (account_id = auth.uid()) does the isolation. No
//     service_role key is ever used or accepted here.
//   - The approval record stays client-encrypted (server sees ciphertext);
//     the binding is the hash check, not the content. The client-side
//     placeholder/attestation scans stay client-side advisory.
//   - Logs nothing that came from the request: the only log line is a fixed
//     string plus an error class name (same rule as the MCP endpoint).

import { createHash } from 'node:crypto'
import { readCappedText } from '../../../mcp/_vendor/catalog/rest.mjs'
import { rateLimitAllow } from '../../../../../lib/rate-limit.ts'

export const MAX_BODY_BYTES = 64 * 1024
const MAX_RECORD_BYTES = 40 * 1024  // ~53KB base64 — must stay under MAX_BODY_BYTES
const REST_TIMEOUT_MS = 15_000
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024

const T_WS = 'aqua_workspaces'
const T_REC = 'aqua_workspace_records'
const T_AUD = 'aqua_workspace_audit'
/** mirrors KINDS.approval.dirs.projection (aqua-companion workspace.mjs) */
const APPROVAL_DIR = 'answers/approved'
const AUDIT_LOG_NAME = 'hosted-approvals.jsonl'
const HOSTED_VIA = 'hosted_review'
const RECORD_FORMAT = 1 // aqua-companion RECORD_FORMAT — head is plaintext; enc/data stays opaque

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHA256_RE = /^[0-9a-f]{64}$/
const WS_KEY_RE = /^WS-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/
const PG_CODE = /^[A-Z0-9]{3,8}$/

type Env = Record<string, string | undefined>
type Verified = { id: string }
export type HostedApproveDeps = {
  env?: Env
  fetchImpl?: typeof fetch
  verifyJwt?: (token: string) => Promise<Verified>
  allow?: (key: string) => boolean
  now?: () => string
  reindex?: (a: { workspaceId: string; rid: string; path: string }) => Promise<boolean>
}

const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } })
}

const sha256hex = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

/** fileNameFor('approval', key) — mirrors aqua-companion workspace.mjs so the
    stored path lands where the companion's own writer would put it. */
function fileNameForApproval(key: string): string {
  const safe = SAFE_KEY.test(key) ? key : null
  return `approval-${safe ?? `h${hashName(key)}`}.json`
}

/** FNV-1a, same as workspace.mjs hashName: deterministic filesystem-safe name. */
function hashName(key: string): string {
  let h = 0x811c9dc5
  for (const ch of key) h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 0x01000193) >>> 0
  return `${h.toString(16).padStart(8, '0')}${key.length.toString(16)}`
}

type PgReply = { status: number; body: any; code: string | null }

/** One PostgREST call on the caller's own JWT. RLS does the isolation. */
async function pg(
  fetchImpl: typeof fetch,
  origin: string,
  key: string,
  jwt: string,
  method: string,
  table: string,
  opts: { params?: Record<string, string>; body?: unknown; prefer?: string } = {},
): Promise<PgReply> {
  const url = new URL(`/rest/v1/${table}`, origin)
  for (const [k, v] of Object.entries(opts.params ?? {})) url.searchParams.set(k, v)
  const headers: Record<string, string> = {
    apikey: key,
    authorization: `Bearer ${jwt}`,
    accept: 'application/json',
    'accept-profile': 'public',
  }
  if (opts.prefer) headers.prefer = opts.prefer
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetchImpl(url.toString(), {
      method,
      redirect: 'error',
      credentials: 'omit',
      signal: controller.signal,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
  } finally {
    clearTimeout(timer)
  }
  const text = await readCappedText(res, MAX_RESPONSE_BYTES)
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  const code = body && typeof body.code === 'string' && PG_CODE.test(body.code) ? body.code : null
  return { status: res.status, body, code }
}

/** PostgREST table-missing / not-exposed errors mean the hosted schema is
    not deployed in this project (migration 064 is gated). */
function schemaMissing(r: PgReply): boolean {
  return r.code === 'PGRST205' || r.code === '42P01' || (r.status === 404 && r.code !== '23505')
}

/** Postgres refused the caller's JWT/role (RLS, grants, expired token). */
function denied(r: PgReply): boolean {
  return r.code === '42501' || r.status === 401 || r.status === 403
}



export async function handleHostedApprove(req: Request, deps: HostedApproveDeps = {}): Promise<Response> {
  const env = deps.env ?? (process.env as Env)
  const fetchImpl = deps.fetchImpl ?? fetch
  const now = deps.now ?? (() => new Date().toISOString())
  const allow = deps.allow ?? ((key: string) => rateLimitAllow(key, 'hosted_approve'))
  const verifyJwt =
    deps.verifyJwt ??
    (async (token: string) => {
      const { verifySupabaseJWT } = await import('../../../../../lib/verify-jwt.ts')
      return verifySupabaseJWT(token)
    })
  try {
    const ctype = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (ctype !== 'application/json') return json(415, { error: 'unsupported_media_type' })
    const raw = await readCappedText(req, MAX_BODY_BYTES)
    if (raw === null) return json(413, { error: 'request_too_large' })
    let msg: unknown
    try {
      msg = JSON.parse(raw)
    } catch {
      return json(400, { error: 'bad_json' })
    }

    // Auth — the actor is stamped from the verified token, never from the body.
    const auth = req.headers.get('authorization') ?? ''
    if (!auth.startsWith('Bearer ')) return json(401, { error: 'unauthorized' })
    const jwt = auth.slice(7).trim()
    let user: Verified
    try {
      user = await verifyJwt(jwt)
    } catch {
      return json(401, { error: 'unauthorized' })
    }
    if (!user?.id) return json(401, { error: 'unauthorized' })
    if (!allow(user.id)) return json(429, { error: 'rate_limited' }, { 'retry-after': '60' })

    const origin = env.NEXT_PUBLIC_SUPABASE_URL
    const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!origin || !key) return json(503, { error: 'not_configured' })
    try {
      const { assertAnonKey } = await import('../../../mcp/_vendor/catalog/key.mjs')
      assertAnonKey(key)
    } catch {
      return json(503, { error: 'not_configured', detail: 'the configured key is not an anon/publishable key' })
    }

    // Body validation.
    const b = (msg ?? {}) as Record<string, unknown>
    const versionId = typeof b.version_id === 'string' ? b.version_id.trim() : ''
    if (!UUID_RE.test(versionId)) return json(400, { error: 'bad_version_id' })
    const expected = typeof b.expected_sha256 === 'string' ? b.expected_sha256.trim().toLowerCase() : ''
    if (!SHA256_RE.test(expected)) {
      return json(400, { error: 'bad_expected_sha256', detail: 'expected_sha256 must be the 64-hex hash of the record the human reviewed' })
    }
    if (b.via !== HOSTED_VIA) return json(400, { error: 'bad_via', expected: HOSTED_VIA })
    const actorLabel =
      typeof b.actor_id === 'string' && b.actor_id.trim() && b.actor_id.length <= 200 ? b.actor_id.trim() : null
    if (typeof b.record_b64 !== 'string' || !b.record_b64) return json(400, { error: 'bad_record' })
    const bytes = Buffer.from(b.record_b64, 'base64')
    if (bytes.toString('base64') !== b.record_b64.replace(/\s/g, '')) return json(400, { error: 'bad_record' })
    if (bytes.length === 0 || bytes.length > MAX_RECORD_BYTES) return json(400, { error: 'record_too_large' })
    const workspaceClaim = typeof b.workspace_id === 'string' ? b.workspace_id.trim() : null
    if (workspaceClaim !== null && !UUID_RE.test(workspaceClaim) && !WS_KEY_RE.test(workspaceClaim)) {
      return json(400, { error: 'bad_workspace_id' })
    }

    // The record head is plaintext by design (id/kind/scope/authority are the
    // indexed metadata the file table mirrors); enc/data stays opaque.
    let head: any
    try {
      head = JSON.parse(bytes.toString('utf8'))
    } catch {
      return json(400, { error: 'bad_record', detail: 'record_b64 is not an AQUA record file' })
    }
    if (
      !head ||
      head.aqua_record !== RECORD_FORMAT ||
      head.kind !== 'approval' ||
      typeof head.id !== 'string' ||
      !head.id.startsWith('approval:') ||
      typeof head.workspace_id !== 'string' ||
      !WS_KEY_RE.test(head.workspace_id)
    ) {
      return json(400, { error: 'bad_record', detail: 'record_b64 must be an AQUA approval record file' })
    }
    const approvalKey = head.id.slice('approval:'.length)
    if (!approvalKey) return json(400, { error: 'bad_record' })
    if (workspaceClaim && WS_KEY_RE.test(workspaceClaim) && workspaceClaim !== head.workspace_id) {
      return json(409, { error: 'workspace_mismatch' })
    }

    // Resolve the workspace row — RLS scopes this to the caller's own rows.
    const wsParams: Record<string, string> = { select: 'id,workspace_key', limit: '2' }
    if (workspaceClaim && UUID_RE.test(workspaceClaim)) wsParams.id = `eq.${workspaceClaim}`
    else wsParams.workspace_key = `eq.${head.workspace_id}`
    const wsRes = await pg(fetchImpl, origin, key, jwt, 'GET', T_WS, { params: wsParams })
    if (schemaMissing(wsRes)) return json(503, { error: 'not_configured' })
    if (denied(wsRes)) return json(403, { error: 'forbidden' })
    if (wsRes.status !== 200 || !Array.isArray(wsRes.body)) return json(502, { error: 'upstream' })
    if (!wsRes.body.length) return json(404, { error: 'workspace_not_found' })
    const ws = wsRes.body[0]
    if (ws.workspace_key !== head.workspace_id) return json(409, { error: 'workspace_mismatch' })

    // Locate the stored version row and re-check stored-vs-claimed — the
    // hard floor. The server never computes the reviewed hash.
    const vRes = await pg(fetchImpl, origin, key, jwt, 'GET', T_REC, {
      params: {
        workspace_id: `eq.${ws.id}`,
        select: 'id,path,rid,kind,status,sha256',
        or: `(rid.eq.version:${versionId},path.like.%/version-${versionId}.json,path.eq.version-${versionId}.json)`,
        limit: '10',
      },
    })
    if (schemaMissing(vRes)) return json(503, { error: 'not_configured' })
    if (denied(vRes)) return json(403, { error: 'forbidden' })
    if (vRes.status !== 200 || !Array.isArray(vRes.body)) return json(502, { error: 'upstream' })
    const rows = vRes.body.filter((r: any) => r && (r.kind == null || r.kind === 'version'))
    const live = rows.filter((r: any) => r.status === 'live')
    if (!rows.length) return json(404, { error: 'version_not_found' })
    if (!live.length) return json(409, { error: 'version_not_live' })
    if (live.length > 1) return json(409, { error: 'version_ambiguous' })
    const version = live[0]
    if (version.sha256 !== expected) {
      return json(409, {
        error: 'sha256_mismatch',
        detail: 'the stored version record no longer matches the reviewed hash — decision refused',
      })
    }

    // Atomic write: the RPC re-checks stored-vs-claimed sha256, inserts the
    // approval record row, and appends the audit receipt in ONE transaction —
    // no check-then-act window, no compensating delete. A seq race on the
    // audit unique key retries once with a fresh tail.
    const recPath = `${APPROVAL_DIR}/${fileNameForApproval(String(head.id).slice('approval:'.length))}`
    const recSha = sha256hex(bytes)
    let done = false, doneSeq = 0, doneAt = ''
    for (let attempt = 0; attempt < 2 && !done; attempt++) {
      const tail = await pg(fetchImpl, origin, key, jwt, 'GET', T_AUD, {
        params: { workspace_id: `eq.${ws.id}`, log_name: `eq.${AUDIT_LOG_NAME}`, select: 'entry,line', order: 'seq.desc', limit: '1' },
      })
      if (tail.status !== 200) return json(500, { error: 'audit_failed', detail: 'the approval receipt could not be prepared' })
      let seq = 1
      let prev: string | null = null
      const last = Array.isArray(tail.body) && tail.body.length ? tail.body[0] : null
      if (last) {
        const lastText = typeof last.line === 'string' ? last.line : JSON.stringify(last.entry)
        try { seq = (last.entry?.seq ?? 0) + 1 } catch { seq = 2 }
        prev = sha256hex(Buffer.from(lastText, 'utf8'))
      }
      const auditEntry = {
        at: now(), op: 'hosted_approval', version_id: versionId,
        version_sha256: expected, actor_id: user.id,
        ...(actorLabel ? { actor_label: actorLabel } : {}),
        via: HOSTED_VIA, record_path: recPath, record_sha256: recSha,
        decision: 'approved', actor_class: 'human', seq, prev,
      }
      const res = await pg(fetchImpl, origin, key, jwt, 'POST', 'rpc/aqua_workspace_approve', {
        body: {
          p_workspace_id: ws.id,
          p_version_path: version.path,
          p_expected_sha256: expected,
          p_record_path: recPath,
          p_record_b64: b.record_b64,
          p_rid: String(head.id),
          p_audit: { log_name: AUDIT_LOG_NAME, seq, entry: auditEntry, line: JSON.stringify(auditEntry), prev },
        },
        prefer: 'return=minimal',
      })
      if (res.status === 200 || res.status === 204) { done = true; doneSeq = seq; doneAt = auditEntry.at; break }
      const msg = String(res.body?.message ?? res.code ?? '')
      if (msg.includes('sha256_mismatch')) {
        return json(409, { error: 'sha256_mismatch', detail: 'the stored version record no longer matches the reviewed hash — decision refused' })
      }
      if (msg.includes('version_not_found')) {
        return json(409, { error: 'version_changed', detail: 'the version record changed while the decision was being written — nothing was approved' })
      }
      if (res.code === '23505' || msg.includes('23505') || msg.includes('duplicate key')) {
        const dupRes = await pg(fetchImpl, origin, key, jwt, 'GET', T_REC, {
          params: { workspace_id: `eq.${ws.id}`, path: `eq.${recPath}`, select: 'id,sha256', limit: '1' },
        })
        const dup = dupRes.status === 200 && Array.isArray(dupRes.body) && dupRes.body.length ? dupRes.body[0] : null
        if (dup && dup.sha256 === recSha) {
          const reindexed = await reindexApproval(deps, env, origin, key, jwt, ws.id, String(head.id), recPath, recSha, now())
          if (!reindexed) return json(500, { error: 'reindex_failed', detail: 'the approval exists but is not indexed — retry to index it' })
          return json(200, {
            status: 'ok', already_recorded: true, version_id: versionId, version_sha256: expected,
            actor_id: user.id, via: HOSTED_VIA, path: recPath, sha256: recSha,
          })
        }
        if (dup) return json(409, { error: 'approval_exists', detail: 'a different record already occupies this path' })
        if (attempt === 0) continue
      }
      console.error('approve rpc fail', res.status, res.code)
      return json(500, { error: 'write_failed', detail: msg || 'the approval could not be recorded' })
    }
    if (!done) return json(500, { error: 'audit_failed', detail: 'the approval receipt could not be written' })

    // The RPC writes record + audit atomically, but manifest.records is
    // engine-owned — index the approval through the unlocked store-backed
    // workspace so read_review_status, approvalGate and packets observe it.
    const reindexed = await reindexApproval(deps, env, origin, key, jwt, ws.id, String(head.id), recPath, recSha, doneAt)
    if (!reindexed) return json(500, { error: 'reindex_failed', detail: 'the approval was written but not indexed — retry the decision' })

    return json(200, {
      status: 'ok',
      version_id: versionId,
      version_sha256: expected,
      actor_id: user.id,
      via: HOSTED_VIA,
      path: recPath,
      sha256: recSha,
      audit_seq: doneSeq,
      at: doneAt,
    })
  } catch (e) {
    console.error('hosted approve: internal error', (e as Error)?.name ?? 'Error')
    return json(500, { error: 'internal' })
  }
}

/** Index an approval record into manifest.records via the store-backed engine.
 *  The server holds AQUA_PASSPHRASE; the manifest CAS (manifest_rev) serializes
 *  concurrent writers. content_mac comes from the engine's own decode. */
async function reindexApproval(
  deps: HostedApproveDeps, env: Env, origin: string, key: string, jwt: string,
  workspaceId: string, rid: string, recPath: string, recSha: string, at: string,
): Promise<boolean> {
  if (deps.reindex) return deps.reindex({ workspaceId, rid, path: recPath })
  const passphrase = env.AQUA_PASSPHRASE
  if (!passphrase) return false
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const { createSupabaseStore } = await import('../../../mcp/_vendor/workspace/companion/src/store/workspace-store.mjs')
    const { Workspace } = await import('../../../mcp/_vendor/workspace/companion/src/workspace.mjs')
    const client = createClient(origin, key, { global: { headers: { authorization: `Bearer ${jwt}` } } })
    const store = createSupabaseStore(client, workspaceId)
    const ctx = { env: {} as Record<string, string>, stderr: { write: () => true } }
    const w = await (Workspace as any).openStore(store, ctx)
    await w.unlock(passphrase)
    const decoded = await w.decodeFile(recPath)
    w.manifest.records[rid] = {
      kind: 'approval', path: recPath, authority: 'projection', scope: 'private',
      sha256: recSha, content_mac: decoded.contentMac, status: 'live',
      created_at: at, updated_at: at,
    }
    await w.saveManifest()
    return true
  } catch {
    return false
  }
}
