# Codebase Structure

**Analysis Date:** 2026-05-21

## Directory Layout

```
application-hub/                         # Repo root
├── app/                                 # Next.js 14 product (App Router)
│   ├── app/                             # Next.js app directory
│   │   ├── (app)/                       # Authenticated route group
│   │   │   ├── layout.tsx               # Auth guard + onboarding gate + sidebar
│   │   │   ├── dash/                    # /dash — personalized dashboard
│   │   │   ├── applications/            # /applications — program browser + detail
│   │   │   ├── workspace/               # /workspace + /workspace/[program_id] — answer workspace
│   │   │   ├── profile/                 # /profile/* — profile tabs
│   │   │   ├── answers/                 # /answers — quick answer view
│   │   │   ├── questions/               # /questions — question archive browser
│   │   │   ├── funders/                 # /funders — funders directory
│   │   │   ├── community/               # /community/messages
│   │   │   └── workstation/             # /workstation (new workspace variant)
│   │   ├── (auth)/login/                # /login — magic link auth page
│   │   ├── (onboarding)/onboarding/     # /onboarding — one-time setup gate
│   │   ├── about/scoring/               # /about/scoring — public scoring explainer
│   │   ├── api/                         # Next.js API routes (Edge/Node)
│   │   │   ├── draft/                   # POST /api/draft — AI drafting (BYOK + platform)
│   │   │   ├── hub/                     # /api/hub/* — proxies to Supabase Edge Functions
│   │   │   ├── import/                  # /api/import/* — program/application import
│   │   │   ├── integrations/            # /api/integrations/* — BYOK key CRUD
│   │   │   ├── stress-test/             # POST /api/stress-test
│   │   │   ├── answers/capture/         # POST /api/answers/capture
│   │   │   ├── applications/[id]/       # PATCH /api/applications/[id]/outcome
│   │   │   ├── auth/token/              # GET /api/auth/token — JWT for extension
│   │   │   ├── stripe/                  # /api/stripe/* — checkout, webhook, portal
│   │   │   ├── teams/                   # /api/teams/* — multi-seat teams
│   │   │   ├── credits/claim/           # POST /api/credits/claim
│   │   │   ├── onboarding/complete/     # POST /api/onboarding/complete
│   │   │   ├── profile/                 # /api/profile/fms, /api/profile/identity
│   │   │   ├── match-question/          # POST /api/match-question
│   │   │   ├── alerts/deadline-check/   # GET /api/alerts/deadline-check
│   │   │   ├── cron/recruiter/          # POST /api/cron/recruiter
│   │   │   ├── community/messages/      # CRUD /api/community/messages
│   │   │   ├── beta/check/              # GET /api/beta/check
│   │   │   └── og/                      # Open Graph image generation
│   │   ├── auth/callback/               # GET /auth/callback — Supabase magic link handler
│   │   ├── layout.tsx                   # Root layout (fonts, ThemeProvider, metadata)
│   │   └── page.tsx                     # / — landing page (redirects authed users)
│   ├── components/                      # Shared React components
│   │   ├── AnswerEditor.tsx             # Rich answer editor with AI draft + stress test
│   │   ├── Sidebar.tsx                  # App navigation sidebar
│   │   ├── StressTestPanel.tsx          # Answer stress-test UI
│   │   ├── IntegrationsForm.tsx         # BYOK key management form
│   │   ├── ImportClient.tsx             # Application import flow
│   │   ├── ProgramCard.tsx              # Program listing card
│   │   ├── DnaRadarChart.tsx            # Program DNA visualization
│   │   ├── editor/HighlightEditor.tsx   # Word-highlighted editor
│   │   ├── ingestion/IngestionUploader.tsx
│   │   ├── smart-matcher/SmartMatcherFeed.tsx
│   │   └── variations/                  # Answer variation components
│   ├── lib/                             # Shared utilities and types
│   │   ├── supabase/
│   │   │   ├── server.ts                # SSR cookie client (Server Components)
│   │   │   ├── client.ts                # Browser singleton client
│   │   │   └── request-auth.ts          # Dual auth resolver (cookie + Bearer JWT)
│   │   ├── database.types.ts            # Auto-generated Supabase type definitions
│   │   ├── encryption.ts                # AES-256-GCM BYOK key encrypt/decrypt
│   │   ├── utils.ts                     # Formatting helpers (deadline, currency, labels)
│   │   ├── aquascore.ts                 # AQUA score computation
│   │   ├── subscription.ts              # Subscription tier helpers
│   │   ├── stripe.ts                    # Stripe client init
│   │   ├── credits.ts                   # Credits system helpers
│   │   ├── beta.ts                      # Beta mode flag helpers
│   │   ├── rate-limit.ts                # Rate limit helpers
│   │   └── sanitize.ts                  # Input sanitization
│   └── data/
│       └── stress_test_follow_ups.json  # Static follow-up prompts for stress test
│
├── application-hub-mcp-server/          # MCP server (TypeScript / Node.js)
│   ├── src/
│   │   ├── index.ts                     # Entry point — registers tools, resources, prompts; binds transport
│   │   ├── constants.ts                 # Shared enums: ProgramType, AnswerConfidence, QUESTION_THEMES
│   │   ├── types.ts                     # Shared interfaces: Program, ProgramQuestion, ProfileAnswer, etc.
│   │   ├── tools/
│   │   │   ├── programs/                # Public program tools (search, detail, rankings, heat scores)
│   │   │   ├── questions/               # Public question tools (program questions, DNA, universal, similar)
│   │   │   ├── intelligence/            # Public intelligence tools (significance, acceptance stats)
│   │   │   ├── user/                    # Authenticated user tools (fit, answers, draft, stress test, review)
│   │   │   └── aqua-hub.ts              # AQUA hub composite tool
│   │   ├── services/
│   │   │   ├── supabase.ts              # Service-role + user-scoped Supabase clients
│   │   │   ├── auth.ts                  # JWT validation helper (validateUserToken)
│   │   │   ├── cache.ts                 # In-memory TTL cache
│   │   │   └── rate_limit.ts            # Per-IP rate limiter
│   │   ├── resources/                   # MCP resources (programs, questions, rankings)
│   │   └── prompts/                     # MCP prompts (opportunity_scout, draft_answer, program_comparison)
│   └── dist/                            # Compiled output (run `npm run build` first)
│
├── supabase/
│   ├── migrations/                      # 46 ordered SQL migrations (001–046)
│   └── functions/                       # Deno Edge Functions
│       ├── canonical-hub/index.ts       # ingest / qualify / export / map_variant actions
│       ├── smart-matcher/index.ts       # Answer-to-question matching
│       ├── deadline-alerts/index.ts     # Deadline notification dispatch
│       └── recruiter-agent/index.ts     # Recruiter matching agent
│
├── .claude/
│   ├── commands/                        # Claude Code slash commands
│   │   ├── certify-answer.md            # /certify-answer
│   │   ├── review-answer.md             # /review-answer
│   │   ├── review-answer-fit.md         # /review-answer-fit
│   │   └── stress-test-answer.md        # /stress-test-answer
│   └── agents/                          # Reviewer agent definitions
│       ├── rns-answer-reviewer.md       # RNS reviewer
│       ├── program-fit-reviewer.md      # Program fit reviewer
│       ├── fidelity-certifier.md        # Fidelity certifier
│       └── stress-test-conductor.md     # Stress test conductor
│
├── webextension/                        # Browser extensions
│   ├── application-hub/                 # Active extension (manifest + background/content scripts)
│   ├── x-bookmarks/userscript/          # X bookmarks userscript
│   ├── chrome/ firefox/ safari/         # Browser-specific builds
│   └── _archive/                        # Archived extension versions
│
├── appfeeder/                           # Standalone question-capture extension variant
├── seed/                                # Seed SQL and staging import data
│   ├── programs/                        # Per-program seed files
│   └── staging/                         # Scraped + batched program data
├── scripts/                             # Utility scripts (Python, TS)
│   ├── local-extension-agent.mjs        # Local agent bridge for extension
│   ├── scrape-apply-questions.ts        # Question scraper
│   └── seed-question-embeddings.ts      # Embedding seeder
├── migrations/                          # Legacy root-level migrations (do not use — superseded by supabase/migrations/)
├── docs/                                # Architecture decision records and documentation
│   └── adr/                             # ADRs
├── codex/                               # Codex workspace and QA files
├── qaapplication/                       # QA application imports (in-progress)
├── REBUILD/                             # Research conversations and branding assets
├── .agents/                             # Agent coordination files (PROTOCOL.md, registry.yaml, claims.yaml)
├── .planning/codebase/                  # Codebase analysis documents (this directory)
├── CLAUDE.md                            # Project context for Claude sessions
├── TASKS.md                             # Current prioritized task list
├── STATUS.md                            # Human-readable truth report
└── package.json                         # Root-level scripts (codex/rebuild tooling)
```

