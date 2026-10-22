/**
 * In-memory rate limiter — keyed by `${user_id}:${action}`.
 * Acceptable for low-traffic beta; replace with Redis or Upstash when
 * we outgrow single-instance memory or need to survive cold starts.
 *
 * LIMITATION (M09 hardening M1): every limit in this module is PER
 * INSTANCE. Serverless platforms run many instances and recycle them, so a
 * determined caller can exceed these numbers by landing on fresh instances.
 * They bound accidental abuse and per-instance resource use (sockets, CPU);
 * DURABLE per-user / per-target limits need a shared store (a Postgres
 * counter table or a KV/Redis the deployment already has). No new provider
 * is added here on purpose — that is an owner/infra decision.
 */

type LimitConfig = { windowMs: number; max: number }

const LIMITS = {
  community_message: { windowMs: 60 * 60 * 1000, max: 10 },
  beta_check: { windowMs: 60 * 1000, max: 1 },
  exchange_company_signup: { windowMs: 60 * 60 * 1000, max: 3 },
  exchange_company_verify: { windowMs: 60 * 60 * 1000, max: 10 },
  exchange_agent_signup: { windowMs: 60 * 60 * 1000, max: 10 },
  exchange_proposal: { windowMs: 60 * 60 * 1000, max: 20 },
  exchange_request: { windowMs: 60 * 60 * 1000, max: 20 },
  exchange_message: { windowMs: 60 * 60 * 1000, max: 120 },
  catalog_candidate_submit: { windowMs: 60 * 60 * 1000, max: 10 },
  catalog_candidate_list: { windowMs: 60 * 1000, max: 60 },
  catalog_curator_action: { windowMs: 60 * 60 * 1000, max: 300 },
  // M09 W2: user-initiated public application URL extraction (outbound fetch)
  catalog_extract_url: { windowMs: 60 * 60 * 1000, max: 30 },
  // M09b: hosted read-only MCP endpoint (/mcp → /api/mcp), keyed by client IP
  mcp_hosted: { windowMs: 60 * 1000, max: 60 },
} satisfies Record<string, LimitConfig>

export type RateLimitAction = keyof typeof LIMITS
const hits = new Map<string, number[]>()
let lastGc = Date.now()
function maybeGc(now: number) {
  if (now - lastGc < 5 * 60 * 1000) return
  lastGc = now
  for (const [k, arr] of hits) {
    if (arr.length === 0 || arr[arr.length - 1] < now - 60 * 60 * 1000) hits.delete(k)
  }
}

export function rateLimitAllow(userId: string, action: RateLimitAction): boolean {
  const cfg = LIMITS[action]
  const now = Date.now()
  maybeGc(now)
  const key = `${userId}:${action}`
  const arr = hits.get(key) ?? []
  const cutoff = now - cfg.windowMs
  const fresh = arr.filter(t => t > cutoff)
  if (fresh.length >= cfg.max) { hits.set(key, fresh); return false }
  fresh.push(now); hits.set(key, fresh); return true
}

export function rateLimitRemaining(userId: string, action: RateLimitAction): number {
  const cfg = LIMITS[action]
  const arr = hits.get(`${userId}:${action}`) ?? []
  const cutoff = Date.now() - cfg.windowMs
  const fresh = arr.filter(t => t > cutoff).length
  return Math.max(0, cfg.max - fresh)
}

// ─── Outbound fetch concurrency (M09 hardening M1) ───────────────────────────
//
// Server-initiated outbound fetches (catalog extract-url, candidate
// url_fetch, curator recheck-source) hold a GLOBAL per-instance slot for the
// whole operation plus a PER-TARGET-HOST slot for every host they contact
// (redirect hops included). When a cap is reached the caller is refused
// immediately (no queueing), so one user — or many users aimed at one
// victim host — cannot pin this instance's sockets or hammer a single target.
// Per instance only; see the LIMITATION note at the top of this file.

export const OUTBOUND_FETCH_LIMITS = { maxGlobal: 8, maxPerHost: 2 } as const

export type OutboundRelease = () => void

export class OutboundFetchLimiter {
  readonly maxGlobal: number
  readonly maxPerHost: number
  private global = 0
  private readonly perHost = new Map<string, number>()

  constructor(opts: { maxGlobal: number; maxPerHost: number } = OUTBOUND_FETCH_LIMITS) {
    this.maxGlobal = Math.max(1, Math.floor(opts.maxGlobal))
    this.maxPerHost = Math.max(1, Math.floor(opts.maxPerHost))
  }

  /** One global slot, or null when the instance is at capacity. */
  acquireGlobal(): OutboundRelease | null {
    if (this.global >= this.maxGlobal) return null
    this.global++
    let released = false
    return () => { if (!released) { released = true; this.global-- } }
  }

  /** One slot for `host` (normalized lower-case, no trailing dot), or null at capacity. */
  acquireHost(host: string): OutboundRelease | null {
    const key = normalizeHost(host)
    const n = this.perHost.get(key) ?? 0
    if (n >= this.maxPerHost) return null
    this.perHost.set(key, n + 1)
    let released = false
    return () => {
      if (released) return
      released = true
      const left = (this.perHost.get(key) ?? 1) - 1
      if (left <= 0) this.perHost.delete(key)
      else this.perHost.set(key, left)
    }
  }

  stats(): { global: number; hosts: Record<string, number> } {
    return { global: this.global, hosts: Object.fromEntries(this.perHost) }
  }
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
}

/** Process-wide limiter shared by every outbound catalog fetch on this instance. */
export const outboundFetchLimiter = new OutboundFetchLimiter()
