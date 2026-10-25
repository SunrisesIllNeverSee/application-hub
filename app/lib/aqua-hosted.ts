// m10 — client calls to the hosted workspace HTTP endpoints.
//
// These are the ONLY paths in the app that talk to /api/workspace/* — the
// hosted-workspace counterpart of the vault write APIs. The local-first
// vault (lib/aqua-local) stays the default and is untouched here; this
// module exists so the review surface can opt a decision into the caller's
// hosted workspace too.
//
// Boundary rules kept identical to the server side:
//   - auth is the user's own Supabase access token (Bearer), never a
//     service key; RLS does the account isolation;
//   - approve sends the CONTENT hash the human reviewed —
//     expected_sha256 = sha256(canonicalJson({title, body})), the same
//     value the vault stores as version.sha256 and the card displays;
//   - the record is server-built (no record_b64): the unlocked engine
//     encodes the approval record itself;
//   - errors surface honestly: a non-2xx {error, detail} body is thrown
//     as HostedApiError, never swallowed or rewritten.

export const HOSTED_INIT_PATH = '/api/workspace/init'
export const HOSTED_APPROVE_PATH = '/api/workspace/approve'
/** The only `via` the hosted approve endpoint accepts. */
export const HOSTED_VIA = 'hosted_review' as const

export class HostedApiError extends Error {
  /** HTTP status (0 for a transport/client-side failure). */
  readonly status: number
  /** The server's {error} code, or a local code when there is none. */
  readonly code: string
  constructor(status: number, code: string, detail?: string | null) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'HostedApiError'
    this.status = status
    this.code = code
  }
}

export interface HostedDeps {
  /** Injectable for tests; defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch
  /** Origin prefix for the endpoint path ('' = same origin). */
  baseUrl?: string
}

export interface HostedInitResult {
  status: 'ok'
  workspace_id?: string
  already_initialized?: boolean
  [k: string]: unknown
}

export interface HostedApproveInput {
  /** Entered by the human for this decision; never read from the vault or saved. */
  approval_secret: string
  /** The hosted workspace version row id (version:<id> rid suffix). */
  version_id: string
  /** sha256(canonicalJson({title, body})) — the hash the human reviewed. */
  expected_sha256: string
  /** Advisory label only — the server stamps the actor from the JWT. */
  actor_id?: string | null
}

export interface HostedApproveResult {
  status: 'ok'
  version_id: string
  version_sha256: string
  actor_id: string
  via: typeof HOSTED_VIA
  already_recorded?: boolean
  path?: string
  sha256?: string
  audit_seq?: number
  at?: string
  [k: string]: unknown
}

async function postJson<T>(path: string, body: unknown, token: string, deps: HostedDeps): Promise<T> {
  const fetchImpl = deps.fetchImpl ?? fetch
  let res: Response
  try {
    res = await fetchImpl(`${deps.baseUrl ?? ''}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      credentials: 'omit',
      body: JSON.stringify(body),
    })
  } catch (e) {
    throw new HostedApiError(0, 'request_failed', e instanceof Error ? e.message : String(e))
  }
  let parsed: Record<string, unknown> = {}
  try {
    parsed = (await res.json()) as Record<string, unknown>
  } catch {
    parsed = {}
  }
  if (!res.ok) {
    // local-first refusal (403 {error: 'local-first mode: …', local_first:
    // true}) — keep a machine-readable code so callers can map it to a
    // deployment-level message instead of echoing a sentence as a "code".
    if (parsed.local_first === true) {
      const msg = typeof parsed.error === 'string' ? parsed.error : null
      throw new HostedApiError(res.status, 'local_first', msg)
    }
    const code = typeof parsed.error === 'string' && parsed.error ? parsed.error : `http_${res.status}`
    const detail = typeof parsed.detail === 'string' ? parsed.detail : null
    throw new HostedApiError(res.status, code, detail)
  }
  return parsed as T
}

/**
 * Provision the caller's hosted workspace with explicit storage consent
 * and the human's approval secret. A bare token never provisions storage. Idempotent:
 * an existing workspace answers already_initialized.
 */
export async function hostedInit(token: string, approvalSecret: string, deps: HostedDeps = {}): Promise<HostedInitResult> {
  return postJson<HostedInitResult>(HOSTED_INIT_PATH, {
    consent_hosted_workspace: true,
    approval_secret: requireApprovalSecret(approvalSecret),
  }, token, deps)
}

function requireApprovalSecret(value: string): string {
  const secret = typeof value === 'string' ? value.trim() : ''
  if (secret.length < 8) {
    throw new HostedApiError(0, 'approval_secret_required', 'Enter your hosted approval secret (at least 8 characters).')
  }
  return secret
}

/**
 * Record a human approval on the hosted workspace (server-built mode).
 * The server re-checks stored-vs-claimed: the version's live content hash
 * must equal expected_sha256 or the decision is refused (409).
 */
export async function hostedApprove(input: HostedApproveInput, token: string, deps: HostedDeps = {}): Promise<HostedApproveResult> {
  return postJson<HostedApproveResult>(
    HOSTED_APPROVE_PATH,
    {
      version_id: input.version_id,
      expected_sha256: input.expected_sha256,
      approval_secret: requireApprovalSecret(input.approval_secret),
      via: HOSTED_VIA,
      ...(input.actor_id ? { actor_id: input.actor_id } : {}),
    },
    token,
    deps,
  )
}

// ---------------------------------------------------------------------------
// Session + workspace-row helpers (browser only — the @/ import stays lazy so
// this module also loads under plain-node test runners).
// ---------------------------------------------------------------------------

export interface SupabaseLike {
  from: (table: string) => any
  auth?: { getSession: () => Promise<{ data: { session: { access_token?: string | null; user?: { id?: string } | null } | null } }> }
}

/** The signed-in user's access token, or null (signed out / no session). */
export async function getAccessToken(client?: SupabaseLike): Promise<string | null> {
  const c = client ?? (await import('@/lib/supabase/client')).createClient()
  const { data } = await c.auth!.getSession()
  return data.session?.access_token ?? null
}

export interface HostedWorkspaceRow {
  id: string
  workspace_key?: string | null
}

/**
 * The caller's hosted workspace row, RLS-scoped by the session the client
 * already carries (aqua_workspaces selects run under account_id = auth.uid()).
 * Returns null when the user has no hosted workspace.
 */
export async function findHostedWorkspace(client?: SupabaseLike): Promise<HostedWorkspaceRow | null> {
  const c = client ?? (await import('@/lib/supabase/client')).createClient()
  const { data, error } = await c
    .from('aqua_workspaces')
    .select('id, workspace_key')
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) {
    throw new HostedApiError(0, 'workspace_lookup_failed', error.message ?? error.code ?? 'aqua_workspaces query failed')
  }
  return data && data.length ? (data[0] as HostedWorkspaceRow) : null
}