## Directory Purposes

**`app/app/(app)/`:**
- Purpose: All authenticated user-facing routes
- Contains: Server Component pages that query Supabase directly; one shared layout that enforces auth + onboarding gate
- Key files: `layout.tsx` (the auth/onboarding guard), `workspace/[program_id]/page.tsx` (answer workspace), `dash/page.tsx` (dashboard)

**`app/app/api/`:**
- Purpose: Next.js API routes for operations that require server-side auth, AI calls, or Stripe
- Pattern: Every route file is `route.ts` exporting named HTTP methods (`GET`, `POST`, `PATCH`)
- Key files: `draft/route.ts` (AI drafting), `hub/ingest/route.ts` (proxies to canonical-hub Edge Function), `integrations/key/route.ts` (BYOK key upsert)

**`app/components/`:**
- Purpose: Shared React components used across pages
- Mix: Server-safe display components and `'use client'` interactive components
- Key files: `AnswerEditor.tsx` (main editing surface, 446 lines), `Sidebar.tsx` (nav, 205 lines)

**`app/lib/`:**
- Purpose: Shared utilities, type definitions, and service clients
- Key files: `lib/supabase/server.ts` and `lib/supabase/client.ts` (the two Supabase clients), `database.types.ts` (auto-generated types), `encryption.ts` (BYOK key crypto)

