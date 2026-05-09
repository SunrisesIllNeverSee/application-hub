# Application Hub — Full Product Roadmap

**Ello Cello LLC · From MCP server to funded platform intelligence layer**

---

## The destination

| | |
|---|---|
| **The platform** | The canonical database of what accelerators, grants, and fellowships actually ask — and what winning answers look like. |
| **The user** | Any founder or applicant who needs to apply to programs — individually or with a team. |
| **The model** | Freemium SaaS. Free tier builds the network. Pro unlocks AI drafting. Team unlocks collaboration. API licenses the data. |
| **The moat** | The question archive + outcome data. Every application logged makes the intelligence layer smarter. Network effects compound. |

---

## Phase 1 — Foundation · Intelligence layer + MCP server

**Status: Complete · Weeks 1–3**

The core asset isn't the UI — it's the question archive and the scoring engine sitting on top of it. Phase 1 built the intelligence layer first, before any user-facing product.

| Component | What it is | Status |
|---|---|---|
| v3 database schema | Question archive, profile answers, program DNA, fit scores, intelligence tables | ✅ Done |
| MCP server | 16 tools, 7 resources, 3 prompts — stdio + HTTP transport, TypeScript, clean build | ✅ Done |
| Question significance scoring | `asked_by_count × word_limit × theme_prestige × universal_bonus` per question | ✅ Done |
| Program DNA engine | Theme weight breakdown per program — what it actually cares about vs what it says | ✅ Done |

### MCP server tools (16 total)

**Public (no auth required)**

- `hub_search_programs` — filter by type, equity cap, deadline, cash
- `hub_get_program_detail` — full detail by UUID or slug
- `hub_get_program_rankings` — sorted by value score (ROI)
- `hub_get_heat_scores` — trending programs by applicant interest
- `hub_get_program_questions` — all questions with significance scores
- `hub_find_similar_questions` — pgvector semantic search + ilike fallback
- `hub_get_universal_questions` — questions asked by 80%+ of programs
- `hub_get_program_dna` — what a program actually weights (traction vs team vs mission %)
- `hub_get_question_significance` — how much a question matters across the platform
- `hub_get_acceptance_stats` — acceptance rate data by cohort label

**Authenticated (requires user_token)**

- `hub_get_profile_answers` — user's answer library ranked by coverage
- `hub_get_application_readiness` — % complete for a specific program + missing questions
- `hub_get_fit_score` — pre-computed fit score vs a program (4-component breakdown)
- `hub_find_best_programs` — top programs ranked by composite score for this user
- `hub_rank_my_answers` — which answers unlock the most programs
- `hub_log_draft_run` — track AI draft usage (rate-limited by tier)

**Resources (7)**

- `hub://programs` — all open programs, sorted by heat score (cached 60s)
- `hub://programs/{slug}` — single program detail by slug (cached 5min)
- `hub://questions/universal` — universal questions by significance (cached 1hr)
- `hub://questions/themes` — question counts by theme
- `hub://rankings/value` — top 25 open programs by value score (cached 1hr)
- `hub://rankings/heat` — top 25 trending programs (cached 1hr)
- `hub://stats/platform` — live counts: total programs, questions

**Prompts (3)**

- `opportunity_scout` — find best programs → show readiness gaps for each
- `draft_answer` — question significance → DNA → profile → draft answer
- `program_comparison` — side-by-side table with DNA breakdown + verdict

---

## Phase 2 — Seed data + core UI

**Status: Building now · Weeks 3–6**

This is the build sprint. The sequence matters — migrations first, data second, UI third. Nothing in the UI is meaningful without real programs and real questions behind it.

### Sequence

**Step 1 — Supabase migrations live**

Apply the v3 schema to production:
- `program_dna` table (theme weights per program)
- `user_program_fit` table (fit scores, pre-computed daily)
- `significance_score` column on `archived_questions`
- `pgvector` extension + embedding column for semantic question search
- Daily cron jobs: recompute fit scores, update heat scores, refresh significance

**Step 2 — Seed 30 real programs**

The 30-program threshold is a deliberate checkpoint. Before it, significance scores and DNA weights are theoretical. After it, there's enough data to validate whether the scoring predicts anything worth predicting.

Programs to seed (initial batch):
- Y Combinator, Techstars, SBIR, Google for Startups
- a16z, First Round Capital, Indie.vc, Founder Catalyst
- NSF SBIR, DOE grants, Echoing Green, Halcyon
- 10–15 additional accelerators and fellowships across sectors

For each program: real application questions, exact phrasing, word limits, theme classification, equity %, cash/credit value, deadline cadence.

**Step 3 — Next.js app scaffold**

- Auth via Supabase (email + magic link, no password)
- TypeScript types generated from schema
- Route structure: `/hub`, `/hub/[slug]`, `/workspace`, `/workspace/[program_id]`, `/profile`
- Dark/light mode (system default)
- Shared layout: sidebar nav, program search, user avatar

**Step 4 — Program Hub UI**

The program directory — the front door of the product:
- Program cards with type, equity, cash, heat score, days-to-deadline
- Rankings view: by value score (ROI) and by heat (trending)
- Program detail page: full terms, acceptance stats, DNA visualization (ASCII bar chart or simple bar)
- Timeline view: open vs closed, upcoming deadlines on a calendar
- Filter sidebar: type, equity cap, rolling vs cohort, deadline range

**Step 5 — Application workspace**

