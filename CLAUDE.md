# Application Hub — Claude Context

> This file is the persistent context for any Claude or Cowork session working on this project.
> Read it first. Every time. It's short on purpose.

---

## What this project is

**Application Hub** — a platform that helps anyone apply to **opportunities that need essays**: accelerators, grants, jobs, schools, and fellowships.

The core asset is a **question archive**: every question ever asked by any program, stored once, scored by significance. Users build a profile answer bank that pre-fills across multiple applications. The intelligence layer computes fit scores, program DNA weights, and opportunity rankings.

**Business model**: Freemium SaaS. Free tier gets 10 AI drafts/month. Pro ($19/mo) is unlimited. Team ($49/mo) adds multi-seat and shared answer library.

**Company**: Ello Cello LLC (sole proprietor — Deric McHenry, deric.mchenry@gmail.com)

---

## Architecture at a glance

```
Supabase (PostgreSQL + pgvector)   ← single source of truth
  ↕
MCP Server (TypeScript)            ← intelligence layer, 20 tools
  ↕
Claude Desktop / Cursor / Windsurf ← AI drafting interface (current)
  ↕
Next.js app (app/)                 ← user-facing product, live-data wired
```

**Current phase: Launch hardening — ship the spine, layer RNS**
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
│   ├── 008_intelligence_layer_v2.sql   ← adds program_dna, user_program_fit, RPCs
│   ├── 009_fix_auth_trigger_search_path.sql ← fixes magic-link signup trigger search_path
│   ├── 012_launch_hardening.sql        ← BYOK metadata + answer stress-test persistence
│   ├── 013_cohort_context.sql          ← cohort metadata on programs
│   ├── 014_question_bank_drip.sql      ← Question Bank unlocks + daily drip
│   └── 015_byok_key_storage.sql        ← encrypted BYOK key storage column
│
├── application-hub-mcp-server/        ← TypeScript MCP server (20 tools, 7 resources, 3 prompts)
│   ├── src/
│   ├── dist/                          ← compiled output (run npm run build first)
│   └── README.md
│
└── seed/                              ← seed SQL for 30 real programs
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
| `user_integrations` | BYOK provider metadata; raw keys stay in server-side secret storage |
| `answer_stress_tests` | Persisted answer stress-test/review runs |

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

**The MCP server will not function until migrations 001-015 have been applied to Supabase.**

---

## Environment variables

### Next.js app (`app/.env.local`)

This file is gitignored. Claude Code needs it to run `npm run dev` and `npm run build`.

```
NEXT_PUBLIC_SUPABASE_URL=https://betcyfbzsgusaghriptz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
ANTHROPIC_API_KEY=<optional platform fallback key>
INTEGRATION_ENCRYPTION_KEY=<required for BYOK key storage>
```

The anon key is safe to use client-side (it's public). `INTEGRATION_ENCRYPTION_KEY` is required for encrypted BYOK storage. `ANTHROPIC_API_KEY` is optional and only used if platform fallback is intentionally enabled. Never put the service role key in `.env.local`.

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

## Current status (launch hardening)

| Component | Status |
|---|---|
| v3 schema design | ✅ Done |
| Supabase migrations 001-015 | ✅ Done |
| MCP server (20 tools, 7 resources, 3 prompts) | ✅ Done — clean build |
| 30 programs seeded | ✅ Done — all in Supabase `betcyfbzsgusaghriptz` |
| Intelligence layer (significance + DNA) | ✅ Done — RPCs executed, 225 questions scored |
| Next.js app scaffold | ✅ Done — auth, app router, Supabase SSR client, layouts |
| Auth callback path | ✅ Done — magic links land at real `/auth/callback` route |
| Hub UI (program directory + timeline) | ✅ Done — all column refs fixed, wired to live DB |
| Question Bank (`/bank`) | ✅ Done — unlocked questions, locked previews, daily drip |
| Application workspace | ✅ Done — column refs fixed, wired to live DB |
| Profile split (`about`, `answers`, `settings`, `integrations`) | ✅ Done |
| AnswerEditor (save/upsert) | ✅ Done — uses real confidence enum (draft/solid/locked) |
| Build verification | ✅ Done — zero TypeScript errors (`npx tsc --noEmit` passes) |
| AI draft button | ✅ Done — POST /api/draft wired, AnswerEditor "Draft with AI" button live |
| Hosted draft metering | ✅ Done — successful hosted drafts log to `ai_draft_runs` |
| BYOK draft routing | ✅ Done — `/api/draft` prefers user key; `/profile/integrations` saves encrypted provider keys |
| Stripe integration | ⬜ Phase 3 |

---

## What to work on next

See `TASKS.md` for the prioritized task list.

**Current launch sequence**:
1. Ship today to 10–20 power users through MCP/web app with clear BYOK/hosted-AI caveats.
2. MVP pieces are in repo: Question Bank, drip mechanic, profile split, BYOK integrations.
3. Polished public launch: live BYOK draft validation, real deadlines, program TL;DR/pros/cons, heat/applicant polish.

`cd app && npm run type-check` and `cd app && npm run build` are passing as of 2026-05-10.

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
