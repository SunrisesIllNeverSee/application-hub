# Build Plan — Application Hub
> Ello Cello LLC

---

## Principles

- **Seed first, automate second.** Manual data until 30 programs. Then build scrapers.
- **Revisit after each phase.** Assumptions will be wrong. Plans update.
- **MCP from day one.** Every data model decision should ask: "does this expose cleanly as an MCP tool?"

---

## Phase 1 — Foundation
*Prerequisite for everything. Do once.*

- [ ] Run migrations 001–007 in Supabase (prod + staging branch)
- [ ] Enable pg_cron, pgvector, pg_trgm extensions
- [ ] Scaffold Next.js 14 App Router project
- [ ] Supabase client + server-side auth (Google OAuth + magic link)
- [ ] `supabase gen types typescript` → `/types/supabase.ts`
- [ ] Environment config (`.env.local`, Vercel env vars)
- [ ] Basic layout shell (nav, auth state, dark/light mode toggle)

---

## Phase 2 — Seed Data (Manual, 30 Programs)
*Do this before building any UI. You need real data to build against.*

### Programs to seed first (prioritized by user demand)
| Program | Type | Notes |
|---|---|---|
| Y Combinator | Accelerator | 7% equity, $500k, rolling review |
| Techstars | Accelerator | 6% equity, $120k, cohort |
| Antler | Accelerator | 10% equity, $200k, cohort |
| 500 Global | Accelerator | 6% equity, $150k, cohort |
| Pear PearX | Accelerator | ~5% equity |
| a16z START | Accelerator | No equity, cash grant |
| Google for Startups | Corporate | No equity, credits + mentorship |
| AWS Activate | Corporate | No equity, credits |
| Microsoft Founders Hub | Corporate | No equity, credits |
| SBIR Phase I (NSF) | Gov Grant | No equity, $275k |
| SBIR Phase I (NIH) | Gov Grant | No equity, $300k |
| SBIR Phase I (DoD) | Gov Grant | No equity, $250k |
| Thiel Fellowship | Fellowship | $100k, no equity, under-20 |
| Knight Foundation | Fellowship | Journalism/civic tech focus |
| Echoing Green | Fellowship | Social enterprise, $80k |
| Schmidt Futures | Fellowship | Science/tech policy |
| GSB SEED | University | Stanford, $20k |
| MIT delta v | University | $20k + lab access |
| Wharton Venture Award | University | Penn, $20k |
| OpenAI Grove | Corporate | OpenAI portfolio support |
| Databricks Startup Challenge | Corporate | Credits + partnership |
| MassChallenge | Accelerator | No equity |
| Sequoia Arc | VC Program | No equity, global |
| Bessemer Forge | VC Program | BVP portfolio |
| NEA | Gov Grant | Arts focus |
| USDA SBIR | Gov Grant | Ag/rural focus |
| Cloudflare for Startups | Corporate | No equity, credits |
| Stripe Atlas + credits | Corporate | No equity, infra |
| Neo4j Startup Program | Corporate | No equity, credits |
| GitHub Accelerator | Corporate | Open source focus, stipend |

### Per program, capture
- All questions (exact text)
- Word/character limits per question
- Equity %, cash value, credit value
- Deadline + rolling vs cohort
- Program length (weeks)
- What stage/sector they want
- Acceptance rate if known
- Follow-on funding rate if known

### Revisit after 30
- Are the schema fields sufficient? What data couldn't you capture?
- Which questions appeared across 5+ programs? Those are your universal questions.
- What did you wish you had scraped automatically?

---

## Phase 3 — Hub (Browse + Discover)