**`application-hub-mcp-server/src/tools/user/`:**
- Purpose: Authenticated MCP tools — the intelligence-layer API for AI agents
- Pattern: Each tool is a standalone `.ts` file with an exported `register*` function. Heavy logic extracted to `.logic.ts` and `.helpers.ts` co-located files
- Key files: `hub_find_best_programs.ts` + `.logic.ts`, `hub_stress_test_answer.ts` + `.logic.ts` + `.helpers.ts`

**`supabase/migrations/`:**
- Purpose: Ordered SQL migrations defining the entire schema
- Key files: `001`–`008` (core schema + intelligence), `015` (BYOK storage), `026` (answer reviews), `042`–`046` (canonical hub, rewards, aggregate system)
- Rule: Always add new migrations at the end (never edit existing files); use `supabase/migrations/` not the legacy root `migrations/`

**`supabase/functions/`:**
- Purpose: Deno-runtime Edge Functions for compute-heavy server-side logic
- Key files: `canonical-hub/index.ts` (content ingestion and qualification pipeline)

## Key File Locations

**Entry Points:**
- `app/app/page.tsx`: Public landing page (`/`)
- `app/app/(app)/layout.tsx`: Authenticated app shell (auth + onboarding gate)
- `app/app/(auth)/login/page.tsx`: Magic link login page
- `app/app/auth/callback/route.ts`: Magic link / OAuth callback
- `application-hub-mcp-server/src/index.ts`: MCP server process entry

