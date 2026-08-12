# Repo Review and Tools

#### You:
I have a repo that I would like you to review, deepdive, and assess...

I was thinking github then what other tools

Also how do I use agent mode

#### ChatGPT:
I’ll handle this in two tracks: first, connect/check what GitHub access is available; second, give you a clean repo-review workflow plus how Agent Mode fits without turning it into chaos.


#### ChatGPT:
GitHub is connected under `SunrisesIllNeverSee`, so I can inspect repos through the connector. For a serious review, I’d want repo name, target branch, and whether the goal is security, architecture, deployment, product polish, or investor-grade audit.## What to use

### 1. GitHub — primary source

Best for:

- Reading repo structure
- Reviewing commits/branches
- Inspecting code
- Looking at issues, PRs, README, config, workflows
- Checking deployment assumptions

Since your GitHub is connected, I can review a repo directly once you give me the repo name or link.

---

## Other useful tools

### 2. Local/static audit tools

Depending on stack:

| Area          | Tools                           |
| ------------- | ------------------------------- |
| JS/TS quality | ESLint, TypeScript, Biome       |
| Security      | Semgrep, npm audit, Snyk        |
| Secrets       | Gitleaks, TruffleHog            |
| Dependencies  | Dependabot, Renovate            |
| Performance   | Lighthouse, WebPageTest         |
| Accessibility | axe DevTools, Lighthouse        |
| Backend/API   | Postman, Bruno, OpenAPI linting |
| Repo health   | GitHub Actions, CodeQL          |

### 3. Deployment tools

For your likely use case:

- **Vercel** — best for frontend/Next/React public launch
- **Railway** — better for backend services, databases, workers
- **Supabase** — auth/db/storage if you need quick infra
- **Cloudflare** — DNS, protection, workers, caching

### 4. Documentation / project control

Use:

- **README.md** for public-facing clarity
- **ARCHITECTURE.md** for system layout
- **SECURITY.md** for responsible disclosure/security stance
- **ROADMAP.md** for execution phases
- **CHANGELOG.md** once releases matter
- **Notion** only for planning, not source-of-truth code specs

---

# How Agent Mode fits

Agent Mode is useful when you want me to **operate across the repo**, not just talk about it.

Good Agent Mode tasks:

- “Audit this repo and produce a prioritized issue list.”
- “Find deployment blockers for Vercel.”
- “Trace the backend/API flow.”
- “Identify security risks and secrets exposure.”
- “Create missing documentation files.”
- “Open a PR that fixes obvious lint/type/deploy errors.”
- “Map the architecture and tell me what this repo actually is.”

Bad Agent Mode tasks:

- “Make it better.”
- “Fix everything.”
- “Build the whole product.”
- “Figure out my entire strategy.”

Those are too vague and invite drift.

---

## Best command format for you

Use this:

```text
AGENT TASK:
Repo: <GitHub repo link>
Branch: <branch name>
Goal: <audit / fix / migrate / document / deploy>
Scope: <frontend / backend / whole repo>
Do not: <things to avoid>
Deliverable: <report / PR / files / checklist>
Priority: <security / launch / investor demo / architecture>
```

Example:

```text
AGENT TASK:
Repo: https://github.com/SunrisesIllNeverSee/agent-universe
Branch: main
Goal: Full audit for Vercel migration and backend structure.
Scope: Whole repo.
Do not: Rewrite the app or change product logic.
Deliverable: Prioritized audit report with blocker/risk/fix sections.
Priority: Launch readiness.
```

---

# Review levels I can run

## Level 1 — Fast pass

Output:

- What the repo is
- Stack
- Major folders
- Obvious risks
- Deployment blockers
- Next 5 fixes

## Level 2 — Deep dive

Output:

- Architecture map
- Frontend/backend split
- Data flow
- Auth/security review
- Dependency risks
- Deployment strategy
- Product/UX risks
- Cleanup plan

## Level 3 — Agent execution

Output:

- Actual file changes
- Documentation added
- Config fixes
- Potential PR
- Migration checklist

---

## My recommendation

Start with **Level 2 deep dive**, then use Agent Mode only after the audit identifies specific fixes.

Best first command:

```text
Review this repo at Level 2:
<repo link>

Focus on:
1. Architecture
2. Security
3. Vercel/Railway deployment split
4. Code quality
5. Missing docs
6. Launch blockers

Do not rewrite anything yet.
```

That gives control before code changes.


#### You:
https://github.com/SunrisesIllNeverSee/application-hub


Perfect let's do it all step by step please

Plus implementing tools

#### ChatGPT:
We’ll move in controlled passes: inventory first, then architecture/security/deploy review, then tool implementation as separate commits or PRs. I’ll start by confirming repo access and reading the high-signal files before suggesting changes.


#### ChatGPT:
Search didn’t surface indexed files, which can happen on a small/private or not-yet-indexed repo. I’m switching to direct file/path inspection and repository initialization checks.


#### ChatGPT:
## Step 1 — Repo access status

I can access the repo metadata:

```text
Repo: SunrisesIllNeverSee/application-hub
Visibility: private
Default branch: main
Permissions: admin / maintain / pull / push
Initialized: yes
Size: 286 KB
```

But direct inspection hit a blocker:

```text
package.json: Not Found
Code search: no indexed results
Commit search: no useful results
```

That means one of these is likely true:

1. The repo is initialized but does not have a standard Node/React structure yet.
2. The app is inside a subfolder.
3. GitHub code search has not indexed the private repo yet.
4. The repo uses a non-JS stack or unusual file layout.
5. The connector can access metadata but not enumerate the file tree directly through the available tool set.

---

# Step 2 — Best next move

To keep this controlled, send me **one of these**:

## Option A — Repo file tree

Run locally or in GitHub Codespaces:

```bash
find . -maxdepth 3 -type f | sort
```

Paste the output here.

## Option B — ZIP upload

Download the repo as ZIP from GitHub and upload it here.

That is the cleanest path for a real deep dive because I can inspect the whole structure directly.

## Option C — Give me the main file paths

At minimum, paste any of these if they exist:

```text
package.json
README.md
src/
app/
pages/
server/
api/
vite.config.*
next.config.*
tsconfig.json
.env.example
railway.json
vercel.json
```

---

# Step 3 — Tool implementation plan

Once I can see the file tree, we proceed in passes:

## Pass 1 — Inventory

Deliverable:

```text
STACK REPORT
- Framework
- Runtime
- Package manager
- Frontend/backend split
- Database/auth presence
- Deployment target
- Missing core files
```

## Pass 2 — Audit

Deliverable:

```text
AUDIT REPORT
1. Architecture
2. Security
3. Code quality
4. Deployment readiness
5. Performance
6. SEO/accessibility
7. Documentation gaps
8. Launch blockers
```

## Pass 3 — Tooling implementation

I would add tools in this order:

### 1. Baseline project hygiene

```text
README.md
ARCHITECTURE.md
SECURITY.md
.env.example
.gitignore review
```

### 2. Code quality

```text
ESLint or Biome
TypeScript strictness check
Prettier or formatter config
```

### 3. Security

```text
GitHub secret scanning checklist
Gitleaks config
npm audit / dependency review
CodeQL workflow
```

### 4. CI

```text
.github/workflows/ci.yml
- install
- lint
- typecheck
- build
```

### 5. Deployment

```text
Vercel config if frontend
Railway config if backend
Environment variable map
Deployment checklist
```

---

# Step 4 — How to use Agent Mode here

Use Agent Mode **after** the inventory, not before.

Best command:

```text
AGENT TASK:
Repo: https://github.com/SunrisesIllNeverSee/application-hub
Branch: main
Goal: Audit and implement baseline tooling.
Scope: Whole repo.
Do not: Rewrite product logic or change app behavior.
Deliverable:
1. Repo audit report
2. Tooling implementation PR
3. README / ARCHITECTURE / SECURITY docs
4. CI workflow
Priority: Launch readiness and repo hygiene.
```

For now, the immediate blocker is file visibility. Send the file tree or upload the ZIP and we can continue step by step.


#### You:
Try it now

#### ChatGPT:
Retesting now. I’m going to search for repo structure with broader filenames, then fetch likely root files directly if they appear.


#### Plugin (api_tool.call_tool):
Citation Marker: fileciteturn11file0

[L1] Compact result: {"title":"README.md","url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/README.md","citation_id":"fd61d138-f203-4830-9b9d-ee0913802278"}
[L2] Full entry:
[L3] {"content":"# Application Hub\n\n**The canonical database of what accelerators, grants, and fellowships actually ask — and what winning answers look like.**\n\nBuilt by Ello Cello LLC.\n\n---\n\n## What it is\n\nApplication Hub is a platform for founders applying to programs. It solves one specific problem: the same questions show up everywhere, answered slightly differently each time, losing context and quality with every copy-paste.\n\nThe product is built around a **question archive** — every question asked by every program, stored once. When you answer a question on one application, that answer lives in your profile and pre-fills every future application that asks something similar. The intelligence layer tells you which questions are most valuable to answer (significance score), which programs are the best fit for where you are right now (composite score), and exactly what's left before you're ready to apply (readiness check).\n\n---\n\n## Current state\n\n**Phase 2** — building seed data and core UI.\n\n| Component | Status |\n|---|---|\n| Database schema (v3) | ✅ Complete |\n| Supabase migrations | ✅ 008 migrations, apply in order |\n| MCP server (16 tools) | ✅ Complete, clean build |\n| Seed data (30 programs) | ⬜ Not started |\n| Next.js app | ⬜ Not started |\n\nThe MCP server is the working interface right now. It connects to Claude Desktop, Cursor, and Windsurf and exposes the full intelligence layer as 16 tools, 7 resources, and 3 prompts.\n\n---\n\n## For Claude / Cowork sessions\n\nRead `CLAUDE.md` first — it has the architecture, schema overview, current status, and conventions. It's the single source of context for any AI session on this project.\n\nCheck `TASKS.md` for what's current and what's blocked.\n\n---\n\n## Quick start — MCP server\n\n```bash\ncd application-hub-mcp-server\nnpm install\nnpm run build\n```\n\nSee `application-hub-mcp-server/README.md` for full setup, including Claude Desktop and Cursor config.\n\n**Prerequisites**: Supabase project with all 8 migrations applied.\n\n### Local Codex / Cowork connection\n\nThis repository can be public on GitHub while the local MCP connection still points at the local compiled server:\n\n```text\n/Users/dericmchenry/Desktop/application-hub/application-hub-mcp-server/dist/index.js\n```\n\nThe `dist/` directory is intentionally ignored and not pushed to GitHub. If Codex, Cowork, Claude Desktop, Cursor, or Windsurf cannot connect after a fresh clone or cleanup, rebuild it locally:\n\n```bash\ncd /Users/dericmchenry/Desktop/application-hub/application-hub-mcp-server\nnpm install\nnpm run build\n```\n\n---\n\n## Tech stack\n\n| Layer | Choice |\n|---|---|\n| Database | Supabase (PostgreSQL + pgvector) |\n| MCP server | TypeScript + `@modelcontextprotocol/sdk` |\n| Frontend | Next.js App Router (planned) |\n| Payments | Stripe (planned) |\n| AI drafting | Claude API — Haiku for speed, Sonnet for quality |\n| Hosting | Vercel (frontend) + Railway or Fly (MCP HTTP mode) |\n| Cron | Supabase pg_cron |\n\n---\n\n## Roadmap\n\nSee `application-hub-roadmap.md` for the full four-phase roadmap with milestones, scoring formulas, dependency table, and what's deliberately not on it.\n\n---\n\n## Contributing\n\nSee `CONTRIBUTING.md` — especially the section on adding program seed data, which is the highest-leverage contribution right now.\n","encoding":"utf-8","sha":"f51cd0765418a5e8c3aff3bc6269d77f377227bd","display_url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/README.md","display_title":"README.md"}

