# Application Hub — Launch Roadmap

> **We are nonlinear and temporal.** This project does not run on calendar sprints.
> The order below is sequence and leverage, not a promise about dates.

> **For Cowork (Claude) and Codex**: this is the canonical roadmap. Read at session start.
> `TASKS.md` has implementation details. `STATUS.md` has confirmed repo state. `VISION.md` has the bigger thesis.

---

## Current Truth

Application Hub already has a shippable spine:

- **Database**: the live Supabase project, migration chain, and archive counts are tracked canonically in `STATUS.md` and `.agents/registry.yaml`.
- **Intelligence**: significance scores, program DNA, fit scoring, pgvector retrieval.
- **MCP server**: 21 tools, 7 resources, 3 prompts. Power-user path is real today.
- **Next.js app**: Hub, timeline-in-Hub, Question Bank, workspace (/workspace with opportunity ranking), profile split, BYOK integrations, live Supabase wiring, home dashboard (`/today`), stress-test UI, DNA radar chart, significance stars display.
- **Auth**: magic links plus a dev-only password escape hatch.
- **AI drafts**: hosted `/api/draft` route logs successful drafts to `ai_draft_runs`, and fails closed unless explicitly enabled.
- **RNS direction**: additive intelligence layer above the current Supabase/MCP/app spine, not a launch blocker.
- **Portability requirement**: the underlying question graph must stay flexible enough to switch themes into jobs, grants, and school applications without re-architecting the core data model.

The refined external roadmap was built outside the repo, so keep these corrections in mind:

- MCP is **21 tools**, not 19. New routes: `/today`, `/api/stress-test`, `/api/cron/recruiter`.
- Rate logging for hosted `/api/draft` is already implemented, and BYOK routing is now in repo.
- Responsive layout has had a first sweep committed; continue testing real devices, but do not treat it as untouched.
- Custom SMTP is documented; remaining work is manual Resend domain verification and Supabase dashboard configuration.

---

## Launch Milestone 1 — Ship Today

**Verdict**: Soft launch is not the blocker anymore. The product now has the MVP spine; what remains is polish and live validation.

Best users for this milestone:

- They are comfortable in Claude/Cursor/Windsurf.
- They understand the value of the question archive without a guided drip loop.
- They can tolerate some runtime rough edges and still get value from the archive/MCP path.

What is already good enough:

- A live archive and question bank substantial enough for real founder workflows; see `STATUS.md` for current counts.
- Program discovery, detail, workspace, and saved answers.
- MCP access to the intelligence layer.
- Live Supabase wiring and clean builds.
- RNS path documented as an additive advantage.

Launch caveats:

- Heat/applicant signals still rely on provisional fallback labels until the synthetic compute job lands.
- Live BYOK drafting should be validated end to end on deployed app.

---

## Launch Milestone 2 — MVP

**Verdict**: This milestone is now represented in the repo.

These are the minimum additions that make the app work for non-technical founders:

- [x] **Question Bank UI (`/bank`)** — *Cowork*
  Daily landing surface for unlocked questions, locked previews, and high-significance answer prompts is built.

- [x] **Answer Bank drip mechanic** — *Cowork*
  `user_question_unlocks` flow is in place via migration `014`; signup seeding and daily drip now back the Question Bank.

- [x] **BYOK AI provider integration** — *Cowork + Codex*
  `/profile/integrations`, encrypted key storage, and BYOK-first `/api/draft` routing are now in repo. Remaining work is live runtime verification.

- [x] **Hosted draft rate logging** — *Codex*
  `/api/draft` inserts successful Anthropic calls into `ai_draft_runs`; the trigger updates `ai_usage`.

- [x] **Hosted draft UX polish** — *Cowork + Codex*
  Backend now supports BYOK-first routing, clean provider-required failures, direct integrations CTA, and clearer runtime messaging around draft source/limits.

---

## Launch Milestone 3 — Polished Public Launch

**Verdict**: This is the public announcement bar. The product should feel complete, not just functional.

- [x] **Responsive layout first sweep** — *Cowork*
  Commit `9d83151` landed sidebar, padding, and tablet squeeze work. Keep device/browser testing open as polish, but the first pass is done.

- [ ] **Real deadlines + urgency sort** — *Cowork*
  Seed real upcoming deadlines where available using `seed/01_deadline_updates_template.sql`. Default sort should prefer closest non-rolling deadline, then composite score within rolling programs.

- [x] **Program detail TL;DR / pros / cons / best-for block** — *Cowork*
  Program pages now have seeded scannable judgment blocks.

- [x] **Proper user profile split** — *Cowork*
  `/profile/answers`, `/profile/about`, `/profile/settings`, and `/profile/integrations` now exist.

- [x] **Custom SMTP through Resend** — *Deric/Codex docs support*
  SMTP is documented and wired; live auth mail flow has already been smoke-tested.

- [ ] **AI draft end-to-end smoke test** — *Cowork*
  Final check: verify live BYOK flow from `/profile/integrations` through Draft with AI on deployed app.

