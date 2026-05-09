# Application Hub — Task List

Current phase: **Phase 2 — Seed data + Core UI**

Last updated: 2026-05-09

---

## Now (blocking)

### [ ] Seed 30 real programs
**Priority**: P0 — nothing in the intelligence layer is meaningful without real data.

Programs to seed first (have public application archives):
- [ ] Y Combinator (S25 or most recent batch)
- [ ] Techstars (Boulder or NY)
- [ ] SBIR Phase I (any agency)
- [ ] Google for Startups Accelerator
- [ ] a16z START
- [ ] First Round Capital (scout/seed)
- [ ] Indie.vc
- [ ] Founder Catalyst
- [ ] NSF SBIR
- [ ] DOE ARPA-E Exploratory Topics
- [ ] Echoing Green Fellowship
- [ ] Halcyon Incubator
- [ ] Accenture Fintech Innovation Lab
- [ ] MassChallenge
- [ ] Village Capital (sector programs)
- [ ] Backstage Capital
- [ ] Visible Hands
- [ ] Camelback Ventures
- [ ] Fast Forward (tech nonprofits)
- [ ] Mozilla Foundation Builders
- [ ] NEA Venture Studio
- [ ] Pear VC
- [ ] Precursor Ventures
- [ ] Hustle Fund
- [ ] Overlooked Ventures
- [ ] Capital Factory (Austin)
- [ ] Alchemist Accelerator (enterprise)
- [ ] Founders' Co-op (Pacific NW)
- [ ] Kapor Capital
- [ ] 500 Startups

For each program, capture:
- Program name, slug, type, equity %, cash value, deadline cadence, rolling vs cohort
- All required application questions with exact phrasing and word limits
- Theme classification per question

Create as `seed/programs/[slug].sql` — one file per program.

**Checkpoint**: After 30 programs, validate that significance scores sort sensibly and DNA weights reflect actual program priorities. Recalibrate theme prestige weights in `compute_significance_scores()` if needed.

---

### [ ] Apply Migration 008 to Supabase
- File: `migrations/008_intelligence_layer_v2.sql`
- Adds: `program_dna`, `user_program_fit`, `match_archived_questions` RPC, `increment_draft_count` RPC, significance score columns, profile_answers alignment
- **Required before any MCP tool testing against a live database**

Steps:
1. Open Supabase Dashboard → SQL Editor
2. Paste content of `008_intelligence_layer_v2.sql`
3. Run → confirm no errors
4. Verify: `SELECT * FROM program_dna LIMIT 5;` (should be empty until programs seeded)
5. Verify: `SELECT compute_significance_scores();` (should run without error)

---

## Next (Phase 2 unblocked after seeding)

### [ ] Scaffold Next.js app
- Auth via Supabase (email + magic link)
- TypeScript types generated from schema (`npx supabase gen types typescript`)
- Route structure: `/hub`, `/hub/[slug]`, `/workspace`, `/workspace/[program_id]`, `/profile`
- Shared layout: sidebar nav, program search, user avatar
- Dark/light mode (system default, Tailwind)
- Supabase client (server + browser instances)
- `.env.local` template

Blocked by: nothing (can scaffold structure before seeding, just won't have data)

### [ ] Build Hub UI — program directory
- Program cards: type, equity, cash, heat score, days-to-deadline
- Rankings views: by value score (ROI) and by heat (trending)  
- Program detail page: full terms, acceptance stats, DNA visualization
- Timeline view: open vs closed programs, upcoming deadlines
- Filter sidebar: type, equity cap, rolling vs cohort, deadline range

Blocked by: Next.js scaffold, seed data

### [ ] Build Application Workspace
- Per-program workspace for the actual drafting work
- Question list with significance stars and word limits
- Answer editor: write, edit, track word count, mark confidence
- Answer history: diff view between versions
- Profile answer suggestion: "You answered something similar — use this?"
- Readiness indicator: progress bar for required questions

Blocked by: Hub UI (shared components)

---

## Phase 3 (after first paying user)

### [ ] Stripe integration
- Stripe products: Free / Pro ($19/mo) / Team ($49/mo)
- Webhook handler: update `user_subscriptions` on payment events
- Rate limiting already wired via `ai_usage` + `increment_draft_count`
- Gate Pro features: unlimited AI, export, heat scores, acceptance rates

### [ ] Recruiter agent
- Scheduled job: scan new programs matching user profile DNA
- Alert delivery: email + in-app notification
- Trigger: when new program added OR user profile changes materially

### [ ] Deadline alerts
- 30d / 7d / 24h warnings
- Only for programs where user readiness > 60%
- Email via Supabase Edge Function + Resend

### [ ] Answer editor v2
- Source tracking: AI-generated / human-written / curated from archive
- Dual scoring: quality + relevance to program DNA
- Canonical toggle: mark an answer as source-of-truth for a theme

---

## Phase 4 (platform layer)

### [ ] GitHub plugin
- Pull traction signals from public repos (stars, commits, contributors)
- Auto-populate answer context for traction questions

### [ ] Outcome tracking
- User logs: "got in" / "rejected" / "waitlisted"
- Closes the feedback loop for fit score and DNA calibration
- **Required before any outcome-based model training**

### [ ] Team mode
- Co-founders share an answer library
- Assign questions to team members
- See each other's drafts and confidence scores

### [ ] Public API
- Open program and question data to partners
- YC alumni networks, accelerator directories, university programs

---

## Done

- [x] v3 schema design — global question archive as core asset
- [x] Supabase migrations 001-007 (core schema, intelligence, monetization)
- [x] Migration 008 (program_dna, user_program_fit, significance RPCs)
- [x] MCP server TypeScript scaffold
- [x] All 16 MCP tools (public + authenticated)
- [x] All 7 MCP resources
- [x] All 3 MCP prompts
- [x] Clean TypeScript build (zero errors)
- [x] MCP server README (Claude Desktop, Cursor, Windsurf configs)
- [x] Full product roadmap document
- [x] 30 programs seeded (seed/programs/*.sql + seed/00_run_all.sql)
- [x] Next.js app scaffold — app router, auth, Supabase SSR, TypeScript types, layout
- [x] Hub UI — program directory, filters, sort, ranking, program detail with DNA viz
- [x] Hub Timeline — open/closed status, deadline countdown bars, rolling programs
- [x] Application Workspace — per-program Q&A, readiness progress, answer editor
- [x] Answer History — diff view component with word-level highlights, restore button
- [x] Answer Bank (profile) — grouped by theme, source badges, inline editor

---

## Milestones

| Milestone | Target | Status |
|---|---|---|
| MCP server production-ready | Week 3 | ✅ Done |
| 30 programs seeded | Week 5 | ⬜ Not started |
| Hub UI live (read-only) | Week 6 | ⬜ Not started |
| First paying user | Week 8 | ⬜ Not started |
| 30 draft runs logged | Week 9 | ⬜ Not started |
| Recalibration checkpoint | Week 10 | ⬜ Not started |