#### ChatGPT:
Access is working now. The repo is public and root README confirms this is an Application Hub project: Supabase + TypeScript MCP server complete, Next.js planned, seed data not started.


#### Plugin (api_tool.call_tool):
Citation Marker: fileciteturn12file0

[L1] Compact result: {"title":"CLAUDE.md","url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/CLAUDE.md","citation_id":"03e9f4f8-7de8-47d0-aff6-b44a0c6dfaea"}
[L2] Full entry:
[L3] {"content":"# Application Hub — Claude Context\n\n> This file is the persistent context for any Claude or Cowork session working on this project.\n> Read it first. Every time. It's short on purpose.\n\n---\n\n## What this project is\n\n**Application Hub** — a platform that helps founders apply to accelerators, grants, and fellowships.\n\nThe core asset is a **question archive**: every question ever asked by any program, stored once, scored by significance. Users build a profile answer bank that pre-fills across multiple applications. The intelligence layer computes fit scores, program DNA weights, and opportunity rankings.\n\n**Business model**: Freemium SaaS. Free tier gets 10 AI drafts/month. Pro ($19/mo) is unlimited. Team ($49/mo) adds multi-seat and shared answer library.\n\n**Company**: Ello Cello LLC (sole proprietor — Deric McHenry, deric.mchenry@gmail.com)\n\n---\n\n## Architecture at a glance\n\n```\nSupabase (PostgreSQL + pgvector)   ← single source of truth\n  ↕\nMCP Server (TypeScript)            ← intelligence layer, 16 tools\n  ↕\nClaude Desktop / Cursor / Windsurf ← AI drafting interface (current)\n  ↕\nNext.js app (planned Phase 2)      ← user-facing product\n```\n\n**Current phase: Phase 2 — building seed data + Next.js app**\n**MCP server: complete, clean build**\n\n---\n\n## Repo layout\n\n```\napplication-hub/\n├── CLAUDE.md                  ← you are here\n├── TASKS.md                   ← current task list (always up to date)\n├── README.md                  ← project overview for humans\n├── CONTRIBUTING.md            ← how to add programs, questions, seed data\n│\n├── migrations/                ← Supabase SQL, apply in order\n│   ├── 001_enums_and_extensions.sql\n│   ├── 002_core_tables.sql\n│   ├── 003_intelligence_and_integrations.sql\n│   ├── 004_functions_and_triggers.sql\n│   ├── 005_rls_policies.sql\n│   ├── 006_edge_functions_cron.sql\n│   ├── 007_monetization.sql\n│   └── 008_intelligence_layer_v2.sql   ← APPLY THIS — adds program_dna, user_program_fit, RPCs\n│\n├── application-hub-mcp-server/        ← TypeScript MCP server (16 tools, 7 resources, 3 prompts)\n│   ├── src/\n│   ├── dist/                          ← compiled output (run npm run build first)\n│   └── README.md\n│\n└── seed/                              ← (planned) seed SQL for 30 real programs\n```\n\n---\n\n## Key database concepts\n\n| Table | What it does |\n|---|---|\n| `archived_questions` | Master question archive — one row per unique question across all programs |\n| `programs` | Every accelerator, grant, fellowship, VC |\n| `program_questions` | Maps archived questions to specific programs (exact phrasing + word limits) |\n| `program_dna` | Per-program theme weight breakdown (what it *actually* cares about) |\n| `profile_answers` | User's reusable answer bank (one row per user per archived question) |\n| `user_program_fit` | Pre-computed fit scores per (user, program) pair — refreshed nightly |\n| `ai_usage` | Draft run tracking for rate limiting |\n| `user_subscriptions` | Stripe-linked subscription tier per user |\n\n**Scoring formulas (reference)**:\n\n```\nsignificance_score = asked_by_count × avg_word_limit_weight × theme_prestige × universal_bonus\n\nfit_score = (coverage_pct × 0.40) + (theme_alignment × 0.35)\n          + (criteria_match × 0.15) + (quality_signal × 0.10)\n\ncomposite_score = fit_score × program_value_score / 100\n```\n\n---\n\n## MCP server — how to run locally\n\n```bash\ncd application-hub-mcp-server\nnpm install\nnpm run build\n```\n\nConnect to Claude Desktop — add to `~/Library/Application Support/Claude/claude_desktop_config.json`:\n\n```json\n{\n  \"mcpServers\": {\n    \"application-hub\": {\n      \"command\": \"node\",\n      \"args\": [\"/absolute/path/to/application-hub-mcp-server/dist/index.js\"],\n      \"env\": {\n        \"SUPABASE_URL\": \"https://your-project.supabase.co\",\n        \"SUPABASE_SERVICE_ROLE_KEY\": \"your-service-role-key\",\n        \"SUPABASE_ANON_KEY\": \"your-anon-key\"\n      }\n    }\n  }\n}\n```\n\n**The MCP server will not function until migrations 001-008 have been applied to Supabase.**\n\n---\n\n## Environment variables\n\n| Variable | Required | What it is |\n|---|---|---|\n| `SUPABASE_URL` | Yes | Your Supabase project URL |\n| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server-side only, never expose) |\n| `SUPABASE_ANON_KEY` | Yes | Anon key (used for user JWT validation) |\n| `TRANSPORT` | No | `stdio` (default) or `http` |\n| `PORT` | No | HTTP mode port (default 3000) |\n\n---\n\n## Current status (Phase 2)\n\n| Component | Status |\n|---|---|\n| v3 schema design | ✅ Done |\n| Supabase migrations 001-008 | ✅ Done |\n| MCP server (16 tools, 7 resources, 3 prompts) | ✅ Done — clean build |\n| 30 programs seeded | ⬜ Not started |\n| Next.js app scaffold | ⬜ Not started |\n| Hub UI (program directory) | ⬜ Not started |\n| Application workspace | ⬜ Not started |\n| Stripe integration | ⬜ Phase 3 |\n\n---\n\n## What to work on next\n\nSee `TASKS.md` for the prioritized task list.\n\nThe blocking task right now: **seed 30 real programs** (`seed/` directory). Without real data, significance scores and DNA weights are theoretical — the intelligence layer isn't meaningful until the archive has substance.\n\nAfter seeding: scaffold the Next.js app (Task #3 in TASKS.md).\n\n---\n\n## Conventions\n\n- **TypeScript throughout** — no plain JS in src/\n- **Zod for all input schemas** — `z.object({...}).strict()`\n- **Supabase join access pattern**: always use `Array.isArray(row.joined) ? row.joined[0] : row.joined` then cast with `as unknown as T` — TypeScript infers foreign table joins as arrays\n- **CHARACTER_LIMIT = 25_000** — all tool text responses sliced at this\n- **Response format**: tools accept `response_format: \"markdown\" | \"json\"` — default markdown\n- **Structured content**: all tools return both `content[text]` and `structuredContent` for MCP clients that support it\n\n---\n\n## Don't do these things\n\n- Don't run migrations out of order — they depend on each other\n- Don't use the service role key client-side or expose it in any frontend code\n- Don't add community/social features until the data layer has real programs seeded (noise before signal)\n- Don't auto-submit applications — this is a preparation layer, not a submission layer\n","encoding":"utf-8","sha":"d3540e18942e9388ffce0168bac7f67bb9876bc7","display_url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/CLAUDE.md","display_title":"CLAUDE.md"}

#### Plugin (api_tool.call_tool):
Citation Marker: fileciteturn13file0

[L1] Compact result: {"title":"TASKS.md","url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/TASKS.md","citation_id":"68bd2ac9-dfb3-44e8-aaf2-971e5ad5b01b"}
[L2] Full entry:
[L3] {"content":"# Application Hub — Task List\n\nCurrent phase: **Phase 2 — Seed data + Core UI**\n\nLast updated: 2026-05-09\n\n---\n\n## Now (blocking)\n\n### [ ] Seed 30 real programs\n**Priority**: P0 — nothing in the intelligence layer is meaningful without real data.\n\nPrograms to seed first (have public application archives):\n- [ ] Y Combinator (S25 or most recent batch)\n- [ ] Techstars (Boulder or NY)\n- [ ] SBIR Phase I (any agency)\n- [ ] Google for Startups Accelerator\n- [ ] a16z START\n- [ ] First Round Capital (scout/seed)\n- [ ] Indie.vc\n- [ ] Founder Catalyst\n- [ ] NSF SBIR\n- [ ] DOE ARPA-E Exploratory Topics\n- [ ] Echoing Green Fellowship\n- [ ] Halcyon Incubator\n- [ ] Accenture Fintech Innovation Lab\n- [ ] MassChallenge\n- [ ] Village Capital (sector programs)\n- [ ] Backstage Capital\n- [ ] Visible Hands\n- [ ] Camelback Ventures\n- [ ] Fast Forward (tech nonprofits)\n- [ ] Mozilla Foundation Builders\n- [ ] NEA Venture Studio\n- [ ] Pear VC\n- [ ] Precursor Ventures\n- [ ] Hustle Fund\n- [ ] Overlooked Ventures\n- [ ] Capital Factory (Austin)\n- [ ] Alchemist Accelerator (enterprise)\n- [ ] Founders' Co-op (Pacific NW)\n- [ ] Kapor Capital\n- [ ] 500 Startups\n\nFor each program, capture:\n- Program name, slug, type, equity %, cash value, deadline cadence, rolling vs cohort\n- All required application questions with exact phrasing and word limits\n- Theme classification per question\n\nCreate as `seed/programs/[slug].sql` — one file per program.\n\n**Checkpoint**: After 30 programs, validate that significance scores sort sensibly and DNA weights reflect actual program priorities. Recalibrate theme prestige weights in `compute_significance_scores()` if needed.\n\n---\n\n### [ ] Apply Migration 008 to Supabase\n- File: `migrations/008_intelligence_layer_v2.sql`\n- Adds: `program_dna`, `user_program_fit`, `match_archived_questions` RPC, `increment_draft_count` RPC, significance score columns, profile_answers alignment\n- **Required before any MCP tool testing against a live database**\n\nSteps:\n1. Open Supabase Dashboard → SQL Editor\n2. Paste content of `008_intelligence_layer_v2.sql`\n3. Run → confirm no errors\n4. Verify: `SELECT * FROM program_dna LIMIT 5;` (should be empty until programs seeded)\n5. Verify: `SELECT compute_significance_scores();` (should run without error)\n\n---\n\n## Next (Phase 2 unblocked after seeding)\n\n### [ ] Scaffold Next.js app\n- Auth via Supabase (email + magic link)\n- TypeScript types generated from schema (`npx supabase gen types typescript`)\n- Route structure: `/hub`, `/hub/[slug]`, `/workspace`, `/workspace/[program_id]`, `/profile`\n- Shared layout: sidebar nav, program search, user avatar\n- Dark/light mode (system default, Tailwind)\n- Supabase client (server + browser instances)\n- `.env.local` template\n\nBlocked by: nothing (can scaffold structure before seeding, just won't have data)\n\n### [ ] Build Hub UI — program directory\n- Program cards: type, equity, cash, heat score, days-to-deadline\n- Rankings views: by value score (ROI) and by heat (trending)  \n- Program detail page: full terms, acceptance stats, DNA visualization\n- Timeline view: open vs closed programs, upcoming deadlines\n- Filter sidebar: type, equity cap, rolling vs cohort, deadline range\n\nBlocked by: Next.js scaffold, seed data\n\n### [ ] Build Application Workspace\n- Per-program workspace for the actual drafting work\n- Question list with significance stars and word limits\n- Answer editor: write, edit, track word count, mark confidence\n- Answer history: diff view between versions\n- Profile answer suggestion: \"You answered something similar — use this?\"\n- Readiness indicator: progress bar for required questions\n\nBlocked by: Hub UI (shared components)\n\n---\n\n## Phase 3 (after first paying user)\n\n### [ ] Stripe integration\n- Stripe products: Free / Pro ($19/mo) / Team ($49/mo)\n- Webhook handler: update `user_subscriptions` on payment events\n- Rate limiting already wired via `ai_usage` + `increment_draft_count`\n- Gate Pro features: unlimited AI, export, heat scores, acceptance rates\n\n### [ ] Recruiter agent\n- Scheduled job: scan new programs matching user profile DNA\n- Alert delivery: email + in-app notification\n- Trigger: when new program added OR user profile changes materially\n\n### [ ] Deadline alerts\n- 30d / 7d / 24h warnings\n- Only for programs where user readiness > 60%\n- Email via Supabase Edge Function + Resend\n\n### [ ] Answer editor v2\n- Source tracking: AI-generated / human-written / curated from archive\n- Dual scoring: quality + relevance to program DNA\n- Canonical toggle: mark an answer as source-of-truth for a theme\n\n---\n\n## Phase 4 (platform layer)\n\n### [ ] GitHub plugin\n- Pull traction signals from public repos (stars, commits, contributors)\n- Auto-populate answer context for traction questions\n\n### [ ] Outcome tracking\n- User logs: \"got in\" / \"rejected\" / \"waitlisted\"\n- Closes the feedback loop for fit score and DNA calibration\n- **Required before any outcome-based model training**\n\n### [ ] Team mode\n- Co-founders share an answer library\n- Assign questions to team members\n- See each other's drafts and confidence scores\n\n### [ ] Public API\n- Open program and question data to partners\n- YC alumni networks, accelerator directories, university programs\n\n---\n\n## Done\n\n- [x] v3 schema design — global question archive as core asset\n- [x] Supabase migrations 001-007 (core schema, intelligence, monetization)\n- [x] Migration 008 (program_dna, user_program_fit, significance RPCs)\n- [x] MCP server TypeScript scaffold\n- [x] All 16 MCP tools (public + authenticated)\n- [x] All 7 MCP resources\n- [x] All 3 MCP prompts\n- [x] Clean TypeScript build (zero errors)\n- [x] MCP server README (Claude Desktop, Cursor, Windsurf configs)\n- [x] Full product roadmap document\n- [x] 30 programs seeded (seed/programs/*.sql + seed/00_run_all.sql)\n- [x] Next.js app scaffold — app router, auth, Supabase SSR, TypeScript types, layout\n- [x] Hub UI — program directory, filters, sort, ranking, program detail with DNA viz\n- [x] Hub Timeline — open/closed status, deadline countdown bars, rolling programs\n- [x] Application Workspace — per-program Q&A, readiness progress, answer editor\n- [x] Answer History — diff view component with word-level highlights, restore button\n- [x] Answer Bank (profile) — grouped by theme, source badges, inline editor\n\n---\n\n## Milestones\n\n| Milestone | Target | Status |\n|---|---|---|\n| MCP server production-ready | Week 3 | ✅ Done |\n| 30 programs seeded | Week 5 | ⬜ Not started |\n| Hub UI live (read-only) | Week 6 | ⬜ Not started |\n| First paying user | Week 8 | ⬜ Not started |\n| 30 draft runs logged | Week 9 | ⬜ Not started |\n| Recalibration checkpoint | Week 10 | ⬜ Not started |\n","encoding":"utf-8","sha":"acc96edffaca6fd33383eaae7d290de6f3041b7f","display_url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/TASKS.md","display_title":"TASKS.md"}