**Configuration:**
- `app/tsconfig.json`: TypeScript config with `@/*` path alias mapping to `./`
- `app/.env.local` (gitignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `INTEGRATION_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`
- `vercel.json`: Deployment config (root level)
- `application-hub-mcp-server/package.json`: MCP server build (`npm run build` → `dist/`)

**Core Logic:**
- `app/app/api/draft/route.ts`: AI draft generation (BYOK routing, metering)
- `app/lib/supabase/request-auth.ts`: Dual auth resolver
- `app/lib/encryption.ts`: BYOK key AES-256-GCM encrypt/decrypt
- `application-hub-mcp-server/src/services/supabase.ts`: MCP Supabase client pair
- `application-hub-mcp-server/src/services/auth.ts`: MCP JWT validation
- `supabase/functions/canonical-hub/index.ts`: Content ingestion pipeline
- `application-hub-mcp-server/src/constants.ts`: Shared enums (ProgramType, AnswerConfidence, QUESTION_THEMES)

**Database Types:**
- `app/lib/database.types.ts`: Auto-generated from Supabase schema; regenerate with `supabase gen types`
- `application-hub-mcp-server/src/types.ts`: Manually-maintained interfaces for MCP tool responses

**Testing:**
- `application-hub-mcp-server/src/tools/intelligence/hub_get_acceptance_stats.test.ts`
- `application-hub-mcp-server/src/tools/user/hub_find_best_programs.test.ts`
- `application-hub-mcp-server/src/tools/user/hub_stress_test_answer.test.ts`
- `application-hub-mcp-server/src/services/cache.test.ts`
- `application-hub-mcp-server/src/services/rate_limit.test.ts`

## Naming Conventions

**Files:**
- Next.js routes: `page.tsx`, `layout.tsx`, `route.ts` (Next.js convention)
- Components: PascalCase — `AnswerEditor.tsx`, `ProgramCard.tsx`
- MCP tools: `hub_snake_case.ts` — e.g. `hub_find_best_programs.ts`
- MCP logic split: `hub_<name>.ts` (handler), `hub_<name>.logic.ts` (pure functions), `hub_<name>.helpers.ts` (side-effectful helpers), `hub_<name>.test.ts` (tests)
- Lib utilities: camelCase — `encryption.ts`, `aquascore.ts`, `rate-limit.ts`

**Directories:**
- Next.js route groups: parentheses convention — `(app)`, `(auth)`, `(onboarding)`
- Dynamic segments: brackets — `[slug]`, `[program_id]`, `[id]`
- MCP tool namespaces: plain noun — `programs/`, `questions/`, `intelligence/`, `user/`

**TypeScript:**
- Interfaces for domain types (MCP `types.ts`), auto-generated `Database` type for DB schema
- Zod schemas named `Schema` (tool-level) or descriptive (edge function `hubRequestSchema`)
- Enums in constants: `ProgramType`, `ProgramStatus`, `AnswerConfidence`, `ResponseFormat`

## Where to Add New Code

**New authenticated app page:**
- Page file: `app/app/(app)/<route-name>/page.tsx`
- If it needs sub-tabs/nested layout: add `layout.tsx` in the same directory
- Auth is handled by the parent `(app)/layout.tsx` — no need to re-check auth in the page

**New API route:**
- File: `app/app/api/<resource>/route.ts`
- Use `getRequestUser(req)` from `lib/supabase/request-auth.ts` for auth (handles both cookie and Bearer)
- Return `NextResponse.json(...)` with a descriptive `code` field on errors

**New MCP tool:**
- Public (no auth): add `hub_<name>.ts` to `application-hub-mcp-server/src/tools/programs/` or `questions/` or `intelligence/`
- Authenticated: add to `application-hub-mcp-server/src/tools/user/`
- Register in `application-hub-mcp-server/src/index.ts`
- Use Zod `z.object({...}).strict()` for schema
- Extract pure logic to `hub_<name>.logic.ts`

**New shared component:**
- File: `app/components/<ComponentName>.tsx`
- Add `'use client'` directive only if it uses hooks or browser APIs

**New shared utility:**
- File: `app/lib/<utility-name>.ts`
- Export named functions; no default exports in lib

**New database migration:**
- File: `supabase/migrations/<NNN>_<description>.sql` where NNN continues the sequence (currently at 046)
- NEVER add to the legacy `migrations/` root directory

**New Supabase Edge Function:**
- Directory: `supabase/functions/<function-name>/index.ts`
- Proxy it through a Next.js API route in `app/app/api/` for auth handling

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents (this directory)
- Generated: By `/gsd:map-codebase` command
- Committed: Yes (planning artifacts)

**`.agents/`:**
- Purpose: Session coordination — `PROTOCOL.md`, `registry.yaml` (machine-readable truth), `claims.yaml`
- Generated: No (hand-maintained)
- Committed: Yes

**`.claude/`:**
- Purpose: Claude Code slash commands (`commands/`) and agent definitions (`agents/`)
- Generated: No
- Committed: Yes

**`application-hub-mcp-server/dist/`:**
- Purpose: Compiled TypeScript output
- Generated: Yes (`npm run build`)
- Committed: No (build artifact)

**`app/.next/`:**
- Purpose: Next.js build cache and output
- Generated: Yes
- Committed: No

**`seed/staging/`:**
- Purpose: Raw scraped program data in batches, pre-import staging files
- Generated: Yes (scrapers and import pipelines)
- Committed: Partially (source data kept for reproducibility)

**`migrations/` (root level):**
- Purpose: Legacy migration directory — superseded
- Do not add new migrations here; use `supabase/migrations/` exclusively

---

*Structure analysis: 2026-05-21*
