# Codebase Concerns

**Analysis Date:** 2026-05-21

## Tech Debt

**Google/Gemini provider listed but not implemented for drafting:**
- Issue: `PROVIDER_PRIORITY` in the draft route includes `'google'` as a fourth priority provider, and the integrations UI lets users save a Google API key, but the draft execution branch in `/api/draft/route.ts` only handles `anthropic`, `openai`, and `ollama`. A user who connects only a Google key hits the `'Unsupported AI provider'` 400 error with no explanation.
- Files: `app/app/api/draft/route.ts` (lines 132–133, 418–419), `app/components/IntegrationsForm.tsx` (line 40–44)
- Impact: Silent product failure — Google is displayed as a supported provider but drafts silently fail for it.
- Fix approach: Either add a Google Generative AI branch to the draft handler (using the Gemini REST API or `@google/generative-ai` SDK), or remove Google from `PROVIDER_PRIORITY` and disable the Google integration option in the UI until it is implemented.

**`is_active` column mismatch in match-question route:**
- Issue: `/api/match-question/route.ts` queries `user_integrations` with `.eq('is_active', true)`, but the `user_integrations` table (created in `012_launch_hardening.sql`) has a `status` column of type `integration_status` enum, not a boolean `is_active` column. This query always returns zero rows, making BYOK vector embeddings unreachable for the browser extension.
- Files: `app/app/api/match-question/route.ts` (line 167), `supabase/migrations/012_launch_hardening.sql` (line 53)
- Impact: Browser extension Smart Matcher silently falls back to full-text search for all users regardless of BYOK configuration.
- Fix approach: Change `.eq('is_active', true)` to `.eq('status', 'active')` to match the actual schema column.

**`decrypt_integration_key` RPC called but never defined:**
- Issue: `app/app/api/match-question/route.ts` calls `adminClient.rpc('decrypt_integration_key', { p_user_id, p_provider })` to retrieve a decrypted OpenAI key for embedding. No migration defines this function. The `decryptKey()` helper in `app/lib/encryption.ts` performs this operation correctly in other routes, but was not used here.
- Files: `app/app/api/match-question/route.ts` (lines 177–181), `app/lib/encryption.ts`
- Impact: OpenAI BYOK embeddings in the browser extension always fail silently; the code falls through to platform OPENAI_API_KEY.
- Fix approach: Replace the RPC call with `decryptKey(integration.key_encrypted, integration.key_storage_ref)` from `@/lib/encryption`, matching the pattern used in `app/app/api/draft/route.ts`.

**`model_used` field always records Anthropic constant for non-Anthropic drafts:**
- Issue: The `ai_draft_runs` insert in `/api/draft/route.ts` always sets `model_used: MODEL` where `MODEL = 'claude-haiku-4-5-20251001'`. When a user drafts with an OpenAI or Ollama BYOK key, the logged `model_used` is incorrect.
- Files: `app/app/api/draft/route.ts` (lines 6, 435)
- Impact: AI usage analytics and audit trail data is inaccurate for non-Anthropic providers.
- Fix approach: Track `resolvedModel` during provider selection (set per branch alongside `resolvedApiKey`) and use it in the insert.

**Zod is installed but hand-rolled validation used in import routes:**
- Issue: `app/package.json` lists `zod: ^4.4.3` as a dependency, and `CLAUDE.md` explicitly states "Zod for all input schemas". However, `app/app/api/import/paste/route.ts` uses hand-rolled validation with a comment: `// Input validation (hand-rolled, zod isn't installed)` — this comment is incorrect. Other API routes also bypass Zod.
- Files: `app/app/api/import/paste/route.ts` (lines 52–108), `app/app/api/import/application/route.ts`
- Impact: Hand-rolled validation is harder to maintain, less exhaustive, and diverges from stated convention.
- Fix approach: Replace `validateInput()` in `/api/import/paste/route.ts` with a `z.object({...}).strict()` schema. Update the stale comment.