#### ChatGPT:
First inconsistency found: `TASKS.md` says current blockers are seed data and migration 008, but its “Done” section says seed data, Next.js scaffold, Hub UI, workspace, answer history, and answer bank are already complete. That needs cleanup before tooling, because it affects what “next” means.


#### Plugin (api_tool.call_tool):
Citation Marker: fileciteturn14file0

[L1] Compact result: {"title":"package.json","url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/application-hub-mcp-server/package.json","citation_id":"5fb46851-6c29-416e-a672-35db4b80b986"}
[L2] Full entry:
[L3] {"content":"{\n  \"name\": \"application-hub-mcp-server\",\n  \"version\": \"1.0.0\",\n  \"description\": \"MCP server for the Application Hub — programs, questions, rankings, and applicant intelligence\",\n  \"type\": \"module\",\n  \"main\": \"dist/index.js\",\n  \"scripts\": {\n    \"start\": \"node dist/index.js\",\n    \"dev\": \"tsx watch src/index.ts\",\n    \"build\": \"tsc\",\n    \"clean\": \"rm -rf dist\",\n    \"inspector\": \"npx @modelcontextprotocol/inspector node dist/index.js\"\n  },\n  \"engines\": { \"node\": \">=18\" },\n  \"dependencies\": {\n    \"@modelcontextprotocol/sdk\": \"^1.6.1\",\n    \"@supabase/supabase-js\": \"^2.49.0\",\n    \"express\": \"^4.18.0\",\n    \"zod\": \"^3.23.8\"\n  },\n  \"devDependencies\": {\n    \"@types/express\": \"^4.17.0\",\n    \"@types/node\": \"^22.10.0\",\n    \"tsx\": \"^4.19.2\",\n    \"typescript\": \"^5.7.2\"\n  }\n}\n","encoding":"utf-8","sha":"0aa922cd34fd5ff63d476ad32b51aa5ec9596f1f","display_url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/application-hub-mcp-server/package.json","display_title":"package.json"}

#### ChatGPT:
## Step 1 result - repo access works now

I can read the repo.

### Confirmed project identity

`README.md` describes **Application Hub** as:

> “The canonical database of what accelerators, grants, and fellowships actually ask - and what winning answers look like.”

Core product:

- Founder application platform
- Central **question archive**
- Reusable profile answer bank
- Program fit scoring
- Readiness checks
- MCP server as current working interface

### Confirmed stack

From `README.md` and `CLAUDE.md`:

| Layer       | Status                                          |
| ----------- | ----------------------------------------------- |
| Database    | Supabase / PostgreSQL / pgvector                |
| MCP server  | TypeScript + `@modelcontextprotocol/sdk`        |
| Frontend    | Next.js App Router planned / partially claimed  |
| Payments    | Stripe planned                                  |
| Hosting     | Vercel frontend + Railway/Fly for MCP HTTP mode |
| AI drafting | Claude API planned                              |

The architecture is stated clearly in `CLAUDE.md`:

```text
Supabase → MCP Server → Claude Desktop / Cursor / Windsurf → Next.js app
```

---

# Step 2 - immediate audit finding

## High-priority inconsistency

`TASKS.md` is internally contradictory.

At the top, it says the blocking tasks are:

- Seed 30 real programs
- Apply Migration 008
- Scaffold Next.js app
- Build Hub UI
- Build Application Workspace

But the **Done** section says these are already complete:

- 30 programs seeded
- Next.js app scaffold
- Hub UI
- Application Workspace
- Answer History
- Answer Bank

That creates drift. Before implementing tools, this file needs to be corrected into a reliable source of truth.

**Verdict:** `TASKS.md` should be the first cleanup target.

---

# Step 3 - current repo structure signal

There is **no root `package.json`**.

The actual package appears to live here:

```text
application-hub-mcp-server/package.json
```

That package confirms:

```json
{
  "name": "application-hub-mcp-server",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "clean": "rm -rf dist",
    "inspector": "npx @modelcontextprotocol/inspector node dist/index.js"
  }
}
```

Dependencies:

- `@modelcontextprotocol/sdk`
- `@supabase/supabase-js`
- `express`
- `zod`

Dev dependencies:

- `typescript`
- `tsx`
- `@types/node`
- `@types/express`

---

# Step 4 - first controlled implementation plan

Do **not** start by rewriting the app.

Start with repo hygiene and audit tooling.

## Phase A - Documentation correction

Create/update:

```text
TASKS.md
STATUS.md
ARCHITECTURE.md
.env.example
```

Purpose:

- Resolve “what is actually done”
- Separate planned work from completed work
- Make repo usable by Claude, Codex, Cursor, Windsurf, and future contributors

## Phase B - MCP server tooling

Inside:

```text
application-hub-mcp-server/
```

Add:

```text
eslint
prettier or biome
npm scripts:
  lint
  typecheck
  check
```

Current scripts only include:

```text
start
dev
build
clean
inspector
```

So there is no dedicated lint/typecheck/check pipeline yet.

## Phase C - GitHub Actions CI

Add:

```text
.github/workflows/ci.yml
```

Initial CI should run:

```bash
cd application-hub-mcp-server
npm ci
npm run build
```

Then later add lint/typecheck once scripts exist.

## Phase D - Security baseline

Add:

```text
SECURITY.md
.env.example
```

And verify:

- Supabase service role key is never frontend-exposed
- `.env` is ignored
- `dist/` remains ignored
- No real API keys in committed config

`CLAUDE.md` already warns not to expose the service role key client-side.

---

# Step 5 - how to proceed step by step

Recommended next sequence:

## Step 1

I inspect these files next:

```text
application-hub-mcp-server/src/index.ts
application-hub-mcp-server/tsconfig.json
application-hub-mcp-server/README.md
.gitignore
CONTRIBUTING.md
application-hub-roadmap.md
migrations/008_intelligence_layer_v2.sql
```

## Step 2

I produce a compact audit:

```text
1. Architecture map
2. File structure map
3. Security risks
4. Tooling gaps
5. Deployment blockers
6. Documentation contradictions
7. Recommended first PR
```

## Step 3

Then we implement the first tool package:

```text
PR 1 - Repo hygiene + CI baseline
```

Likely changes:

```text
STATUS.md
ARCHITECTURE.md
.env.example
.github/workflows/ci.yml
application-hub-mcp-server/package.json script updates
```

---

## Current verdict

The repo is not broken. It is in a normal early-stage state:

```text
Strong concept
Clear MCP-first architecture
Good Claude/Cowork context file
Good database-first thinking
But source-of-truth drift exists
Tooling and CI are underbuilt
Frontend status is unclear
```

The first priority is not “more features.”

The first priority is:

```text
Freeze status → verify server → add CI → add security/env docs → then build frontend/tools.
```


#### You:
Right so let's proceed with first priority followed with your three suggested steps... im pretty sure I built out the gap and it wasn't uploaded in timr

#### ChatGPT:
Understood. I’ll treat the repo as possibly behind your local build: first freeze the visible GitHub status, then inspect server/docs/migrations, then prepare the first controlled PR package without assuming the missing frontend exists remotely.


#### Plugin (api_tool.call_tool):
Citation Marker: fileciteturn17file0

