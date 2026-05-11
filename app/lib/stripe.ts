import Stripe from 'stripe'

// Server-side Stripe client — never import from client components
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    // NOTE: pinning a specific apiVersion is Stripe best practice — it shields
    // you from breaking changes when Stripe rolls forward. Bump deliberately
    // alongside SDK upgrades. See https://docs.stripe.com/api/versioning.
    //
    // We pin to the SDK's typed default (Stripe.LatestApiVersion) so the
    // TypeScript Stripe.* types match what API calls return.
    //
    // The webhook endpoint on the Dashboard may be configured to a slightly
    // different api_version (e.g. 2026-03-25.dahlia). Stripe sends webhook
    // payloads in the endpoint's configured version, not this one. Our handler
    // is written against shapes that are common to both — period dates read
    // from subscription.items[0], not the deprecated root-level fields.
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-04-22.dahlia',
    })
  }
  return _stripe
}

// Price ID resolution helpers
export type SubscriptionTier = 'pro' | 'team'
export type BillingInterval = 'monthly' | 'annual'

export function getPriceId(tier: SubscriptionTier, interval: BillingInterval): string {
  const map: Record<SubscriptionTier, Record<BillingInterval, string | undefined>> = {
    pro: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
    },
    team: {
      monthly: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,
      annual: process.env.STRIPE_TEAM_ANNUAL_PRICE_ID,
    },
  }

  const priceId = map[tier][interval]
  if (!priceId) {
    throw new Error(`Price ID not configured for tier=${tier} interval=${interval}`)
  }
  return priceId
}

// Client-side publishable key hint (safe to expose)
export function getStripePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set')
  return key
}