**`preferred` variable declared but unused in integrations key route:**
- Issue: `app/app/api/integrations/key/route.ts` declares `const preferred = ['anthropic', 'openai']` (line 31) but never uses the variable; provider fallback logic is written inline below it.
- Files: `app/app/api/integrations/key/route.ts` (line 31)
- Impact: Dead code; TypeScript does not error on unused `const` in this context. Low severity.
- Fix approach: Remove the `preferred` declaration.

**Duplicate files with spaces in names (macOS copy artifacts):**
- Issue: Three files with space-in-name copies exist and are tracked in git:
  - `app/lib/database.types 2.ts` — 81 lines shorter than `database.types.ts` (missing `graphql_public` section and one `funder_id` column)
  - `app/app/(app)/applications/page 2.tsx` — older version of the applications page
  - `app/app/(app)/workspace/[program_id]/page 2.tsx` — older version of workspace detail page
- Files: `app/lib/database.types 2.ts`, `app/app/(app)/applications/page 2.tsx`, `app/app/(app)/workspace/[program_id]/page 2.tsx`
- Impact: Confusing; Next.js may try to serve `page 2.tsx` as a route depending on how the file router resolves URL-encoded spaces. The `database.types 2.ts` has an older schema snapshot.
- Fix approach: Delete all three files. They are not imported anywhere in the codebase.

**Two parallel migration chains:**
- Issue: `migrations/` (root) contains 38 SQL files with names like `001_enums_and_extensions.sql`. `supabase/migrations/` contains 46 SQL files with the same naming scheme. The authoritative chain is `supabase/migrations/`, but the legacy root `migrations/` is not deleted.
- Files: `/migrations/` (root), `/supabase/migrations/`
- Impact: Ambiguity about which chain is applied. A developer running `psql < migrations/*.sql` would apply stale state.
- Fix approach: Delete `/migrations/` (root directory). The CLAUDE.md already notes `supabase/migrations/` as the canonical location.

## Known Bugs

**`/workstation` and `/community` routes not in middleware PROTECTED_ROUTES:**
- Symptoms: Unauthenticated users can reach `/workstation` and `/community/messages` without being redirected to login. The individual page components do `if (!user) return null` which renders a blank page instead of redirecting.
- Files: `app/middleware.ts` (lines 7–20), `app/app/(app)/workstation/page.tsx` (line 9), `app/app/(app)/community/messages/page.tsx` (line 66)
- Trigger: Navigate to `/workstation` without a session cookie.
- Workaround: Pages silently render empty. No data is exposed due to RLS, but the UX is a blank page with no redirect or error message.
- Fix approach: Add `'/workstation'` and `'/community'` to the `PROTECTED_ROUTES` array in `app/middleware.ts`.

**`run_daily_drip` called on every page load for two pages:**
- Symptoms: The `run_daily_drip` RPC fires synchronously during SSR on both `/dash` and `/questions` page loads. This is a write operation (unlocking questions) triggered by reads, with no idempotency guard beyond the DB-level function logic.
- Files: `app/app/(app)/dash/page.tsx` (line 26), `app/app/(app)/questions/page.tsx` (line 101)
- Trigger: Any user loading the dash or questions page. If both pages are loaded in the same session, the RPC fires twice.
- Workaround: The RPC itself likely has date-based guards preventing double-drip.
- Fix approach: Move `run_daily_drip` to a dedicated API route called once per day (using `last_daily_drip_at` on the user profile), or gate the call with a session-level flag.

## Security Considerations

**Decrypted API key returned over HTTP to browser extension:**
- Risk: `GET /api/integrations/key` returns the plaintext decrypted user API key in the JSON response body. This endpoint is called by the AQUA browser extension to obtain the user's BYOK key for direct provider calls. Any interception or misconfigured CORS would expose the key.
- Files: `app/app/api/integrations/key/route.ts` (lines 48–53)
- Current mitigation: Requires authenticated session cookie or Bearer JWT. Keys are encrypted at rest in the DB.
- Recommendations: Consider whether the extension should call the API with user context and have the server make the AI call, rather than shipping the raw key to the browser. If key retrieval must remain, add explicit CORS restrictions so only the extension's chrome-extension:// origin can call this endpoint.

