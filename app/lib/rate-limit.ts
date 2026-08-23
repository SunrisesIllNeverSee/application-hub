/**
 * In-memory rate limiter — keyed by `${user_id}:${action}`.
 * Acceptable for low-traffic beta; replace with Redis or Upstash when
 * we outgrow single-instance memory or need to survive cold starts.
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
