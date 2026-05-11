import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, getPriceId, type SubscriptionTier, type BillingInterval } from '@/lib/stripe'

const VALID_TIERS = ['pro', 'team'] as const
const VALID_INTERVALS = ['monthly', 'annual'] as const

function isValidTier(v: unknown): v is SubscriptionTier {
  return typeof v === 'string' && (VALID_TIERS as readonly string[]).includes(v)
}
function isValidInterval(v: unknown): v is BillingInterval {
  return typeof v === 'string' && (VALID_INTERVALS as readonly string[]).includes(v)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as Record<string, unknown>
    const { tier, interval } = body

    if (!isValidTier(tier)) {
      return NextResponse.json({ error: 'tier must be "pro" or "team"' }, { status: 400 })
    }
    if (!isValidInterval(interval)) {
      return NextResponse.json({ error: 'interval must be "monthly" or "annual"' }, { status: 400 })
    }

    let priceId: string
    try {
      priceId = getPriceId(tier, interval)
    } catch {
      return NextResponse.json(
        { error: 'Pricing not yet configured. Contact support.' },
        { status: 503 }
      )
    }

    const stripe = getStripe()

    // Look up or create Stripe customer
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let stripeCustomerId: string | null = sub?.stripe_customer_id ?? null

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      })
      stripeCustomerId = customer.id

      // Persist customer ID so we can look it up on future requests and webhooks
      await supabase
        .from('user_subscriptions')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('user_id', user.id)
    }

    const origin = req.headers.get('origin') ?? 'http://localhost:3000'

    // NOTE: we deliberately do NOT pass payment_method_types — Stripe's
    // dynamic payment methods picks the best methods per region/customer
    // (Apple Pay, Google Pay, Klarna, etc) based on Dashboard settings.
    // https://docs.stripe.com/payments/payment-methods/dynamic-payment-methods
    //
    // Stripe-hosted Checkout is the recommended frontend pattern for SaaS
    // subscriptions (per stripe-best-practices skill). The Payment Element
    // is an alternative only if you need deep inline customization.
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Both URLs include the {CHECKOUT_SESSION_ID} placeholder so the success
      // page can verify the session out-of-band. Keep success/cancel separate
      // so analytics can distinguish completed vs abandoned upgrades.
      success_url: `${origin}/profile/settings?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/profile/settings?upgrade_cancelled=true`,
      // Duplicate metadata on the session AND the subscription — the webhook
      // reads user_id from whichever event fires first.
      metadata: { user_id: user.id, tier },
      subscription_data: {
        metadata: { user_id: user.id, tier },
        trial_period_days: 7,
      },
      // Optional but recommended for SaaS — allow promo codes at checkout
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[/api/stripe/checkout] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
