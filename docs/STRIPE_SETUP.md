# Stripe setup checklist — Application Hub

> Walkthrough to wire up Stripe Billing for the freemium SaaS model.
>
> Pricing model (per `CLAUDE.md`):
> - **Free** — $0, 10 AI drafts/month, drip cap
> - **Pro** — $19/mo or $190/yr — unlimited drafts, all 225+ questions, fit scores
> - **Team** — $49/mo or $490/yr — Pro + shared answer library + multi-seat

---

## Shared Stripe account — important

This Stripe account is shared with another app. The integration is isolated by:

| Isolation surface | Owned by | Notes |
|---|---|---|
| **Product IDs** | This app | Application Hub products only |
| **Price IDs** | This app | The 4 IDs listed in Part 1.1 below |
| **Webhook endpoint** | This app | `https://mos2es.xyz/api/stripe/webhook` — only Application Hub events route here |
| **Webhook handler price filter** | This app | `webhook/route.ts` filters every `customer.subscription.*` and `invoice.*` event by Application Hub price ID before mutating `user_subscriptions`. Events from the other app's subscriptions are skipped with a `[webhook] skip ... shared-account isolation` log line. |
| **API keys** | **SHARED** | Same `sk_live_…` / `pk_live_…` powers both apps. Restricted keys can isolate later if needed. |
| **Customer Portal config** | **SHARED account-wide policy** | See Part 1.3 — do not blindly toggle, inspect what the other app depends on first. |
| **Payment methods toggle** | **SHARED account-wide policy** | See Part 1.2 — usually safe to enable more methods, but still shared. |

**Bottom line**: webhook + price IDs + product IDs are safely isolated. Portal + payment methods + API keys are not — touch the dashboard for those with care.

---

## Part 1 — Stripe Dashboard (~10 min)

### 1.1 Create products + prices

> ✅ **Already done — live mode.** The four Application Hub price IDs below are created in the shared Stripe account. Re-use these when adding env vars in Part 3.

```env
STRIPE_PRO_MONTHLY_PRICE_ID=price_1TVibhF3nomgD2vdeLrLomqM
STRIPE_PRO_ANNUAL_PRICE_ID=price_1TVibiF3nomgD2vd8pdU6Nsw
STRIPE_TEAM_MONTHLY_PRICE_ID=price_1TVibkF3nomgD2vdXmoI1cUa
STRIPE_TEAM_ANNUAL_PRICE_ID=price_1TVibmF3nomgD2vdK5QdO6z0
```

If you ever need to recreate them (e.g. spinning up a test-mode parallel), the original recipe was:

| Product | Monthly | Annual |
|---|---|---|
| Application Hub Pro | $19/mo | $190/yr (≈30% off) |
| Application Hub Team | $49/mo per seat | $490/yr per seat |

### 1.2 Enable dynamic payment methods

> ⚠️ **Shared account-wide policy.** This page applies to every app sharing the Stripe account. Adding payment methods is usually safe and additive (the other app simply gets the new methods too), but inspect first if the other app pins a specific surface.

Stripe Dashboard → **Settings** → **Payment methods**. Toggle ON (or confirm already on):

- ✅ Cards
- ✅ Apple Pay (often on by default)
- ✅ Google Pay
- ✅ Link
- (Optional) Klarna, Affirm, Cash App Pay — for US

Modern Stripe Checkout uses **dynamic payment methods** by default — Stripe picks the best methods per customer based on country, currency, and Dashboard settings. Some methods won't appear as explicit on/off toggles because they aren't supported for your account country or flow; that's expected, not blocked. Our `checkout/route.ts` deliberately doesn't pass `payment_method_types` so it stays compatible with whatever Dashboard surfaces.

### 1.3 Configure the Customer Portal

> ⚠️ **Shared account-wide policy.** Customer Portal configuration is global. Changes here affect the other app's billing UX too. **Inspect the current settings first.** Only change a toggle if you're sure the other app doesn't depend on the existing behavior.

Stripe Dashboard → **Settings** → **Billing** → **Customer portal**.

Recommended for Application Hub:

- ✅ Allow customers to update payment method
- ✅ Allow customers to update billing address
- ✅ Allow customers to cancel subscriptions (recommend: at period end, not immediately) — the webhook now reads `cancel_at_period_end` and surfaces a "Cancellation scheduled" banner in `/profile/settings`
- ✅ Allow customers to switch plans (between Pro Monthly ↔ Pro Annual etc)
- Cancellation reason: optional but useful

Save.

### 1.4 Get your API keys

Stripe Dashboard → **Developers** → **API keys**.

Copy these:
- **Publishable key** (`pk_test_...`) — safe for client-side
- **Secret key** (`sk_test_...`) — SERVER-ONLY, never expose

---

## Part 2 — Configure the webhook (~5 min)

### 2.1 Add the endpoint in Stripe

> ✅ **Safe to add alongside the other app.** Webhook endpoints are per-URL — adding `mos2es.xyz/api/stripe/webhook` does not affect the other app's endpoint. The Application Hub handler also filters every subscription/invoice event by Application Hub price ID, so even if a shared Stripe customer's event is delivered, the handler will skip events whose price ID doesn't belong to this app.