[L1] Compact result: {"title":"index.ts","url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/application-hub-mcp-server/src/index.ts","citation_id":"502d4e64-f12c-4cee-b456-7cfec2074e67"}
[L2] Full entry:
[L3] {"content":"import { McpServer } from \"@modelcontextprotocol/sdk/server/mcp.js\";\nimport { StreamableHTTPServerTransport } from \"@modelcontextprotocol/sdk/server/streamableHttp.js\";\nimport { StdioServerTransport } from \"@modelcontextprotocol/sdk/server/stdio.js\";\nimport express from \"express\";\n\n// ── Public tools: programs ──────────────────────────────────────────────────\nimport { registerSearchPrograms } from \"./tools/programs/hub_search_programs.js\";\nimport { registerGetProgramDetail } from \"./tools/programs/hub_get_program_detail.js\";\nimport { registerGetProgramRankings } from \"./tools/programs/hub_get_program_rankings.js\";\nimport { registerGetHeatScores } from \"./tools/programs/hub_get_heat_scores.js\";\n\n// ── Public tools: questions ─────────────────────────────────────────────────\nimport { registerGetProgramQuestions } from \"./tools/questions/hub_get_program_questions.js\";\nimport { registerFindSimilarQuestions } from \"./tools/questions/hub_find_similar_questions.js\";\nimport { registerGetUniversalQuestions } from \"./tools/questions/hub_get_universal_questions.js\";\nimport { registerGetProgramDna } from \"./tools/questions/hub_get_program_dna.js\";\n\n// ── Public tools: intelligence ──────────────────────────────────────────────\nimport { registerGetQuestionSignificance } from \"./tools/intelligence/hub_get_question_significance.js\";\nimport { registerGetAcceptanceStats } from \"./tools/intelligence/hub_get_acceptance_stats.js\";\n\n// ── Authenticated tools ─────────────────────────────────────────────────────\nimport { registerGetProfileAnswers } from \"./tools/user/hub_get_profile_answers.js\";\nimport { registerGetApplicationReadiness } from \"./tools/user/hub_get_application_readiness.js\";\nimport { registerGetFitScore } from \"./tools/user/hub_get_fit_score.js\";\nimport { registerFindBestPrograms } from \"./tools/user/hub_find_best_programs.js\";\nimport { registerRankMyAnswers } from \"./tools/user/hub_rank_my_answers.js\";\nimport { registerLogDraftRun } from \"./tools/user/hub_log_draft_run.js\";\n\n// ── Resources ───────────────────────────────────────────────────────────────\nimport { registerProgramResources } from \"./resources/programs.js\";\nimport { registerQuestionResources } from \"./resources/questions.js\";\nimport { registerRankingResources } from \"./resources/rankings.js\";\n\n// ── Prompts ─────────────────────────────────────────────────────────────────\nimport { registerOpportunityScout } from \"./prompts/opportunity_scout.js\";\nimport { registerDraftAnswer } from \"./prompts/draft_answer.js\";\nimport { registerProgramComparison } from \"./prompts/program_comparison.js\";\n\n// ────────────────────────────────────────────────────────────────────────────\n\nasync function main() {\n  const server = new McpServer({\n    name: \"application-hub-mcp-server\",\n    version: \"1.0.0\"\n  });\n\n  // Register all public tools\n  registerSearchPrograms(server);\n  registerGetProgramDetail(server);\n  registerGetProgramRankings(server);\n  registerGetHeatScores(server);\n  registerGetProgramQuestions(server);\n  registerFindSimilarQuestions(server);\n  registerGetUniversalQuestions(server);\n  registerGetProgramDna(server);\n  registerGetQuestionSignificance(server);\n  registerGetAcceptanceStats(server);\n\n  // Register authenticated tools\n  registerGetProfileAnswers(server);\n  registerGetApplicationReadiness(server);\n  registerGetFitScore(server);\n  registerFindBestPrograms(server);\n  registerRankMyAnswers(server);\n  registerLogDraftRun(server);\n\n  // Register resources\n  registerProgramResources(server);\n  registerQuestionResources(server);\n  registerRankingResources(server);\n\n  // Register prompts\n  registerOpportunityScout(server);\n  registerDraftAnswer(server);\n  registerProgramComparison(server);\n\n  // ── Transport ──────────────────────────────────────────────────────────────\n  const transport = process.env.TRANSPORT ?? \"stdio\";\n\n  if (transport === \"http\") {\n    const app = express();\n    app.use(express.json());\n\n    // Stateless HTTP — new transport per request (simpler, scales better)\n    app.post(\"/mcp\", async (req, res) => {\n      const t = new StreamableHTTPServerTransport({\n        sessionIdGenerator: undefined, // stateless\n        enableJsonResponse: true\n      });\n      res.on(\"close\", () => t.close());\n      await server.connect(t);\n      await t.handleRequest(req, res, req.body);\n    });\n\n    // Health check\n    app.get(\"/health\", (_req, res) => {\n      res.json({ status: \"ok\", server: \"application-hub-mcp-server\", version: \"1.0.0\" });\n    });\n\n    const port = parseInt(process.env.PORT ?? \"3000\");\n    app.listen(port, () => {\n      console.error(`Application Hub MCP server running on :${port}/mcp`);\n    });\n  } else {\n    // stdio — default for local use with Claude, Cursor, Windsurf\n    const t = new StdioServerTransport();\n    await server.connect(t);\n    console.error(\"Application Hub MCP server running on stdio\");\n  }\n}\n\nmain().catch(err => {\n  console.error(\"Fatal error:\", err);\n  process.exit(1);\n});\n","encoding":"utf-8","sha":"73c64fdd3ce39e3b54157cd3380050ac4d1362b8","display_url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/application-hub-mcp-server/src/index.ts","display_title":"index.ts"}

#### Plugin (api_tool.call_tool):
Citation Marker: fileciteturn18file0

[L1] Compact result: {"title":"tsconfig.json","url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/application-hub-mcp-server/tsconfig.json","citation_id":"ccdab072-b52a-4df1-b079-7569663bf077"}
[L2] Full entry:
[L3] {"content":"{\n  \"compilerOptions\": {\n    \"target\": \"ES2022\",\n    \"module\": \"NodeNext\",\n    \"moduleResolution\": \"NodeNext\",\n    \"lib\": [\"ES2022\"],\n    \"outDir\": \"./dist\",\n    \"rootDir\": \"./src\",\n    \"strict\": true,\n    \"esModuleInterop\": true,\n    \"skipLibCheck\": true,\n    \"forceConsistentCasingInFileNames\": true,\n    \"declaration\": true,\n    \"declarationMap\": true,\n    \"sourceMap\": true\n  },\n  \"include\": [\"src/**/*\"],\n  \"exclude\": [\"node_modules\", \"dist\"]\n}\n","encoding":"utf-8","sha":"710db5d20d95c80c9f3daee9a19106897f4062ce","display_url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/application-hub-mcp-server/tsconfig.json","display_title":"tsconfig.json"}

#### Plugin (api_tool.call_tool):
Citation Marker: fileciteturn19file0

[L1] Compact result: {"title":".gitignore","url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/.gitignore","citation_id":"841fc97d-6e58-4a85-9027-2020911e23be"}
[L2] Full entry:
[L3] {"content":"# Dependencies\nnode_modules/\n*/node_modules/\n\n# Build output\ndist/\n*/dist/\n.next/\n*/.next/\nout/\ncoverage/\n*.tsbuildinfo\n\n# Local environment\n.env\n.env.*\n!.env.example\n!.env.local.example\n\n# Logs\nnpm-debug.log*\nyarn-debug.log*\nyarn-error.log*\npnpm-debug.log*\n\n# OS/editor\n.DS_Store\nThumbs.db\n.idea/\n.vscode/\n","encoding":"utf-8","sha":"5ed69626fc85e5b29d740075280f5d32b27c6579","display_url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/.gitignore","display_title":".gitignore"}

#### ChatGPT:
Core server entrypoint is present and structured: 16 tools are registered, plus resources/prompts, and it supports both stdio and HTTP mode. TypeScript strict mode is already enabled, so the tooling pass can be clean and minimal.


#### Plugin (api_tool.call_tool):
Citation Marker: fileciteturn20file0

[L1] Compact result: {"title":"README.md","url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/application-hub-mcp-server/README.md","citation_id":"9128afd6-79b8-4526-958d-4c576c60a2b8"}
[L2] Full entry:
[L3] {"content":"# Application Hub MCP Server\n\nMCP server for the Application Hub — a platform that helps founders track, compare, and apply to accelerators, grants, and fellowships.\n\nExposes 16 tools, 7 resources, and 3 prompts over stdio (local) or HTTP (remote).\n\n---\n\n## Requirements\n\n- Node.js >= 18\n- A Supabase project with the Application Hub v3 schema applied\n- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (required)\n- `SUPABASE_ANON_KEY` (required for authenticated user tools)\n\n```bash\ncp .env.example .env\n# fill in your values\n```\n\n---\n\n## Running Locally\n\n```bash\nnpm install\nnpm run dev        # tsx watch — auto-reloads on save\n# or\nnpm run build && npm start\n```\n\n### Local Codex / Cowork path\n\nFor this machine, Codex/Cowork can connect to the compiled MCP server at:\n\n```text\n/Users/dericmchenry/Desktop/application-hub/application-hub-mcp-server/dist/index.js\n```\n\n`dist/` is local build output and is intentionally ignored by git. The public GitHub repo will not include it. If a local client cannot connect because `dist/index.js` is missing, rebuild it:\n\n```bash\ncd /Users/dericmchenry/Desktop/application-hub/application-hub-mcp-server\nnpm install\nnpm run build\n```\n\n---\n\n## Connect to Claude Desktop\n\nAdd to `~/Library/Application Support/Claude/claude_desktop_config.json`:\n\n```json\n{\n  \"mcpServers\": {\n    \"application-hub\": {\n      \"command\": \"node\",\n      \"args\": [\"/absolute/path/to/application-hub-mcp-server/dist/index.js\"],\n      \"env\": {\n        \"SUPABASE_URL\": \"https://your-project.supabase.co\",\n        \"SUPABASE_SERVICE_ROLE_KEY\": \"your-service-role-key\",\n        \"SUPABASE_ANON_KEY\": \"your-anon-key\"\n      }\n    }\n  }\n}\n```\n\nRestart Claude Desktop. The server runs in stdio mode by default.\n\n---\n\n## Connect to Cursor\n\nIn `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):\n\n```json\n{\n  \"mcpServers\": {\n    \"application-hub\": {\n      \"command\": \"node\",\n      \"args\": [\"/absolute/path/to/application-hub-mcp-server/dist/index.js\"],\n      \"env\": {\n        \"SUPABASE_URL\": \"https://your-project.supabase.co\",\n        \"SUPABASE_SERVICE_ROLE_KEY\": \"your-service-role-key\",\n        \"SUPABASE_ANON_KEY\": \"your-anon-key\"\n      }\n    }\n  }\n}\n```\n\n---\n\n## Connect to Windsurf\n\nIn `~/.codeium/windsurf/mcp_config.json`:\n\n```json\n{\n  \"mcpServers\": {\n    \"application-hub\": {\n      \"command\": \"node\",\n      \"args\": [\"/absolute/path/to/application-hub-mcp-server/dist/index.js\"],\n      \"env\": {\n        \"SUPABASE_URL\": \"https://your-project.supabase.co\",\n        \"SUPABASE_SERVICE_ROLE_KEY\": \"your-service-role-key\",\n        \"SUPABASE_ANON_KEY\": \"your-anon-key\"\n      }\n    }\n  }\n}\n```\n\n---\n\n## HTTP Mode (Remote / Cloudflare / Railway)\n\n```bash\nTRANSPORT=http PORT=3000 node dist/index.js\n```\n\nPOST to `/mcp` with MCP JSON-RPC payloads. GET `/health` returns server status.\n\nFor remote Claude connections, point the MCP config at your deployed URL:\n\n```json\n{\n  \"mcpServers\": {\n    \"application-hub\": {\n      \"url\": \"https://your-server.example.com/mcp\"\n    }\n  }\n}\n```\n\n---\n\n## Tools\n\n### Public (no auth required)\n\n| Tool | Description |\n|---|---|\n| `hub_search_programs` | Search/filter programs by type, equity cap, deadline, cash, etc. |\n| `hub_get_program_detail` | Full detail for one program (by UUID or slug) |\n| `hub_get_program_rankings` | Programs ranked by value score (ROI) |\n| `hub_get_heat_scores` | Trending programs by applicant interest |\n| `hub_get_program_questions` | All questions for a specific program with significance scores |\n| `hub_find_similar_questions` | Find archive questions similar to a given text (pgvector + fallback) |\n| `hub_get_universal_questions` | Questions asked by 80%+ of programs — answer these first |\n| `hub_get_program_dna` | What a program actually cares about (traction vs team vs mission %) |\n| `hub_get_question_significance` | How much a question matters across the platform |\n| `hub_get_acceptance_stats` | Acceptance rate data by cohort label |\n\n### Authenticated (requires `user_token`)\n\n| Tool | Description |\n|---|---|\n| `hub_get_profile_answers` | User's answer library, ranked by coverage |\n| `hub_get_application_readiness` | % complete for a specific program + missing questions |\n| `hub_get_fit_score` | Pre-computed fit score vs a program (4-component breakdown) |\n| `hub_find_best_programs` | Top programs ranked by composite score for this user |\n| `hub_rank_my_answers` | Which answers unlock the most programs |\n| `hub_log_draft_run` | Track AI draft usage (rate-limited by tier) |\n\n---\n\n## Resources\n\n| URI | Description |\n|---|---|\n| `hub://programs` | All open programs, sorted by heat score (cached 60s) |\n| `hub://programs/{slug}` | Single program detail by slug (cached 5min) |\n| `hub://questions/universal` | Universal questions, sorted by significance (cached 1hr) |\n| `hub://questions/themes` | Question counts by theme |\n| `hub://rankings/value` | Top 25 open programs by value score (cached 1hr) |\n| `hub://rankings/heat` | Top 25 trending programs (cached 1hr) |\n| `hub://stats/platform` | Live counts: total programs, questions |\n\n---\n\n## Prompts\n\n| Prompt | Description |\n|---|---|\n| `opportunity_scout` | Multi-step: find best programs → show readiness gaps for each |\n| `draft_answer` | Multi-step: get question significance → DNA → profile → draft answer |\n| `program_comparison` | Side-by-side table comparison of two programs with DNA + verdict |\n\n---\n\n## Development\n\n```bash\nnpm run dev          # tsx watch mode\nnpm run build        # compile to dist/\nnpm run inspector    # launch MCP Inspector UI for interactive testing\nnpm run clean        # remove dist/\n```\n\nTest individual tools with the MCP Inspector:\n\n```bash\nnpm run inspector\n# Opens at http://localhost:5173\n# Select \"stdio\" transport, point at dist/index.js\n```\n","encoding":"utf-8","sha":"7b13f4296b1783acdf6cdfc3df6b9250cbc9b6d8","display_url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/application-hub-mcp-server/README.md","display_title":"README.md"}

