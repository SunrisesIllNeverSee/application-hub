# Application Hub — Task List

Current phase: **Phase 2 — Live data integration + Polish**

Last updated: 2026-05-10

---

## Now (active)

### [ ] Answer Bank drip mechanic — sign-up + daily login feed
**Owner**: Cowork (UX) + Cowork (data)
**Priority**: P0 — this is the retention engine, not a feature.

User vision (captured 2026-05-10): Answer Bank pre-loads with 5–10 high-significance archived questions on sign-up, drips 2–5 new questions per daily login for free users, capped at ~30 total. Pro tier unlocks all 225+ questions immediately. Free tier visibly grows their bank as they show up.

Why this matters:
- Solves cold-start (today: empty bank → user bounces)
- Builds daily habit (log in to see new questions to answer)
- Visible asset growth (count goes up, feels like banking something real)
- Pro upgrade has a clear hook (unlock all questions instead of waiting weeks)

Implementation pieces:
- New table `user_question_unlocks` (user_id, archived_question_id, unlocked_at, source) — append-only
- On sign-up trigger: pick top N high-significance questions matched to user's profile tags, insert into unlocks
- On daily login: pick M unlocked questions for today (skip if user has answered N already this week)
- Profile page surfaces unlocked vs. locked questions visually — locked show theme + "Pro to unlock" or "Unlocks tomorrow"
- Pro tier check skips drip entirely

See VISION.md for the broader product context.

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

### [x] Agent-side review/comment contract
**Owner**: Codex + Deric
**Priority**: P1 — documented the saved-answer context needed for RNS/CIVITAE/MO§ES review workflows

Keep this separate from `/api/draft`: hosted drafting creates first-pass text, while review/comments/certification can run from Deric's side through MCP/RNS workflows over saved answers.

Output:
- `docs/07_agent_review_contract.md`
- MCP tool stub: `hub_get_answer_review_context(answer_id)`

---

## Tonight's follow-ups (2026-05-10 smoke-test session)

### [ ] Set up custom SMTP for Supabase auth emails
**Owner**: Codex or Deric
**Priority**: P1 — Supabase free-tier email is rate-limited (~3/hr per address, also IP-throttled). Magic-link signups are unreliable for any real user testing.

Option set: Resend (cheapest, 100/day free), Mailgun, SendGrid, AWS SES. Resend is the most Supabase-friendly and they have a setup guide.
Flow: Supabase Dashboard → Authentication → Emails → "Set up custom SMTP" → paste provider creds.

### [ ] Commit migration 009 + auth/callback route move
**Owner**: Cowork
**Priority**: P0 — these are real fixes that need to land.

- `migrations/009_fix_auth_trigger_search_path.sql` — fixes the "Database error saving new user" gotcha (SECURITY DEFINER + missing search_path)
- `app/app/auth/callback/route.ts` — moved out of `(auth)` route group so Supabase magic-link redirects find the route at the URL the login page advertises

### [ ] Decide what to do with dev-only password sign-in
**Owner**: Cowork
**Priority**: P2 — added during smoke test as escape hatch for email rate limits.

The block in `app/(auth)/login/page.tsx` is marked `{/* Dev/testing path... */}`. Options: (a) gate behind `NODE_ENV === 'development'`, (b) gate behind a feature flag, (c) strip before launch and rely solely on magic links. Custom SMTP (above) makes magic links reliable enough that (c) becomes viable.

### [x] Bug — DNA theme weights showed as 2290% (fixed)
**Owner**: Cowork
ThemeBar expected `weight` as 0–1 but `program_dna.weight_pct` is 0–100. Removed the `* 100` in `app/components/ThemeBar.tsx`.

### [x] Bug — Sidebar "Program Hub" stayed active on `/hub/timeline` (fixed)
**Owner**: Cowork
Active matching used prefix `startsWith('/hub/')` which matched both. Now picks the longest matching href so child routes win.

### [ ] Hub list — surface deadlines + better default sort
**Owner**: Cowork
**Priority**: P1 — biggest UX gap from smoke test. Every program shows "Rolling" because seed data has no real deadlines. Need to (a) seed real deadlines on programs that have them (YC W26, Techstars batches, SBIR cycles), and (b) sort default to surface urgency (closest non-rolling deadline first, then composite_score within Rolling).

### [ ] Program detail — TL;DR / pros & cons / verdict block
**Owner**: Cowork
**Priority**: P1 — user feedback: "the programs did not describe who and what they are... pros and cons of the deal and tl;dr." Detail page has the long blob description but no scannable summary. Two paths: static seed columns (`tldr`, `pros[]`, `cons[]`, `best_for_founder_type`), or AI-generated on first view. Static ships faster, AI is more unique.

### [ ] "Golden opportunities" tier — premium feature concept
**Owner**: Cowork (design) + Codex (data)
**Priority**: P2 — premium upsell anchor from user suggestion. Combines days-until-deadline (lower = urgent), applicant count (lower = less competition), DNA-fit (higher = better match), and recency. Pro tier sees a "Golden opportunities" rail at top of /hub.

### [ ] Sidebar — make collapsible
**Owner**: Cowork
**Priority**: P2 — user request. Chevron toggle, collapses to icon-only ~56px width, persist in localStorage.

### [ ] Sidebar — workspace discoverability
**Owner**: Cowork
**Priority**: P2 — user couldn't find "Workspace" because sidebar shows "My Applications." Either rename in sidebar to "Workspace" or update docs (CLAUDE.md/AGENTS.md/README) to consistently use "My Applications" as the user-facing label and reserve "workspace" for the route name only.

