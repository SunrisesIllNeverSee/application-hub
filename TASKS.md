# Application Hub — Task List

Current phase: **Launch hardening — ship the spine, layer RNS**

Last updated: 2026-05-10

This file is the granular task list. `ROADMAP.md` is the sequence. `SCRATCH.md` is who is touching what right now.

---

## Live State

App is live at `https://application-hub-chi.vercel.app`. The repo now includes migrations through `015`, Question Bank, drip mechanic, profile split, BYOK integrations, and sidebar IA updates. Remaining work is polish, runtime validation, and quality of signal.

### Bugs to fix

- [x] **Workspace index source-of-truth fix** — `/workspace` now queries `user_applications` directly instead of using `user_program_fit` as a proxy.

- [x] **Copy button on answer boxes** — read-only answers and active editors now both expose copy actions so founders can paste into external application portals quickly.

- [x] **OTP 6-digit code input on login page** — login now supports the 6-digit email code path in addition to magic-link clickthrough.

- [x] **Program cohort context missing in workspace header** — workspace and detail views now surface cohort name, start timing, and cohort size when present.

### IA decisions made

- [x] **Timeline → fold into Hub as view tab** — Timeline remains as a route, but sidebar navigation has been folded back into the main Hub flow.

- [ ] **Answer Bank and Profile are fully separate** — Answer Bank = user's ammunition/memory (what they've written). Profile = who they are (metadata, stage, company). Different routes, different jobs, different UI.

- [x] **Sidebar IA redesign** — Hub / Bank / Answer Bank / Profile at top, then a divider, then user's applications list sorted by status.

- [x] **Question Bank (`/bank`)** — built. Uses `user_question_unlocks`, significance ordering, locked previews, and daily drip.

- [ ] **Companies/Funders index** — users want an org-level index (YC, Techstars, NEA) separate from program cycles. Needs three-layer schema. P2.

---

## Launch Milestone 1 — Ship Today

These are the facts that make a soft launch possible now.

### [x] Core spine is shippable for power users
**Owner**: Cowork + Codex
**Status**: Done

- 30 programs seeded
- 225 questions archived/scored
- Significance scoring and program DNA live
- MCP server: 20 tools, 7 resources, 3 prompts
- Next.js app: Hub, program detail, workspace, profile/answer bank
- Live Supabase wiring
- Clean MCP/app build verification

### [ ] Soft-launch checklist for 10–20 power users
**Owner**: Deric + Cowork/Codex support
**Priority**: P0 if launching today

- Confirm which users are comfortable with MCP/Cursor/Claude/Windsurf
- Provide MCP setup instructions from `application-hub-mcp-server/README.md`
- Explain that web drafting is BYOK-first and that users should connect their provider in `/profile/integrations`
- Decide whether hosted AI drafting is enabled, admin-only, or disabled until BYOK
- Collect first feedback on program usefulness, missing programs, and answer-bank workflow

---

## Launch Milestone 2 — MVP

This is the 100-founder launch bar.

### [x] Question Bank UI (`/bank`)
**Owner**: Cowork
**Priority**: P0

Built as the daily landing area for unlocked questions, locked previews, and answer editing.

Implementation:
- `/bank` route
- Unlocked questions ready to answer
- Locked previews with theme/significance
- Link into AnswerEditor / saved answers
- Calls existing query/MCP pattern behind `hub_get_universal_questions` or direct Supabase equivalent
- Empty state that makes the archive valuable immediately

### [x] Answer Bank drip mechanic
**Owner**: Cowork
**Priority**: P0

Implemented through migration `014_question_bank_drip.sql`. Signup seeding and daily drip are now in place.

Implementation:
- New table `user_question_unlocks`
- Columns: `user_id`, `archived_question_id`, `unlocked_at`, `source`
- Signup initialization: high-significance questions matched to available profile tags
- Daily unlock logic
- Free tier cap around 30 unlocked questions until upgrade
- UI shows unlocked vs. locked questions visibly

Why this matters:
- Solves cold-start
- Creates a daily login loop
- Makes the user feel their answer bank is accumulating value
- Creates a clean Pro upgrade hook

### [x] BYOK AI provider integration
**Owner**: Cowork + Codex
**Priority**: P0

Users can now connect their own provider keys through `/profile/integrations`, and `/api/draft` routes BYOK-first.

Implementation:
- `user_integrations` exists in migrations `012` and `015`
- `/profile/integrations` UI exists
- AES-256-GCM server-side encryption is in place
- `/api/draft` prefers the user's Anthropic key

Remaining runtime check:
- Save a real key on deployed app
- Draft successfully from workspace
- Confirm `ai_draft_runs.integration_type = byok_anthropic`

### [x] Hosted draft rate logging
**Owner**: Codex
**Priority**: P0
**Status**: Done

`POST /api/draft` now logs successful hosted Anthropic calls into `ai_draft_runs`; the database trigger updates `ai_usage`.

### [x] Hosted draft UX polish
**Owner**: Cowork + Codex
**Priority**: P0

Rate logging exists, BYOK routing exists, and the route now gives clearer founder-facing feedback:

- direct provider-required messaging
- link to `/profile/integrations`
- cleaner draft-limit messaging
- confirmation when the founder's own Anthropic key was used

---

## Launch Milestone 3 — Polished Public Launch

### [x] Responsive layout first sweep
**Owner**: Cowork
**Status**: Done in `9d83151`

Sidebar, app padding, and tablet squeeze work landed. Keep real-device testing open, but the first implementation pass is complete.

### [ ] Browser/device responsive QA
**Owner**: Cowork
**Priority**: P1

Verify mobile/tablet/desktop routes:
- `/hub`
- `/hub/[slug]`
- `/workspace/[program_id]`
- `/profile`
- `/bank`

### [ ] Seed real deadlines + urgency sort
**Owner**: Cowork
**Priority**: P1

Every program currently appears as "Rolling" unless seeded otherwise. Add real deadlines where available and sort by urgency.

Implementation:
- Add dates for YC, Techstars, SBIR cycles, and other known programs using `seed/01_deadline_updates_template.sql`
- Default sort: closest non-rolling deadline first, then composite score among rolling programs
- Keep unknown dates as rolling/unknown instead of fake specificity

### [x] Program detail TL;DR / pros / cons / best-for block
**Owner**: Cowork
**Priority**: P1

Program pages now ship with scannable judgment blocks backed by seeded columns.

### [x] Proper user profile split
**Owner**: Cowork
**Priority**: P1

Built as:
- `/profile/answers`
- `/profile/about`
- `/profile/settings`
- `/profile/integrations`

This now unblocks better fit scoring, smarter drip, BYOK, and future billing.

### [x] Custom SMTP completion
**Owner**: Deric + Codex support
**Priority**: P1

Documented, configured, and confirmed during live smoke test.

### [ ] AI draft live smoke test
**Owner**: Cowork
**Priority**: P1

With a valid authenticated session and a real BYOK Anthropic key:
- Click workspace "Draft with AI"
- Confirm `POST /api/draft` returns text using the saved BYOK key
- Confirm text inserts into editor
- Confirm `ai_draft_runs` row exists with `integration_type = byok_anthropic`
- Confirm `ai_usage` updates via trigger

---

## Next Product Layer

### [ ] Home dashboard + sidebar IA
**Owner**: Cowork
**Priority**: P2

### [ ] Curated ingest lane for new targets
**Owner**: Codex
**Priority**: P2

Keep dataset growth tightly focused on application/funding/question surfaces.

Implementation:
- Maintain `seed/staging/application_targets_watchlist.csv`
- Use Firecrawl as an on-demand research layer, not as direct production truth
- Promote only targets with real application pages, reusable question signal, or meaningful funding workflow data
- Keep generic VC prestige tracking out of the active ingest lane

### [ ] Heat/applicant synthetic compute job
**Owner**: Codex + Cowork
**Priority**: P2

Launch-surface fallback labels are now in place, but the deeper job still needs to exist:

- compute better synthetic heat when real usage data is absent
- move beyond provisional value-score-based fallback labels
- eventually replace synthetic estimates with observed demand and outcome data

Create a Today surface:
- Questions unlocked today
- Closest deadlines
- In-progress applications
- Answers needing stress tests
- MoatScore/FundScore/standing placeholder when ready

Sidebar target: Today / Hub / Bank / Apps or Workspace / Profile.

### [ ] Stress-test saved answers UI/scoring
**Owner**: Cowork + Codex
**Priority**: P2

MCP groundwork exists through `hub_stress_test_answer`, and persistence exists in `migrations/012_launch_hardening.sql`. Next layer:
- Quota policy
- UI entry point from Answer Bank/workspace
- Later: BYOK/LLM-backed RNS-style challenge generation

### [ ] Significance score display
**Owner**: Cowork
**Priority**: P2

- Star or importance indicator on questions
- Tooltip: "Asked by N programs"
- Sort questions by significance within sections

### [ ] DNA visualization on program detail
**Owner**: Cowork
**Priority**: P2

- Radar/bar chart of `program_dna`
- Compare user's profile coverage against program DNA

### [ ] Heat scores + applicant counts
**Owner**: Cowork data + Codex compute
**Priority**: P2

Current UI can show zeros. MVP heat can be synthetic from prestige and cohort exclusivity; later heat can use acceptance rates, social mentions, partner/applicant telemetry, and GitHub/company signals.

### [ ] Workspace naming alignment
**Owner**: Cowork
**Priority**: P2

Sidebar says "My Applications" while docs/code often say "Workspace." Pick the user-facing label and align docs, nav, and copy.

### [ ] Dev-only password sign-in decision
**Owner**: Cowork
**Priority**: P2

The password escape hatch helped during email limits. Before public launch:
- Gate behind `NODE_ENV === "development"`
- Gate behind feature flag
- Or remove once custom SMTP is reliable

### [ ] Residual dependency audit follow-up
**Owner**: Codex
**Priority**: P2

Next.js is bumped to `14.2.35` and builds cleanly. Remaining advisories should be handled as a deliberate upgrade track, not blind `npm audit fix --force`.

---

## Platform Layer

