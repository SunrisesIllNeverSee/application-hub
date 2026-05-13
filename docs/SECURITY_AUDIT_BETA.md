# Security Audit — Beta Mode

_Pre-launch checklist for the beta-mode features introduced in migration 041._

This document records the security review for: beta payment method capture, starter packages, community messaging, and enhanced outcome tracking. Run the verification commands at the bottom before every production deploy that touches these surfaces.

---

## 1. Authentication & authorization

| Table | RLS enabled | Owner-scoped read | Owner-scoped write | Notes |
|---|---|---|---|---|
| `beta_settings` | yes | public read (config only) | service role only | No user data; safe to expose `is_beta_mode` and `beta_end_date` |
| `user_subscriptions` | inherits | owner only | service role only | `beta_payment_method_id` is server-side; webhook + service role writes |
| `user_applications` | inherits | owner only | owner only | New outcome columns inherit existing RLS |
| `starter_packages` | yes | public read where `is_active` | service role only | Catalog data, no user PII |
| `user_starter_claims` | yes | owner only | owner only | `claim_starter_package()` RPC runs as SECURITY DEFINER and writes via service role |
| `community_messages` | yes | sender OR recipient | sender insert, recipient update read-status only | Cross-user reads blocked by `cm_party_select` |

**Verify:**
```bash
psql "$DATABASE_URL" -c "SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('beta_settings','user_starter_claims','community_messages','starter_packages') ORDER BY tablename, policyname;"
```

---

## 2. Sensitive data handling

- **`beta_payment_method_id`** must never be returned in any API response to the browser. Server-side only.
  ```bash
  # Verify no API route selects beta_payment_method_id without scrubbing it
  grep -rn "beta_payment_method_id" app/app/api --include="*.ts"
  ```
  Acceptable usages: `/api/stripe/webhook` (write), `/api/beta/check` (internal read, never returned).

- **Email addresses in community messages** — when we join `from_user.email`, the recipient sees the sender's email. This is acceptable for direct messages but flag if we ever expose to non-parties.

- **Outcome data with `is_public_result = false`** must never be aggregated into community stats. Verify:
  ```bash
  grep -rn "is_public_result" app/app/api --include="*.ts"
  ```
  Every aggregate query reading user_applications must filter `WHERE is_public_result = TRUE`.

---

## 3. Input validation

| Field | Max length | Sanitizer | Where enforced |
|---|---|---|---|
| `community_messages.subject` | 200 | `sanitizeSubject()` | API route + DB CHECK |
| `community_messages.body` | 5000 | `sanitizeText()` | API route + DB CHECK |
| `user_applications.outcome_notes` | 2000 | `sanitizeText()` | API route |
| `user_applications.program_feedback` | 2000 | `sanitizeText()` | API route |
| `user_applications.would_recommend` | int 1-5 | manual check | API + DB CHECK |

`app/lib/sanitize.ts` strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<svg>`, on-* event handlers, `javascript:` and `data:text/html` URLs.

---

## 4. Rate limiting

`app/lib/rate-limit.ts` provides an in-memory LRU keyed by `${user_id}:${action}`. Limits:

- `community_message`: 10 / hour
- `beta_check`: 1 / minute

Applied in:
- `POST /api/community/messages`
- `GET /api/beta/check`

**Caveat:** Single-instance memory. Acceptable for low-traffic beta. Migrate to Upstash/Redis when we cross multi-region or add a load balancer.

---

## 5. API security

- All POST/PATCH/DELETE routes require `supabase.auth.getUser()` to succeed; unauth returns 401.
- All writes either use `auth.uid()` as the identifier or scope updates by `.eq('user_id', user.id)` defensively.
- Stripe webhook validates signature via `stripe.webhooks.constructEvent()`.

**Verify no path traversal / SQL injection vectors:**
```bash
# Look for raw string concatenation in supabase queries (false positives expected)
grep -rn "supabase.from" app/app/api --include="*.ts" | grep -v "\.eq\|\.select\|\.insert\|\.update\|\.delete\|\.upsert\|\.match\|\.in\|\.ilike\|\.maybeSingle\|\.single\|\.returns"

# Confirm no dangerouslySetInnerHTML in any new component
grep -rn "dangerouslySetInnerHTML" app/
grep -rn "innerHTML" app/components

# Confirm no exposed server-side secrets in client code
grep -rn "process.env" app/components app/lib/utils.ts app/lib/aquascore.ts | grep -v "NEXT_PUBLIC"
```

---

## 6. Stripe security

- Beta checkout uses `mode: 'subscription'` with `trial_period_days: 14` and a $1/mo price ID (`STRIPE_BETA_PRO_PRICE_ID`).
- Payment method captured during checkout (no manual SetupIntent flow needed).
- Webhook signature validation: enforced via `STRIPE_WEBHOOK_SECRET`.
- `beta_participant=true` is set by the webhook ONLY when session metadata says so — never trusted from frontend.

---

## 7. Beta end transition safety

`/api/beta/check`:
- Idempotent — running multiple times for the same user after beta ends doesn't change state after the first transition (tier already 'pro' or 'free').
- Single source of truth for "beta is over" check: `isBetaOver()` from `app/lib/beta.ts`, driven by `BETA_END_DATE` env var.
- Never automatically charges a card. The transition only sets `tier='pro'` and `grace_period_ends_at`; the actual subscription/charge happens via the existing Stripe checkout flow if the user converts.

---

## Pre-deploy checklist

Run before every deploy that touches these surfaces:

```bash
# 1. TypeScript clean
cd app && npx tsc --noEmit

# 2. Verify migration applied
psql "$DATABASE_URL" -c "SELECT count(*) FROM information_schema.columns WHERE table_name = 'user_applications' AND column_name IN ('outcome_notes','interview_date','program_feedback','would_recommend','outcome_logged_at');"
# Expected: 5

# 3. Verify starter pack seeded
psql "$DATABASE_URL" -c "SELECT name, array_length(question_ids,1) FROM starter_packages WHERE name='Founder Starter Pack';"
# Expected: ('Founder Starter Pack', 10)

# 4. Verify RLS policies
psql "$DATABASE_URL" -c "SELECT tablename, count(*) FROM pg_policies WHERE tablename IN ('community_messages','starter_packages','user_starter_claims','beta_settings') GROUP BY tablename;"

# 5. Verify env vars set
echo "BETA_MODE=$BETA_MODE"
echo "BETA_END_DATE=$BETA_END_DATE"
echo "STRIPE_BETA_PRO_PRICE_ID is set: $([[ -n $STRIPE_BETA_PRO_PRICE_ID ]] && echo yes || echo no)"

# 6. Confirm no XSS regressions
grep -rn "dangerouslySetInnerHTML" app/ && echo "FAIL: dangerouslySetInnerHTML present" || echo "PASS: no dangerouslySetInnerHTML"
```

---

_Last reviewed: 2026-05-12._