### [ ] Login — Safari/Chrome Keychain password save
**Owner**: Cowork
**Priority**: P3 — user noted Mac password manager didn't offer to save. Form has correct `autoComplete` attributes but `router.push('/hub')` is client-side and sometimes doesn't trigger save prompts. Quick workaround: switch to `window.location.href = '/hub'` after sign-in. Goes away once magic links are reliable (= custom SMTP).

### [ ] Build the Question Bank UI surface
**Owner**: Cowork
**Priority**: P1 — the *concept* is foundational and well-documented (`docs/04_question_intelligence.md`, `02_build_plan.md` Phase 4). The MCP tool `hub_get_universal_questions` already exists and works. The 225 archived questions are scored. **Only the Next.js UI is missing.**

What to build:
- `/bank` route — unlocked questions ready to answer + locked previews + drip schedule
- Onboarding flow per `04_question_intelligence.md` mockup: "Answer these 5 questions and you'll be ready for 60% of open programs"
- Calls the existing `hub_get_universal_questions` MCP tool (or replicates the query directly via Supabase)
- Combines with the Drip mechanic: free tier sees N unlocked + M locked previews
- Replaces or augments `/profile` (Answer Bank) as the daily landing page

### [ ] Three-layer schema — Funders / Programs / Applications
**Owner**: Cowork (data) + future migration
**Priority**: P2 — schema cleanup for long-term clarity. YC runs W26 and S26 separately. Techstars runs Boulder, Seattle, NYC. We conflate these today.

Future migration: add `funders` table, `programs.funder_id` FK. New `/funders` index. See VISION.md for full reasoning.

### [ ] Information architecture — Timeline tab review
**Owner**: Cowork (design)
**Priority**: P3 — Timeline is its own sidebar entry but it's just a different sort of Hub. Two options: (A) Timeline becomes a view tab inside Hub, (B) reorganize sidebar around founder workflow stages (Discover / Schedule / Apply / Bank / Funders). Defer decision until drip mechanic ships.

### [ ] Build proper user profile section (separate from Answer Bank)
**Owner**: Cowork
**Priority**: P1 — `/profile` is the Answer Bank today. No actual user profile (company name, bio, stage, industry tags, etc).

Schema: new `user_profiles` table or expand. Routes split: `/profile/answers` (current bank) + `/profile/about` (real profile) + `/profile/settings`. Unblocks: better fit scores, smarter drip, Founder Ranking, Application Hub Fund eligibility.

### [ ] Bug — pages don't auto-render at smaller viewports
**Owner**: Cowork
**Priority**: P1 — user reports having to max out screens. Investigation done — three specific fixes:

1. **Sidebar fixed `w-56` never hides** — `app/components/Sidebar.tsx:91`. Add `hidden md:flex` + mobile drawer toggle (or `w-0 md:w-56`).
2. **App layout no mobile padding scaling** — `app/app/(app)/layout.tsx:23` uses `max-w-6xl mx-auto px-6 py-8`. Change to `px-4 md:px-6 py-4 md:py-8` and add `min-w-0` on `<main>` to prevent flex-child overflow.
3. **Program detail tablet squeeze** — `app/app/(app)/hub/[slug]/page.tsx:152` uses `lg:grid-cols-3`. Tablet (768–1023px) plus sidebar squeezes content. Need either intermediate breakpoint or sidebar collapse at `md`.

Plus three smaller layout bugs spotted: `overflow-hidden` on root flex (`(app)/layout.tsx:20`) prevents page-scroll fallback, stat cells in program detail (`hub/[slug]/page.tsx:118`) lack `truncate`, sidebar internal nav lacks min-height guard.

### [x] Bug — word counter (resolved by user; was input-mode confusion)
**Owner**: Cowork
User confirmed working after retest. Agent investigation had already found no plausible code path where it would fail. Likely cause was typing in login form or AnswerEditor view mode (no textarea). Closing.

### [ ] Heat scores + applicant counts populating as 0
**Owner**: Cowork (data) + Codex (compute)
**Priority**: P2 — every program shows "0 heat" and "0 applicants" because no data source yet. Real heat: scrape acceptance rate sites, social mentions, portfolio company GitHub stars. Real applicants: program partnerships or our own telemetry. MVP: synthetic heat from prestige + cohort exclusivity.

---

## Next

### [ ] Residual dependency audit follow-up
- Next.js is bumped from `14.2.0` to `14.2.35` and builds cleanly.
- `npm audit --omit=dev --audit-level=moderate` still reports advisories for `next`, `postcss`, and `@supabase/ssr` transitive `cookie`.
- `npm audit fix --force` currently wants breaking upgrades (`next@16.2.6`, `@supabase/ssr@0.10.3`), so handle this as a deliberate upgrade track instead of a blind force fix.

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
- [x] Supabase migrations 001–009 (core schema, intelligence, monetization, DNA layer, auth trigger hardening)
- [x] MCP server — 19 tools, 7 resources, 3 prompts, clean TypeScript build
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

## Milestones (sequence, not schedule)

We are **nonlinear and temporal** — no calendar weeks, no dates. Milestones exist
to track sequence and dependency, not to commit to timelines.

| Milestone | Status |
|---|---|
| MCP server production-ready | ✅ Done |
| 30 programs seeded + intelligence live | ✅ Done |
| Hub UI live (real data) | ✅ Smoke-tested 2026-05-10 |
| Question Bank UI + Drip mechanic | ⬜ Next critical milestone |
| Custom SMTP + reliable magic-link auth | ⬜ Queued |
| First paying user | ⬜ After above two |
| 30 draft runs logged | ⬜ After first paying user |
| Recalibration checkpoint (theme prestige weights) | ⬜ After 30 drafts |

See `ROADMAP.md` for the priority-ordered list of work.
