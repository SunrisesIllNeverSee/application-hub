# Application Hub — Status

_Last updated: 2026-05-09_

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
- Migrations `001` through `008` are documented as the canonical migration chain.
- `migrations/008_intelligence_layer_v2.sql` is present and includes:
  - MCP-facing program display columns
  - question significance scoring
  - profile answer alignment columns/triggers
  - draft usage RPC
  - `program_dna`
  - `user_program_fit`
  - pgvector matching RPC
  - nightly cron refresh jobs

### MCP server
- `application-hub-mcp-server/` exists.
- TypeScript MCP server is present.
- Server registers:
  - 16 tools
  - 7 resources
  - 3 prompts
- Supports two transports:
  - `stdio` for Claude Desktop / Cursor / Windsurf
  - `http` for remote deployment
- Build script exists: `npm run build`.
- Strict TypeScript config exists.

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
- Next.js app package
- App Router routes
- Hub UI implementation
- Application workspace UI
- Answer history UI
- Answer bank UI
- `application-hub-roadmap.md`
- GitHub Actions CI workflow
- ESLint / Biome / Prettier config
- Dedicated `typecheck`, `lint`, or `check` scripts

---

## Current remote truth

The GitHub-visible repo should be treated as:

```text
Database schema + MCP server are present.
Frontend status is unverified remotely.
Seed data status is unclear because TASKS.md contains conflicting statements.
Tooling and CI need to be added.
```

---

## Immediate priorities

1. Resolve `TASKS.md` contradiction.
2. Add baseline CI for the MCP server.
3. Add repo-level architecture and security documentation.
4. Confirm whether the locally built frontend/seed-data gap needs to be pushed.
5. After remote state is synchronized, continue with frontend and production deployment work.
