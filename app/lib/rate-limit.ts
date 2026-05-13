/**
 * In-memory rate limiter — keyed by `${user_id}:${action}`.
 * Acceptable for low-traffic beta; replace with Redis or Upstash when
 * we outgrow single-instance memory or need to survive cold starts.
 *
 * Limits configured per action:
 *   - community_message: 10 / hour
 *   - beta_check: 1 / minute
 */

type LimitConfig = { windowMs: number; max: number }

const LIMITS: Record<string, LimitConfig> = {
  community_message: { windowMs: 60 * 60 * 1000, max: 10 },
  beta_check: { windowMs: 60 * 1000, max: 1 },
}

// hits.get(key) -> array of timestamps inside the current window
const hits = new Map<string, number[]>()

// Periodically GC dead keys to bound memory.
let lastGc = Date.now()
function maybeGc(now: number) {
  if (now - lastGc < 5 * 60 * 1000) return
  lastGc = now
  for (const [k, arr] of hits) {
    if (arr.length === 0 || arr[arr.length - 1] < now - 60 * 60 * 1000) {
      hits.delete(k)
    }
  }
}

export function rateLimitAllow(userId: string, action: keyof typeof LIMITS): boolean {
  const cfg = LIMITS[action]
  if (!cfg) return true
  const now = Date.now()
  maybeGc(now)
  const key = `${userId}:${action}`
  const arr = hits.get(key) ?? []
  // drop expired
  const cutoff = now - cfg.windowMs
  const fresh = arr.filter(t => t > cutoff)
  if (fresh.length >= cfg.max) {
    hits.set(key, fresh)
    return false
  }
  fresh.push(now)
  hits.set(key, fresh)
  return true
}

export function rateLimitRemaining(userId: string, action: keyof typeof LIMITS): number {
  const cfg = LIMITS[action]
  if (!cfg) return Infinity
  const arr = hits.get(`${userId}:${action}`) ?? []
  const cutoff = Date.now() - cfg.windowMs
  const fresh = arr.filter(t => t > cutoff).length
  return Math.max(0, cfg.max - fresh)
}
