# Application Hub

**The canonical database of what accelerators, grants, and fellowships actually ask — and what winning answers look like.**

Built by Ello Cello LLC.

---

## What it is

Application Hub is a platform for founders applying to programs. It solves one specific problem: the same questions show up everywhere, answered slightly differently each time, losing context and quality with every copy-paste.

The product is built around a **question archive** — every question asked by every program, stored once. When you answer a question on one application, that answer lives in your profile and pre-fills every future application that asks something similar. The intelligence layer tells you which questions are most valuable to answer (significance score), which programs are the best fit for where you are right now (composite score), and exactly what's left before you're ready to apply (readiness check).

---

## Current state

**Phase 2** — building seed data and core UI.

| Component | Status |
|---|---|
| Database schema (v3) | ✅ Complete |
| Supabase migrations | ✅ 008 migrations, apply in order |
| MCP server (16 tools) | ✅ Complete, clean build |
| Seed data (30 programs) | ⬜ Not started |
| Next.js app | ⬜ Not started |

The MCP server is the working interface right now. It connects to Claude Desktop, Cursor, and Windsurf and exposes the full intelligence layer as 16 tools, 7 resources, and 3 prompts.

---

## For Claude / Cowork sessions

Read `CLAUDE.md` first — it has the architecture, schema overview, current status, and conventions. It's the single source of context for any AI session on this project.

Check `TASKS.md` for what's current and what's blocked.

---

## Quick start — MCP server

```bash
cd application-hub-mcp-server
npm install
npm run build
```

See `application-hub-mcp-server/README.md` for full setup, including Claude Desktop and Cursor config.

**Prerequisites**: Supabase project with all 8 migrations applied.

---

## Tech stack

| Layer | Choice |
|---|---|
| Database | Supabase (PostgreSQL + pgvector) |
| MCP server | TypeScript + `@modelcontextprotocol/sdk` |
| Frontend | Next.js App Router (planned) |
| Payments | Stripe (planned) |
| AI drafting | Claude API — Haiku for speed, Sonnet for quality |
| Hosting | Vercel (frontend) + Railway or Fly (MCP HTTP mode) |
| Cron | Supabase pg_cron |

---

## Roadmap

See `application-hub-roadmap.md` for the full four-phase roadmap with milestones, scoring formulas, dependency table, and what's deliberately not on it.

---

## Contributing

See `CONTRIBUTING.md` — especially the section on adding program seed data, which is the highest-leverage contribution right now.