#### Plugin (api_tool.call_tool):
Citation Marker: fileciteturn21file0

[L1] Compact result: {"title":".env.example","url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/application-hub-mcp-server/.env.example","citation_id":"c853aa07-b0a2-445d-b351-4b0eb25a7ac5"}
[L2] Full entry:
[L3] {"content":"# Supabase\nSUPABASE_URL=https://your-project.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=          # server-side only — never expose to client\nSUPABASE_ANON_KEY=                  # for user-scoped auth validation\n\n# Transport: \"http\" for remote deployment, \"stdio\" for local Claude/Cursor\nTRANSPORT=stdio\nPORT=3000\n","encoding":"utf-8","sha":"649d68a198f7471759d1a28e0935142b0a5e5c70","display_url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/application-hub-mcp-server/.env.example","display_title":".env.example"}

#### Plugin (api_tool.call_tool):
Citation Marker: fileciteturn22file0

[L1] Compact result: {"title":"CONTRIBUTING.md","url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/CONTRIBUTING.md","citation_id":"3f5269e8-2e2e-4407-a595-42bf28f857f8"}
[L2] Full entry:
[L3] {"content":"# Contributing to Application Hub\n\nThe highest-leverage contribution right now is **seed data** — real programs with real questions. The intelligence layer (significance scores, DNA weights, fit scores) isn't meaningful until the archive has substance. Adding 30 well-researched programs is worth more than any UI feature.\n\n---\n\n## Adding a program\n\nEach program lives in `seed/programs/[slug].sql`. The slug format is `[org-name]-[round-or-type]`, e.g. `yc-s25`, `techstars-boulder-2025`, `sbir-phase-1`.\n\n### Step 1: Find the actual application\n\nMost programs publish their questions:\n- YC: published annually, widely documented\n- Techstars: available in application portal (create free account)\n- SBIR: solicitations published at grants.gov and sbir.gov\n- Foundation programs: typically on program website\n\nDo not guess questions. Use exact phrasing from the real application.\n\n### Step 2: Create the seed file\n\n```sql\n-- seed/programs/yc-s25.sql\n\n-- 1. Insert the program\nINSERT INTO programs (\n  slug, name, organization, type, status,\n  round, opens_at, closes_at,\n  check_size_min, check_size_max,  -- in USD cents\n  equity_taken,                     -- as decimal: 0.07 = 7%\n  is_rolling,\n  cash_value_usd, credit_value_usd,\n  program_value_score,              -- leave NULL if unknown, cron will compute\n  description, url\n) VALUES (\n  'yc-s25',\n  'Y Combinator S25',\n  'Y Combinator',\n  'accelerator',\n  'open',\n  'S25',\n  '2025-01-10 00:00:00+00',\n  '2025-04-01 00:00:00+00',\n  50000 * 100,    -- $500K check (fictitious example)\n  50000 * 100,\n  0.07,           -- 7% equity\n  FALSE,          -- cohort, not rolling\n  500000,         -- cash_value_usd\n  NULL,           -- no AWS credits\n  NULL,           -- program_value_score — let cron compute\n  'Y Combinator is a startup accelerator that invests in a wide range of startups twice a year.',\n  'https://www.ycombinator.com/apply'\n);\n\n-- 2. Insert archived questions (one row per unique question)\n-- If a question already exists (same text, same theme), use its existing UUID.\n-- These get deduped by the platform over time.\n\nINSERT INTO archived_questions (text, theme, response_type, typical_word_limit, asked_by_count, is_universal, example_programs)\nVALUES\n  ('Describe what your company does in 50 characters or less.', 'product', 'text_short', 50, 1, FALSE, ARRAY['Y Combinator']),\n  ('What is your company going to make?', 'product', 'text_long', 150, 1, FALSE, ARRAY['Y Combinator']),\n  ('Who are your founders, and what makes them the right team to build this?', 'team', 'text_long', 200, 1, TRUE, ARRAY['Y Combinator']),\n  ('How far along are you?', 'traction', 'text_long', 150, 1, TRUE, ARRAY['Y Combinator']),\n  ('Why did you pick this idea to work on?', 'vision', 'text_long', 200, 1, FALSE, ARRAY['Y Combinator']),\n  ('What do you understand about your users that similar companies have missed?', 'market', 'text_long', 200, 1, FALSE, ARRAY['Y Combinator'])\nON CONFLICT DO NOTHING;\n\n-- 3. Link questions to this program with exact phrasing + word limits\n-- Use the archived_question_id (you may need to query by text if just inserted above)\n\nWITH inserted_questions AS (\n  SELECT id, text FROM archived_questions\n  WHERE text IN (\n    'Describe what your company does in 50 characters or less.',\n    'What is your company going to make?',\n    'Who are your founders, and what makes them the right team to build this?',\n    'How far along are you?',\n    'Why did you pick this idea to work on?',\n    'What do you understand about your users that similar companies have missed?'\n  )\n),\nprogram AS (SELECT id FROM programs WHERE slug = 'yc-s25')\nINSERT INTO program_questions (program_id, archived_question_id, asked_as, word_limit, is_required, order_index)\nSELECT\n  (SELECT id FROM program),\n  iq.id,\n  iq.text,  -- for YC the phrasing matches; adjust as needed\n  CASE iq.text\n    WHEN 'Describe what your company does in 50 characters or less.' THEN 50\n    WHEN 'What is your company going to make?' THEN 150\n    WHEN 'Who are your founders, and what makes them the right team to build this?' THEN 200\n    WHEN 'How far along are you?' THEN 150\n    WHEN 'Why did you pick this idea to work on?' THEN 200\n    WHEN 'What do you understand about your users that similar companies have missed?' THEN 200\n  END,\n  TRUE,\n  ROW_NUMBER() OVER (ORDER BY iq.text)  -- adjust order_index to match actual form order\nFROM inserted_questions iq\nON CONFLICT (program_id, archived_question_id) DO NOTHING;\n```\n\n### Step 3: Run significance + DNA refresh\n\nAfter seeding, trigger a refresh manually:\n\n```sql\nSELECT compute_significance_scores();\nSELECT compute_program_dna();\n```\n\nOr just wait for the nightly cron (runs at 02:00-03:30 UTC).\n\n### Step 4: Verify\n\n```sql\n-- Check DNA weights look right\nSELECT theme, weight_pct FROM program_dna\nWHERE program_id = (SELECT id FROM programs WHERE slug = 'yc-s25')\nORDER BY weight_pct DESC;\n\n-- Check significance scores are populated\nSELECT text, significance_score, asked_by_count\nFROM archived_questions\nORDER BY significance_score DESC\nLIMIT 10;\n```\n\n---\n\n## Question themes\n\nUse one of these exact theme values when inserting archived questions:\n\n| Theme | What it covers |\n|---|---|\n| `team` | Founders, background, co-founder relationship, advisors |\n| `traction` | Revenue, users, growth, metrics, milestones |\n| `product` | What you're building, technical approach, demo |\n| `market` | TAM, competition, positioning, customer insight |\n| `vision` | Why this, why now, long-term mission |\n| `financials` | Revenue model, burn, runway, pricing |\n| `impact` | Social/environmental impact (for foundations + impact programs) |\n| `legal` | Entity structure, IP, prior funding |\n| `other` | Logistics, references, video pitches, etc. |\n\n---\n\n## Universal questions\n\nSet `is_universal = TRUE` for any question asked by 80% or more of programs in the archive. At <30 programs seeded, be conservative — mark universal only the ones you've verified appear in 5+ programs.\n\nUniversal questions surface first in profile onboarding. They're the highest-leverage answers to write first.\n\nExamples of likely universals:\n- \"What does your company do?\"\n- \"Who is on the team?\"\n- \"How far along are you?\"\n- \"What's your revenue / traction?\"\n\n---\n\n## Code contributions\n\n- TypeScript only in `application-hub-mcp-server/src/`\n- Run `npm run build` before submitting — must compile clean\n- New tools go in `src/tools/[category]/hub_[tool_name].ts` and must be registered in `src/index.ts`\n- Follow the existing Zod schema pattern — `.strict()` on all input schemas\n- Supabase join access pattern: `Array.isArray(row.joined) ? row.joined[0] : row.joined` then `as unknown as T`\n\n---\n\n## Questions?\n\nOpen an issue. See `.github/ISSUE_TEMPLATE/` for templates.\n","encoding":"utf-8","sha":"b4107fb8f7f6e4b6d7f3ae41206dd72aff50001b","display_url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/CONTRIBUTING.md","display_title":"CONTRIBUTING.md"}

#### Plugin (api_tool.call_tool):
Citation Marker: fileciteturn24file0