- [ ] Program cards: name, type, status (open/closed/upcoming), deadline countdown
- [ ] Program value score displayed (ROI ranking)
- [ ] Filters: type, status, equity (yes/no), rolling, deadline range
- [ ] Heat score ranking (trending)
- [ ] Program detail page: full metadata + questions list + acceptance stats
- [ ] Readiness % per program (based on user's answered questions)

---

## Phase 4 — Application Workspace

- [ ] Profile onboarding: answer universal questions first
- [ ] Per-program workspace: question list, pre-fill from profile, divergence flag
- [ ] Answer editor: word count, limit indicator, version history
- [ ] AI draft button (uses connected integration or platform default Claude)
- [ ] Status tracker: saved → drafting → submitted → result
- [ ] Deadline sidebar with countdown

---

## Phase 5 — Program Ranking System

New schema fields (migration 008):
```sql
ALTER TABLE programs ADD COLUMN equity_pct           NUMERIC(5,2);
ALTER TABLE programs ADD COLUMN cash_value_usd       INT;
ALTER TABLE programs ADD COLUMN credit_value_usd     INT;
ALTER TABLE programs ADD COLUMN is_rolling           BOOLEAN DEFAULT FALSE;
ALTER TABLE programs ADD COLUMN exclusivity_days     INT;
ALTER TABLE programs ADD COLUMN program_length_weeks INT;
ALTER TABLE programs ADD COLUMN network_score        INT;   -- 1–10, curated
ALTER TABLE programs ADD COLUMN brand_score          INT;   -- 1–10, curated
ALTER TABLE programs ADD COLUMN follow_on_rate_pct   NUMERIC(5,2);
ALTER TABLE programs ADD COLUMN application_roi      NUMERIC(10,4);
```

Value score formula:
```
program_value_score =
  (cash_value_usd + credit_value_usd + (network_score * 50000) + (brand_score * 25000))
  - (equity_pct * 100000 + exclusivity_days * 500)
  / NULLIF(total_required_questions * avg_word_limit, 0)
```
Recomputed daily by cron.

---

## Phase 6 — Scraping Pipeline
*Only after Phase 2 manual seed validates the data model.*

### Architecture
```
Playwright scrapers  →  Raw HTML/JSON  →  Parser  →  import_queue  →  AI mapper  →  programs + archived_questions
Grants.gov API       →  Structured JSON →  Direct mapper            →  programs
```

### Scrapers to build (in order)
1. **Grants.gov / Simpler.Grants.gov** — REST API, free, documented. Start here.
2. **Known program pages** — Playwright, target: YC, Techstars, Antler, 500, etc. Hit their /apply pages.
3. **Reddit** — r/startups, r/entrepreneur, r/YCombinator — search for new program announcements
4. **ProductHunt** — tag: "startup tools," "grants," "fellowships"

### Cron schedule (all daily)
| Job | Time | What |
|---|---|---|
| `gov-grants-sync` | 5am | Simpler.Grants.gov API → new/updated federal opps |
| `scrape-program-deadlines` | 6am | Check known program pages for deadline changes |
| `scrape-program-questions` | 6:30am | Re-pull question list if deadline changed |
| `discover-new-programs` | 7am | SERP + Reddit + PH for new programs |
| `recompute-heat-scores` | Every 6h | Existing cron (migration 006) |
| `auto-update-program-status` | Every 1h | Existing cron (migration 006) |
| `recompute-program-value-scores` | 8am | Re-run value score formula |

### Data filtering per scraped program
1. Dedup — slug match + pgvector name similarity
2. Question extraction — AI parses page, pulls questions + word limits
3. Question dedup — pgvector match against archived_questions
4. Metadata extraction — equity, cash, deadline, rolling/cohort
5. Confidence scoring — flag low-confidence for human review

### Revisit after scraper is live
- Which sites blocked us? Need Bright Data / Apify for those.
- Which questions did the AI misparse? Improve prompt.
- What data is consistently missing from scraped pages? Add manual field.

---

## Phase 7 — Agent Layer

### Agent 1: Scout Agent
- Trigger: daily cron (7am, after discover-new-programs)
- Inputs: SERP results, Reddit posts, PH launches
- Output: pushes candidates to import_queue with confidence score
- Stack: Supabase Edge Function + Claude claude-haiku-4-5 (fast + cheap)

### Agent 2: Deadline Nudge Agent
- Trigger: program deadline ≤ 7 days + user has application in "drafting" status
- Output: notification with completion %, list of unanswered required questions
- Stack: Edge Function triggered by pg_cron

### Agent 3: Opportunity Scout (the "recruiter")
- Trigger: new program ingested OR user updates profile answers
- Logic: score each open program against user's profile completeness
- Output: ranked list — "You're 82% ready for Antler. 3 questions left. 14 days."
- Stack: Edge Function + pgvector cosine similarity (profile vs program requirements)

### Agent 4: Answer Coach
- Trigger: user opens a question in workspace
- Logic: pull best past answer from profile/history, compare to program tone/focus, suggest edits
- Output: inline suggestions + divergence score
- Stack: Edge Function + Claude Sonnet

### Agent 5: Archive Enrichment Agent
- Trigger: new program ingested (after question extraction)
- Logic: embed new questions with pgvector, match to existing archive, merge duplicates
- Output: updates archived_questions, increments asked_by_count
- Stack: Edge Function + OpenAI text-embedding-3-small (or Claude when available)

---

## Phase 8 — Stripe + Subscriptions

- [ ] Stripe products + prices matching migration 007 seed data
- [ ] Stripe webhooks → update user_subscriptions table
- [ ] Subscription check middleware (Next.js)
- [ ] Feature gates: export, acceptance rates, heat scores, AI drafts limit
- [ ] Program listing flow for funders (verified/featured tiers)
- [ ] Customer portal (manage subscription, cancel)

---

## Phase 9 — MCP Server
*See `03_mcp_spec.md` for full detail.*

- [ ] Build MCP server (TypeScript, `@anthropic-ai/sdk` or `@modelcontextprotocol/sdk`)
- [ ] Deploy as Supabase Edge Function or standalone (Vercel)
- [ ] Publish to Official MCP Registry
- [ ] Submit to Smithery + Glama
- [ ] Add Claude plugin listing

---

## What to Revisit at Each Phase End

| After phase | Questions to answer |
|---|---|
| 2 (seed) | Is the schema right? What fields are missing? Which questions are universal? |
| 3 (hub) | What do users actually filter by? What's confusing? |
| 4 (workspace) | What's the drop-off point? Where do users get stuck? |
| 5 (ranking) | Does the value score match user intuition? Needs calibration. |
| 6 (scraping) | What % of data is accurate? What needs human review? |
| 7 (agents) | Which agent gets used? Which gets ignored? |
