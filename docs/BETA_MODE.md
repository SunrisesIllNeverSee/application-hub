# Beta Mode — Operator Runbook

How beta mode works, how to toggle it, how to end it.

## Mental model

Application Hub runs in two modes — **beta** or **production** — controlled by env vars.

| Variable | Beta value | Production value |
|---|---|---|
| `BETA_MODE` | `true` | unset / `false` |
| `BETA_END_DATE` | `2026-09-30` | unset |
| `STRIPE_BETA_PRO_PRICE_ID` | `price_xxx` ($1/mo) | unset |

When `BETA_MODE=true`:
- Landing page + `/profile/settings` show Pro at **$1/mo with 14-day trial** instead of $19/mo
- Stripe checkout uses 14-day trial + tags subscription metadata as `beta_participant`
- Webhook captures `beta_payment_method_id` for transition
- New signups auto-claim the **Founder Starter Pack** (10 questions) on onboarding completion
- `/api/beta/check` endpoint is live but always returns `beta_active`

When `BETA_END_DATE` passes:
- `/api/beta/check` transitions each user one of two ways:
  - **Has card on file** → tier=pro, grace_period_ends_at = today + 30 days, banner shows "You're in your 30-day grace period"
  - **No card** → tier=free, banner shows "Beta ended — upgrade to keep Pro features"

## Toggling beta on/off

### Turn beta on
```bash
# .env.local AND Vercel env
BETA_MODE=true
BETA_END_DATE=2026-09-30
STRIPE_BETA_PRO_PRICE_ID=price_<beta_1usd_monthly>
```
Redeploy. Pricing flips immediately on next page load.

### Extend beta
Update `BETA_END_DATE` only. No code change required. Users currently in `beta_active` stay there.

### End beta early
1. Update `BETA_END_DATE` to a past date OR leave unset
2. On next user page load, `/api/beta/check` runs the transition (idempotent — safe to run repeatedly)

### Turn beta off permanently
1. Unset `BETA_MODE`, `BETA_END_DATE`, `STRIPE_BETA_PRO_PRICE_ID` from Vercel
2. Remove `beta_settings` row OR leave it (no-op when env vars are unset)

## Starter pack management

The pack is a single row in `starter_packages` named `'Founder Starter Pack'`. To rotate the questions:

```sql
UPDATE starter_packages
SET question_ids = ARRAY(
  SELECT id FROM archived_questions
  WHERE is_universal = TRUE
  ORDER BY significance_score DESC
  LIMIT 10
)
WHERE name = 'Founder Starter Pack';
```

Existing claims are NOT rolled back. To re-grant a user the new pack:

```sql
DELETE FROM user_starter_claims WHERE user_id = '<uuid>';
SELECT claim_starter_package('<uuid>');
```

To create additional themed packs:
```sql
INSERT INTO starter_packages (name, description, question_ids)
VALUES ('YC Ready Pack', 'The 10 questions YC asks every cohort', ARRAY[...]);
```

Add a UI button in `/profile/settings` linking to a POST `/api/starter/claim?pack=<id>` if exposing these is desirable.

## Community messaging

Tables: `community_messages` (FK to `import_queue` for context).

To moderate / clean up:
```sql
-- View a thread
SELECT id, from_user_id, to_user_id, subject, created_at, is_read
FROM community_messages
WHERE parent_id = '<root_id>' OR id = '<root_id>'
ORDER BY created_at;

-- Delete a single message (sender or admin)
DELETE FROM community_messages WHERE id = '<uuid>';
```

Rate limit is 10 messages/hour per user (in-memory). Tune in `app/lib/rate-limit.ts`.

## Outcome tracking

New fields on `user_applications`:
- `outcome_notes` — free text
- `interview_date` — used when status is `waitlisted` or `accepted`
- `program_feedback` — what the program said back
- `would_recommend` — 1-5 stars
- `outcome_logged_at` — set on first outcome record

Surfaced in:
- `/workspace/[program_id]` via `OutcomeTracker.tsx`
- `/dash` Outcomes widget (aggregate counts + avg recommend rating)

## Common operations

### Find users in grace period
```sql
SELECT user_id, grace_period_ends_at
FROM user_subscriptions
WHERE grace_period_ends_at IS NOT NULL
  AND grace_period_ends_at > NOW()
ORDER BY grace_period_ends_at;
```

### Count beta participants with card on file
```sql
SELECT count(*) FROM user_subscriptions
WHERE beta_participant = TRUE AND beta_payment_method_id IS NOT NULL;
```

### Force-claim starter pack for an existing user
```sql
SELECT claim_starter_package('<user_uuid>');
```

## Security

See `docs/SECURITY_AUDIT_BETA.md` for the full pre-deploy checklist.

---

_Last updated: 2026-05-12_