### [ ] Cross-theme portability guardrail
**Owner**: Codex + Cowork
**Priority**: P3

Mark and protect the architectural decision that this system should be able to switch themes across founder programs, jobs, grants, and school applications.

What this means in practice:
- Keep schema naming as application-graph friendly as possible
- Avoid founder-only assumptions in reusable intelligence layers
- Separate domain-specific copy from reusable workflow primitives
- Treat question archive + answer bank + fit/review engine as portable infrastructure

### [ ] Three-layer schema: Funders / Programs / Applications
**Owner**: Cowork + future migration
**Priority**: P3

YC the funder and YC W26/S26 the programs should not be conflated forever.

Future migration:
- `funders`
- `programs.funder_id`
- application/cohort distinction
- possible `/funders` index

### [ ] Stripe integration
**Owner**: Cowork UI + Codex webhook
**Priority**: P3

- Free / Pro ($19/mo) / Team ($49/mo)
- Webhook updates `user_subscriptions`
- Gates unlimited AI, export, heat scores, acceptance rates

### [ ] Deadline alerts
**Owner**: Cowork UI + Codex cron
**Priority**: P3

- 30d / 7d / 24h warnings
- Only trigger when readiness is above threshold
- Email through Supabase Edge Function + Resend

### [ ] Outcome tracking
**Owner**: Cowork
**Priority**: P3

User logs accepted/rejected/waitlisted. This closes the feedback loop for fit scores and DNA calibration.

### [ ] Recruiter agent
**Owner**: Codex
**Priority**: P3

Scheduled job scans new programs against user profiles and alerts on high-fit matches.

### [ ] GitHub traction integration
**Owner**: Codex + Cowork
**Priority**: P3

Pull public repo stars, commits, contributor signals, and traction context into answer drafting and fit scoring.

### [ ] Team mode
**Owner**: Cowork
**Priority**: P3

Co-founders share an answer library, assign questions, and review each other's drafts.

### [ ] Public API
**Owner**: Codex
**Priority**: P3

Open program and question data to partners with tiered access.

---

## RNS / Research Differentiation

These are additive above the current app, not blockers for launch:

- RNS signal purity for question significance
- Word Vault taxonomy classification
- SigToken contextual answer scoring
- Signal Harness-style answer fidelity certificates
- SDOT for answer evolution over time
- SigTune input quality measurement
- Commitment conservation metrics for answer stability
- CIVITAE/MO§ES governed scraper posture and audit trails

Canonical doc: `docs/06_rns_integrated_build_path.md`.

---

## Done

- [x] v3 schema design — global question archive as core asset
- [x] Supabase migrations 001–015
- [x] MCP server — 20 tools, 7 resources, 3 prompts, clean TypeScript build
- [x] MCP server README for Claude Desktop, Cursor, Windsurf
- [x] CI workflow for MCP server and Next.js app
- [x] `SECURITY.md`, `ARCHITECTURE.md`, `STATUS.md`
- [x] 30 programs seeded to Supabase
- [x] 225 questions archived
- [x] `compute_significance_scores()` executed
- [x] `compute_program_dna()` executed
- [x] Next.js app scaffold
- [x] Hub UI
- [x] Hub Timeline
- [x] Question Bank `/bank`
- [x] Drip mechanic via `user_question_unlocks`
- [x] Program detail route
- [x] Application Workspace
- [x] Answer History
- [x] Answer Bank/profile surface
- [x] Profile split (`about`, `answers`, `settings`, `integrations`)
- [x] Sidebar IA redesign
- [x] Workspace index uses `user_applications`
- [x] Auth callback moved to real `/auth/callback`
- [x] Migration 009 auth trigger search_path fix
- [x] Migration 012 launch hardening: BYOK metadata + answer stress-test persistence
- [x] Migration 014 question bank drip mechanic
- [x] Migration 015 BYOK encrypted key storage column
- [x] Next.js 14.2.35 bump
- [x] Agent-side review/comment contract: `docs/07_agent_review_contract.md`
- [x] MCP `hub_get_answer_review_context`
- [x] MCP `hub_stress_test_answer`
- [x] Resend/Supabase SMTP guide: `docs/08_resend_smtp_setup.md`
- [x] Hosted `/api/draft` metering through `ai_draft_runs`
- [x] Hosted `/api/draft` fail-closed policy
- [x] BYOK `/api/draft` routing and `/profile/integrations`
- [x] Launch checklist: `docs/09_launch_checklist.md`
- [x] BYOK/draft policy doc: `docs/10_byok_and_draft_policy.md`
- [x] Deadline seed helper: `seed/01_deadline_updates_template.sql`
- [x] Stress-test persistence doc: `docs/12_stress_test_persistence.md`
- [x] SMTP launch handoff: `docs/13_smtp_launch_handoff.md`

---

## Archive Lane

Completed, superseded, or duplicate planning files should move to `docs/archive/` with a note in `docs/archive/README.md`. Keep active execution in:

- `ROADMAP.md`
- `TASKS.md`
- `STATUS.md`
- `VISION.md`
- `SCRATCH.md`
- `AGENTS.md`
