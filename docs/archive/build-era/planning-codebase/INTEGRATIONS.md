# External Integrations

**Analysis Date:** 2026-05-21

## APIs & External Services

**AI — Anthropic:**
- Service: Anthropic Claude API — generates application answer drafts
  - SDK/Client: `@anthropic-ai/sdk` ^0.95.1 in `app/app/api/draft/route.ts`
  - Model: `claude-haiku-4-5-20251001` (hardcoded constant `MODEL`)
  - Auth: `ANTHROPIC_API_KEY` env var (server-side only; optional — only used if `PLATFORM_AI_DRAFTS_ENABLED=true`)
  - Routing: BYOK-first; platform key is a fallback, not the default path

**AI — OpenAI:**
- Service: OpenAI Embeddings API — semantic question matching
  - Client: raw `fetch` to `https://api.openai.com/v1/embeddings`
  - Model: `text-embedding-3-small` at 768 dimensions
  - Auth: `OPENAI_API_KEY` env var (server-side only)
  - Used in: `app/app/api/answers/capture/route.ts`, `app/app/api/match-question/route.ts`
  - Falls back gracefully (returns `null`) if key is absent

**AI — OpenAI-Compatible (BYOK):**
- Service: Any OpenAI-compatible endpoint — user-supplied provider keys
  - Client: raw `fetch` in `app/app/api/draft/route.ts`
  - Providers supported: `anthropic`, `openai`, `ollama`, `google`
  - Priority order: anthropic → openai → ollama → google
  - Keys encrypted at rest with AES-256-GCM via `app/lib/encryption.ts`
  - Stored in: `user_integrations` table (columns: `key_encrypted`, `key_storage_ref` as IV, `base_url`, `model_preference`)
  - Key retrieval endpoint: `app/app/api/integrations/key/route.ts` (used by browser extension)

**Email — Resend:**
- Service: Resend transactional email API
  - Client: raw `fetch` to `https://api.resend.com/emails`
  - Auth: `RESEND_API_KEY` env var; sender `RESEND_FROM_EMAIL` (defaults to `noreply@mos2es.xyz`)
  - Used in:
    - `app/app/api/alerts/deadline-check/route.ts` — deadline proximity alerts (30d/7d/24h)
    - `app/app/api/cron/recruiter/route.ts` — weekly top program match emails
    - `app/app/api/teams/[id]/invite/route.ts` — team invitation emails

**Payments — Stripe:**
- Service: Stripe subscriptions + billing portal
  - SDK/Client: `stripe` ^22.1.1; API version pinned to `2026-04-22.dahlia` in `app/lib/stripe.ts`
  - Auth: `STRIPE_SECRET_KEY` (server-side); `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client-safe)
  - Webhook: `app/app/api/stripe/webhook/route.ts` — verified via `STRIPE_WEBHOOK_SECRET`; dedup via `stripe_events` table
  - Webhook events handled: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`
  - Checkout: `app/app/api/stripe/checkout/route.ts`
  - Portal: `app/app/api/stripe/portal/route.ts`
  - Payout/Connect: `app/app/api/stripe/payout/route.ts`
  - Price IDs configured via env: `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`, `STRIPE_TEAM_MONTHLY_PRICE_ID`, `STRIPE_TEAM_ANNUAL_PRICE_ID`, `STRIPE_BETA_PRO_PRICE_ID`
  - Tiers: `free` (default), `pro` ($19/mo), `team` ($49/mo)

## Data Storage

**Databases:**
- Supabase PostgreSQL — single source of truth; project `betcyfbzsgusaghriptz`
  - Connection (Next.js app): `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client/server-component); `SUPABASE_SERVICE_ROLE_KEY` (server-only admin routes)
  - Connection (MCP server): `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service role for all public tools); `SUPABASE_ANON_KEY` (user-scoped client for authenticated tools)
  - Client (Next.js SSR): `@supabase/ssr` — `createServerClient` in `app/lib/supabase/server.ts`; `createBrowserClient` in `app/lib/supabase/client.ts`; singleton pattern in client
  - Client (MCP server): `@supabase/supabase-js` — `createClient` in `application-hub-mcp-server/src/services/supabase.ts`; `userClient(token)` helper for RLS-honoring authenticated calls
  - Client (Edge Functions): `@supabase/supabase-js` imported via `https://esm.sh/`
  - RLS: enabled throughout; migrations in `supabase/migrations/005_rls_policies.sql`
  - Extensions: `vector` (pgvector), `pg_trgm`, `uuid-ossp`, `pgcrypto`

**File Storage:**
- Local filesystem only — no cloud object storage integration detected

