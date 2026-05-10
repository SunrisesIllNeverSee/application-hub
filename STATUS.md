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
  - 19 tools
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
- Hosted AI drafting is wired through `POST /api/draft`; deeper review/comments are intentionally reserved for agent-side RNS/MCP workflows until the contract is hardened.
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

## Immediate priorities

1. Continue smoke-testing live Supabase app routes in browser.
2. Keep architecture/status docs synced as schema-facing column names settle.
3. Expand MCP app-support tools only when they remove server-side app duplication.
4. Smoke-test `POST /api/draft` with a real authenticated session and valid Anthropic key.
5. Define the agent-side review/comment contract for saved answers before embedding RNS review directly into the app UI.
