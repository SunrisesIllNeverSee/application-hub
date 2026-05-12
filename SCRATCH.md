# Scratch — active work in progress

> **Both agents check this BEFORE picking up a task from `TASKS.md`.**
> Claim by appending your line. Release by removing it (or moving to "recently released").
> Stale claims = no commits touching the claimed paths since the claim landed.
> See also: `~/Desktop/MULTI_CLAUDE.md` for cross-workspace coordination.
> `SCRATCH.md` is for repo-local active claims only. It is not the main status doc; factual current-state truth lives in `STATUS.md`.

---

## Current state (2026-05-13, vscode-claude session — updated)

AQUA Phase shipped. Build clean, tsc 0 errors. Site live at mos2es.xyz. Migration chain at 040, next = 041.

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
- Sitemap + robots.txt for mos2es.xyz (Next.js dynamic, 500 program limit, /hub/timeline added)
- Sitemap + robots.txt for mos2es.com (static XML in mos2es-site repo, Netlify)
- Next.js 14.2.35 → 15.3.4 — 4 high CVEs resolved, all server clients async
- Ranking RPC migration 038 — `get_top_programs_by_value()` live in Supabase
- Portability domain guardrail — hub query + 2 MCP tools now filter by domain
- AFTER_LAUNCH.md — Architecture Decisions (ADR-001), Pricing Strategy, Migration Cleanup Plan, Data Lifecycle / Cycle Retirement
- codex/feedback.md — structured + Claude addendum (product commentary, ICP, business model analysis)
- codex/feedbackplan.md — full sequential build plan from feedback.md
- codex/feedback2.md — Codex-generated summary of vision docs + ICP/strategic commentary
- **ADR-001 locked** — `docs/adr/ADR-001-portability.md` formal decision record, domain-agnostic infrastructure confirmed
- **Pricing strategy implemented** — Team tier removed from PricingCards UI, Free/Pro only for launch
- **Migration cleanup baseline** — `seed/000_baseline.sql` placeholder created, regenerate at migration 050
- **Appfeeder V1** — `appfeeder/` scaffold + `docs/BROWSER_EXTENSION.md` spec + semantic match wired (mcp-eval)
- **AQUA Phase (8 features)** — rebrand, split-screen workspace, onboarding gate (migration 040), AQUAscore + persona, Dash command center, Answers file tree, Applications merge, Questions tabs
- **Middleware fixed** — routes updated to AQUA nav, onboarding gate added, post-login redirect → /dash
- **Appfeeder capture loop** — blur listener + `/api/answers/capture` route (semantic match → save new answer version)
- **codex/qaapplication/** — sample application files (solo fund, unicorn fund) for archive seeding

### Remaining open work

- **FundingCake Phase C** — HOLD — 39 rows staged but quality mixed (MaRS rows similarity 0.38–0.46, false positives). Manual review of `seed/staging/fundingcake_questions_promote.csv` before any Supabase write
- **ROADMAP.md Vision Tier pruning** — move distant future items to AFTER_LAUNCH.md Future Products section

### Deric to drive

- Stripe: confirm price IDs in Vercel env
- Recruiter agent: set CRON_SECRET + APP_URL in Supabase edge function env, activate Monday 9am schedule
- Submit `mos2es.xyz/sitemap.xml` and `mos2es.com/sitemap.xml` to Google Search Console

### FundingCake programs — WRAPPED (2026-05-12, mcp-eval)

**What's done:**

- Phase A: 782 homepages scraped → 160 apply_urls staged (`seed/staging/fundingcake_apply_urls.csv`)
- Phase B: 88 questions extracted, 39 promote-ready (`seed/staging/fundingcake_questions_promote.csv`)
- `apply_url` now renders on hub program detail with "verify link" badge (`7e2fe35`)
- 13 JS-gated programs listed as needs-validation: `seed/staging/needs_validation.md`
- Full methodology: `docs/26_fundingcake_ingest_pipeline.md`

**Pending human action:**

- Review `fundingcake_questions_promote.csv` (39 rows) then run promotion SQL
- Spot-check the 13 programs in `needs_validation.md` manually

---

## For Codex — most recent context

Updated 2026-05-12 (vscode-claude) — migration chain at 039, next=040. Next.js 15.3.4, ranking RPC live, domain guardrail wired. AFTER_LAUNCH.md complete (ADR-001, pricing, migration cleanup, data lifecycle). codex/feedbackplan.md added — full build plan mapped from feedback.md. FundingCake Phase C pending (39 rows ready to promote). MoatScore cards need real formula or removal.

## Currently claimed

- **mcp-eval** — Appfeeder V1 scaffold done (`appfeeder/`, `docs/BROWSER_EXTENSION.md`, semantic match wired) — lane releasing

## Recently released

- **vscode-claude** — three infra tasks (ranking RPC, Next.js 15, portability guardrail), AFTER_LAUNCH.md sections, codex/ files — commits `9c15708`, `aba40c5` — 2026-05-12
- **mcp-eval** — CI fixes, coordination sync, markdown lint — `.github/workflows/ci.yml`, `SCRATCH.md`, `STATUS.md`, `.agents/claims.yaml` — 2026-05-12
