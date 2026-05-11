# Stripe webhook diagnostic — 2026-05-11

Archived from commit `9d6e6b4` (debug log) before removing it from production code in a follow-up commit.

## Symptom

After completing a live Stripe checkout, the user's `user_subscriptions` row was not updating. Stripe webhook dashboard showed deliveries as "Delivered" with HTTP 200, but the `stripe_events` dedup table was empty and `stripe_customer_id` / `stripe_subscription_id` were null in Postgres.

The HTTP status fluctuated across attempts:

- Early resends: `400 Invalid signature` in Vercel logs
- Later resends: `500 Handler error` with no row in `stripe_events`

Three things made this hard to diagnose:

1. The Stripe Dashboard had the endpoint URL saved as `https://mos2es.xyz` (no path), so the first batch of deliveries went to the Next.js homepage, which returned 200. Stripe marked these as Delivered. The handler never ran.
2. After the URL was corrected to `https://mos2es.xyz/api/stripe/webhook`, signature verification briefly logged as failing, but this was a stale/misread log entry — the real failures were 500s.
3. The 500s came from `getAdminClient()` in `app/app/api/stripe/webhook/route.ts` throwing on missing `SUPABASE_SERVICE_ROLE_KEY`. The throw is outside the inner `try/catch` block, so Next.js returned a generic 500 without our handler's error logging running. From the outside it looked like signature verification, but signature verification was passing.

## Diagnostic step

A temporary `console.log` was added immediately after the `STRIPE_WEBHOOK_SECRET` presence check to surface the secret prefix and length in Vercel logs:

```ts
console.log(`[webhook] secret prefix: ${webhookSecret.slice(0, 14)}... length=${webhookSecret.length}`)
```

This log appeared in Vercel runtime logs alongside a 500 response — proving the env var was set and execution had passed the signature gate. That ruled out signature verification and pointed at the Supabase client.

## Root cause

`SUPABASE_SERVICE_ROLE_KEY` was missing from Vercel environment variables. Only the public anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) was present. `getAdminClient()` throws on missing service role key, which surfaces as an unhandled 500 in the function.

## Fix

1. Added `SUPABASE_SERVICE_ROLE_KEY` to Vercel env vars for Production + Preview, with the service role key from Supabase → Project Settings → API.
2. Redeployed.
3. Resent `evt_1TVvYYF3nomgD2vdA79ROoi6` from the Stripe Dashboard. It landed cleanly:
   - 200 response
   - `stripe_events` row written with `processed_at` set and `error_text = null`
   - `user_subscriptions` updated with the correct customer + subscription IDs

## Lessons

- **`getAdminClient()` should fail loudly with the env var name in the response body**, not throw a generic Error. A future hardening pass could return a structured 500 with `{ error: 'Missing env: SUPABASE_SERVICE_ROLE_KEY' }` so the debugging step here would have been a single look at the response body.
- **Stripe Dashboard's "Delivered" status only reflects HTTP status code, not application semantics.** A 200 from the wrong route looks identical to a 200 from a working handler.
- **The signing secret rabbit hole was a red herring** — the secret was correct the whole time. The real chain of failures was: wrong URL → handler never ran → URL fixed → handler ran → missing env var → 500 with no detail.

## Cleanup

The debug log is being removed in a follow-up commit. This file preserves the diagnostic recipe for the next time something similar happens.