Stripe Dashboard → **Developers** → **Webhooks** → **+ Add endpoint**.

- **Endpoint URL**: `https://mos2es.xyz/api/stripe/webhook`
- **Events to send** — select these 7:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

Click **Add endpoint**.

### 2.2 Get the signing secret

After creating the endpoint, click into it. Click **Reveal** next to "Signing secret". Copy the value (`whsec_...`).

This is what verifies that incoming webhook calls actually came from Stripe.

---

## Part 3 — Push env vars to Vercel (~3 min)

You'll need to set **7 env vars** in Vercel (Production + Preview).

```bash
# At repo root:
cd /Users/dericmchenry/Desktop/application-hub
export PATH="/Users/dericmchenry/Desktop/hermes/node/bin:$PATH"

# Run each one — paste the value when prompted, then "Production" + "Preview" target
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_SECRET_KEY preview

vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_WEBHOOK_SECRET preview

vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY preview

vercel env add STRIPE_PRO_MONTHLY_PRICE_ID production
vercel env add STRIPE_PRO_MONTHLY_PRICE_ID preview

vercel env add STRIPE_PRO_ANNUAL_PRICE_ID production
vercel env add STRIPE_PRO_ANNUAL_PRICE_ID preview

vercel env add STRIPE_TEAM_MONTHLY_PRICE_ID production
vercel env add STRIPE_TEAM_MONTHLY_PRICE_ID preview

vercel env add STRIPE_TEAM_ANNUAL_PRICE_ID production
vercel env add STRIPE_TEAM_ANNUAL_PRICE_ID preview
```

Then redeploy to pick up the new env vars:

```bash
vercel --prod
```

---

## Part 4 — Smoke test (~5 min)

### 4.1 Trigger a test checkout

1. Visit https://mos2es.xyz → sign in → /profile/settings (or wherever PricingCards is rendered)
2. Click "Upgrade to Pro Monthly"
3. Should redirect to Stripe Checkout
4. Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP
5. Complete checkout
6. Should redirect back to `/profile/settings?upgraded=true&session_id=cs_...`

### 4.2 Verify subscription synced

Run this in Supabase SQL editor (or via MCP):

```sql
SELECT user_id, tier, status, stripe_customer_id, stripe_subscription_id, current_period_end
FROM user_subscriptions
WHERE stripe_subscription_id IS NOT NULL
ORDER BY current_period_end DESC NULLS LAST
LIMIT 5;
```

You should see your account with `tier='pro'`, `status='active'`.

### 4.3 Verify webhook events are recording

```sql
SELECT event_type, livemode, processed_at, error_text
FROM stripe_events
ORDER BY received_at DESC
LIMIT 20;
```

You should see `checkout.session.completed`, `customer.subscription.created`, and `invoice.paid` rows. All should have `processed_at` set and `error_text` NULL.

### 4.4 Test the portal

From `/profile/settings`, click "Manage billing". Should redirect to Stripe Customer Portal where you can cancel/upgrade.

### 4.5 Test cancellation

Cancel the test subscription via the portal. Watch the webhook fire `customer.subscription.deleted`. Your `user_subscriptions` row should flip back to `tier='free'`.

---

## Part 5 — Going live (later, not now)

1. **Activate your Stripe account** — Dashboard → fill out the business details
2. **Repeat Parts 1–3 in LIVE mode** — different keys (`sk_live_...`), different price IDs, different webhook endpoint
3. **Verify the live webhook** with a real $1 test purchase (issue yourself a refund after)
4. **Stripe go-live checklist**: https://docs.stripe.com/get-started/checklist/go-live

---

## Files in this repo

| File | Purpose |
|---|---|
| `app/app/api/stripe/checkout/route.ts` | Creates Checkout Session — POST from PricingCards |
| `app/app/api/stripe/portal/route.ts` | Creates Customer Portal session — POST from "Manage billing" |
| `app/app/api/stripe/webhook/route.ts` | Receives all Stripe events; dedup + sync to `user_subscriptions` |
| `app/lib/stripe.ts` | Server-side Stripe client + price ID resolver |
| `app/lib/subscription.ts` | `getUserTier`, `canDraft`, `isPro` helpers — server components use these |
| `app/components/PricingCards.tsx` | Client UI — Free/Pro/Team cards with upgrade buttons |
| `migrations/022_stripe_events.sql` | Webhook event dedup table |

---

## Notes & known follow-ups

- **API version** pinned to `2024-06-20` (SDK 16.x baseline). When upgrading the `stripe` package, also bump `apiVersion` in `lib/stripe.ts` deliberately.
- **No PaymentElement / Card Element** — we use Stripe-hosted Checkout (per skill recommendation). Switching to Payment Element only if we need deep inline customization later.
- **No Stripe Connect** — single-tenant SaaS, no marketplace mechanics.
- **No trial period** configured — add via `subscription_data.trial_period_days` in checkout if you want 7-day free trials.
- **No usage-based metering** — flat-rate subscriptions only. Add via Stripe Meters API later if needed (e.g. for per-draft pricing tier).
- **Tax**: Stripe Tax is OFF by default. Enable via Dashboard → Settings → Tax if you sell to EU/CA/NZ/AU customers. Pass `automatic_tax: { enabled: true }` in the checkout session.
