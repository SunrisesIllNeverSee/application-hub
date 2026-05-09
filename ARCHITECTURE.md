# Application Hub — Architecture

_Last updated: 2026-05-09_

Application Hub is a database-first, MCP-first platform for founders applying to accelerators, grants, fellowships, and similar programs.

The core asset is a reusable question archive: every program question is stored once, mapped to the programs that ask it, scored for significance, and used to help founders build a durable answer bank.

---

## System shape

```text
Supabase PostgreSQL + pgvector
  ↓
Application Hub MCP Server
  ↓
Claude Desktop / Cursor / Windsurf / future app clients
  ↓
Next.js frontend and paid SaaS layer
```

---

## Current GitHub-visible architecture

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

- 16 MCP tools
- 7 MCP resources
- 3 MCP prompts

---

### 3. Client layer

Current verified clients:

- Claude Desktop via local MCP config
- Cursor via MCP config
- Windsurf via MCP config

Planned / unverified in current GitHub state:

- Next.js App Router frontend
- Hub directory UI
- Application workspace
- Answer bank UI
- Stripe-gated SaaS surfaces

If these exist locally, they need to be pushed before the remote repository can be treated as frontend-complete.

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

---

## Boundary rules

### Do

- Keep database migrations ordered and append-only.
- Keep service-role access server-side only.
- Keep MCP tool schemas strict.
- Keep reusable logic out of UI components.
- Treat the question archive as the core product asset.
- Treat seed data quality as more important than visual polish.

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

The remote repository currently verifies the database and MCP layers but does not verify the frontend layer. `TASKS.md` also contains status drift between blocking tasks and completed tasks.

Until the local work is pushed, the safe operating assumption is:

```text
Remote GitHub state = backend/intelligence layer confirmed; frontend status unverified.
```
