# Technology Stack

**Analysis Date:** 2026-05-21

## Languages

**Primary:**
- TypeScript 5.x — all source code in `app/`, `application-hub-mcp-server/src/`, and `supabase/functions/`
- SQL (PostgreSQL) — all database migrations in `supabase/migrations/`

**Secondary:**
- JavaScript (plain) — browser extension content scripts in `webextension/application-hub/` and `webextension/x-bookmarks/`
- Python 3.11 — tooling scripts in `scripts/` (e.g., `scripts/parse_fundingcake.py`)

## Runtime

**Environment:**
- Node.js >=18 (MCP server `engines` field); CI runs Node 22
- Deno — Supabase Edge Functions in `supabase/functions/` use `Deno.serve` and `Deno.env`

**Package Manager:**
- npm (lockfiles present at `app/package-lock.json` and `application-hub-mcp-server/package-lock.json`)
- Root `package.json` is a thin scripts-only file; real dependencies are scoped to sub-packages

## Frameworks

**Core:**
- Next.js ^15.3.4 (App Router) — user-facing product in `app/`
- Express ^4.18.0 — HTTP transport mode for MCP server in `application-hub-mcp-server/`
- Model Context Protocol SDK ^1.6.1 — MCP server backbone in `application-hub-mcp-server/src/index.ts`

**Database:**
- Supabase (PostgreSQL 15) — single source of truth; project ref `betcyfbzsgusaghriptz`
  - Extensions: `uuid-ossp`, `pgcrypto`, `pg_trgm` (fuzzy search), `vector` (pgvector 768-dim)
- pgvector — semantic similarity via `match_archived_questions` RPC; vectors stored at 768 dims (migration `029_embedding_resize_768.sql`)

**Testing:**
- Vitest ^2.0.0 — MCP server tests in `application-hub-mcp-server/`; config implied by package scripts `test` / `test:watch`

**Build/Dev:**
- tsx ^4.19.2 — watch-mode dev server for MCP TypeScript (`npm run dev`)
- tsc — production build for MCP server (`npm run build` outputs to `application-hub-mcp-server/dist/`)
- Next.js built-in bundler (Turbopack-adjacent) for `app/`
- Playwright ^1.60.0 — root-level dev dep for browser automation scripts

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` ^2.43.0 (Next.js app), ^2.49.0 (MCP server + Edge Functions) — database client
- `@supabase/ssr` ^0.4.0 — SSR-safe cookie-based session management in Next.js middleware and server components
- `@anthropic-ai/sdk` ^0.95.1 — AI draft generation in `app/app/api/draft/route.ts`; model pinned to `claude-haiku-4-5-20251001`
- `stripe` ^22.1.1 — payment processing; API version pinned to `2026-04-22.dahlia` in `app/lib/stripe.ts`
- `zod` ^4.4.3 (Next.js app), ^3.23.8 (MCP server + Edge Functions) — schema validation throughout

**Infrastructure:**
- `@modelcontextprotocol/sdk` ^1.6.1 — MCP protocol transport (stdio + StreamableHTTP)
- `clsx` ^2.1.0 + `tailwind-merge` ^2.3.0 — className utility pair in Next.js UI components

**UI:**
- `tailwindcss` ^3.4.1 — utility-first CSS; config at `app/tailwind.config.ts`; dark mode via `class` strategy; custom `brand`, `neutral`, `success`, `warning`, `danger` color scales
- `react` ^18, `react-dom` ^18 — React component model
- Font: `Inter` loaded via CSS variable `--font-inter`

## Configuration

**Environment (Next.js app — `app/.env.local`, gitignored):**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (public, client-safe)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (public, client-safe)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (server-only; stripe webhook, cron routes)
- `INTEGRATION_ENCRYPTION_KEY` — 32-byte hex; AES-256-GCM for BYOK key storage (`app/lib/encryption.ts`)
- `ANTHROPIC_API_KEY` — optional platform fallback for hosted drafts (only used if `PLATFORM_AI_DRAFTS_ENABLED=true`)
- `OPENAI_API_KEY` — used by `/api/answers/capture` and `/api/match-question` for `text-embedding-3-small` embeddings
- `STRIPE_SECRET_KEY` — Stripe server key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe client key
- `STRIPE_WEBHOOK_SECRET` — signature verification for `app/app/api/stripe/webhook/route.ts`
- `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`, `STRIPE_TEAM_MONTHLY_PRICE_ID`, `STRIPE_TEAM_ANNUAL_PRICE_ID` — Stripe price IDs
- `STRIPE_BETA_PRO_PRICE_ID` — optional beta override price
- `RESEND_API_KEY` — transactional email (deadline alerts, recruiter cron, team invites)
- `RESEND_FROM_EMAIL` — sender address; defaults to `noreply@mos2es.xyz`
- `CRON_SECRET` — shared secret for Supabase Edge Function → Next.js cron route auth
- `APP_URL` / `NEXT_PUBLIC_APP_URL` — production domain (`https://mos2es.xyz`)
- `PLATFORM_AI_DRAFTS_ENABLED` — feature flag to enable hosted Anthropic drafts

**Environment (MCP server — set in `claude_desktop_config.json` or shell):**
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (bypasses RLS)
- `SUPABASE_ANON_KEY` — anon key (user JWT validation)
- `TRANSPORT` — `stdio` (default) or `http`
- `PORT` — HTTP mode port (default 3000)

**Build:**
- `app/tsconfig.json` — strict mode, `moduleResolution: bundler`, path alias `@/*` → `./`
- `app/next.config.mjs` — `typedRoutes: false`; wildcard remote image patterns; 7 permanent redirects
- `application-hub-mcp-server/tsconfig.json` — ESM output (`type: module`)
- `app/.eslintrc.json` — extends `next/core-web-vitals`
- `app/postcss.config.js` + `app/tailwind.config.ts` — Tailwind CSS pipeline

## Platform Requirements

**Development:**
- Node.js 22 (CI pinned); >=18 required by MCP server
- Supabase CLI for migration management (`supabase/migrations/`)

**Production:**
- Vercel (Next.js app) — org `team_9Ru1xfKoyL9WUSCag3xYquTp`, project `prj_AJzq3I97E0c1V0ZoZ6pwGUA1NFZJ` per `.vercel/project.json`; domain `mos2es.xyz`
- Supabase hosted PostgreSQL — project ref `betcyfbzsgusaghriptz`
- Supabase Edge Functions (Deno runtime) — deployed for `canonical-hub`, `deadline-alerts`, `recruiter-agent`, `smart-matcher`
- MCP server — runs locally via stdio for Claude Desktop / Cursor / Windsurf; can also run as HTTP service

---

*Stack analysis: 2026-05-21*
