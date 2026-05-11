import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import Stripe from 'stripe'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// =============================================================================
// Stripe Webhook Handler — best-practice notes
// =============================================================================
// • Signature verification: stripe.webhooks.constructEvent on the raw body.
//   Required by Stripe — without it, anyone could POST fake events.
//   https://docs.stripe.com/webhooks/signatures
//
// • Raw body access: Next.js App Router uses req.text() (NOT req.json()) so we
//   get the exact bytes Stripe signed.
//
// • Dedup: every event ID is INSERTed into stripe_events BEFORE processing.
//   Stripe retries failed deliveries (and can replay during outages); without
//   dedup, a checkout.session.completed could fire twice and double-mutate
//   subscription state. The UNIQUE PK on event_id makes the second insert fail
//   cleanly — we return 200 immediately and skip handler logic.
//   https://docs.stripe.com/webhooks#handle-duplicate-events
//
// • Always 200 on success, even for events we don't handle. Returning 4xx/5xx
//   triggers Stripe retries, which spams the endpoint and can mask bugs.
//
// • Service role Supabase client: webhook needs to write across user rows;
//   the anon-key client would be blocked by RLS. NEVER use service role in
//   user-facing routes — only in trusted server-only endpoints like this one.
// =============================================================================

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
 *
 * NOTE: env vars are read at module load — if a new price ID is added to
 * Stripe, you must redeploy the function for tierFromPriceId to recognise it.
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

/**
 * Shared-Stripe-account safety: returns true iff the given price ID is one
 * of our 4 Application Hub prices. Events whose underlying subscription is
 * on a different price (i.e. belongs to a different app sharing this Stripe
 * account) must NOT mutate our user_subscriptions rows.
 *
 * Without this filter, a customer.subscription.updated event from the other
 * app on a shared Stripe customer would overwrite our stripe_subscription_id
 * and current_period_end — corrupting tier state silently.
 */
function isApplicationHubPriceId(priceId: string | null | undefined): boolean {
  if (!priceId) return false
  return tierFromPriceId(priceId) !== null
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

  // ===========================================================================
  // DEDUP — claim the event ID before processing. If another delivery already
  // claimed it, return 200 immediately so Stripe stops retrying.
  // ===========================================================================
  const { error: claimErr } = await supabase.from('stripe_events').insert({
    event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
  })

  if (claimErr) {
    // 23505 = unique_violation in Postgres — means we've seen this event before.
    // Any other error: log but still return 200 so Stripe doesn't retry forever
    // on a transient DB hiccup.
    if (claimErr.code === '23505') {
      console.log(`[webhook] dedup hit for ${event.id} (${event.type}) — skip`)
      return NextResponse.json({ received: true, deduped: true })
    }
    console.error('[webhook] failed to claim event (continuing):', claimErr)
  }

  try {
    switch (event.type) {
      // -----------------------------------------------------------------------
      // Checkout completed — initial subscription activation
      // -----------------------------------------------------------------------
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

      // -----------------------------------------------------------------------
      // Subscription created — covers cases where a sub is created outside our
      // checkout flow (e.g. admin-created in Stripe Dashboard, migration import).
      // -----------------------------------------------------------------------
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const priceId = subscription.items.data[0]?.price?.id

        if (!isApplicationHubPriceId(priceId)) {
          console.log(`[webhook] skip ${event.type} for non-app-hub priceId=${priceId} (shared-account isolation)`)
          break
        }

        const tier = tierFromPriceId(priceId!)
        // Period dates moved from subscription root to subscription items
        // in API version 2025-03-31.basil. Reading from items.data[0] is
        // the post-migration canonical path. Application Hub subscriptions
        // are single-item (one plan), so items[0] always carries the dates.
        const item = subscription.items.data[0]
        const updatePayload: Record<string, unknown> = {
          status: subscription.status,
          stripe_subscription_id: subscription.id,
          current_period_start: new Date(item.current_period_start * 1000).toISOString(),
          current_period_end: new Date(item.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end ?? false,
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

      // -----------------------------------------------------------------------
      // Subscription deleted — graceful downgrade to free
      // -----------------------------------------------------------------------
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const priceId = subscription.items.data[0]?.price?.id

        if (!isApplicationHubPriceId(priceId)) {
          console.log(`[webhook] skip customer.subscription.deleted for non-app-hub priceId=${priceId} (shared-account isolation)`)
          break
        }

        await supabase
          .from('user_subscriptions')
          .update({
            tier: 'free',
            status: 'active',
            stripe_subscription_id: null,
            current_period_end: null,
            cancel_at_period_end: false,
          })
          .eq('stripe_customer_id', customerId)
        break
      }

      // -----------------------------------------------------------------------
      // Invoice paid — successful renewal. Refresh period dates from the
      // invoice's parent subscription so we stay synced with Stripe.
      // -----------------------------------------------------------------------
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        const subscriptionId = (invoice as Stripe.Invoice & { subscription?: string }).subscription
        if (!subscriptionId) break

        const stripe = getStripe()
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price?.id

        if (!isApplicationHubPriceId(priceId)) {
          console.log(`[webhook] skip ${event.type} for non-app-hub priceId=${priceId} (shared-account isolation)`)
          break
        }

        const item = subscription.items.data[0]
        await supabase
          .from('user_subscriptions')
          .update({
            status: subscription.status,
            current_period_start: new Date(item.current_period_start * 1000).toISOString(),
            current_period_end: new Date(item.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
          })
          .eq('stripe_customer_id', customerId)
        break
      }

      // -----------------------------------------------------------------------
      // Invoice payment failed — set status to past_due. Stripe's Smart
      // Retries will reattempt the charge per the customer's dunning settings.
      // We don't downgrade the tier here — wait for customer.subscription.deleted
      // or .updated to reflect the final state.
      // NOTE: For dunning UX, you may want to email the user from here, or surface
      // an in-app banner gated on status='past_due'.
      // -----------------------------------------------------------------------
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        const subscriptionId = (invoice as Stripe.Invoice & { subscription?: string }).subscription
        if (!subscriptionId) break

        // Fetch subscription to confirm this invoice belongs to an Application Hub price.
        // In a shared Stripe account, a payment_failed for the other app's subscription
        // must not flip our row to past_due.
        const stripe = getStripe()
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price?.id

        if (!isApplicationHubPriceId(priceId)) {
          console.log(`[webhook] skip invoice.payment_failed for non-app-hub priceId=${priceId} (shared-account isolation)`)
          break
        }

        await supabase
          .from('user_subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_customer_id', customerId)
        break
      }

      default:
        // Unhandled event — log + return 200. Don't retry-spam Stripe on
        // event types we deliberately ignore.
        console.log(`[webhook] unhandled event type ${event.type}`)
        break
    }
  } catch (err) {
    console.error('[webhook] handler error:', err)
    // Mark the event as errored so retries can re-attempt (after dedup row
    // is cleaned up out-of-band) and we have a paper trail.
    await supabase
      .from('stripe_events')
      .update({ error_text: err instanceof Error ? err.message : String(err) })
      .eq('event_id', event.id)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  // Mark processed
  await supabase
    .from('stripe_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('event_id', event.id)

  return NextResponse.json({ received: true })
}