**Caching:**
- In-memory only — MCP server `application-hub-mcp-server/src/services/cache.ts` is a local in-process cache (no Redis/external cache)
- Supabase Edge Function `canonical-hub` implements a simple in-process rate bucket map (`Map<string, { count: number; resetAt: number }>`)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth — magic link (email OTP) flow
  - Implementation: `app/app/auth/callback/route.ts` handles both PKCE code exchange (`supabase.auth.exchangeCodeForSession`) and OTP token hash (`supabase.auth.verifyOtp`)
  - Session management: cookie-based via `@supabase/ssr`; refreshed on every request in `app/middleware.ts` via `supabase.auth.getUser()`
  - Protected routes enforced by `app/middleware.ts`; unauthenticated users redirected to `/login`
  - Onboarding gate: middleware checks `user_profiles.onboarding_completed_at` before allowing access to app routes

**MCP Auth:**
- User JWT validation in `application-hub-mcp-server/src/services/auth.ts` via `supabase.auth.getUser(token)`
- Tools accept a `user_token` parameter; validated per-call to scope to the authenticated user

## Monitoring & Observability

**Error Tracking:**
- None detected — no Sentry, Datadog, or similar SDK present

**Logs:**
- `console.error` / `console.log` throughout API routes and edge functions
- Stripe webhook handler logs to `stripe_events` table with `error_text` column for failed handler runs

## CI/CD & Deployment

**Hosting:**
- Vercel — Next.js app deployed from `app/`; config in `.vercel/project.json`; domain `mos2es.xyz` (also `application-hub-chi.vercel.app` as Vercel preview)
- Supabase — hosted PostgreSQL + Edge Functions on project `betcyfbzsgusaghriptz`

**CI Pipeline:**
- GitHub Actions — `.github/workflows/ci.yml`
  - Triggers: push to `main`, all PRs
  - Jobs:
    1. `agent-check` — runs `python3 .agents/check.py --strict` (blocks all other jobs)
    2. `migrations` — duplicate prefix check + filename validation via inline Python
    3. `mcp-server` — `npm ci` → typecheck → build (Node 22)
    4. `next-app` — `npm ci` → type-check → build (Node 22)
  - No test job defined (Vitest exists in MCP server but not wired into CI)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/stripe/webhook` — Stripe event delivery; signature verified via `STRIPE_WEBHOOK_SECRET`; dedup via `stripe_events` table
- `POST /api/alerts/deadline-check` — called by Supabase Edge Function `deadline-alerts` cron; auth via Bearer `CRON_SECRET`
- `POST /api/cron/recruiter` — called by Supabase Edge Function `recruiter-agent` cron; auth via Bearer `CRON_SECRET`

**Outgoing (via Supabase Edge Functions):**
- `deadline-alerts` function calls `POST ${APP_URL}/api/alerts/deadline-check` — thin cron trigger wrapper
- `recruiter-agent` function calls `POST ${APP_URL}/api/cron/recruiter` — thin cron trigger wrapper
- Both functions are scheduled via Supabase Dashboard and use `CRON_SECRET` for auth

## Browser Extensions

**AQUA Extension (`webextension/application-hub/`):**
- Vanilla JS (no bundler); Manifest V3 Chrome/Firefox
- Calls `GET /api/integrations/key` to retrieve user's BYOK API key
- Requires a valid session cookie or Bearer JWT from the Application Hub

**X Bookmarks (`webextension/x-bookmarks/`):**
- Vanilla JS; also ships as a userscript (`webextension/x-bookmarks/userscript/`)
- No backend integration; local browser tool

## Environment Configuration

**Required env vars (production Next.js app):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INTEGRATION_ENCRYPTION_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_ANNUAL_PRICE_ID`
- `STRIPE_TEAM_MONTHLY_PRICE_ID`
- `STRIPE_TEAM_ANNUAL_PRICE_ID`
- `RESEND_API_KEY`
- `CRON_SECRET`

**Optional env vars:**
- `OPENAI_API_KEY` — enables semantic embedding for question matching; features degrade gracefully without it
- `ANTHROPIC_API_KEY` + `PLATFORM_AI_DRAFTS_ENABLED=true` — enables hosted AI drafts (off by default)
- `STRIPE_BETA_PRO_PRICE_ID` — beta pricing override
- `RESEND_FROM_EMAIL` — sender override (defaults to `noreply@mos2es.xyz`)
- `APP_URL` / `NEXT_PUBLIC_APP_URL` — defaults to `https://mos2es.xyz`

**Secrets location:**
- `app/.env.local` — gitignored, not committed
- MCP server secrets set in `claude_desktop_config.json` env block or shell environment

---

*Integration audit: 2026-05-21*
