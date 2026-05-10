# Application Hub — Task List

Current phase: **Phase 2 — Live data integration + Polish**

Last updated: 2026-05-10

---

## Now (active)

### [x] Wire Next.js app to live Supabase data — Column audit complete
**Owner**: Cowork (Claude)
**Priority**: P0

Column fixes applied across 7 files (database.types.ts, utils.ts, ProgramCard.tsx,
workspace/[program_id]/page.tsx, profile/page.tsx, AnswerEditor.tsx, hub/[slug]/page.tsx,
hub/timeline/page.tsx). Key fixes:
- `program_dna.weight` → `weight_pct`; `program_questions.section_name` → `section`
- `program_questions.display_order` → `order_index`; `exact_phrasing` → `asked_as`
- `archived_questions.question_text` → `text`; `programs.website_url` → `url`
- `programs.tags` → `industry_tags`; `significance_score` thresholds corrected (0–1 not 0–100)
- `profile_answers`: removed non-existent `source`, `is_canonical`, `confidence_score` columns
- `AnswerEditor` confidence: was number slider 0–100, now enum toggle draft/solid/locked

**Verified**: `npm run type-check` and `npm run build` pass in the Next.js app.

### [x] Next.js build verification
**Owner**: Codex (or manual)
**Priority**: P0 — `cd app && npm run build` passes after column fixes

### [x] AI draft API route
**Owner**: Codex
**Priority**: P1 — `POST /api/draft` calls Anthropic directly and returns draft text

### [ ] AI draft UI smoke test
**Owner**: Codex
**Priority**: P1 — confirm workspace button calls `POST /api/draft` and inserts returned draft text

---

## Next

### [ ] Significance score display
- Show `importance_score` as star rating (1–5) on each question in Workspace
- Sort questions by importance within each section
- Tooltip: "Asked by N programs"

### [ ] DNA visualization on program detail page
- Radar/bar chart of theme weights from `program_dna`
- Compare user's profile coverage against program DNA

### [ ] Recalibrate theme prestige weights
- After reviewing sorted significance scores, adjust `theme_prestige` multipliers in `compute_significance_scores()`
- Target: traction + problem questions score highest across most programs

### [ ] TypeScript types regeneration
- Run `npx supabase gen types typescript --project-id betcyfbzsgusaghriptz > app/lib/database.types.ts`
- Ensures types match current schema including `program_dna`, `user_program_fit`

---

## Phase 3 (after first paying user)

### [ ] Stripe integration
- Products: Free / Pro ($19/mo) / Team ($49/mo)
- Webhook handler: update `user_subscriptions` on payment events
- Rate limiting wired via `ai_usage` + `increment_draft_count`
- Gate: unlimited AI, export, heat scores, acceptance rates behind Pro

### [ ] Deadline alerts
- 30d / 7d / 24h warnings per program
- Only trigger when user readiness > 60%
- Email via Supabase Edge Function + Resend

### [ ] Recruiter agent
- Scheduled job: scan new programs matching user profile DNA
- Alert on match when new program added OR user profile changes materially

---

## Phase 4 (platform layer)

### [ ] Outcome tracking
- User logs: "got in" / "rejected" / "waitlisted"
- Closes feedback loop for fit score and DNA calibration

### [ ] GitHub plugin
- Pull traction signals from public repos (stars, commits, contributors)
- Auto-populate traction question context

### [ ] Team mode
- Co-founders share an answer library
- Assign questions to team members, see each other's drafts

### [ ] Public API
- Open program and question data to partners

---

## Done ✅

- [x] v3 schema design — global question archive as core asset
- [x] Supabase migrations 001–008 (core schema, intelligence, monetization, DNA layer)
- [x] MCP server — 18 tools, 7 resources, 3 prompts, clean TypeScript build
- [x] MCP server README (Claude Desktop, Cursor, Windsurf configs)
- [x] CI workflow for MCP server (`.github/workflows/ci.yml`)
- [x] SECURITY.md, ARCHITECTURE.md, STATUS.md docs
- [x] 30 programs seeded to Supabase (`betcyfbzsgusaghriptz`)
  - Y Combinator, Techstars, a16z START, 500 Global, Alchemist Accelerator
  - First Round, Pear VC, NEA, Precursor, Hustle Fund, Indie.vc
  - Google for Startups, Accenture FinTech Lab, Mozilla Builders
  - SBIR Phase I, NSF SBIR, DOE ARPA-E
  - Echoing Green, Fast Forward, Halcyon, MassChallenge, Village Capital
  - Backstage Capital, Visible Hands, Camelback, Overlooked, Kapor Capital
  - Capital Factory, Founders' Co-op, Founder Catalyst
- [x] `compute_significance_scores()` executed — 225 questions scored
- [x] `compute_program_dna()` executed — DNA weights live for all 30 programs
- [x] Next.js app scaffold — app router, auth, Supabase SSR, TypeScript types, layout
- [x] Hub UI — program directory, filters, sort, ranking, program detail with DNA viz
- [x] Hub Timeline — open/closed status, deadline countdown bars, rolling programs
- [x] Application Workspace — per-program Q&A, readiness progress, answer editor
- [x] Answer History — diff view component with word-level highlights, restore button
- [x] Answer Bank (profile) — grouped by theme, confidence badges, inline editor

---

## Milestones

| Milestone | Target | Status |
|---|---|---|
| MCP server production-ready | Week 3 | ✅ Done |
| 30 programs seeded + intelligence live | Week 5 | ✅ Done |
| Hub UI live (real data) | Week 6 | ✅ Build verified |
| First paying user | Week 8 | ⬜ Not started |
| 30 draft runs logged | Week 9 | ⬜ Not started |
| Recalibration checkpoint | Week 10 | ⬜ Not started |
