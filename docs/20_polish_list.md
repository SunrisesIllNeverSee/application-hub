# Polish List

_Last updated: 2026-05-11_
_Implementation order: after repo cleanup (issue #1) is complete._

Items in rough priority order within each tier.

---

## P1 — Ship before broad launch

- [ ] **Questions archive UI** — `/archive/questions` browse page, filter by theme/domain, significance sort, locked/unlocked state. Full plan: `docs/18_questions_archive_plan.md`
- [ ] **Funders index UI** — `/funders` index + `/funders/[slug]` profile. Data is in DB. Full plan: `docs/19_funders_archive_plan.md`
- [ ] **Questions pipeline gap** — 800 FundingCake programs have no questions mapped. Empty workspace state + "submit questions" CTA. Admin import_queue review flow.
- [ ] **Program card funder attribution** — "by Y Combinator" link on program cards pointing to `/funders/[slug]`
- [ ] **Stripe activation** — Deric: add price IDs + CRON_SECRET to Vercel env vars
- [ ] **Pro Plus tier decision** — pricing structure locked, then schema migration + Stripe products

---

## P2 — Polish pass

- [ ] **Home dashboard / Today view** — unlocked questions today, closest deadlines, in-progress applications, answers needing review
- [ ] **DNA radar/chart** — program detail: radar or bar chart of `program_dna` weights vs user profile coverage
- [ ] **Significance score display** — star/importance indicator on questions, "asked by N programs" tooltip, sort by significance within sections
- [ ] **Stress-test UI** — entry point from workspace/bank, quota display, results view (Codex lane: persistence already done)
- [ ] **Workspace empty state** — when program has no questions indexed, show helpful message + submit form URL link
- [ ] **Question count on program cards** — "12 questions indexed" badge

---

## P3 — After launch feedback

- [ ] **MoatScore / FundScore / Standing** — deferred to Deric's spec. `/about/scoring` page has placeholder.
- [ ] **Founder Ranking** — public percentile display, opt-in
- [ ] **Outcome analytics** — aggregate accepted/rejected signals once users start logging outcomes
- [ ] **Funder claiming** — verification flow, verified badge, profile editing
- [ ] **Funder webhooks** — "notify me when high-fit founder applies"
- [ ] **VS Code extension** — sidebar with question bank, command palette for drafting
- [ ] **Public API** — open program + question graph to partners
- [ ] **Embeddable widget** — question + draft assistant for partner sites
- [ ] **Mobile apps** — if analytics show mobile usage

---

## Done (reference)

- [x] Dark mode toggle
- [x] Outcome tracking UI (workspace)
- [x] Scoring overview page `/about/scoring` + inline tooltips
- [x] Funders schema (migration 023, 30 orgs seeded)
- [x] Deadline alerts (edge function + pg_cron)
- [x] Team mode (schema + API)
- [x] Answer review persistence (migration 026)
- [x] Multi-provider draft (Anthropic, OpenAI, Ollama)
- [x] Application import + program submission
- [x] Portable taxonomy (domain + universal_theme)
- [x] SEO — metadataBase, robots.txt, sitemap.xml
- [x] Stripe skeleton (code complete)


---

## Full Item Inventory — Reviewed 2026-05-11

### Platform Layer

**Recruiter agent**
- What: Scheduled job scans new programs against all user profiles, emails founders when a high-fit match appears
- What exists: `user_program_fit` table computed nightly, Resend email working, pg_cron available
- Solution: Edge function or pg_cron job — query `user_program_fit` where composite_score > threshold, send email via Resend
- Placement: **P2** — infrastructure all exists, just needs the job + email template

**GitHub traction integration**
- What: Pull public repo stars, commits, contributors into profile and fit scoring
- What exists: Nothing
- Solution: GitHub OAuth → store repo signals in `user_profiles` → surface in fit scoring and answer drafting context
- Placement: **P3** — complex OAuth, not critical for launch

**Public API**
- What: Open program + question dataset to partners with tiered access
- What exists: MCP HTTP mode is the closest analog
- Solution: REST API, API key auth, rate limiting, versioning, docs — real project
- Placement: **P3** — needs partnership demand signal before building

---

### Next Product Layer

**Home dashboard / Today view**
- What: Landing area after login — questions unlocked today, closest deadlines, in-progress apps, answers needing review
- What exists: All source data is live (`user_question_unlocks`, `user_applications`, `profile_answers`, `programs.deadline_at`)
- Solution: New route replacing hub redirect as default landing — server component pulling all four data sources
- Placement: **P1** — high founder value, data is ready

**Stress-test UI/scoring**
- What: Founder clicks "Stress test this answer" → gets structured pushback, scores, certification status
- What exists: `hub_stress_test_answer` MCP tool, `answer_stress_tests` + `answer_reviews` tables, persistence done (Codex)
- Missing: UI entry point in AnswerEditor, results display, quota indicator
- Solution: Button in AnswerEditor → API route → MCP tool → render structured review
- Placement: **P1** — all backend done, needs UI wire-up only

**Significance score display**
- What: Star/importance indicator on questions, "asked by N programs" tooltip, sort by significance
- What exists: `significance_score` computed for all 225 questions, `ScoreTooltip` component live
- Solution: Add significance stars to question cards in `/bank` and workspace — one afternoon
- Placement: **P1** — trivial, high polish value

**DNA visualization**
- What: Radar or bar chart of `program_dna` theme weights vs user's profile coverage
- What exists: `program_dna` has 183 rows in DB, user profile data exists
- Solution: Chart component on program detail — recharts or custom SVG radar
- Placement: **P2** — needs chart library decision, moderate build

**Heat scores from observed data**
- What: Replace provisional labels with real signals — acceptance rates, applicant volumes, social mentions
- What exists: `heat_score` column now seeded for 30 programs (just fixed), provisional fallback live for 800+ others
- Solution: Data pipeline — partner data, scraping, social signals. No shortcut here.
- Placement: **P3** — needs real data sources. Provisional labels hold until then.

---

### Vision Tier

**Application ranking/leaderboard**
- What: Rank founders per program by composite_score, show position + "raise X to move up"
- What exists: `composite_score` computed, `fit_score` per (user, program)
- Solution: Needs enough applicants per program to be meaningful. Build rank display first, populate when volume exists.
- Placement: **P3** — needs user scale

**Live application updates**
- What: Status updates after submission — "application reviewed," "interview scheduled"
- What exists: `user_applications.status` enum has submitted/accepted/rejected/waitlisted
- Solution: Webhook endpoints for programs + notification layer — requires active program partnerships
- Placement: **P3** — requires partnerships

**Application automation**
- What: Auto-fill official program portals with user approval
- What exists: Nothing — this is the most complex item in the list
- Solution: Browser automation layer — significant legal/TOS complexity per portal
- Placement: **Vision tier** — not building near-term, watch for MCP-based approaches

**Winning applications marketplace**
- What: Opt-in founders release successful applications for payment or community access
- What exists: `is_public_result` flag on `user_applications`, outcome tracking UI done
- Solution: Marketplace UI, payment flow, privacy controls, moderation — needs outcome data first
- Placement: **P3** — needs critical mass of logged outcomes before it's valuable

**Founder ranking / MoatScore / FundScore**
- What: Founder-level reputation score that travels across programs
- What exists: `/about/scoring` page has honest placeholder, VISION.md has the philosophy
- Solution: Deric brings in the spec — computation is his IP, not ours to design
- Placement: **Deferred** — waiting on spec

**Host applications directly**
- What: Become the canonical submission portal for partner programs
- What exists: `import_queue` for program question submissions, three-layer schema (funders table done)
- Solution: Partner API, submission handling, integration layer — requires active program partners
- Placement: **P3** — requires partnerships