Per-program workspace where the actual work happens:
- Question list with significance stars and word limits
- Answer editor: write, edit, track word count, mark confidence (draft / solid / locked)
- Answer history: diff view between versions
- Profile answer suggestion: "You've answered something similar — use this?"
- Readiness indicator: progress bar for required questions
- Submit checklist before flagging as ready

**Step 6 — Answer editor v2**

- Source tracking per sentence: AI-generated / human-written / curated from archive
- Dual scoring: quality (how well-written) + relevance (how well-matched to program DNA)
- Sentence-level blending: highlight which parts came from where
- Canonical toggle: mark an answer as the "source of truth" for this theme

---

## Phase 3 — Intelligence + monetization

**Status: Planned · Weeks 6–10**

Phase 3 is where it becomes a product people pay for. Stripe goes in before the agent layer — rate limiting and tier gating need to be in place before anything runs autonomously.

| Component | What it does |
|---|---|
| **Stripe + tiered access** | Free (100 AI runs/month), Pro (unlimited AI), Team (multi-seat + shared library). Gated via `ai_usage` + `user_subscriptions` table. |
| **Fit score engine (cron)** | Daily recompute of `user_program_fit` for all open programs as the user's answers improve. Composite = `fit_score × program_value_score / 100`. |
| **Recruiter agent** | Autonomous scout: monitors deadlines, alerts on new openings that match user profile DNA. Runs on a schedule, not on-demand. |
| **Guided draft workflow** | One-click: question → significance lookup → DNA → pull best profile answer → draft with word-count target. Uses `hub_log_draft_run` for metering. |
| **Deadline alerts** | Email + in-app notifications: 30d / 7d / 24h warnings for programs where readiness > 60%. |
| **Question analytics** | After 30 programs seeded — revisit significance weights, retrain with real co-occurrence and outcome data. |

### Scoring logic (reference)

**Significance score**
```
significance = asked_by_count × avg_word_limit_weight × theme_prestige × universal_bonus
```

**Fit score (4 components)**
```
fit_score = (coverage 40%) + (theme_alignment 35%) + (criteria_match 15%) + (quality_signal 10%)
```

**Composite score (used in hub_find_best_programs)**
```
composite = fit_score × program_value_score / 100
```

High fit + high value = apply immediately.
High fit + low value = ready but not worth as much effort.
Low fit + high value = worth building toward.

---

## Phase 4 — Platform + ecosystem

**Status: Planned · Weeks 10+**

The platform layer that turns Application Hub from a tool into infrastructure.

| Component | What it does |
|---|---|
| **GitHub plugin** | Pull traction signals from public repos — stars, commits, contributors → auto-populate answer context for traction questions |
| **Plugin / MCP marketplace** | Let third parties add program data, question archives, and scout integrations via the MCP protocol |
| **Team mode** | Co-founders share an answer library, assign questions, see each other's drafts and confidence scores |
| **Outcome tracking** | Did you get in? User logs the result. Closes the loop — trains fit score and DNA weights on real acceptance data |
| **Public API** | Open program and question data to partners — YC alumni networks, accelerator directories, university entrepreneurship programs |

---

## Milestones and checkpoints

| Milestone | Target | Signal |
|---|---|---|
| MCP server production-ready | Week 3 | Clean build, README, connects to Claude Desktop |
| 30 programs seeded | Week 5 | DNA weights validated, significance scores reflect real data |
| Hub UI live (read-only) | Week 6 | Users can browse, compare, filter programs without auth |
| First paying user | Week 8 | Stripe live, Pro tier gated, at least 1 upgrade |
| 30 draft runs logged | Week 9 | Enough usage to validate rate limiting and AI quality |
| Recalibration checkpoint | Week 10 | Revisit scoring with real data — adjust weights before scaling |

---

## What's not on this roadmap (and why)

**Mobile app** — not yet. The workspace is write-heavy; desktop first until there's a clear mobile use case.

**Social / community features** — not yet. The moat is data, not network. Community features before the data layer is solid create noise, not signal.

**Integrations with program portals** — not yet. Scraping or auto-submitting applications introduces compliance risk and brittle maintenance. The platform is the preparation layer, not the submission layer.

**Outcome prediction** — not yet. After 30 programs seeded and 30 outcomes logged, there's enough to train a simple model. Not before.

---

## Dependencies

| Dependency | Risk | Mitigation |
|---|---|---|
| Supabase pgvector for semantic search | Low — extension is standard | ilike fallback already implemented in `hub_find_similar_questions` |
| Real question data for 30 programs | Medium — manual research required | Prioritize programs with public application archives (YC, Techstars, SBIR have published questions) |
| Stripe setup before agent launch | Low — standard integration | Must be done before Phase 3 begins — rate limiting depends on it |
| Outcome data for scoring calibration | High — requires real users | Design outcome logging from day one; don't wait for "enough" users to add it |

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Database | Supabase (PostgreSQL + pgvector) | RLS, auth, real-time, embeddings all in one |
| MCP server | TypeScript + `@modelcontextprotocol/sdk` | Typed, compiled, connects to Claude / Cursor / Windsurf |
| Frontend | Next.js (App Router) | Auth, SSR, TypeScript, easy Supabase integration |
| Payments | Stripe | Standard, well-documented, handles metering |
| AI drafting | Claude API (Haiku for speed, Sonnet for quality) | Metered via `hub_log_draft_run` |
| Hosting | Vercel (frontend) + Railway or Fly (MCP server HTTP mode) | Fast deploys, scales to zero |
| Cron | Supabase Edge Functions or pg_cron | Daily fit score recompute, heat score updates |
