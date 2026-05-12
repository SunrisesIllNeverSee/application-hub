# Scratch — active work in progress

> **Both agents check this BEFORE picking up a task from `TASKS.md`.**
> Claim by appending your line. Release by removing it (or moving to "recently released").
> Stale claims = no commits touching the claimed paths since the claim landed.
> See also: `~/Desktop/MULTI_CLAUDE.md` for cross-workspace coordination.
> `SCRATCH.md` is for repo-local active claims only. It is not the main status doc; factual current-state truth lives in `STATUS.md`.

---

## Current state (2026-05-12)

P1 sprint complete. P2 in progress. Build is clean. Site live at mos2es.xyz. Type-check: 0 errors.

### What's deployed (as of 2026-05-12)

- Hub (842 programs), Question Bank + drip, BYOK, draft routing, import flows
- Stripe skeleton (code done — Deric needs to add price IDs to Vercel)
- Dark mode, outcome tracking, funders schema, deadline alerts (cron live)
- Team mode (schema + API — no UI beyond settings tab)
- Answer review persistence + stress-test persistence
- Reviewer family: rns-answer-reviewer, program-fit-reviewer, fidelity-certifier, stress-test-conductor
- Home dashboard `/today`, StressTestPanel, DnaRadarChart, SignificanceStars, workspace opportunity ranking
- Recruiter agent (migration 027 + /api/cron/recruiter + edge function)
- **Applicant modes** (migrations 030-031): mode toggle, multi-identity profile, RFC badges, contribution rewards
- **Credits & achievements** (migration 032): credit_events ledger, user_achievements, sidebar badge, earn toast, redemption stub
- **OG image** `/api/og`: MO§ES™ branded, personalized share card on /profile/credits
- **Archive page** `/archive/questions`: all 225 questions, theme tabs, Universal tab, lock/unlock state, Answer button
- **Landing page archive**: live top-12 questions from DB (was static single example)
- **Supabase CLI linked**: migrations in `supabase/migrations/`, db push clean, migration lint in CI

### Remaining open work (P1)

- Real deadlines seeding — most programs show "Rolling," needs YC/Techstars/SBIR cycles added
- Browser/device responsive QA on `/hub`, `/hub/[slug]`, `/workspace/[program_id]`, `/profile`, `/bank`

### Remaining open work (Deric to drive)

- Stripe: add price IDs to Vercel env vars
- Recruiter agent: set CRON_SECRET in Supabase edge function env, activate Monday 9am schedule
- Soft-launch: reach out to 10–20 power users, share MCP setup instructions

### FundingCake programs

812 programs from FundingCake import (migration 019). Real funded entities, 782 have URLs, 0 have apply_url. The gap is FundingCake captured homepage URLs not intake page URLs. See `docs/28_fundingcake_shells.md`. Fill path: RFC mechanic (passive) + targeted ingest for top accelerators and VC programs with real intake forms.

---

## For Codex — most recent context

Updated 2026-05-12 — applicant modes shipped, credits system live, archive page rebuilt, Supabase CLI linked, type-check at 0 errors, migration chain at 035, next migration 036.
