# Architecture

**Analysis Date:** 2026-05-21

## Pattern Overview

**Overall:** Multi-tier SaaS with a shared Supabase database at the center. Three client surfaces (Next.js web app, MCP server for AI agents, browser extensions) all read from the same Postgres instance. Business logic is split between Next.js API routes, Supabase Edge Functions (Deno), Supabase RPC/triggers, and an MCP tool layer.

**Key Characteristics:**
- Single source of truth: Supabase PostgreSQL (`betcyfbzsgusaghriptz.supabase.co`) with 46 ordered migrations
- Two distinct auth paths: cookie-session (web users) and Bearer JWT (extension/MCP consumers)
- Intelligence layer is pre-computed (nightly cron refreshes `user_program_fit`) rather than on-demand
- AI drafting is BYOK-first; platform key is an optional fallback gated by `PLATFORM_AI_DRAFTS_ENABLED`
- MCP server exposes public and authenticated tool namespaces; authenticated tools require a `user_token` (Supabase JWT)

## Layers

**Database (Supabase PostgreSQL + pgvector):**
- Purpose: Single source of truth for all domain data and session state
- Location: `supabase/migrations/` (46 SQL files applied in order)
- Contains: Tables, RLS policies, RPC functions, triggers, cron jobs, Edge Function hooks
- Depends on: Nothing (the foundation)
- Used by: Next.js app, MCP server, Edge Functions

**Edge Functions (Deno / Supabase):**
- Purpose: Compute-heavy operations that run server-side near the database
- Location: `supabase/functions/`
- Contains: `canonical-hub/` (ingest/qualify/export/map_variant actions), `smart-matcher/`, `deadline-alerts/`, `recruiter-agent/`
- Depends on: Supabase DB (service role client), Zod for input validation
- Used by: Next.js API routes that proxy through to them (`/api/hub/ingest`, `/api/hub/smart-matcher`)

**MCP Server (TypeScript / Node.js):**
- Purpose: Intelligence layer exposing 21 tools + 7 resources + 3 prompts to AI clients (Claude Desktop, Cursor, Windsurf)
- Location: `application-hub-mcp-server/src/`
- Contains: Tool modules grouped under `tools/programs/`, `tools/questions/`, `tools/intelligence/`, `tools/user/`; service modules `services/supabase.ts`, `services/auth.ts`, `services/cache.ts`, `services/rate_limit.ts`
- Depends on: Supabase DB (service role or user-scoped client), Zod schemas, in-process TTL cache
- Used by: AI agents directly (stdio or HTTP transport)

**Next.js App (React / App Router):**
- Purpose: User-facing product — auth, program browser, answer workspace, profile management
- Location: `app/`
- Contains: Route groups `(app)`, `(auth)`, `(onboarding)`; API routes under `app/api/`; shared components in `components/`; utilities in `lib/`
- Depends on: Supabase SSR client, Anthropic SDK (for `/api/draft`), Edge Functions (proxied)
- Used by: End users in a browser

**Browser Extensions:**
- Purpose: Capture application questions from third-party portals and push them into the hub
- Location: `webextension/application-hub/` (active), `appfeeder/` (standalone variant)
- Contains: `background.js`, `content.js`, `popup.js` / `sidepanel.js`, manifest
- Depends on: `/api/auth/token` to get a session JWT, then calls Next.js API routes directly
- Used by: Users filling out external application portals

## Data Flow

**AI Draft Generation:**

1. User clicks "Draft with AI" in `AnswerEditor` (`app/components/AnswerEditor.tsx`)
2. Client POSTs to `app/app/api/draft/route.ts`
3. Route reads user session (cookie), fetches `user_integrations` to find BYOK key; decrypts with `lib/encryption.ts` (AES-256-GCM)
4. Falls back to platform Anthropic key if no BYOK and `PLATFORM_AI_DRAFTS_ENABLED=true`
5. Fetches question from `archived_questions`, program DNA from `program_dna`, existing profile answers from `profile_answers`
6. Calls AI provider (Anthropic SDK, OpenAI-compatible fetch, or Ollama)
7. Inserts to `ai_draft_runs` for usage metering; draft limit checked against `user_subscriptions` and `ai_usage`
8. Returns `{ draft, drafts_remaining, integration_type }`

**MCP Authenticated Tool Call:**

1. AI agent calls a tool (e.g. `hub_find_best_programs`) with `user_token` JWT
2. Tool handler calls `validateUserToken(token)` in `services/auth.ts` — verifies with Supabase `auth.getUser()`
3. Creates a user-scoped Supabase client (honors RLS) via `userClient(token)` in `services/supabase.ts`
4. Queries `user_program_fit`, `programs`, and related tables
5. Returns structured Markdown or JSON within `CHARACTER_LIMIT = 25_000` chars

**Program Data Ingestion (canonical-hub Edge Function):**

1. Client calls `/api/hub/ingest` (Next.js route in `app/app/api/hub/ingest/route.ts`)
2. Route authenticates via `getRequestUser()`, then proxies to `supabase/functions/canonical-hub/index.ts`
3. Edge function validates with Zod schema, rate-limits per client IP (60 req/min in-memory)
4. Writes to `canonical_entities` / related tables; computes SHA-256 for dedup
5. Returns entity metadata to the caller

**Fit Score Computation:**

- Pre-computed nightly via Supabase cron (migration `008_intelligence_layer_v2.sql`)
- Formula: `fit_score = (coverage_pct × 0.40) + (theme_alignment × 0.35) + (criteria_match × 0.15) + (quality_signal × 0.10)`
- Stored in `user_program_fit`; pages read directly from this table (no on-demand calculation)

