# After Launch — Deferred Feature List

These are confirmed-valuable features that were explicitly deferred until after the initial launch.
Not a backlog — these are things we're building, just not yet.

---

## Product Vision (from `codex/feedback.md`)

### Onboarding & Entry Gate
- Application-first onboarding: new users either fill out "our application" (5-10 questions) OR upload an application they're working on before the product opens up
- The system conforms to their answers — content, themes, and question ordering adapts to their profile
- Reduces overwhelm: don't show the full Hub/Today dashboard until the user has a context established
- Free tier shows less data, not more — fewer questions, randomized/rotated opportunity set

### Persona Profiles ("The Big One")
- As users fill out applications they develop a **persona profile** — eventually strong enough that they don't need to fill out individual applications
- Flip side: employers/funders post an application and get **immediate scoring recommendations** based on filled-out persona profiles — not a match.com % but a genuine ranked hit list
- Breaks gatekeeping: applicants stop spraying and praying; evaluators stop drowning in volume
- Requires: outcome tracking, longitudinal answer quality signals, B2B surface for institutions

### Hub Free Tier Gating
- Free tier rotates/randomizes 50 opportunities every 4-12 hours instead of showing all 800+
- Search, filter, best-fit ranking are Pro features
- Manual search still available on free
- Tab-style display: check_size · equity · paid/unpaid · remote · travel · audience filter columns

### LaTeX-Style Editor
- Left panel: question + answer editor
- Right panel: live output / compiled view
- Similar to Overleaf or Prism
- Copy-paste injection into preferred LLM stays easy

### Days → Pro Transfer
- Users can transfer earned days to other users (founders, students, etc.)
- Social/community mechanic: "I'm giving 30 days to the most compelling cold outreach I receive this month"

---

## Technical Debt

### GitHub Traction Integration
- `github_url` exists on profiles
- Needs: GitHub API fetch (stars, commits, contributors), storage, wiring into fit scoring
- Gate: probably needs OAuth token; respect public API rate limits
- Payoff: fit scores become meaningfully better for technical founders

### Team Mode UI
- Schema live (migration 025), Stripe gating exists
- Needs: invite member flow, shared answer library, collaborative workspace
- Gate: need team-tier subscribers to justify the build

### Public API
- Expose program directory and question archive to partners
- Tiered access (free read-only, paid write/query)
- Gate: need launch traction first

### Plugin-eval Benchmark
- `.plugin-eval/` infrastructure exists, zero tests
- Needs: benchmark test cases against all 21 MCP tools
- Gate: not urgent until MCP usage scales

---

## Data / Archive Vision

### University Seeding
- Top 250 schools, split by specialty: science, business, law, tech, medical
- Sub-layers: community college, 4-year public/private/ivy, grad, PhD
- By location
- Pull 20% of applications from each list

### Grant Seeding
- Split: academic research, student scholarships, business grants, federal/private
- Sub-splits within each

### Jobs Archive (Static)
- Top companies by sector: federal, public, private, finance, manufacturing, tech
- 30-50 applications per sector to seed the category
- **Static/historic archive** for learning from — not competing with Indeed/Glassdoor
- Living archive only if companies pay to host and process their applications through the platform
- Potential partnerships: Greenhouse, Lever, Ashby, Indeed, LinkedIn (not competing — integrating)

### Community Side
- Stats dashboard: questions uploaded, answers given, applications filled
- Leaderboard: who's answering questions, providing programs, filling applications
- Rate/rank answers — community signal on answer quality
- Funny/notable answers surface

---

## Data Lifecycle & Archive

### Cycle Retirement Process
Programs and cycles go stale fast — a closed YC S25 cycle shouldn't carry the same weight as an open S26. The retirement process:

1. **Mark stale**: cron or manual review sets `program_cycles.is_active = false` when `closes_at` has passed + a grace period (e.g. 30 days after close)
2. **Score decay**: `programs.heat_score` decays if the program has no active cycle and hasn't opened a new one in 6+ months — drops it in Hub ranking but doesn't delete
3. **Program archival**: programs with no active cycle for 12+ months get `programs.is_archived = true` — hidden from Hub by default, still queryable

### Static Public Archive
Heavy closed-cycle data doesn't need to live in the hot DB:

- **What moves**: closed `program_cycles` rows older than 2 years, plus their associated `program_questions` snapshots
- **Where it goes**: JSON export to a public S3/R2 bucket + a static archive page (e.g. `/archive/yc-s22`)
- **Why public**: SEO value, researcher use, historical reference — this is a moat asset
- **Hot DB stays lean**: only active programs, open cycles, and the last 1-2 closed cycles per program stay live

### Cleanup Cadence (proposed)
| Trigger | Action |
|---|---|
| `closes_at` + 30 days | Set `is_active = false` on cycle |
| No active cycle for 6 months | Decay `heat_score` |
| No active cycle for 12 months | Set `programs.is_archived = true` |
| Archived for 2 years | Export to static archive, delete hot rows |

Gate: needs `programs.is_archived` column (migration) + Hub filter to exclude archived by default.
