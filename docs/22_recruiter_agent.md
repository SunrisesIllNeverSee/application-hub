# Recruiter Agent — Deployment & Operations Guide

_Last updated: 2026-05-11_

The recruiter agent is a weekly email job that scans all user program-fit scores and
sends each user a personalized digest of their top high-fit programs they have not
applied to yet.

---

## What it does

On a Monday 9am UTC schedule:

1. Queries `user_program_fit` for all (user, program) pairs with `composite_score >= 25`.
2. Filters out programs the user has already applied to (`user_applications`) and any
   (user, program) pairs that already received a recruiter email this calendar week.
3. Groups the remaining matches by user and takes the top 3 by composite score.
4. Sends each user an HTML + plain-text email via Resend with program name, fit score,
   program URL, and a CTA back to the workspace.
5. Inserts dedup rows into `recruiter_alerts` so the same match is not re-sent within
   the same week bucket.

Batching: processes up to 50 users per run (`BATCH_SIZE = 50`). If the user population
grows beyond 50 active users with qualifying matches, increase `BATCH_SIZE` in
`app/app/api/cron/recruiter/route.ts`.

---

## Architecture

```
pg_cron / Supabase Edge Function schedule
  --> supabase/functions/recruiter-agent/index.ts   (Deno edge function trigger)
    --> POST /api/cron/recruiter                    (Next.js route, CRON_SECRET auth)
      --> user_program_fit query                    (Supabase)
      --> user_applications filter                  (Supabase)
      --> recruiter_alerts dedup check              (Supabase)
      --> Resend.send(html + text)                  (email delivery)
      --> INSERT recruiter_alerts                   (dedup record)
```

The edge function is a thin trigger. It does nothing except call the Next.js route
with the `CRON_SECRET` header. All business logic lives in the Next.js API route so it
is testable locally without a Supabase Edge Function runtime.

---

## Required environment variables

| Variable | Where to set | What it is |
|---|---|---|
| `CRON_SECRET` | Vercel env + Supabase Edge Function env | Shared secret authorizing cron calls. Must match on both sides. |
| `RESEND_API_KEY` | Vercel env | Resend API key for sending emails. Already used by deadline-alerts. |
| `RESEND_FROM_EMAIL` | Vercel env | From address, e.g. `noreply@mos2es.xyz`. Already used by deadline-alerts. |
| `APP_URL` | Vercel env + Supabase Edge Function env | Base URL for deep links in emails, e.g. `https://mos2es.xyz`. |

`CRON_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` are already in use by the
deadline-alerts agent. If those are set, confirm `APP_URL` is present and add
`CRON_SECRET` to the edge function environment.

---

## Deployment steps

### 1. Apply migration 027

Run `migrations/027_recruiter_alerts.sql` in the Supabase SQL editor. This creates:

- `recruiter_alerts` table with `(user_id, program_id, week_bucket)` UNIQUE constraint.
- RLS policy (service_role only).
- A commented-out `cron.schedule(...)` stub (activate in step 4).

### 2. Deploy the edge function

```bash
supabase functions deploy recruiter-agent
```

### 3. Set edge function environment variables

In the Supabase dashboard, go to Edge Functions -> recruiter-agent -> Environment variables:

```
APP_URL=https://mos2es.xyz
CRON_SECRET=<same value as Vercel CRON_SECRET>
```

### 4. Activate the schedule

Choose one of:

**Option A - Supabase Dashboard**
Dashboard -> Edge Functions -> `recruiter-agent` -> Schedule -> Add schedule:
`0 9 * * 1` (Monday 9am UTC)

**Option B - SQL editor**
Uncomment the `cron.schedule(...)` block at the bottom of
`migrations/027_recruiter_alerts.sql` and run it in the Supabase SQL editor.

---

## Testing locally

```bash
# Start the Next.js dev server
cd app && npm run dev

# In another terminal, POST to the route directly
curl -X POST http://localhost:3000/api/cron/recruiter \
  -H "Authorization: Bearer <your CRON_SECRET value>"
```

Expected response: a JSON object with `sent` (number of emails dispatched) and
`skipped` (users with no qualifying matches this week).

Check the `recruiter_alerts` table in Supabase to confirm dedup rows were inserted.

---

## Dedup logic

The `recruiter_alerts` table has a `week_bucket` column (type `text`, format `YYYY-WNN`
using the ISO week number). The UNIQUE constraint is on `(user_id, program_id, week_bucket)`.

Before sending, the route queries for existing rows matching the current user ID,
program ID, and the current ISO week. If a row exists, that (user, program) pair is
skipped. After sending, the route inserts a row for every dispatched match.

This means:
- The same user will not receive the same program recommendation twice in the same
  calendar week, even if the cron fires multiple times.
- A user can receive a recommendation for the same program in a future week if they
  still have not applied and the fit score is still >= 25.

---

## Tuning

These constants live at the top of `app/app/api/cron/recruiter/route.ts`:

| Constant | Default | What it controls |
|---|---|---|
| `FIT_THRESHOLD` | `25` | Minimum `composite_score` for a match to qualify. Raise to make the digest more selective. |
| `TOP_PER_USER` | `3` | Maximum programs per user per email. |
| `BATCH_SIZE` | `50` | Maximum users processed per cron run. Increase as active user count grows. |

---

## Related files

- `migrations/027_recruiter_alerts.sql` -- schema, dedup table, and RLS
- `app/app/api/cron/recruiter/route.ts` -- Next.js POST route (core logic)
- `supabase/functions/recruiter-agent/index.ts` -- Deno edge function trigger
- `docs/08_resend_smtp_setup.md` -- Resend setup guide (covers `RESEND_API_KEY`)
