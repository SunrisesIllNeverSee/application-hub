import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import Stripe from 'stripe'

// Supabase admin client (service role) for webhook writes — bypass RLS
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// App Router in Next.js 14 does not use the pages-dir bodyParser config.
// Instead we read the raw body via req.text() before signature verification.

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase service role env vars are not set')
  }
  return createSupabaseClient(url, key)
}

/**
 * Map a Stripe price ID back to a subscription tier.
 * Returns null if the price ID doesn't match a known plan.
 */
function tierFromPriceId(priceId: string): 'pro' | 'team' | null {
  const priceMap: Record<string, 'pro' | 'team'> = {
    [process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? '']: 'pro',
    [process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? '']: 'pro',
    [process.env.STRIPE_TEAM_MONTHLY_PRICE_ID ?? '']: 'team',
    [process.env.STRIPE_TEAM_ANNUAL_PRICE_ID ?? '']: 'team',
  }
  return priceMap[priceId] ?? null
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('[webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const tier = session.metadata?.tier as 'pro' | 'team' | undefined

        if (!userId || !tier) {
          console.error('[webhook] checkout.session.completed: missing metadata', session.id)
          break
        }

        await supabase
          .from('user_subscriptions')
          .update({
            tier,
            status: 'active',
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
          })
          .eq('user_id', userId)

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Resolve tier from the first line item's price
        const priceId = subscription.items.data[0]?.price?.id
        const tier = priceId ? tierFromPriceId(priceId) : null

        const updatePayload: Record<string, unknown> = {
          status: subscription.status,
          stripe_subscription_id: subscription.id,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        }
        if (tier) {
          updatePayload.tier = tier
        }

        await supabase
          .from('user_subscriptions')
          .update(updatePayload)
          .eq('stripe_customer_id', customerId)

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Graceful downgrade: revert to free tier, keep status active
        await supabase
          .from('user_subscriptions')
          .update({
            tier: 'free',
            status: 'active',
            stripe_subscription_id: null,
            current_period_end: null,
          })
          .eq('stripe_customer_id', customerId)

        break
      }

      default:
        // Unhandled event — return 200 to acknowledge receipt and prevent retries
        break
    }
  } catch (err) {
    console.error('[webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