**Service role key used in a Next.js Server Component (page):**
- Risk: `app/app/(app)/profile/credits/page.tsx` creates an admin Supabase client inline using `process.env.SUPABASE_SERVICE_ROLE_KEY`. While Server Components do not expose this to the browser, the pattern makes it easy to accidentally refactor this into a Client Component or import it from a shared module.
- Files: `app/app/(app)/profile/credits/page.tsx` (lines 12–15)
- Current mitigation: This is a Server Component; the key does not reach the browser. RLS is bypassed for the admin queries.
- Recommendations: Extract the service-role client creation to a shared `app/lib/supabase/admin.ts` helper (like the pattern in API routes) to make it visually distinct and harder to misuse.

**`/api/alerts/deadline-check` accepts the service role key as a valid auth token:**
- Risk: `app/app/api/alerts/deadline-check/route.ts` treats a bearer token equal to `SUPABASE_SERVICE_ROLE_KEY` as authorized (line 146). This means anyone who obtains the service role key can trigger deadline alerts for all users, which also leaks that the key is valid.
- Files: `app/app/api/alerts/deadline-check/route.ts` (lines 137–148)
- Current mitigation: The endpoint only sends emails; it doesn't write sensitive data.
- Recommendations: Remove the service role key as a valid cron auth token. Use only `CRON_SECRET` for cron authentication.

**User-submitted answer content not sanitized before storage:**
- Risk: `app/app/api/answers/capture/route.ts` accepts `answerText` from the browser extension and writes it directly to `profile_answers.content` without running `sanitizeText()`. The `sanitize.ts` module is only used in community messages and outcome notes.
- Files: `app/app/api/answers/capture/route.ts` (lines 52–57), `app/lib/sanitize.ts`
- Current mitigation: React auto-escapes on render, preventing XSS in display. Supabase RLS ensures only the owning user can read their own answers.
- Recommendations: Apply `sanitizeText()` to `answerText` before insert to maintain a consistent hygiene posture across all user-writable text fields.

**Full prompt stored in `ai_draft_runs.prompt_used`:**
- Risk: The complete system + user prompt is stored verbatim in `ai_draft_runs` including the user's existing profile answers (which may contain sensitive personal or business information). If the `ai_draft_runs` table RLS is misconfigured or an admin tool exposes these rows, content becomes visible beyond the user.
- Files: `app/app/api/draft/route.ts` (line 436)
- Current mitigation: Supabase RLS should restrict `ai_draft_runs` to the owning user. The column stores legitimate audit data.
- Recommendations: Review whether storing the full prompt is necessary for audit purposes, or whether storing only `prompt_tokens` and a hash is sufficient.

## Performance Bottlenecks

**Dash page fires 13 concurrent Supabase queries on every load:**
- Problem: `app/app/(app)/dash/page.tsx` issues 13 `Promise.all` queries plus a synchronous `run_daily_drip` RPC on every page load, none with caching. The page is a Server Component with no `export const revalidate`, so every navigation re-fetches everything.
- Files: `app/app/(app)/dash/page.tsx` (lines 28–110)
- Cause: All data required for AQUAscore computation and UI is fetched per-request with no memoization.
- Improvement path: Cache relatively static queries (subscriptions, total unlocked count) with `unstable_cache` or short `revalidate` intervals. Move `run_daily_drip` out of the render path.

**In-memory rate limiter resets on every serverless cold start:**
- Problem: `app/lib/rate-limit.ts` uses a module-level `Map` for rate limit state. Vercel serverless functions have short lifetimes and frequent cold starts; the rate limiter provides no protection across function instances or after restarts.
- Files: `app/lib/rate-limit.ts`
- Cause: Acknowledged in the file's own comment: "Acceptable for low-traffic beta; replace with Redis or Upstash when we outgrow single-instance memory."
- Improvement path: Replace with Upstash Redis or a Supabase-backed counter when launching publicly. Currently only used for `community_message` and `beta_check` actions.

