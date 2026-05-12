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
