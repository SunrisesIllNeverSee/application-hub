# Application Hub — Launch Roadmap

> **We are nonlinear and temporal.** This project does not run on calendar sprints.
> The order below is sequence and leverage, not a promise about dates.

> **For Cowork (Claude) and Codex**: this is the canonical roadmap. Read at session start.
> `TASKS.md` has implementation details. `STATUS.md` has confirmed repo state. `VISION.md` has the bigger thesis.

---

## Current Truth

Application Hub already has a shippable spine:

- **Database**: Supabase migrations `001` through `010`, 30 programs, 225 archived questions.
- **Intelligence**: significance scores, program DNA, fit scoring, pgvector retrieval.
- **MCP server**: 20 tools, 7 resources, 3 prompts. Power-user path is real today.
- **Next.js app**: Hub, program detail, workspace, profile/answer bank, live Supabase wiring.
- **Auth**: magic links plus a dev-only password escape hatch.
- **AI drafts**: hosted `/api/draft` route logs successful drafts to `ai_draft_runs`, and fails closed unless explicitly enabled.
- **RNS direction**: additive intelligence layer above the current Supabase/MCP/app spine, not a launch blocker.
- **Portability requirement**: the underlying question graph must stay flexible enough to switch themes into jobs, grants, and school applications without re-architecting the core data model.

The refined external roadmap was built outside the repo, so keep these corrections in mind:

- MCP is **20 tools**, not 19.
- Rate logging for hosted `/api/draft` is already implemented; BYOK and user-facing provider policy are still open.
- Responsive layout has had a first sweep committed; continue testing real devices, but do not treat it as untouched.
- Custom SMTP is documented; remaining work is manual Resend domain verification and Supabase dashboard configuration.

---

## Launch Milestone 1 — Ship Today

**Verdict**: Ship to 10–20 power users today through MCP and the web app, with clear expectations.

Best users for this milestone:

- They are comfortable in Claude/Cursor/Windsurf.
- They understand the value of the question archive without a guided drip loop.
- They can tolerate BYOK being unfinished or AI drafting being limited.

What is already good enough:

- 30 programs and 225 scored questions.
- Program discovery, detail, workspace, and saved answers.
- MCP access to the intelligence layer.
- Live Supabase wiring and clean builds.
- RNS path documented as an additive advantage.

Launch caveats:

- New web users can still land on a thin/empty Answer Bank.
- `/bank` does not exist yet.
- BYOK is not built, so platform-paid hosted drafts need strict policy.
- Custom SMTP is not configured in Supabase yet, though Supabase default email works for low-volume testing.

---

## Launch Milestone 2 — MVP

**Verdict**: This is the real 100-founder launch point.

These are the minimum additions that make the app work for non-technical founders:

- [ ] **Question Bank UI (`/bank`)** — *Cowork*
  Daily landing surface for unlocked questions, locked previews, and high-significance answer prompts. Uses existing question archive/scoring.

- [ ] **Answer Bank drip mechanic** — *Cowork*
  New `user_question_unlocks` flow. Pre-load 5–10 high-signal questions for new users, then drip 2–5/day for free users. Pro unlocks the full bank.

- [ ] **BYOK AI provider integration** — *Cowork + Codex*
  `user_integrations` schema contract exists in migration `010`. Remaining work: `/profile/integrations` UI, server-side secret storage route, and `/api/draft` routing that prefers the user's key.

- [x] **Hosted draft rate logging** — *Codex*
  `/api/draft` inserts successful Anthropic calls into `ai_draft_runs`; the trigger updates `ai_usage`.

- [ ] **Hosted draft UI gating** — *Cowork + Codex*
  Backend now fails closed unless `PLATFORM_AI_DRAFTS_ENABLED=true`. Remaining work: surface provider status, remaining draft count, and BYOK CTA in the UI.

---

## Launch Milestone 3 — Polished Public Launch

**Verdict**: This is the public announcement bar. The product should feel complete, not just functional.

- [x] **Responsive layout first sweep** — *Cowork*
  Commit `9d83151` landed sidebar, padding, and tablet squeeze work. Keep device/browser testing open as polish, but the first pass is done.

- [ ] **Real deadlines + urgency sort** — *Cowork*
  Seed real upcoming deadlines where available using `seed/01_deadline_updates_template.sql`. Default sort should prefer closest non-rolling deadline, then composite score within rolling programs.

- [ ] **Program detail TL;DR / pros / cons / best-for block** — *Cowork*
  Program pages need scannable judgment, not only long descriptions. Static seed columns ship faster; AI generation can come later.

- [ ] **Proper user profile split** — *Cowork*
  Split current `/profile` Answer Bank into `/profile/answers`, `/profile/about`, `/profile/settings`, and `/profile/integrations`.

- [ ] **Custom SMTP through Resend** — *Deric/Codex docs support*
  Setup guide exists at `docs/08_resend_smtp_setup.md`; handoff checklist exists at `docs/13_smtp_launch_handoff.md`. Remaining work: verify domain in Resend, enter SMTP settings in Supabase Auth, run magic-link tests.

- [ ] **AI draft end-to-end smoke test** — *Cowork*
  With a valid Anthropic key/session, verify workspace button → `/api/draft` → response inserted into the editor → usage row logged.

---

## Next Product Layer

These are not launch blockers, but they are still part of the current roadmap and should not be lost.

- [ ] **Home dashboard + sidebar IA** — Today view with unlocked questions, closest deadlines, in-progress applications, answers needing review/stress tests, and MoatScore/FundScore surface.
- [ ] **Stress-test saved answers UI/scoring** — MCP stub and `answer_stress_tests` table exist. Add quota policy, UI, and eventual BYOK/LLM-backed generation.
- [ ] **Significance score display** — Show importance/star rating on questions, “asked by N programs” tooltip, sort by significance.
- [ ] **DNA radar/chart comparison** — Program detail should show program DNA vs. user coverage.
- [ ] **Heat scores + applicant counts** — Replace zeros with synthetic MVP heat from prestige/cohort exclusivity, then real signals later.
- [ ] **Workspace discoverability** — Align “Workspace” vs. “My Applications” naming across sidebar/docs/routes.
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

- [ ] **Recruiter agent**
  Scheduled job scans new programs against user profile and alerts on high-fit matches.

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