**`subscription.ts` helpers (`canDraft`, `getUserTier`) not used by API routes:**
- Problem: `app/lib/subscription.ts` provides `canDraft()` and `getUserTier()` helpers, but the actual draft limit check in `/api/draft/route.ts` re-implements the logic inline against different columns (`monthly_draft_limit` from `user_subscriptions` vs `ai_drafts_per_month` from `subscription_plans`). The helpers are dead code.
- Files: `app/lib/subscription.ts`, `app/app/api/draft/route.ts` (lines 186–214)
- Cause: Parallel implementation paths during feature development.
- Improvement path: Consolidate rate limiting to use the `subscription.ts` helpers, or delete the helpers and document the inline pattern as canonical.

## Fragile Areas

**Server Action `importAction` in workstation page uses self-referential fetch:**
- Files: `app/app/(app)/workstation/page.tsx` (lines 56–85)
- Why fragile: A Server Action that calls `fetch()` back to the same app's API route (`/api/import/paste`) is unusual and brittle. It reconstructs the full absolute URL from `x-forwarded-host` headers and manually copies the cookie header. This pattern breaks if deployed behind a proxy that doesn't forward those headers, or in environments where the server can't reach itself.
- Safe modification: Test any infrastructure change (Vercel config, reverse proxy headers, middleware rewrites) against this path. Alternatively, refactor `importAction` to call the extraction logic directly (import the function) rather than via HTTP.
- Test coverage: No tests exist for this path.

**`/api/hub/refine` is a confirmed stub returning placeholder text:**
- Files: `app/app/api/hub/refine/route.ts`
- Why fragile: The route is wired and accepting production traffic. It returns `{ refinedText: ..., algorithm_status: 'placeholder' }` using deterministic word extraction with a `// TODO` marker. Any UI calling this endpoint silently receives placeholder output.
- Safe modification: Do not build dependent UI features against this endpoint until the actual refinement logic (SigTune / BYOK call) is implemented.
- Test coverage: None.

**Two competing `database.types.ts` files with schema divergence:**
- Files: `app/lib/database.types.ts`, `app/lib/database.types 2.ts`
- Why fragile: The file with the space is 81 lines shorter and is missing the `graphql_public` schema block and one `funder_id` column definition. If a developer regenerates types and saves to the wrong filename, the primary types file could silently fall behind the live schema.
- Safe modification: Delete `database.types 2.ts`. Re-generate `database.types.ts` from the live Supabase project after each migration batch.

**`/api/import/paste` route drives two different page server actions (both calling it via HTTP):**
- Files: `app/app/(app)/workstation/page.tsx` (line 70), `app/app/(app)/profile/import/page.tsx` (line 57)
- Why fragile: Both pages reconstruct the absolute base URL independently using `x-forwarded-host` header reading. Any divergence in how these two callers reconstruct the URL or forward cookies can cause one to silently fail.
- Safe modification: Extract the URL reconstruction and cookie-forwarding logic into a shared server utility function.

## Scaling Limits

**pgvector embedding dimension mismatch risk:**
- Current capacity: Migration `029_embedding_resize_768.sql` resized embeddings to 768 dimensions to match nomic-embed-text. The embedding model hardcoded in `/api/answers/capture/route.ts` and `/api/match-question/route.ts` is `text-embedding-3-small` with `dimensions: 768`. If the dimension is changed in one place but not the other, cosine similarity searches return garbage results without erroring.
- Limit: Any change to embedding dimension requires coordinated changes across `EMBED_DIMS` constants in `app/app/api/answers/capture/route.ts`, `app/app/api/match-question/route.ts`, and a migration to rebuild all existing embeddings.
- Scaling path: Define `EMBED_DIMS` as a single shared constant in `app/lib/constants.ts` referenced by all consumers.