**State Management:**

- Server state owned by Supabase; pages are Server Components that query directly
- Client interactivity uses React `useState` + `useTransition` (e.g. `AnswerEditor`)
- No global client-side state store; each component fetches what it needs
- MCP server uses a simple in-memory TTL cache (`services/cache.ts`) for resource reads

## Key Abstractions

**`archived_questions` / `program_questions`:**
- Purpose: Deduplication layer — one canonical question record shared across all programs that ask it
- The `program_questions` table maps a canonical question to a specific program with exact phrasing + word limits
- Used throughout: `app/app/api/draft/route.ts`, MCP `hub_get_program_questions`, workspace pages

**`profile_answers`:**
- Purpose: User's reusable answer bank — one row per (user, archived_question) pair
- Confidence enum: `draft | solid | locked` (defined in `application-hub-mcp-server/src/constants.ts`)
- Core to both the Next.js workspace and MCP tool queries

**`user_program_fit`:**
- Purpose: Pre-computed match quality between a user's answer bank and each program
- Consumed by the dashboard, workspace ranking, and MCP `hub_find_best_programs`
- Refreshed by nightly Supabase function, not on demand

**`program_dna`:**
- Purpose: Per-program theme weight breakdown — what a program actually cares about
- Used to contextualize AI drafts in `/api/draft/route.ts` and displayed in program detail pages

**Supabase Client Pair (Next.js app):**
- `lib/supabase/server.ts` — cookie-based SSR client (Server Components, API routes)
- `lib/supabase/client.ts` — singleton browser client (Client Components)
- Both use `@supabase/ssr` to keep session state consistent across SSR/CSR

**Supabase Client Pair (MCP server):**
- `services/supabase.ts` `supabase` — service role client for public tools (bypasses RLS)
- `services/supabase.ts` `userClient(token)` — user-scoped client (honors RLS) for authenticated tools

**Dual Auth Resolver (`lib/supabase/request-auth.ts`):**
- Purpose: Accepts both cookie sessions (browser) and Bearer JWT (extension, MCP)
- Returns `{ user, accessToken, authSource }` — routes use this to authenticate without caring which path

## Entry Points

**Next.js Root (`app/app/page.tsx`):**
- Location: `app/app/page.tsx`
- Triggers: Any unauthenticated request to `/`
- Responsibilities: Landing page; redirects authenticated users to `/applications`

**App Shell Layout (`app/app/(app)/layout.tsx`):**
- Location: `app/app/(app)/layout.tsx`
- Triggers: Every authenticated app route
- Responsibilities: Auth guard (redirects to `/login`), onboarding gate (redirects to `/onboarding` if `onboarding_completed_at` is null), sidebar injection, credit balance fetch

**Auth Callback (`app/app/auth/callback/route.ts`):**
- Location: `app/app/auth/callback/route.ts`
- Triggers: Magic link and OAuth redirects
- Responsibilities: Exchange code/OTP for session; redirect to `/applications` or error

**MCP Server Entry (`application-hub-mcp-server/src/index.ts`):**
- Location: `application-hub-mcp-server/src/index.ts`
- Triggers: Node.js process start; runs via `stdio` (default) or `http` transport
- Responsibilities: Register all tools, resources, and prompts; bind transport

**Draft API (`app/app/api/draft/route.ts`):**
- Location: `app/app/api/draft/route.ts`
- Triggers: POST from `AnswerEditor` component
- Responsibilities: BYOK resolution, usage metering, multi-provider AI call, draft logging

## Error Handling

**Strategy:** Fail-fast in the database (triggers, RLS), graceful degradation in API routes, user-visible messages surfaced to UI.

**Patterns:**
- API routes return `NextResponse.json({ error, code }, { status })` with distinct `code` strings (`draft_limit_reached`, `provider_required`, `provider_unreachable`)
- MCP tools throw on auth failure; SDK surfaces as tool error to the AI client
- Edge function `canonical-hub` returns JSON error bodies with HTTP status codes; rate limit returns 429
- Ollama-specific: catch fetch-level `TypeError` and surface a local-vs-remote connectivity hint to the user
- Client `AnswerEditor` maps `code` values to action-linked feedback messages (`actionHref`, `actionLabel`)

## Cross-Cutting Concerns

**Logging:** `console.error('[route-prefix] message:', err)` convention in API routes; no structured logging library.

**Validation:** Zod throughout — `z.object({...}).strict()` in MCP tool schemas; Zod also used in Edge Functions (ESM import from `esm.sh`).

**Authentication:**
- Web: Supabase cookie session via `@supabase/ssr` (`createServerClient`)
- Extension / MCP: Bearer JWT validated against Supabase `auth.getUser()`
- MCP public tools: service role client (no auth required for read-only program data)
- MCP authenticated tools: `user_token` param → `validateUserToken()` → user-scoped client

**BYOK Key Storage:** AES-256-GCM encryption at `lib/encryption.ts`; ciphertext stored in `user_integrations.key_encrypted`, IV in `key_storage_ref`; `INTEGRATION_ENCRYPTION_KEY` env var required.

**Rate Limiting:** In-process per-IP sliding window in MCP server (`services/rate_limit.ts`); in-memory per-IP bucket in `canonical-hub` Edge Function; monthly draft count enforced by DB trigger on `ai_draft_runs`.

---

*Architecture analysis: 2026-05-21*
