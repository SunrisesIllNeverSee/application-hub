# Three Infrastructure Tasks — 2026-05-12

Completed three queued items from the roadmap: Ranking RPC, dependency audit, and portability guardrail.

---

## 1. Ranking RPC — `migration 038_ranking_rpc.sql`

**What**: Created `get_top_programs_by_value()` as a Supabase RPC (PostgreSQL function).

**Why**: Moving the ranking logic from a JS client query to a SQL function gives one round-trip server-side execution, better caching potential, and a single call surface shared by both the Next.js app and the MCP server.

**Filters supported**:
- `p_types` — program_type[] enum filter (accelerator, vc, etc.)
- `p_domain` — domain text filter, defaults to `'founder'`
- `p_equity_max` — numeric cap on equity taken
- `p_status` — program_status[] enum, defaults to `['open']`
- `p_limit` — max 100 rows

**MCP tool updated**: `hub_get_program_rankings` now calls `supabase.rpc("get_top_programs_by_value", ...)` instead of a raw table query.

**Verified**: RPC live in Supabase, returns YC (99), a16z START (87), etc. MCP builds clean.

---

## 2. Dependency Audit — Next.js 14.2.35 → 15.3.4

**What**: Upgraded Next.js from `14.2.35` to `15.3.4`. Applied all required code changes for the breaking async API.

**Why**: 4 high-severity CVEs in Next.js 14.x:
- GHSA-c4j6-fc7j-m34r — SSRF via WebSocket upgrades
- GHSA-wfc6-r584-vfw7 — Cache poisoning in RSC responses
- GHSA-36qx-fr4f-26g5 — Middleware/proxy bypass (i18n)
- GHSA-3g8h-86w9-wvmq — Cache poisoning via middleware redirects

All four are resolved in Next.js 15.x.

**Code changes required**:

Next.js 15 made `cookies()` and `headers()` from `next/headers` async (return Promises). Dynamic page `params` and `searchParams` are also now Promises.

Changes made:
1. `lib/supabase/server.ts` — `createClient()` is now `async`, awaits `cookies()`
2. All 39 server components / API routes that import from `@/lib/supabase/server` — `createClient()` → `await createClient()`
3. `app/auth/callback/route.ts` — `cookies()` → `await cookies()`
4. `app/(app)/profile/import/page.tsx` — `cookies()` → `await cookies()`, `headers()` → `await headers()`
5. `app/api/import/paste/route.ts` — `ReturnType<typeof createClient>` → `Awaited<ReturnType<typeof createClient>>`
6. Dynamic page params updated to `Promise<{...}>` type with `await params`:
   - `app/(app)/hub/[slug]/page.tsx`
   - `app/(app)/funders/[slug]/page.tsx`
   - `app/(app)/workspace/[program_id]/page.tsx`
7. `searchParams` updated to `Promise<{...}>` type with `await searchParams`:
   - `app/(app)/hub/page.tsx`
   - `app/(app)/funders/page.tsx`

**Remaining known advisories (acceptable)**:
- `glob` in `eslint-config-next` (high) — dev tooling only, not production runtime. Fix requires `eslint-config-next@16.2.6` (next major). Track separately.
- `postcss` XSS (moderate) — build-time only, not exploitable at runtime.

**Build verification**: `npx tsc --noEmit` passes with zero errors.

---

## 3. Portability Guardrail — Domain Filter

**What**: Wired the `domain` column (added in migration 034) into the active query layer.

**Why**: Migration 034 added `domain` columns to `archived_questions`, `programs`, `app_import_sessions`, and `import_queue` with a `'founder'` default. Without query-layer filters, adding jobs/education/grants data would surface in founder views. The guardrail ensures domain isolation from day one.

**Changes**:

MCP tools — added `domain` parameter (enum, defaults to `'founder'`):
- `hub_get_universal_questions` — `.eq("domain", domain)` applied to query
- `hub_find_similar_questions` — `.eq("domain", domain)` in fallback ILIKE query; post-filter on RPC results
- `hub_get_program_rankings` — already domain-aware via `p_domain` in the new RPC

Next.js app:
- `app/(app)/hub/page.tsx` — programs query now filters `.eq('domain', activeDomain)`, defaulting to `'founder'`. Accepts `?domain=` search param for future multi-domain routing.

**What this enables**: When jobs, education, or grants data is seeded, it will not appear in the founder hub or founder MCP queries without an explicit `domain` param change.
