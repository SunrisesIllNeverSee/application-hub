# Application Hub — Agent Coordination

> Read this before touching anything. Both Cowork (Claude) and Codex must read this file at the start of every session.
> Check the ownership table before editing files — don't create merge conflicts.
> Then check `SCRATCH.md` for active claims before picking up work.
> Then read `ROADMAP.md` for what's next in priority order.
>
> **We are nonlinear and temporal.** No calendar deadlines. Work happens when Deric is engaged.
> The roadmap is priority-ordered, not time-ordered.

---

## What this project is

**Application Hub** — a platform that helps founders apply to accelerators, grants, and fellowships.

Core asset: a **question archive** — every question ever asked by any program, stored once, scored by significance. Users build a profile answer bank that pre-fills across multiple applications.

**Business model**: Freemium SaaS. Free = 10 AI drafts/month. Pro = $19/mo unlimited. Team = $49/mo multi-seat.  
**Company**: Ello Cello LLC — Deric McHenry (deric.mchenry@gmail.com)

---

## Architecture

```
Supabase (PostgreSQL + pgvector)   ← single source of truth
  ↕                                   project: betcyfbzsgusaghriptz
MCP Server (TypeScript)            ← intelligence layer, 19 tools
  ↕
Next.js app (app/)                 ← user-facing product (Phase 2)
```

---

## Current Phase: 2 — Live data integration

| Component | Status | Owner |
|---|---|---|
| Schema + migrations 001–009 | ✅ Done (009 = auth trigger fix, 2026-05-10) | Cowork (009) |
| MCP server (19 tools) | ✅ Done | — |
| 30 programs seeded to Supabase | ✅ Done | Cowork |
| Intelligence layer (significance + DNA) | ✅ Done | Cowork |
| Next.js app scaffold | ✅ Done | Codex |
| Hub UI (live data) | ✅ Smoke-tested 2026-05-10 | Cowork |
| Application Workspace (live data) | ✅ Smoke-tested 2026-05-10 | Cowork |
| Auth flow (magic link + dev password) | ✅ Working | Cowork |
| `/auth/callback` route fix | ✅ Done | Cowork |
| DNA % display bug | ✅ Fixed | Cowork |
| Sidebar active-state bug | ✅ Fixed | Cowork |
| CI workflow | ✅ Done | Codex |
| Next.js bumped to 14.2.35 | ✅ Done | Cowork |

## What's open for Codex

See `TASKS.md` "Tonight's follow-ups" — but specifically Codex's lane:

1. **P1 — Agent-side review/comment contract** (assigned to Codex + Deric in commit `d5c2587`)
2. **Custom SMTP setup** — Resend integration, Supabase auth Email config
3. **Doc sync** — STATUS.md / ARCHITECTURE.md were updated by Cowork tonight; if Codex wants to refine them, coordinate via commit messages

Cowork is going to attack the P1 bugs (responsive layout, Question Bank UI, real deadlines, program TL;DR). Codex shouldn't touch `app/components/`, `app/app/(app)/`, or `app/app/auth/` until those land — to avoid merge conflicts.

---

## File Ownership Table

This is the coordination contract. **Do not edit files owned by the other agent without flagging it in a commit message.**

| Path | Owner | Notes |
|---|---|---|
| `app/` (all Next.js) | **Cowork** | Live data wiring is build-verified; smoke testing AI draft flow next |
| `migrations/` | **Cowork** | Schema changes only; 009 fixes auth trigger search_path from smoke testing |
| `seed/` | **Cowork** | All 30 programs done |
| `application-hub-mcp-server/src/` | **Shared** | Coordinate via commit messages |
| `application-hub-mcp-server/package.json` | **Codex** | Build scripts, deps |
| `.github/workflows/` | **Codex** | CI/CD |
| `CLAUDE.md` | **Cowork** | Cowork session context |
| `AGENTS.md` | **Cowork** | This file — coordination contract |
| `TASKS.md` | **Cowork** | Task tracking |
| `ARCHITECTURE.md` | **Codex** | Architecture docs |
| `STATUS.md` | **Codex** | Repo status doc |
| `SECURITY.md` | **Codex** | Security policy |
| `README.md` | **Shared** | Coordinate via commit messages |
| `CONTRIBUTING.md` | **Shared** | Coordinate via commit messages |
| `VISION.md` | **Cowork** | Product vision — the why and the future aspirations |
| `ROADMAP.md` | **Shared** | Priority-ordered list of work — read at session start |
| `SCRATCH.md` | **Shared** | Active work claims — both agents must read before starting |

---

## Active work coordination — `SCRATCH.md`

Before picking up any task from `TASKS.md`, both agents **must** check `SCRATCH.md` to see what the other is currently working on. Claim by appending to "Currently claimed" + commit; release by removing your row when done.

This prevents the duplicate work we hit on 2026-05-10 (both agents independently writing migration 009). See `SCRATCH.md` for full protocol.

---

## How we avoid merge conflicts

1. **Pull before every session.** Always `git pull origin main` before starting work.
2. **Small, frequent commits.** Commit after each logical unit — don't batch huge changesets.
3. **Commit messages declare scope.** Start with the area: `app/hub:`, `mcp:`, `seed:`, `docs:` etc.
4. **Don't reformat files you don't own.** Whitespace/formatting changes cause spurious conflicts.
5. **If you touch a shared file, say so.** Add `[shared]` to the commit subject.

---

## Supabase project

- **Project ID**: `betcyfbzsgusaghriptz`
- **URL**: `https://betcyfbzsgusaghriptz.supabase.co`
- **Migrations applied**: 001–009 ✅
- **Programs seeded**: 30 ✅
- **Intelligence layer**: live ✅ (225 questions scored, DNA weights computed)

---

## MCP server — local setup

```bash
cd application-hub-mcp-server
npm install
npm run build
```

Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "application-hub": {
      "command": "node",
      "args": ["/Users/dericmchenry/Desktop/application-hub/application-hub-mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://betcyfbzsgusaghriptz.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "YOUR_SERVICE_ROLE_KEY",
        "SUPABASE_ANON_KEY": "YOUR_ANON_KEY"
      }
    }
  }
}
```

`dist/` is gitignored — always run `npm run build` after cloning or pulling MCP server changes.

---

## Conventions

- **TypeScript throughout** — no plain JS in `src/`
- **Zod for all input schemas** — `z.object({...}).strict()`
- **Supabase join pattern**: `Array.isArray(row.joined) ? row.joined[0] : row.joined` then cast `as unknown as T`
- **CHARACTER_LIMIT = 25_000** — all tool text responses sliced at this
- **Response format**: tools accept `response_format: "markdown" | "json"` — default markdown

## Don't do these things

- Don't run migrations out of order
- Don't expose `SUPABASE_SERVICE_ROLE_KEY` in any frontend code
- Don't add community/social features until outcomes data exists (noise before signal)
- Don't auto-submit applications — preparation layer only