**Recruiter cron processes a fixed batch of 50 users per run:**
- Current capacity: `BATCH_SIZE = 50` in `app/app/api/cron/recruiter/route.ts` (line 22). No pagination — only the first 50 users with qualifying fit scores are processed per invocation.
- Limit: As the user base grows beyond a few hundred active users with fit scores, most users will never receive recruiter emails.
- Scaling path: Add cursor-based pagination to the cron job, or switch to a queue-based architecture.

## Dependencies at Risk

**`@supabase/supabase-js` pinned to `^2.43.0` (early 2024 release):**
- Risk: The Supabase JS client has had multiple breaking and security changes between `2.43.0` and current. The `@supabase/ssr` package is at `^0.4.0` which also lags behind current releases that consolidate SSR helpers.
- Impact: Missing bug fixes and potential compatibility issues with newer Supabase features or edge function updates.
- Migration plan: Upgrade `@supabase/supabase-js` to latest `^2.x` and `@supabase/ssr` to latest, then run `npm run type-check` to surface any breaking changes.

**`eslint-config-next` pinned to `14.2.35` while Next.js is `^15.3.4`:**
- Risk: ESLint config is two major Next.js versions behind. This may cause lint rules to miss new Next.js 15 patterns or fail to catch deprecated patterns from Next.js 14.
- Impact: Lint errors or silent false-negatives for App Router patterns.
- Migration plan: Upgrade `eslint-config-next` to match `15.x`.

## Missing Critical Features

**No `.env.example` for the Next.js app:**
- Problem: `application-hub-mcp-server/.env.example` exists, but there is no `.env.example` or `.env.template` for the main Next.js app. The required variables are documented in `CLAUDE.md` but only partially — `STRIPE_SECRET_KEY`, `BETA_MODE`, `BETA_END_DATE`, `NEXT_PUBLIC_BETA_MODE`, `NEXT_PUBLIC_BETA_END_DATE`, `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `OPENAI_API_KEY`, `APP_URL`, `STRIPE_BETA_PRO_PRICE_ID`, `VERCEL`, `NODE_ENV` are used in routes but not listed in `CLAUDE.md`'s environment section.
- Blocks: Onboarding a new developer or deploying to a new environment requires source-reading to discover all required variables.

**Stripe integration routes exist but Stripe is marked Phase 3:**
- Problem: Full webhook handler, checkout, portal, and payout routes exist at `app/app/api/stripe/` and are production-capable, but the `CLAUDE.md` status table marks Stripe as `⬜ Phase 3`. This creates ambiguity about whether the Stripe routes are live with real keys or configured but dormant.
- Files: `app/app/api/stripe/webhook/route.ts`, `app/app/api/stripe/checkout/route.ts`, `app/lib/stripe.ts`
- Blocks: Onboarding documentation and team communication.

## Test Coverage Gaps

**Zero test coverage for the Next.js app (all routes and components):**
- What's not tested: Every API route, every page component, all form submission flows, all AI draft paths, BYOK key encryption/decryption round-trip in the web app context, Stripe webhook event handling, onboarding flow state machine.
- Files: The entire `app/app/` and `app/components/` directory hierarchy.
- Risk: Regressions in payment processing, key decryption, rate limiting, and auth flows go undetected until users report them.
- Priority: High — especially for `app/app/api/stripe/webhook/route.ts`, `app/lib/encryption.ts`, and `app/app/api/draft/route.ts`.

**MCP server tests cover happy paths only for most tools:**
- What's not tested: Error paths in `hub_stress_test_answer.ts`, network failure scenarios in `hub_get_answer_review_context.ts`, invalid UUID handling across all tools that accept `program_id` or `user_id`.
- Files: `application-hub-mcp-server/src/tools/` (most test files have limited negative-case coverage)
- Risk: Production edge cases silently return malformed responses or crash with unhandled exceptions.
- Priority: Medium.

---

*Concerns audit: 2026-05-21*