[L1] Compact result: {"title":"008_intelligence_layer_v2.sql","url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/migrations/008_intelligence_layer_v2.sql","citation_id":"25915ccd-97a5-49d9-83f4-e3f449e2815a"}
[L2] Full entry:
[L3] {"content":"-- ============================================================\n-- Migration 008: Intelligence Layer v2\n-- Application Hub Platform — Ello Cello LLC\n-- ============================================================\n-- This migration fills the gaps between the v3 schema design\n-- and the MCP server's runtime requirements. Specifically:\n--\n--   1. ADD columns to programs (deadline_at, equity_pct, etc.)\n--   2. ADD columns to archived_questions (significance_score, etc.)\n--   3. ADD columns to profile_answers (question_text, theme, etc.)\n--   4. ADD monthly_draft_limit to user_subscriptions view\n--   5. CREATE program_dna table\n--   6. CREATE user_program_fit table\n--   7. CREATE match_archived_questions RPC (pgvector similarity)\n--   8. CREATE increment_draft_count RPC\n--   9. REWRITE ai_draft_runs (add program_id, archived_question_id)\n--  10. Daily cron: recompute significance scores + fit scores\n--  11. RLS policies for new tables\n-- ============================================================\n\n\n-- ============================================================\n-- 1. PROGRAMS — add MCP-required columns\n-- The original programs table used check_size_min/max and\n-- equity_taken. The MCP server uses flattened display columns:\n-- deadline_at, equity_pct, cash_value_usd, etc.\n-- ============================================================\n\n-- Deadline alias (MCP reads deadline_at; schema uses closes_at)\nALTER TABLE programs ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ\n  GENERATED ALWAYS AS (closes_at) STORED;\n\n-- Equity as percentage (schema stores 0.0–1.0 in equity_taken)\nALTER TABLE programs ADD COLUMN IF NOT EXISTS equity_pct FLOAT\n  GENERATED ALWAYS AS (ROUND((equity_taken * 100)::NUMERIC, 2)::FLOAT) STORED;\n\n-- Cash value shorthand (midpoint of check range for display)\nALTER TABLE programs ADD COLUMN IF NOT EXISTS cash_value_usd BIGINT\n  GENERATED ALWAYS AS (\n    CASE\n      WHEN check_size_min IS NOT NULL AND check_size_max IS NOT NULL\n        THEN (check_size_min + check_size_max) / 2 / 100   -- cents → dollars\n      WHEN check_size_max IS NOT NULL THEN check_size_max / 100\n      WHEN check_size_min IS NOT NULL THEN check_size_min / 100\n      ELSE NULL\n    END\n  ) STORED;\n\n-- Credits (non-cash value — perks, AWS credits, etc.)\nALTER TABLE programs ADD COLUMN IF NOT EXISTS credit_value_usd INT;\n\n-- Computed value score: what you get vs what you give up\n-- Seeded by admin; refined by cron after enough outcome data exists\nALTER TABLE programs ADD COLUMN IF NOT EXISTS program_value_score FLOAT;\n\n-- Network and brand sub-scores (components of program_value_score)\nALTER TABLE programs ADD COLUMN IF NOT EXISTS network_score FLOAT;\nALTER TABLE programs ADD COLUMN IF NOT EXISTS brand_score FLOAT;\n\n-- Follow-on funding rate (% of cohort that raise a next round)\nALTER TABLE programs ADD COLUMN IF NOT EXISTS follow_on_rate_pct FLOAT;\n\n-- Rolling vs cohort (cohort = specific batch deadline)\nALTER TABLE programs ADD COLUMN IF NOT EXISTS is_rolling BOOLEAN NOT NULL DEFAULT FALSE;\n\n-- Index on the new value score for rankings queries\nCREATE INDEX IF NOT EXISTS idx_programs_value_score ON programs (program_value_score DESC NULLS LAST);\nCREATE INDEX IF NOT EXISTS idx_programs_deadline_at ON programs (deadline_at ASC NULLS LAST) WHERE deadline_at IS NOT NULL;\n\n\n-- ============================================================\n-- 2. ARCHIVED QUESTIONS — add significance_score + avg columns\n-- significance = asked_by_count × avg_word_limit_weight × theme_prestige × universal_bonus\n-- Precomputed and stored; refreshed nightly by cron.\n-- ============================================================\n\nALTER TABLE archived_questions ADD COLUMN IF NOT EXISTS significance_score FLOAT NOT NULL DEFAULT 0;\nALTER TABLE archived_questions ADD COLUMN IF NOT EXISTS avg_word_limit INT;   -- median word limit across all programs asking this\nALTER TABLE archived_questions ADD COLUMN IF NOT EXISTS theme_weight FLOAT;   -- prestige weight for this question's theme\n\n-- Rename importance_score → keep both; significance_score is the MCP-facing name\n-- (importance_score remains for backward compatibility with existing code)\n\nCREATE INDEX IF NOT EXISTS idx_archived_questions_significance ON archived_questions (significance_score DESC);\n\n\n-- ============================================================\n-- 3. PROFILE ANSWERS — align column names with MCP usage\n-- MCP reads: question_text, theme, answer_content\n-- Schema has: content (no question_text or theme)\n-- Solution: add the missing columns + populate via trigger\n-- ============================================================\n\nALTER TABLE profile_answers ADD COLUMN IF NOT EXISTS question_text TEXT NOT NULL DEFAULT '';\nALTER TABLE profile_answers ADD COLUMN IF NOT EXISTS theme TEXT;\nALTER TABLE profile_answers ADD COLUMN IF NOT EXISTS answer_content TEXT NOT NULL DEFAULT '';\nALTER TABLE profile_answers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();\n\n-- Sync answer_content ↔ content so both work\nCREATE OR REPLACE FUNCTION sync_profile_answer_columns()\nRETURNS TRIGGER AS $$\nBEGIN\n  -- Keep answer_content and content in sync (write to either, read from either)\n  IF TG_OP = 'INSERT' OR NEW.answer_content IS DISTINCT FROM OLD.answer_content THEN\n    NEW.content := NEW.answer_content;\n  ELSIF NEW.content IS DISTINCT FROM OLD.content THEN\n    NEW.answer_content := NEW.content;\n  END IF;\n\n  -- Auto-populate question_text from archived_questions if blank\n  IF NEW.question_text = '' AND NEW.archived_question_id IS NOT NULL THEN\n    SELECT text INTO NEW.question_text\n    FROM archived_questions\n    WHERE id = NEW.archived_question_id;\n  END IF;\n\n  -- Auto-populate theme from archived_questions if blank\n  IF NEW.theme IS NULL AND NEW.archived_question_id IS NOT NULL THEN\n    SELECT theme INTO NEW.theme\n    FROM archived_questions\n    WHERE id = NEW.archived_question_id;\n  END IF;\n\n  NEW.updated_at := NOW();\n  RETURN NEW;\nEND;\n$$ LANGUAGE plpgsql;\n\nDROP TRIGGER IF EXISTS sync_profile_answer_columns_trigger ON profile_answers;\nCREATE TRIGGER sync_profile_answer_columns_trigger\n  BEFORE INSERT OR UPDATE ON profile_answers\n  FOR EACH ROW EXECUTE FUNCTION sync_profile_answer_columns();\n\n-- Backfill question_text and theme for any existing rows\nUPDATE profile_answers pa\nSET\n  question_text = COALESCE(aq.text, ''),\n  theme = aq.theme,\n  answer_content = pa.content\nFROM archived_questions aq\nWHERE pa.archived_question_id = aq.id\n  AND (pa.question_text = '' OR pa.theme IS NULL OR pa.answer_content = '');\n\n\n-- ============================================================\n-- 4. USER SUBSCRIPTIONS — add monthly_draft_limit view column\n-- MCP calls: select(\"tier, monthly_draft_limit\")\n-- Simplest fix: add a generated column that mirrors the plan limit\n-- ============================================================\n\nALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS monthly_draft_limit INT;\n\n-- Populate from subscription_plans\nUPDATE user_subscriptions us\nSET monthly_draft_limit = sp.ai_drafts_per_month\nFROM subscription_plans sp\nWHERE sp.tier = us.tier;\n\n-- Keep in sync on tier change\nCREATE OR REPLACE FUNCTION sync_draft_limit_on_tier_change()\nRETURNS TRIGGER AS $$\nBEGIN\n  IF NEW.tier IS DISTINCT FROM OLD.tier THEN\n    SELECT ai_drafts_per_month INTO NEW.monthly_draft_limit\n    FROM subscription_plans\n    WHERE tier = NEW.tier;\n  END IF;\n  RETURN NEW;\nEND;\n$$ LANGUAGE plpgsql;\n\nDROP TRIGGER IF EXISTS sync_draft_limit_trigger ON user_subscriptions;\nCREATE TRIGGER sync_draft_limit_trigger\n  BEFORE UPDATE ON user_subscriptions\n  FOR EACH ROW EXECUTE FUNCTION sync_draft_limit_on_tier_change();\n\n-- Also set on insert\nCREATE OR REPLACE FUNCTION set_draft_limit_on_insert()\nRETURNS TRIGGER AS $$\nBEGIN\n  SELECT ai_drafts_per_month INTO NEW.monthly_draft_limit\n  FROM subscription_plans\n  WHERE tier = NEW.tier;\n  RETURN NEW;\nEND;\n$$ LANGUAGE plpgsql;\n\nDROP TRIGGER IF EXISTS set_draft_limit_on_insert_trigger ON user_subscriptions;\nCREATE TRIGGER set_draft_limit_on_insert_trigger\n  BEFORE INSERT ON user_subscriptions\n  FOR EACH ROW EXECUTE FUNCTION set_draft_limit_on_insert();\n\n\n-- ============================================================\n-- 5. AI DRAFT RUNS — extend to match MCP insert schema\n-- Migration 003 created ai_draft_runs with application_answer_id.\n-- MCP inserts with program_id + archived_question_id instead.\n-- Add the missing columns; keep the old ones nullable.\n-- ============================================================\n\nALTER TABLE ai_draft_runs ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES programs(id) ON DELETE SET NULL;\nALTER TABLE ai_draft_runs ADD COLUMN IF NOT EXISTS archived_question_id UUID REFERENCES archived_questions(id) ON DELETE SET NULL;\nALTER TABLE ai_draft_runs ADD COLUMN IF NOT EXISTS integration_type TEXT;     -- \"claude\" | \"openai\" | \"custom_agent\" | \"mcp\"\nALTER TABLE ai_draft_runs ADD COLUMN IF NOT EXISTS prompt_tokens INT;\nALTER TABLE ai_draft_runs ADD COLUMN IF NOT EXISTS completion_tokens INT;\n\n-- Make application_answer_id nullable (MCP doesn't always have one)\nALTER TABLE ai_draft_runs ALTER COLUMN application_answer_id DROP NOT NULL;\n\nCREATE INDEX IF NOT EXISTS idx_ai_draft_runs_program ON ai_draft_runs (program_id);\nCREATE INDEX IF NOT EXISTS idx_ai_draft_runs_question ON ai_draft_runs (archived_question_id);\n\n\n-- ============================================================\n-- 6. PROGRAM DNA TABLE\n-- Per-program theme weight breakdown. Answers \"what does this\n-- program actually care about?\" vs its stated priorities.\n-- Computed from question distribution + word limits + prestige.\n-- One row per (program_id, theme) pair.\n-- ============================================================\n\nCREATE TABLE IF NOT EXISTS program_dna (\n  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,\n  theme           TEXT NOT NULL,             -- matches archived_questions.theme\n  question_count  INT NOT NULL DEFAULT 0,   -- # of questions in this theme for this program\n  word_limit_sum  INT NOT NULL DEFAULT 0,   -- total word capacity allocated to this theme\n  weight_pct      FLOAT NOT NULL DEFAULT 0, -- % of program's total question weight this theme represents\n  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n  UNIQUE (program_id, theme)\n);\n\nCREATE INDEX IF NOT EXISTS idx_program_dna_program ON program_dna (program_id);\nCREATE INDEX IF NOT EXISTS idx_program_dna_theme ON program_dna (program_id, theme);\n\n-- RLS: public read (program DNA is visible to all)\nALTER TABLE program_dna ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY \"program_dna_public_read\"\n  ON program_dna FOR SELECT USING (TRUE);\n\nCREATE POLICY \"program_dna_service_write\"\n  ON program_dna FOR ALL USING (auth.role() = 'service_role');\n\n\n-- ============================================================\n-- 7. USER PROGRAM FIT TABLE\n-- Pre-computed fit scores per (user, program) pair.\n-- Refreshed daily by cron for all open programs.\n-- Four-component breakdown mirrors hub_get_fit_score tool.\n-- ============================================================\n\nCREATE TABLE IF NOT EXISTS user_program_fit (\n  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,\n  program_id       UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,\n  -- Overall score (0–100)\n  fit_score        FLOAT NOT NULL DEFAULT 0,\n  -- Components (each 0–100, combined as weighted average)\n  coverage_pct     FLOAT,   -- 40% weight: required questions answered\n  theme_alignment  FLOAT,   -- 35% weight: user's strong themes vs program DNA\n  criteria_match   FLOAT,   -- 15% weight: stage/sector/geo fit\n  quality_signal   FLOAT,   -- 10% weight: answer length + confidence level\n  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n  UNIQUE (user_id, program_id)\n);\n\nCREATE INDEX IF NOT EXISTS idx_user_program_fit_user ON user_program_fit (user_id);\nCREATE INDEX IF NOT EXISTS idx_user_program_fit_program ON user_program_fit (program_id);\nCREATE INDEX IF NOT EXISTS idx_user_program_fit_score ON user_program_fit (user_id, fit_score DESC);\n\n-- RLS: users see only their own fit scores\nALTER TABLE user_program_fit ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY \"user_program_fit_owner_select\"\n  ON user_program_fit FOR SELECT USING (user_id = auth.uid());\n\nCREATE POLICY \"user_program_fit_service_write\"\n  ON user_program_fit FOR ALL USING (auth.role() = 'service_role');\n\n\n-- ============================================================\n-- 8. match_archived_questions RPC\n-- pgvector similarity search over archived_questions.embedding.\n-- Called by hub_find_similar_questions with a pre-generated\n-- embedding vector. Falls back to ilike in the tool layer.\n--\n-- Args:\n--   query_embedding vector(1536)  — embedding of the search text\n--   match_threshold float         — cosine similarity floor (e.g. 0.7)\n--   match_count     int           — max results to return\n-- Returns: id, text, theme, similarity\n-- ============================================================\n\nCREATE OR REPLACE FUNCTION match_archived_questions(\n  query_embedding vector(1536),\n  match_threshold float DEFAULT 0.7,\n  match_count     int   DEFAULT 10\n)\nRETURNS TABLE (\n  id              UUID,\n  text            TEXT,\n  theme           TEXT,\n  significance_score FLOAT,\n  asked_by_count  INT,\n  is_universal    BOOLEAN,\n  similarity      FLOAT\n)\nLANGUAGE plpgsql\nAS $$\nBEGIN\n  RETURN QUERY\n  SELECT\n    aq.id,\n    aq.text,\n    aq.theme,\n    aq.significance_score,\n    aq.asked_by_count,\n    aq.is_universal,\n    1 - (aq.embedding <=> query_embedding) AS similarity\n  FROM archived_questions aq\n  WHERE aq.embedding IS NOT NULL\n    AND 1 - (aq.embedding <=> query_embedding) >= match_threshold\n  ORDER BY aq.embedding <=> query_embedding\n  LIMIT match_count;\nEND;\n$$;\n\n\n-- ============================================================\n-- 9. increment_draft_count RPC\n-- Called by hub_log_draft_run to upsert the ai_usage row.\n-- Using an RPC rather than direct insert prevents race conditions\n-- on concurrent draft submissions.\n--\n-- Args:\n--   p_user_id   uuid   — auth user id\n--   p_month_year text  — \"YYYY-MM\" billing period key\n-- ============================================================\n\nCREATE OR REPLACE FUNCTION increment_draft_count(\n  p_user_id    UUID,\n  p_month_year TEXT\n)\nRETURNS void\nLANGUAGE plpgsql\nSECURITY DEFINER\nAS $$\nBEGIN\n  INSERT INTO ai_usage (user_id, month_year, draft_count, updated_at)\n  VALUES (p_user_id, p_month_year, 1, NOW())\n  ON CONFLICT (user_id, month_year)\n  DO UPDATE SET\n    draft_count = ai_usage.draft_count + 1,\n    updated_at  = NOW();\nEND;\n$$;\n\n\n-- ============================================================\n-- 10. SIGNIFICANCE SCORE COMPUTATION\n-- Recomputed nightly. Formula:\n--   significance = asked_by_count\n--                × avg_word_limit_weight   (word_limit / 500, capped at 2)\n--                × theme_prestige          (per-theme multiplier)\n--                × universal_bonus         (1.5 if is_universal, else 1.0)\n-- ============================================================\n\nCREATE OR REPLACE FUNCTION compute_significance_scores()\nRETURNS void\nLANGUAGE plpgsql\nSECURITY DEFINER\nAS $$\nDECLARE\n  -- Theme prestige weights (hand-tuned; recalibrate after 30+ programs seeded)\n  theme_prestige JSONB := '{\n    \"traction\":    1.4,\n    \"team\":        1.3,\n    \"vision\":      1.2,\n    \"market\":      1.1,\n    \"product\":     1.1,\n    \"financials\":  1.0,\n    \"impact\":      1.0,\n    \"legal\":       0.9,\n    \"other\":       0.8\n  }'::JSONB;\nBEGIN\n  UPDATE archived_questions aq\n  SET\n    -- Recompute avg_word_limit from program_questions\n    avg_word_limit = sub.avg_wl,\n    theme_weight   = (theme_prestige ->> aq.theme)::FLOAT,\n    significance_score = ROUND((\n      aq.asked_by_count\n      * LEAST(COALESCE(sub.avg_wl, 250)::FLOAT / 250.0, 2.0)  -- word limit weight, capped at 2\n      * COALESCE((theme_prestige ->> aq.theme)::FLOAT, 1.0)   -- theme prestige\n      * CASE WHEN aq.is_universal THEN 1.5 ELSE 1.0 END       -- universal bonus\n    )::NUMERIC, 1)::FLOAT,\n    updated_at = NOW()\n  FROM (\n    SELECT\n      archived_question_id,\n      ROUND(AVG(COALESCE(word_limit, 250))::NUMERIC, 0)::INT AS avg_wl\n    FROM program_questions\n    GROUP BY archived_question_id\n  ) sub\n  WHERE aq.id = sub.archived_question_id;\nEND;\n$$;\n\n\n-- ============================================================\n-- 11. PROGRAM DNA COMPUTATION\n-- Recomputed nightly after significance scores are refreshed.\n-- For each program, groups questions by theme, sums word limits,\n-- and computes each theme's share of total question weight.\n-- ============================================================\n\nCREATE OR REPLACE FUNCTION compute_program_dna()\nRETURNS void\nLANGUAGE plpgsql\nSECURITY DEFINER\nAS $$\nBEGIN\n  -- Delete stale DNA for all programs (re-insert fresh)\n  DELETE FROM program_dna;\n\n  INSERT INTO program_dna (program_id, theme, question_count, word_limit_sum, weight_pct, computed_at)\n  SELECT\n    pq.program_id,\n    aq.theme,\n    COUNT(*)                                                        AS question_count,\n    SUM(COALESCE(pq.word_limit, 250))                               AS word_limit_sum,\n    ROUND(\n      (SUM(COALESCE(pq.word_limit, 250))::FLOAT\n       / NULLIF(SUM(SUM(COALESCE(pq.word_limit, 250))) OVER (PARTITION BY pq.program_id), 0)\n       * 100)::NUMERIC,\n      1\n    )::FLOAT                                                        AS weight_pct,\n    NOW()                                                           AS computed_at\n  FROM program_questions pq\n  JOIN archived_questions aq ON aq.id = pq.archived_question_id\n  GROUP BY pq.program_id, aq.theme;\nEND;\n$$;\n\n\n-- ============================================================\n-- 12. FIT SCORE COMPUTATION\n-- Recomputed daily for all (user, open program) pairs.\n-- Writes into user_program_fit via upsert.\n-- Called from cron or manually after a user updates answers.\n--\n-- Formula (simplified — calibrate after real data exists):\n--   fit_score = (coverage_pct × 0.40)\n--             + (theme_alignment × 0.35)\n--             + (criteria_match × 0.15)\n--             + (quality_signal × 0.10)\n-- ============================================================\n\nCREATE OR REPLACE FUNCTION compute_user_fit_scores(p_user_id UUID DEFAULT NULL)\nRETURNS void\nLANGUAGE plpgsql\nSECURITY DEFINER\nAS $$\nDECLARE\n  rec RECORD;\nBEGIN\n  FOR rec IN\n    -- For each (user, open program) pair\n    SELECT\n      u.id                  AS user_id,\n      p.id                  AS program_id,\n      p.program_value_score AS pvs\n    FROM auth.users u\n    CROSS JOIN programs p\n    WHERE p.status = 'open'\n      AND (p_user_id IS NULL OR u.id = p_user_id)\n  LOOP\n    INSERT INTO user_program_fit (\n      user_id, program_id,\n      coverage_pct, theme_alignment, criteria_match, quality_signal,\n      fit_score, computed_at\n    )\n    SELECT\n      rec.user_id,\n      rec.program_id,\n      -- COVERAGE (40%): % of required questions the user has answered\n      COALESCE(\n        (\n          SELECT ROUND(\n            COUNT(pa.id)::FLOAT\n            / NULLIF(COUNT(pq.id), 0)\n            * 100\n          )\n          FROM program_questions pq\n          LEFT JOIN profile_answers pa\n            ON pa.user_id = rec.user_id\n            AND pa.archived_question_id = pq.archived_question_id\n            AND pa.answer_content != ''\n          WHERE pq.program_id = rec.program_id\n            AND pq.is_required = TRUE\n        ), 0\n      ) AS coverage_pct,\n\n      -- THEME ALIGNMENT (35%): user's strongest themes vs program's DNA weights\n      COALESCE(\n        (\n          SELECT ROUND(\n            SUM(\n              LEAST(\n                COALESCE(pd.weight_pct, 0),\n                (\n                  SELECT COUNT(*) * 10   -- proxy: 10 pts per answer in this theme\n                  FROM profile_answers pa2\n                  WHERE pa2.user_id = rec.user_id\n                    AND pa2.theme = pd.theme\n                    AND pa2.answer_content != ''\n                )\n              )\n            ) / NULLIF(SUM(pd.weight_pct), 0) * 100\n          )\n          FROM program_dna pd\n          WHERE pd.program_id = rec.program_id\n        ), 0\n      ) AS theme_alignment,\n\n      -- CRITERIA MATCH (15%): placeholder — 50 until geo/stage filtering implemented\n      50.0 AS criteria_match,\n\n      -- QUALITY SIGNAL (10%): % of answers at 'solid' or 'locked' confidence\n      COALESCE(\n        (\n          SELECT ROUND(\n            SUM(CASE WHEN pa.confidence IN ('solid', 'locked') THEN 1 ELSE 0 END)::FLOAT\n            / NULLIF(COUNT(pa.id), 0)\n            * 100\n          )\n          FROM program_questions pq\n          JOIN profile_answers pa\n            ON pa.user_id = rec.user_id\n            AND pa.archived_question_id = pq.archived_question_id\n          WHERE pq.program_id = rec.program_id\n        ), 0\n      ) AS quality_signal,\n\n      -- FIT SCORE: weighted composite\n      0 AS fit_score,  -- computed below via update\n      NOW() AS computed_at\n\n    ON CONFLICT (user_id, program_id) DO UPDATE\n    SET\n      coverage_pct    = EXCLUDED.coverage_pct,\n      theme_alignment = EXCLUDED.theme_alignment,\n      criteria_match  = EXCLUDED.criteria_match,\n      quality_signal  = EXCLUDED.quality_signal,\n      computed_at     = NOW();\n\n    -- Update fit_score from components\n    UPDATE user_program_fit\n    SET fit_score = ROUND(\n      (coverage_pct    * 0.40\n       + theme_alignment * 0.35\n       + criteria_match  * 0.15\n       + quality_signal  * 0.10)::NUMERIC,\n      1\n    )::FLOAT\n    WHERE user_id = rec.user_id\n      AND program_id = rec.program_id;\n\n  END LOOP;\nEND;\n$$;\n\n\n-- ============================================================\n-- 13. CRON JOBS (Supabase pg_cron / Edge Function triggers)\n-- Schedule nightly intelligence refresh.\n-- Requires pg_cron extension (enabled in Supabase dashboard).\n-- ============================================================\n\n-- Enable pg_cron if not already (safe to run multiple times)\n-- CREATE EXTENSION IF NOT EXISTS pg_cron;\n\n-- Nightly at 02:00 UTC: refresh significance scores\nSELECT cron.schedule(\n  'refresh-significance-scores',\n  '0 2 * * *',\n  $$SELECT compute_significance_scores();$$\n) ON CONFLICT DO NOTHING;\n\n-- Nightly at 02:30 UTC: refresh program DNA (after significance)\nSELECT cron.schedule(\n  'refresh-program-dna',\n  '30 2 * * *',\n  $$SELECT compute_program_dna();$$\n) ON CONFLICT DO NOTHING;\n\n-- Nightly at 03:00 UTC: recompute fit scores for all active users\nSELECT cron.schedule(\n  'refresh-fit-scores',\n  '0 3 * * *',\n  $$SELECT compute_user_fit_scores(NULL);$$\n) ON CONFLICT DO NOTHING;\n\n-- Every 6 hours: refresh heat scores (program_stats trending_score)\n-- (heat score logic lives in the existing program_stats trigger from migration 003)\nSELECT cron.schedule(\n  'refresh-heat-scores',\n  '0 */6 * * *',\n  $$\n    UPDATE program_stats ps\n    SET\n      trending_score = COALESCE(\n        (\n          SELECT COUNT(*) * 1.0\n          FROM program_signals sig\n          WHERE sig.program_id = ps.program_id\n            AND sig.created_at > NOW() - INTERVAL '48 hours'\n            AND sig.signal_type IN ('view', 'save', 'start')\n        ), 0\n      ),\n      updated_at = NOW()\n    FROM programs p\n    WHERE p.id = ps.program_id AND p.status = 'open';\n\n    UPDATE programs p\n    SET heat_score = COALESCE(ps.trending_score, 0)\n    FROM program_stats ps\n    WHERE ps.program_id = p.id;\n  $$\n) ON CONFLICT DO NOTHING;\n\n\n-- ============================================================\n-- 14. BOOTSTRAP: run initial significance + DNA compute\n-- Safe to run on a fresh or populated database.\n-- ============================================================\n\nSELECT compute_significance_scores();\nSELECT compute_program_dna();\n","encoding":"utf-8","sha":"f47700b96fbd79972a284c52a9a8d525ea061f07","display_url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/migrations/008_intelligence_layer_v2.sql","display_title":"008_intelligence_layer_v2.sql"}

