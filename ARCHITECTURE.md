# Application Hub — Architecture

_Last updated: 2026-05-10_

Application Hub is a database-first, MCP-first platform for founders applying to accelerators, grants, fellowships, and similar programs.

The core asset is a reusable question archive: every program question is stored once, mapped to the programs that ask it, scored for significance, and used to help founders build a durable answer bank.

---

## System shape

```text
Supabase PostgreSQL + pgvector
  ↓
Application Hub MCP Server
  ↓
Claude Desktop / Cursor / Windsurf / server-side app integrations
  ↓
Next.js frontend and paid SaaS layer
```

---

## Current architecture

### 1. Database layer

Location:

```text
migrations/
```

Responsibilities:

- Program catalog
- Archived question library
- Program-question mapping
- Profile answer bank
- Question significance scoring
- Program DNA computation
- User-program fit scoring
- AI draft usage tracking
- Subscription-tier support
- Scheduled recomputation jobs

The database is the source of truth. MCP tools and future UI surfaces should read from it rather than duplicating scoring logic client-side.

---

### 2. MCP server layer

Location:

```text
application-hub-mcp-server/
```

Runtime:

- TypeScript
- Node.js >= 18
- `@modelcontextprotocol/sdk`
- Supabase JS client
- Express for HTTP transport
- Zod for tool input schemas

Transports:

- `stdio` for local Claude Desktop, Cursor, Windsurf, and Codex/Cowork style clients
- `http` for future remote deployment on Railway, Fly, or similar infrastructure

Server entrypoint:

```text
application-hub-mcp-server/src/index.ts
```

The server registers:

- 18 MCP tools
- 7 MCP resources
- 3 MCP prompts

---

### 3. Client and app layer

Current local clients:

- Claude Desktop via local MCP config
- Cursor via MCP config
- Windsurf via MCP config

Application layer:

- Next.js App Router frontend in `app/`
- Hub directory UI
- Application workspace
- Answer bank/profile surfaces
- Supabase auth via magic link

The app is currently moving from mock data to live Supabase data. Cowork owns the active `app/` integration work; Codex-owned parallel work should stay in CI, docs, and MCP server changes unless explicitly reassigned.

---

## Core data concepts

| Concept | Purpose |
|---|---|
| `programs` | Canonical list of accelerators, grants, fellowships, VCs, and related opportunities |
| `archived_questions` | Deduplicated master archive of application questions |
| `program_questions` | Maps archived questions to exact program phrasing and limits |
| `program_dna` | Per-program thematic weight breakdown |
| `profile_answers` | User reusable answer library |
| `user_program_fit` | Precomputed fit scores by user and program |
| `ai_draft_runs` | Draft-generation usage log |
| `ai_usage` | Monthly usage tracking for tier limits |
| `user_subscriptions` | Subscription-tier state |

---

## Scoring responsibilities

Scoring should stay server/database-side.

Primary scoring functions:

```text
compute_significance_scores()
compute_program_dna()
compute_user_fit_scores()
```

Primary formula families:

```text
significance_score = asked_by_count × word_limit_weight × theme_prestige × universal_bonus

fit_score = coverage_pct × 0.40
          + theme_alignment × 0.35
          + criteria_match × 0.15
          + quality_signal × 0.10

composite_score = fit_score × program_value_score / 100
```

RNS is the planned judgment layer above this scaffolding, not a replacement for the Supabase/MCP/app spine. pgvector remains useful for retrieval and similarity; RNS should evaluate signal purity, answer fidelity, commitment conservation, and question significance once the core product loop is usable.

---

## Boundary rules

### Do

- Keep database migrations ordered and append-only.
- Keep service-role access server-side only.
- Keep MCP tool schemas strict.
- Keep reusable logic out of UI components.
- Treat the question archive as the core product asset.
- Treat seed data quality as more important than visual polish.
- Keep app-facing MCP helpers narrow and server-friendly, such as slug lookups and validated answer upserts.

### Do not

- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in any frontend code.
- Do not run migrations out of order.
- Do not duplicate scoring formulas in client-side UI unless explicitly mirrored as display-only logic.
- Do not add community/social features before the data layer is reliable.
- Do not auto-submit applications; this is a preparation and intelligence layer.

---

## Deployment model

### Local mode

```text
Claude / Cursor / Windsurf → stdio → local compiled MCP server → Supabase
```

### Remote mode

```text
Client → HTTPS /mcp → deployed MCP server → Supabase
```

Expected deployment split:

| Layer | Target |
|---|---|
| Frontend | Vercel |
| MCP HTTP server | Railway or Fly |
| Database | Supabase |
| Scheduled jobs | Supabase pg_cron |
| Payments | Stripe |

---

## Current architecture risk

The repository now includes the database, MCP server, seed data, and Next.js app scaffolding, but the app is actively being wired to live Supabase data. CI runs the MCP server checks and the Next.js app checks separately so failures identify the layer that needs attention.

The safe operating assumption is:

```text
Database + MCP intelligence layer = confirmed.
Next.js app = present, active live-data integration in progress.
```