---

## Next Product Layer

These are not launch blockers, but they are still part of the current roadmap and should not be lost.

- [x] **Home dashboard + sidebar IA** — `/today` route ships stat cards, in-progress apps, deadline alerts, top program matches, and pro upsell. MoatScore/FundScore placeholder cards present; signal computation is P2.
- [x] **Stress-test saved answers UI/scoring** — `StressTestPanel` is live. Calls deterministic `/api/stress-test`. Wired into `AnswerEditor`. Quota policy and LLM-backed generation remain P2+.
- [x] **Review write-back path** — persisted review flow now exists through `answer_reviews` + `hub_save_answer_review`.
- [x] **First checked-in reviewer agent** — `rns-answer-reviewer` plus `/review-answer` entrypoint are now checked in.
- [x] **Broader reviewer/agent family** — program-fit, fidelity-certifier, and stress-test-conductor agents plus command entrypoints are now checked in.
- [ ] **Plugin-eval measurement baseline** — benchmark MCP/agent bundle with observed usage, not just static analysis.
- [ ] **MoatScore / FundScore signal** — placeholder cards are on the Today dashboard. Needs scoring formula, data inputs, and compute job or RPC.
- [ ] **Internal applicant ranking** — show where a founder likely ranks among applicants for a given program. Depends on outcome tracking and more applied-user data.
- [ ] **Significance score display** — Show importance/star rating on questions, “asked by N programs” tooltip, sort by significance.
- [x] **DNA radar/chart comparison** — `DnaRadarChart` (pure SVG) is live on program detail pages when 4+ themes have weight.
- [ ] **Heat scores + applicant counts** — Replace zeros with synthetic MVP heat from prestige/cohort exclusivity, then real signals later.
- [x] **Launch-surface signal fallback** — *Codex*
  Replace embarrassing zeros in the UI with honest provisional labels while we wait for deeper synthetic/observed signal jobs.
- [x] **Workspace discoverability / sidebar IA** — Sidebar now carries the founder workflow more clearly, including My Applications below the main nav. Further naming polish can happen later.
- [ ] **Dev-only password sign-in decision** — Gate behind development/feature flag or remove before public launch once SMTP is reliable.
- [ ] **Residual dependency audit** — Next 14.2.35 is in place; remaining advisories should be handled as a deliberate upgrade path, not blind `--force`.

---

## Platform Layer

- [ ] **Cross-theme portability guardrail**
  Keep schema, copy, and product architecture general enough that the same spine can support founder programs, jobs, grants, and school applications. This is strategically important: the reusable question graph becomes much more valuable if we can swap verticals without rebuilding the engine.

- [ ] **Three-layer schema: Funders / Programs / Applications**
  Split YC the funder from YC W26/S26 programs. Add `funders`, `programs.funder_id`, and a future `/funders` index.

- [ ] **Stripe integration**
  Free / Pro ($19/mo) / Team ($49/mo). Webhook updates `user_subscriptions`. Gate unlimited AI, export, heat scores, and acceptance data.

- [ ] **Deadline alerts**
  30d / 7d / 24h warnings when readiness is high enough. Email via Supabase Edge Function + Resend.

- [ ] **Outcome tracking**
  User logs accepted/rejected/waitlisted. Feeds future calibration.

- [x] **Recruiter agent**
  Weekly email job (Monday 9am UTC). `migrations/027` + `/api/cron/recruiter` + Deno edge function. Dedup via `recruiter_alerts`. See `docs/22_recruiter_agent.md` for deployment steps.

- [ ] **GitHub/traction integrations**
  Pull public repo stars, commits, contributors, and traction context into answer drafting and fit scoring.

- [ ] **Team mode**
  Shared answer library and multi-seat workflow.

- [ ] **Public API / Question Databank as a service**
  Open the program/question graph to partners and power users.

---

## Vision Tier

These remain alive, but they should not clog launch execution:

- Application Hub Fund
- Founder Ranking / MoatScore / FundScore
- Golden Opportunities premium rail
- Host applications directly for partner programs
- Application ranking + feedback
- Live application updates after submission
- Application automation with user approval
- Outcome/cohort intelligence dataset
- RNS/CIVITAE/MO§ES research differentiation: SDOT, SigTune, answer fidelity certificates, governed scrapers, commitment conservation metrics

---

## Archive Policy

Completed, outdated, duplicate, or exploratory planning files should move to `docs/archive/` instead of staying in the active planning lane.

Use this rule:

- **Active direction**: `ROADMAP.md`, `TASKS.md`, `STATUS.md`, `VISION.md`, `SCRATCH.md`, `AGENTS.md`.
- **Reference docs**: keep in `docs/` if they are still linked by active work.
- **Historical docs**: move to `docs/archive/` with a short note in `docs/archive/README.md` explaining why it moved.

Do not delete historical thinking unless Deric explicitly asks. Old plans are still useful context; they just should not masquerade as current marching orders.
