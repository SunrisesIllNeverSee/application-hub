# Application Hub — Claude Context

> This file is the persistent context for any Claude or Cowork session working on this project.
> Read it first. Every time. It's short on purpose.

---

## What this project is

**Application Hub** — a platform that helps founders apply to accelerators, grants, and fellowships.

The core asset is a **question archive**: every question ever asked by any program, stored once, scored by significance. Users build a profile answer bank that pre-fills across multiple applications. The intelligence layer computes fit scores, program DNA weights, and opportunity rankings.

**Business model**: Freemium SaaS. Free tier gets 10 AI drafts/month. Pro ($19/mo) is unlimited. Team ($49/mo) adds multi-seat and shared answer library.

**Company**: Ello Cello LLC (sole proprietor — Deric McHenry, deric.mchenry@gmail.com)

---

## Architecture at a glance

```
Supabase (PostgreSQL + pgvector)   ← single source of truth
  ↕
MCP Server (TypeScript)            ← intelligence layer, 18 tools
  ↕
Claude Desktop / Cursor / Windsurf ← AI drafting interface (current)
  ↕
Next.js app (planned Phase 2)      ← user-facing product
```

**Current phase: Phase 2 — building seed data + Next.js app**
**MCP server: complete, clean build**

---

## Repo layout

```
application-hub/
├── CLAUDE.md                  ← you are here
├── TASKS.md                   ← current task list (always up to date)
├── README.md                  ← project overview for humans
├── CONTRIBUTING.md            ← how to add programs, questions, seed data
│
├── migrations/                ← Supabase SQL, apply in order
│   ├── 001_enums_and_extensions.sql
│   ├── 002_core_tables.sql
│   ├── 003_intelligence_and_integrations.sql
│   ├── 004_functions_and_triggers.sql
│   ├── 005_rls_policies.sql
│   ├── 006_edge_functions_cron.sql
│   ├── 007_monetization.sql
│   └── 008_intelligence_layer_v2.sql   ← APPLY THIS — adds program_dna, user_program_fit, RPCs
│
├── application-hub-mcp-server/        ← TypeScript MCP server (18 tools, 7 resources, 3 prompts)
│   ├── src/
│   ├── dist/                          ← compiled output (run npm run build first)
│   └── README.md
│
└── seed/                              ← (planned) seed SQL for 30 real programs
```

---

## Key database concepts

| Table | What it does |
|---|---|
| `archived_questions` | Master question archive — one row per unique question across all programs |
| `programs` | Every accelerator, grant, fellowship, VC |
| `program_questions` | Maps archived questions to specific programs (exact phrasing + word limits) |
| `program_dna` | Per-program theme weight breakdown (what it *actually* cares about) |
| `profile_answers` | User's reusable answer bank (one row per user per archived question) |
| `user_program_fit` | Pre-computed fit scores per (user, program) pair — refreshed nightly |
| `ai_usage` | Draft run tracking for rate limiting |
| `user_subscriptions` | Stripe-linked subscription tier per user |

**Scoring formulas (reference)**:

```
significance_score = asked_by_count × avg_word_limit_weight × theme_prestige × universal_bonus

fit_score = (coverage_pct × 0.40) + (theme_alignment × 0.35)
          + (criteria_match × 0.15) + (quality_signal × 0.10)

composite_score = fit_score × program_value_score / 100
```

---

## MCP server — how to run locally

```bash
cd application-hub-mcp-server
npm install
npm run build
```

Connect to Claude Desktop — add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "application-hub": {
      "command": "node",
      "args": ["/absolute/path/to/application-hub-mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
        "SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

**The MCP server will not function until migrations 001-008 have been applied to Supabase.**

---

## Environment variables

### Next.js app (`app/.env.local`)

This file is gitignored. Claude Code needs it to run `npm run dev` and `npm run build`.

```
NEXT_PUBLIC_SUPABASE_URL=https://betcyfbzsgusaghriptz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
ANTHROPIC_API_KEY=<your Anthropic API key>
```

The anon key is safe to use client-side (it's public). `ANTHROPIC_API_KEY` is server-side only — used by `POST /api/draft`. Never put the service role key in `.env.local`.

### MCP server (`application-hub-mcp-server/`)

Set these in your shell or in `claude_desktop_config.json` env block:

| Variable | Required | What it is |
|---|---|---|
| `SUPABASE_URL` | Yes | `https://betcyfbzsgusaghriptz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key — server-side only, never expose to client |
| `SUPABASE_ANON_KEY` | Yes | Anon key (used for user JWT validation) |
| `TRANSPORT` | No | `stdio` (default) or `http` |
| `PORT` | No | HTTP mode port (default 3000) |

### Claude Code MCP config (`~/.claude/claude_desktop_config.json`)

Recommended MCPs to add for this project:

```json
{
  "mcpServers": {
    "application-hub": {
      "command": "node",
      "args": ["/Users/dericmchenry/Desktop/application-hub/application-hub-mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://betcyfbzsgusaghriptz.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "<service role key>",
        "SUPABASE_ANON_KEY": "<anon key>"
      }
    },
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest", "--project-ref", "betcyfbzsgusaghriptz"],
      "env": { "SUPABASE_ACCESS_TOKEN": "<your personal access token>" }
    }
  }
}
```

---

## Current status (Phase 2)

| Component | Status |
|---|---|
| v3 schema design | ✅ Done |
| Supabase migrations 001-008 | ✅ Done |
| MCP server (18 tools, 7 resources, 3 prompts) | ✅ Done — clean build |
| 30 programs seeded | ✅ Done — all in Supabase `betcyfbzsgusaghriptz` |
| Intelligence layer (significance + DNA) | ✅ Done — RPCs executed, 225 questions scored |
| Next.js app scaffold | ✅ Done — auth, app router, Supabase SSR client, layouts |
| Hub UI (program directory + timeline) | ✅ Done — all column refs fixed, wired to live DB |
| Application workspace | ✅ Done — column refs fixed, wired to live DB |
| Answer Bank (profile page) | ✅ Done — column refs fixed, wired to live DB |
| AnswerEditor (save/upsert) | ✅ Done — uses real confidence enum (draft/solid/locked) |
| Build verification | ✅ Done — zero TypeScript errors (`npx tsc --noEmit` passes) |
| AI draft button | ✅ Done — POST /api/draft wired, AnswerEditor "Draft with AI" button live |
| Stripe integration | ⬜ Phase 3 |

---

## What to work on next

See `TASKS.md` for the prioritized task list.

**Current P0**: Run `cd app && npm run build` — the column audit is complete and all live-data
wiring is done. This verifies there are no remaining TypeScript errors before testing in browser.

**P1 after build passes**: Smoke-test `POST /api/draft` from the workspace UI and confirm
draft generation logs usage cleanly.

---

## Conventions

- **TypeScript throughout** — no plain JS in src/
- **Zod for all input schemas** — `z.object({...}).strict()`
- **Supabase join access pattern**: always use `Array.isArray(row.joined) ? row.joined[0] : row.joined` then cast with `as unknown as T` — TypeScript infers foreign table joins as arrays
- **CHARACTER_LIMIT = 25_000** — all tool text responses sliced at this
- **Response format**: tools accept `response_format: "markdown" | "json"` — default markdown
- **Structured content**: all tools return both `content[text]` and `structuredContent` for MCP clients that support it

---

## Don't do these things

- Don't run migrations out of order — they depend on each other
- Don't use the service role key client-side or expose it in any frontend code
- Don't add community/social features until the data layer has real programs seeded (noise before signal)
- Don't auto-submit applications — this is a preparation layer, not a submission layer
