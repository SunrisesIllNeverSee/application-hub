# Application Hub — Status

_Last updated: 2026-05-10_

This file is the current GitHub-visible source of truth. It separates what is confirmed in this repository from what may exist locally but has not yet been uploaded.

---

## Confirmed in GitHub

### Repository
- Public GitHub repository: `SunrisesIllNeverSee/application-hub`
- Default branch: `main`
- Root project documentation is present.
- Root `.gitignore` is present and excludes dependency folders, build output, `.next`, local env files, and editor artifacts.

### Database
- Supabase migration directory exists.
- Migrations `001` through `009` are documented as the canonical migration chain.
- `migrations/008_intelligence_layer_v2.sql` is present and includes:
  - MCP-facing program display columns
  - question significance scoring
  - profile answer alignment columns/triggers
  - draft usage RPC
  - `program_dna`
  - `user_program_fit`
  - pgvector matching RPC
  - nightly cron refresh jobs
- `migrations/009_fix_auth_trigger_search_path.sql` is present. Cowork added it during live smoke testing to pin search_path on the signup trigger chain and fix magic-link signup failures.
- The current strategy is to keep migrations `001` through `009` and layer RNS-backed intelligence above the existing scoring fields rather than rolling back to a minimal schema.

### MCP server
- `application-hub-mcp-server/` exists.
- TypeScript MCP server is present.
- Server registers:
  - 20 tools
  - 7 resources
  - 3 prompts
- Supports two transports:
  - `stdio` for Claude Desktop / Cursor / Windsurf
  - `http` for remote deployment
- Build script exists: `npm run build`.
- Typecheck script exists: `npm run typecheck`.
- Strict TypeScript config exists.
- New app-support tools are present:
  - `hub_get_program_by_slug`
  - `hub_save_answer`
  - `hub_get_answer_review_context`
  - `hub_stress_test_answer`

### Next.js app
- `app/` exists as a Next.js App Router application.
- Package and lockfile are present.
- Current app surfaces include:
  - Hub directory
  - Program detail route
  - Workspace route
  - Profile route
  - Supabase auth callback/login scaffolding
- Magic-link redirects now land at real path `/auth/callback`; Cowork moved the callback route out of the `(auth)` route group during live smoke testing.
- Live Supabase data wiring is present and build-verified.
- Hosted AI drafting is wired through `POST /api/draft`; successful drafts are logged to `ai_draft_runs` so the database trigger updates `ai_usage`.
- Deeper review/comments are intentionally reserved for agent-side RNS/MCP workflows until the contract is hardened.
- RNS-integrated build-path documentation is present at `docs/06_rns_integrated_build_path.md`.

### CI
- GitHub Actions workflow exists at `.github/workflows/ci.yml`.
- CI has separate jobs for:
  - MCP server install, typecheck, build
  - Next.js app install, typecheck, build

### Environment documentation
- `application-hub-mcp-server/.env.example` exists.
- Required variables are documented:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ANON_KEY`
  - `TRANSPORT`
  - `PORT`
- Supabase Auth custom SMTP setup is documented at `docs/08_resend_smtp_setup.md`.
- Resend SMTP credentials are dashboard secrets, not frontend environment variables.

---

## Not currently confirmed in GitHub

These may exist locally, but are not confirmed by the current GitHub-visible repository state:

- Root `package.json`
- `application-hub-roadmap.md`
- Production deployment configuration
- Stripe webhook implementation
- Browser smoke testing against real Supabase credentials

---

## Current remote truth

The GitHub-visible repo should be treated as:

```text
Database schema + seed data + MCP server are present.
Next.js app is present, wired to live data, and build-verified.
CI covers MCP and app packages separately.
RNS is the planned additive judgment layer, not a launch blocker.
```

---

## Immediate priorities (post 2026-05-10 smoke test)

1. **Build the Question Bank UI** — biggest gap surfaced by smoke test; merges with the Drip mechanic
2. **Fix responsive layout** — sidebar/main padding/program-detail squeeze at <1024px viewports
3. **Seed real deadlines** — every program currently shows "Rolling" because seed lacks dates
4. **Program detail TL;DR / pros & cons block** — user feedback: pages are too blob-y
5. **Build proper user profile section** — `/profile` is currently the Answer Bank, no actual profile page
6. **Set up custom SMTP** (Resend recommended) — setup guide is documented; dashboard/DNS configuration remains manual
7. **Stress-test saved answers through MCP groundwork** — UI/persistence still pending
8. **Smoke-test `POST /api/draft`** with valid Anthropic key (deferred — user doesn't have one yet)

## What landed during the 2026-05-10 smoke session

- `migrations/009_fix_auth_trigger_search_path.sql` — fixed Supabase auth signup
- `app/app/auth/callback/route.ts` — moved out of `(auth)` route group
- `app/components/ThemeBar.tsx` — fixed DNA % display (was showing 2290%)
- `app/components/Sidebar.tsx` — fixed active-state matching for child routes
- `app/app/(auth)/login/page.tsx` — added dev-only password sign-in escape hatch
- `app/app/(app)/layout.tsx` — reverted experimental dynamic export (cookies trigger dynamic on their own)
- `app/package.json` — bumped Next.js 14.2.0 → 14.2.35 (CVE chain + dev-mode regressions)
- `VISION.md` — new product vision doc
- `TASKS.md` — captured 16 follow-ups from smoke test
- `app/.env.local` (worktree + main) — populated with Supabase URL + publishable key
