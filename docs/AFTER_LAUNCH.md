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

---

## Architecture Decisions

### ADR-001 — Cross-Theme Portability
**Decision**: The question archive, answer bank, fit/review engine, and MCP tools are domain-agnostic infrastructure. No founder-only assumptions in reusable layers.

**What's already in place**: `domain` param on `hub_get_universal_questions` and `hub_find_similar_questions`. `applicant_mode` enum separates founder/student/researcher/job-seeker identity. Program types are filterable by mode.

**What's deferred**: Actual seeding of non-founder verticals (jobs, school applications, grants). Do not expand until the founder wedge validates — defined as 100+ active founders with measurable Answer Bank reuse rates.

**Rule**: When building new features, ask "does this work for a job applicant too?" If yes, build it portable. If the answer is "we'd need to refactor," that's the signal to make the layer generic first.

---

## Pricing Strategy

**Launch posture**: Free / Pro only. Keep it simple until we know what people actually pay for.

| Tier | Price | What it unlocks |
|---|---|---|
| Free | $0 | 10 AI drafts/mo, drip questions, Hub access |
| Pro | $19/mo | Unlimited drafts, full archive, fit scores, export |
| Team | $49/mo | Live in schema + Stripe, not actively marketed |
| Pro+ | TBD | Defined in VISION, not built |

**Gate**: Revisit after first 100 active founders. If Free→Pro conversion is happening naturally, keep it. If nobody's hitting the free limit, the limit is wrong. If Team has zero subscribers after 6 months of Pro users, cut it.

**Rule**: Don't add more tiers. Add more value to Pro first.

---

## Migration Cleanup Plan

**Problem**: 39 migrations accumulated in ~2 days. Chain is correct but noisy for fresh installs and PR reviews.

**Plan**:
- At migration **050**: squash migrations 001–020 into a single `000_baseline.sql` for fresh install convenience
- Migrations 021+ stay incremental — they contain live data transformations and seeds
- Live Supabase schema is **never touched** — developer ergonomics only
- `000_baseline.sql` goes in `seed/` as a fresh-install shortcut; `supabase/migrations/` stays canonical

**Owner**: whoever is active when we hit migration 050. Flag it in the commit message.
