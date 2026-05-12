# Scratch — active work in progress

> **Both agents check this BEFORE picking up a task from `TASKS.md`.**
> Claim by appending your line. Release by removing it (or moving to "recently released").
> Stale claims = no commits touching the claimed paths since the claim landed.
> See also: `~/Desktop/MULTI_CLAUDE.md` for cross-workspace coordination.
> `SCRATCH.md` is for repo-local active claims only. It is not the main status doc; factual current-state truth lives in `STATUS.md`.

---

## Current state (2026-05-12, vscode-claude session)

P2 in progress. Build clean, tsc 0 errors. Site live at mos2es.xyz. Migration chain at 033 (supabase/migrations/), next = 034.

### What's shipped (confirmed this session)

- Hub (842 programs), Question Bank + drip, BYOK, draft routing, import flows
- Stripe — live (livemode: true, 1 real checkout processed)
- Email+password signup/signin — primary auth flow, GitHub OAuth live
- Dark mode, funders schema, deadline alerts edge fn (ACTIVE)
- Team mode (schema + API — no UI beyond settings tab)
- Answer review persistence + stress-test persistence
- Reviewer family: rns-answer-reviewer, program-fit-reviewer, fidelity-certifier, stress-test-conductor
- Home dashboard `/today`, StressTestPanel, DnaRadarChart, SignificanceStars, workspace opportunity ranking
- Recruiter agent — edge function ACTIVE, `/api/cron/recruiter` live
- Applicant modes (030-031), Credits & achievements (032)
- Archive page `/archive/questions` — 225 questions, theme tabs, lock/unlock state
- Funders index `/funders` + `/funders/[slug]`
- Question embeddings — 225 questions seeded at 768d via nomic-embed-text
- Security DEFINER views fixed (migration 033)
- CI in strict mode, database.types.ts regenerated + aliases

### Remaining open work

- Real deadlines seeding — most programs show "Rolling"
- Heat scores — synthetic compute from brand_score + cohort_size
- MoatScore / FundScore — placeholder cards on Today need actual compute
- Responsive QA — mobile/tablet viewport pass on hub/bank/workspace/profile
- Workspace naming locked as "My Applications" (sidebar) / "Workspace" (routes)

### Deric to drive

- Stripe: confirm price IDs in Vercel env
- Recruiter agent: set CRON_SECRET + APP_URL in Supabase edge function env, activate Monday 9am schedule

### FundingCake programs

782/812 have real website URLs. 778 have descriptions. The only gap is `apply_url` — FundingCake captured homepages, not intake pages.

**Phase A COMPLETE (2026-05-12):** 782 homepages scraped — 160 high-confidence apply_urls found (20%), 132 medium, 395 not_found. Master CSV at `seed/staging/fundingcake_apply_urls.csv`.

**Phase B IN PROGRESS:** 10 parallel agents scraping 160 confirmed apply pages, extracting question text, matching to `archived_questions`. Results at `seed/staging/question_results/batch_NN.csv`.

**Do not touch:** `seed/staging/phase_b_batches/`, `seed/staging/question_results/` — agents actively writing.

---

## For Codex — most recent context

Updated 2026-05-12 (vscode-claude + mcp-eval) — auth rebuilt (password+GitHub), security fixes, archive/funders UI, types clean, migration 033 latest, next = 034. FundingCake apply_url discovery pipeline active (mcp-eval).

## Currently claimed

- **mcp-eval** — FundingCake Phase B question extraction — `seed/staging/phase_b_batches/`, `seed/staging/question_results/` — claimed 2026-05-12 — 10 agents running, do not write to these paths

## Recently released

- **mcp-eval** — CI fixes, coordination sync, markdown lint — `.github/workflows/ci.yml`, `SCRATCH.md`, `STATUS.md`, `.agents/claims.yaml` — 2026-05-12
