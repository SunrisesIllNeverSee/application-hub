/**
 * Beta mode helpers — single source of truth for beta lifecycle checks.
 *
 * BETA_MODE: 'true' while we're in public beta. Gates Pro pricing display,
 *   trial length in Stripe checkout, beta_participant flag capture.
 * BETA_END_DATE: ISO date when beta ends. Used by /api/beta/check to
 *   trigger the grace-period or basic-tier transition.
 *
 * NEXT_PUBLIC_BETA_MODE: client-readable mirror. Required for client
 *   components (e.g. PricingCards) that need to gate UI on beta state.
 */

export function isBetaMode(): boolean {
  // Prefer server-only flag; fall back to public mirror for client components.
  return (
    process.env.BETA_MODE === 'true' ||
    process.env.NEXT_PUBLIC_BETA_MODE === 'true'
  )
}

export function getBetaEndDate(): Date | null {
  const raw = process.env.BETA_END_DATE ?? process.env.NEXT_PUBLIC_BETA_END_DATE
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

export function isBetaOver(): boolean {
  const end = getBetaEndDate()
  return end ? new Date() > end : false
}

export function betaDaysRemaining(): number | null {
  const end = getBetaEndDate()
  if (!end) return null
  const ms = end.getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}