#### ChatGPT:
The missing-upload theory is plausible. GitHub currently shows MCP server/docs/migrations, but not a root Next.js package or roadmap file; `TASKS.md` appears to describe both an older remote state and a newer local state at the same time.


#### ChatGPT:
Phase 1 has started.

I added:

```text id="grd8pq"
STATUS.md
```

Commit:

```text id="m0k56w"
adfffa4cb78f1027494a47b49325f75d42e40130
```

What it does:

- Separates confirmed GitHub state from assumed local state
- Documents the MCP server as the current verified core
- Flags the `TASKS.md` contradiction explicitly
- Identifies missing/unverified frontend artifacts
- Establishes a clean operational baseline before further tooling

---

# Current assessment

## Strong areas

### MCP server architecture

The server entrypoint is clean and modular:

- tool registration separated by domain
- resources/prompts separated cleanly
- stdio + HTTP transport support
- proper async bootstrapping
- Express health endpoint
- TypeScript strict mode enabled

`src/index.ts` is structurally solid for an early-stage MCP platform.

### Migration quality

`008_intelligence_layer_v2.sql` is substantially more mature than typical early-stage startup schema work.

Notable strengths:

- generated columns
- sync triggers
- pgvector RPC search
- precomputed fit tables
- cron-based recomputation
- layered scoring logic
- compatibility bridges between schema versions
- RLS awareness

