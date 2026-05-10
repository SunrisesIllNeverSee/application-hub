# Application Hub — Research & Build Plan

---

## 1. White Space: What Already Exists

### GitHub
| Repo | What it is | Threat level |
|---|---|---|
| [ankitshah009/all_about_grad_cs_fellowships](https://github.com/ankitshah009/all_about_grad_cs_fellowships) | Static list of grad fellowships, markdown only | None — no product |
| [zaina-saif/GrantAIScraper](https://github.com/zaina-saif/GrantAIScraper) | Scrapes awarded grants for nonprofit keyword analysis | Low — nonprofit-only, no application layer |
| [Tar-ive/grants-mcp](https://github.com/Tar-ive/grants-mcp) | MCP server for US federal grants via Simpler.Grants.gov API | Medium — covers gov grants, not private/accelerators, no question archive |
| [robhunter/agentdeals](https://github.com/robhunter/agentdeals) | MCP server for infra deals + startup credits (AWS Activate, etc.) | Low — credits/perks, not applications |
| No repo found | "Application hub" or "program hub" with question database | **Gap confirmed** |

### MCP Registries (Smithery, Glama — 9,000+ servers combined)
- **grants-mcp** exists: federal gov grants only, no private programs, no question archive, no workflow
- **agentdeals** exists: startup credits, not applications
- **Nothing found**: accelerator/fellowship/VC program hub, question database as MCP, application workflow as MCP

### Products (non-GitHub)
| Product | What it does | Gap |
|---|---|---|
| Grants.gov / Simpler.Grants.gov | Federal grants search + API | Gov only, no application help |
| F6S | Program directory + apply button | No question reuse, no ranking, no AI |
| Submittable | Grant/program intake for funders | Funder-side tool, not applicant-side |
| Huntr / Simplify | Job application tracker | Jobs only, no programs, no AI drafting |
| Startup Genome | Ecosystem data | Research tool, not application tool |

**Verdict:** No one has (a) a cross-category program hub + (b) a shared question archive + (c) applicant-side workflow + (d) MCP exposure. Confirmed clear.

---

## 2. What We're Building (Full Map)

### Core Platform Layers
```
[Data Layer]        programs + questions + rankings (Supabase/Postgres)
[Intelligence]      heat scores + question dedup + acceptance rates
[Application Layer] profile answers → per-program drafts → submission tracking
[Monetization]      user subscriptions + funder listings + AI usage metering
[MCP Server]        exposes platform as tools for any AI assistant
[Agents]            5 autonomous agents running on Edge Functions
```

### Programs We Track (not just accelerators)
- Accelerators: YC, Techstars, 500 Global, Antler, Pear PearX
- VC programs: a16z START, Sequoia Arc, Bessemer Forge
- Corporate: Google for Startups, AWS Activate, Microsoft Founders Hub
- Gov grants: SBIR/STTR (NSF, NIH, DoD), NEA, USDA
- Fellowships: Thiel, Knight, Echoing Green, Schmidt Futures
- University: GSB SEED, Wharton Venture, MIT delta v
- Jobs: senior/exec roles at portfolio companies

---

## 3. Program Ranking System (NEW)

Each program gets a **Program Value Score** separate from heat score.

### What goes into it

**The Ask (negative weight)**
- Equity taken (0% → 10%+)
- Time commitment (weeks in program)
- Exclusivity (can you apply elsewhere during?)
- Revenue share if any
- IP assignment clauses

**What You Get (positive weight)**
- Cash / grant amount
- Credit value (AWS, GCP, etc.)
- Network quality (alumni outcomes, investor access)
- Brand / signal value (YC > unknown accel)
- Mentorship hours / access
- Follow-on funding rate

**Application Difficulty**
- Number of questions
- Word limits total
- Acceptance rate (from acceptance_reports table)
- Rolling vs cohort (rolling = better odds)

**Formula (v1)**
```
program_value_score = (
  (cash_value + credit_value + network_score + brand_score)
  - (equity_pct * 10 + time_cost_score + exclusivity_penalty)
) / application_difficulty_score
```

This gives: **ROI per unit of application effort.**

### Schema additions needed
```sql
-- Add to programs table:
equity_pct          NUMERIC(5,2),        -- 0.00 to 100.00
cash_value_usd      INT,                 -- grant/investment amount
credit_value_usd    INT,                 -- cloud/tool credits
is_rolling          BOOLEAN DEFAULT FALSE,
exclusivity_days    INT,                 -- days you can't apply elsewhere
program_length_weeks INT,
network_score       INT CHECK (1-10),    -- manually curated
brand_score         INT CHECK (1-10),    -- manually curated
follow_on_rate_pct  NUMERIC(5,2),        -- % that raise after

-- Computed:
program_value_score NUMERIC(10,4) GENERATED ALWAYS AS (...) STORED,
application_roi     NUMERIC(10,4),       -- recomputed with heat score
```

---

## 4. Data Scraping & Automation Plan

### Sources to scrape
| Source | What we get | Method |
|---|---|---|
| YC, Techstars, 500, Antler websites | Program details, deadlines, questions | Playwright scraper |
| Grants.gov / Simpler.Grants.gov | Federal opportunities | API (free, documented) |
| Crunchbase / Dealroom | Program metadata, alumni, funding | API or scraper |
| LinkedIn | Program announcements | SERP scraping |
| Twitter/X | Deadline reminders, new programs | API (limited) or scraper |
| Product Hunt | New program launches | RSS + scraper |
| Reddit (r/startups, r/entrepreneur) | Community-sourced programs | API |

### Pipeline Architecture
```
[Scrapers]  →  [Raw Queue]  →  [Parser/Mapper]  →  [import_queue table]
                                                          ↓
                                              [AI mapping agent]
                                                          ↓
                                         [programs + archived_questions]
```

#### Scraper stack
- **Playwright** (Node or Python) — handles JS-rendered pages
- **Bright Data / Apify** — for sites that block scrapers
- **Grants.gov API** — direct REST, no scraping needed
- **Firecrawl** — for bulk page extraction into markdown

#### Cron schedule
| Job | Frequency | What it does |
|---|---|---|
| `scrape-program-deadlines` | Daily 6am | Checks known program pages for deadline changes |
| `discover-new-programs` | Weekly | SERP + Reddit + PH search for new programs |
| `scrape-program-questions` | On deadline change | Re-pulls question list if program page updated |
| `gov-grants-sync` | Daily | Hits Simpler.Grants.gov API for new/updated federal opps |
| `acceptance-rate-refresh` | Weekly | Recomputes from acceptance_reports table |

#### Data filtering pipeline
Each scraped program goes through:
1. **Dedup check** — slug match + pgvector similarity on name/description
2. **Question extraction** — AI parses application page, extracts questions
3. **Question dedup** — pgvector match against archived_questions
4. **Metadata extraction** — equity, cash, timeline, rolling/cohort
5. **Human review queue** — low-confidence items flagged for manual check

---

## 5. MCP Server (Platform as Infrastructure)

Platform exposes these tools — any AI (Claude, GPT, Cursor, etc.) can use them:

```typescript
// Tools exposed
search_programs(filters)           // search hub by type/status/tags/deadlines
get_program_questions(program_id)  // returns all questions for a program
get_profile_answers(user_id)       // returns user's stored answers (authenticated)
get_heat_scores(limit, type)       // trending programs right now
get_program_value_scores(filters)  // ranked by ROI score
log_draft_run(program_id, ...)     // record AI draft usage
find_similar_questions(text)       // semantic search across archive
```

**Why this matters:** Other tools (Cursor, Claude, GPT plugins, Zapier) can plug into the platform. Users can ask their AI assistant "what are the top 5 fellowships open right now with no equity ask" and get a real answer from our data.

**Publish to:** Official MCP Registry (registry.modelcontextprotocol.io), Smithery, Glama, Claude plugins.

---

## 6. Agent Layer

### Agent 1: Scout Agent
- Trigger: daily cron
- Job: finds new programs, pushes to import_queue
- Sources: SERP, Reddit, Twitter, PH, known program pages

### Agent 2: Deadline Nudge Agent
- Trigger: deadline within 7 days AND user has started application
- Job: sends reminder, shows completion %, suggests which answers need work

### Agent 3: Opportunity Scout (Recruiter Agent)
- Trigger: user profile answers + background
- Job: scans hub for programs that match user's profile, ranks by program_value_score × readiness %
- Output: "You're 80% ready for Antler — 3 questions left. Deadline: 14 days."
- This is the "recruiter agent" — it proactively hunts for you

### Agent 4: Answer Coach
- Trigger: user opens a question in workspace
- Job: pulls best past answer, checks against program's tone/focus, suggests edits
- Outputs divergence score vs profile answer

### Agent 5: Archive Enrichment Agent
- Trigger: new program ingested
- Job: generates pgvector embeddings for all new questions, maps to existing archive, flags duplicates

---

## 7. Filtering Model (What We Extract Per Program)

### Program-level data
- Name, slug, type, status, source
- Deadlines (rolling vs cohort, multiple rounds)
- Equity %, cash/grant, credits
- Program length, location, remote/in-person
- What they're looking for (stage, sector, geography)
- Acceptance rate (crowdsourced from users)
- Follow-on funding rate (curated)
- Alumni notable outcomes

### Question-level data
- Question text (exact + normalized)
- Theme (mission, traction, team, market, product, financials, etc.)
- Word/character limit
- Required vs optional
- Is it universal? (asked by 80%+ of programs)
- How many programs ask it (asked_by_count)

### Application-level data (per user)
- Status (saved / drafting / submitted / result)
- Completion % (answered required questions / total required)
- Last edited
- Time spent
- Submitted date, result date

---

## 8. Build Order

| Phase | What | Why first |
|---|---|---|
| 1 | Run migrations 001–007 in Supabase | Foundation |
| 2 | Scaffold Next.js 14 + Supabase client + auth | Can't build UI without |
| 3 | Seed 30 programs + 500 questions manually | Need real data to test everything |
| 4 | Build Hub (browse, filter, heat score, program value score) | Core user value |
| 5 | Build Application Workspace | Core user value |
| 6 | Add schema fields for program ranking (equity, cash, etc.) | Required for ranking |
| 7 | Build Opportunity Scout agent | Retention + differentiation |
| 8 | Build scraper pipeline (Playwright + Grants.gov API) | Scale data |
| 9 | Expose MCP server | Platform / distribution play |
| 10 | Stripe + subscription gating | Monetization |

---

## Sources
- [grants-mcp on GitHub](https://github.com/Tar-ive/grants-mcp)
- [grants-mcp on Glama](https://glama.ai/mcp/servers/@Tar-ive/grants-mcp)
- [agentdeals MCP](https://github.com/robhunter/agentdeals)
- [Simpler.Grants.gov API](https://simpler.grants.gov/developer)
- [Official MCP Registry](https://registry.modelcontextprotocol.io/)
- [GitHub topics: grants](https://github.com/topics/grants)
- [GitHub topics: fellowships](https://github.com/topics/fellowships)
- [GrantAIScraper](https://github.com/zaina-saif/GrantAIScraper)
- [Glama MCP servers](https://glama.ai/mcp/servers)
- [Smithery](https://smithery.ai)
