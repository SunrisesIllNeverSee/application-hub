# Application Hub

**The canonical database of what accelerators, grants, and fellowships actually ask — and what winning answers look like.**

Built by Ello Cello LLC.

---

## Where we're at

- **`ROADMAP.md`** — priority-ordered list of work, what's next, the visionary backlog
- **`VISION.md`** — product vision, the why, premium pricing structure, future aspirations
- **`TASKS.md`** — granular task list with smoke-test feedback and follow-ups
- **`STATUS.md`** — current confirmed state of the GitHub-visible repo
- **`AGENTS.md`** — Cowork (Claude) + Codex coordination contract, file ownership
- **`SCRATCH.md`** — active work-in-progress claims (what each agent is touching right now)
- **`docs/08_resend_smtp_setup.md`** — practical Supabase Auth custom SMTP setup with Resend
- **`docs/09_launch_checklist.md`** — Milestone 3 ship/no-ship checklist
- **`docs/10_byok_and_draft_policy.md`** — BYOK and hosted draft policy contract
- **`docs/archive/`** — historical/superseded planning docs that are useful context but no longer active direction

We are **nonlinear and temporal** — no calendar deadlines. The roadmap is priority-ordered.

## What it is

Application Hub is a platform for founders applying to programs. It solves one specific problem: the same questions show up everywhere, answered slightly differently each time, losing context and quality with every copy-paste.

The product is built around a **question archive** — every question asked by every program, stored once. When you answer a question on one application, that answer lives in your profile and pre-fills every future application that asks something similar. The intelligence layer tells you which questions are most valuable to answer (significance score), which programs are the best fit for where you are right now (composite score), and exactly what's left before you're ready to apply (readiness check).

Just as important: the spine should stay portable across adjacent application domains. The same archive/reuse/intelligence model should be able to switch themes into **jobs, grants, and school applications** without a ground-up rebuild. That portability is part of the moat, not a side quest.

---

## Current state

**Launch hardening** — the spine is built; the next work is cold-start, BYOK, and public-launch polish.

| Component | Status |
|---|---|
| Database schema (v3) | ✅ Complete |
| Supabase migrations | ✅ 010 migrations, apply in order |
| MCP server (20 tools) | ✅ Complete, clean build |
| Seed data (30 programs) | ✅ Done |
| Next.js app | ✅ Live data wired, build verified |

The MCP server connects to Claude Desktop, Cursor, and Windsurf and exposes the full intelligence layer as 20 tools, 7 resources, and 3 prompts.

Current launch frame:

- **Ship today**: soft launch to 10–20 power users through MCP/web app.
- **MVP**: add `/bank`, Drip mechanic, BYOK, and hosted draft policy/gating.
- **Polished launch**: real deadlines, program TL;DR/pros/cons, profile split, custom SMTP, and full draft smoke test.

---

## Current strategy

Application Hub ships first as a practical application operating system: question archive, reusable answer bank, program workspace, hosted AI drafting, and external apply paths. RNS is additive over that spine. The current scoring layer is useful scaffolding; RNS turns it into signal intelligence for question significance, answer fidelity, and opportunity matching without blocking the launch path.

The hosted app can generate drafts through `POST /api/draft`, but review, comments, certification, and deeper answer judgment do not have to live in that route on day one. Those can come from Deric's side through RNS/CIVITAE/MO§ES workflows and MCP tools after the app has saved the question, program, draft, answer history, and confidence state.

See `docs/06_rns_integrated_build_path.md` for the build sequence.

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

**Prerequisites**: Supabase project with all 10 migrations applied.

### Local Codex / Cowork connection

This repository can be public on GitHub while the local MCP connection still points at the local compiled server:

```text
/Users/dericmchenry/Desktop/application-hub/application-hub-mcp-server/dist/index.js
```

The `dist/` directory is intentionally ignored and not pushed to GitHub. If Codex, Cowork, Claude Desktop, Cursor, or Windsurf cannot connect after a fresh clone or cleanup, rebuild it locally:

```bash
cd /Users/dericmchenry/Desktop/application-hub/application-hub-mcp-server
npm install
npm run build
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Database | Supabase (PostgreSQL + pgvector) |
| MCP server | TypeScript + `@modelcontextprotocol/sdk` |
| Frontend | Next.js App Router |
| Payments | Stripe (planned) |
| AI drafting | Claude API — Haiku for speed, Sonnet for quality |
| Hosting | Vercel (frontend) + Railway or Fly (MCP HTTP mode) |
| Cron | Supabase pg_cron |

---

## Roadmap

See `ROADMAP.md` for the launch milestones and `TASKS.md` for implementation details. Older duplicate planning docs live in `docs/archive/` so they remain referenceable without clogging the active pipeline.

---

## Contributing

See `CONTRIBUTING.md` — especially the section on adding program seed data, which is the highest-leverage contribution right now.