This is not “toy CRUD schema” territory anymore.

### Documentation

`CLAUDE.md` and MCP README are unusually coherent for AI-assisted infra projects.

The repo already has:

- architectural framing
- environment expectations
- transport modes
- MCP integration docs
- contribution conventions
- schema reasoning

That matters more than people think.

---

# Weak areas / risk zones

## 1. Operational drift

Main issue right now.

`TASKS.md` contains mutually exclusive states.

This creates:

- contributor confusion
- AI cowork drift
- incorrect roadmap assumptions
- deployment ambiguity

That is now partially stabilized via `STATUS.md`.

---

## 2. CI/tooling gap

Currently missing:

```text id="0i5ihm"
GitHub Actions
lint pipeline
typecheck pipeline
security scan baseline
repo health automation
```

The code quality may be fine, but nothing enforces it yet.

---

## 3. Frontend uncertainty

Current remote repo does **not** verify:

- Next.js app
- Hub UI
- Workspace
- Profile/answer bank

This is likely a local-upload gap.

Until synced, the remote repo appears backend-heavy.

---

# Next move (Step 2)

I recommend the next controlled PR bundle be:

## PR: “Repo Hygiene + CI Baseline”

Contents:

### Add

```text id="8g1uj9"
ARCHITECTURE.md
SECURITY.md
.github/workflows/ci.yml
```

### Update

```text id="6dbf5j"
TASKS.md
application-hub-mcp-server/package.json
```

### Add scripts

```json id="w3y7vn"
"typecheck": "tsc --noEmit",
"check": "npm run typecheck && npm run build"
```

No ESLint yet unless you want it immediately.

You already have strong TypeScript discipline; lightweight enforcement first is the correct move.

---

# One important observation

This repo is actually taking a smart direction:

```text id="q4q6rt"
Database-first
MCP-first
Frontend-second
```

That is probably the correct order for this product.

Most people build UI first and then discover they have no reusable intelligence layer.

You did the reverse.

That gives the system better long-term leverage if executed cleanly.


#### You:
Perfext


I swear I have the stuff ..


Let continue w step 2

#### ChatGPT:
Proceeding with Step 2 as a controlled hygiene/CI pass. I’ll add the missing repo-level docs, add CI, and update the MCP package scripts without touching product logic.


#### Plugin (api_tool.call_tool):
Citation Marker: fileciteturn27file0

[L1] Compact result: {"title":"package.json","url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/application-hub-mcp-server/package.json","citation_id":"9335359e-7521-4c64-a1be-f2396701efba"}
[L2] Full entry:
[L3] {"content":"{\n  \"name\": \"application-hub-mcp-server\",\n  \"version\": \"1.0.0\",\n  \"description\": \"MCP server for the Application Hub — programs, questions, rankings, and applicant intelligence\",\n  \"type\": \"module\",\n  \"main\": \"dist/index.js\",\n  \"scripts\": {\n    \"start\": \"node dist/index.js\",\n    \"dev\": \"tsx watch src/index.ts\",\n    \"build\": \"tsc\",\n    \"clean\": \"rm -rf dist\",\n    \"inspector\": \"npx @modelcontextprotocol/inspector node dist/index.js\"\n  },\n  \"engines\": { \"node\": \">=18\" },\n  \"dependencies\": {\n    \"@modelcontextprotocol/sdk\": \"^1.6.1\",\n    \"@supabase/supabase-js\": \"^2.49.0\",\n    \"express\": \"^4.18.0\",\n    \"zod\": \"^3.23.8\"\n  },\n  \"devDependencies\": {\n    \"@types/express\": \"^4.17.0\",\n    \"@types/node\": \"^22.10.0\",\n    \"tsx\": \"^4.19.2\",\n    \"typescript\": \"^5.7.2\"\n  }\n}\n","encoding":"utf-8","sha":"0aa922cd34fd5ff63d476ad32b51aa5ec9596f1f","display_url":"https://github.com/SunrisesIllNeverSee/application-hub/blob/main/application-hub-mcp-server/package.json","display_title":"package.json"}

#### ChatGPT:
Step 2 complete.

## Added

### `ARCHITECTURE.md`

Commit:

```text id="6v0t9u"
aa05282538747afe19a9ecec6e04605303d4b6a8
```

Covers:

- system shape
- MCP-first architecture
- database responsibilities
- scoring boundaries
- deployment topology
- client/runtime separation
- remote-state caveat

---

### `SECURITY.md`

Commit:

```text id="zyj1g0"
312dd0510efc5ecbc759e918e0c0c19c0d1c43fc
```

Covers:

- secret handling
- service-role boundaries
- repo hygiene
- future hardening
- disclosure workflow
- missing security automation

---

### GitHub Actions CI

File:

```text id="h6q73t"
.github/workflows/ci.yml
```

Commit:

```text id="95wknk"
a1fe47ca1437aa20c6b56a9bb5b591e33300880f
```

Pipeline now runs:

```bash id="zhb4hm"
npm ci
npm run typecheck
npm run build
```

against:

```text id="ub1ukv"
application-hub-mcp-server/
```

on push + PR.

---

### MCP package scripts

Updated:

```text id="vnd8yq"
application-hub-mcp-server/package.json
```

Commit:

```text id="awjlwm"
f928f4b8110c005024ccc4e6649e7077eebb2abd
```

Added:

```json id="0ux9eb"
"typecheck": "tsc --noEmit",
"check": "npm run typecheck && npm run build"
```

---

# Current repo maturity jump

You now have:

| Area                               | Status |
| ---------------------------------- | ------ |
| Repo source-of-truth stabilization | ✅      |
| Architecture documentation         | ✅      |
| Security baseline                  | ✅      |
| CI pipeline                        | ✅      |
| TypeScript enforcement             | ✅      |
| MCP runtime structure              | ✅      |
| Environment documentation          | ✅      |

This moves the repo from:

```text id="trjlwm"
prototype archive
```

toward:

```text id="a4gqvn"
maintainable infrastructure project
```

---

# Important observation

The MCP layer is cleaner than I expected.

Particularly:

- transport separation
- resource/tool segmentation
- migration coherence
- scoring centralization
- strict TypeScript config
- Zod convention discipline

Those choices reduce long-term entropy substantially.

---

# Next recommended phase (Step 3)

Now we move into:

## Remote-state reconciliation

Meaning:

```text id="qdu0hn"
What exists locally but is missing remotely?
```

Most likely candidates:

- Next.js app
- UI work
- roadmap file
- seed data
- additional package roots
- deployment config

---

# Recommended next actions for you

## 1. Sync local repo status

On your machine:

```bash id="6dndkl"
git status
```

Then:

```bash id="p2bvxq"
git branch
```

Then:

```bash id="p8rlpn"
find . -maxdepth 3 -type f | sort
```

You do **not** need to paste everything.

Main thing I want to confirm:

```text id="q15e9l"
Do you actually have:
- app/
- src/
- next.config.*
- package.json
- vercel.json
- tailwind.config.*
- seed/programs/
- frontend components
```

locally.

---

## 2. If yes

Then we proceed with:

```text id="v31w2f"
Frontend sync audit
```

Meaning:

- determine what was never pushed
- determine if frontend is structurally sound
- verify deployment readiness
- reconcile local vs remote architecture

---

# After that

Then we enter the real engineering phase:

## Productionization

Including:

- Vercel deployment
- Railway/Fly MCP deployment
- Supabase environment separation
- Stripe wiring
- monitoring/logging
- frontend polish
- seed ingestion pipeline
- AI orchestration layer

The repo is now stable enough to support that progression without drifting immediately.
