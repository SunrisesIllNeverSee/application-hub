---
type: Reference
title: Start Here
description: Start Here — documentation in docs/.
tags: [documentation, docs]
timestamp: 2026-08-19
---

# Start Here

> Read this first. Every session. Every agent. It's short on purpose.

---

## What this project is

**Application Hub** (`mos2es.xyz`) — a platform that helps founders (and eventually job seekers, students, researchers) apply to accelerators, grants, fellowships, and programs.

Core asset: a **question archive** + reusable **answer bank**. Answer once, apply everywhere.

**Company**: Ello Cello LLC — Deric McHenry (deric.mchenry@gmail.com)

---

## The four active sessions

| Session | Surface | Lane |
|---|---|---|
| **Cowork** (Claude Code Desktop) | `application-hub/` | App, migrations, docs |
| **Codex** (Codex Desktop) | `application-hub/` | MCP server, CI, coordination layer |
| **VS Code Claude** | `application-hub/` | Repo-wide features and review |
| **VS Code Claude (MCP)** | `~/Desktop/mcp_eval/` | MCP server evaluation |

---

## Before you touch anything

```bash
# 1. Pull latest
git pull

# 2. Verify the build
cd app && npm run type-check && npm run build
cd ../application-hub-mcp-server && npm run check && npm test
```

The multi-agent coordination protocol (`.agents/`, pre-commit hook, `check.py`)
has been archived to `docs/archive/build-era/agents/`. It was build-era
scaffolding for parallel Cowork/Codex/VSCode-Claude sessions and is no longer
active. See `REPO_INDEX.md` for the current repo map.

---

## Before writing a migration

1. Check the current high-water mark in `docs/STATUS.md` or `docs/archive/build-era/agents/registry.yaml`
2. Create the file in `supabase/migrations/` (NOT the legacy `migrations/` root — that's archived)
3. Run `supabase db push` to apply it to production
4. Update `docs/STATUS.md` with the new high-water mark


**Migration home:** `supabase/migrations/` is the canonical location. The old `migrations/` root folder is archived at `docs/archive/build-era/migrations/`.

---

## Where things live

| What | Where |
|---|---|
| Repo map | `REPO_INDEX.md` (root) |
| Current roadmap | `docs/ROADMAP.md` |
| Confirmed live state | `docs/STATUS.md` |
| Migration chain | `supabase/migrations/` + `docs/STATUS.md` |
| All feature docs | `docs/` |
| Archived coordination | `docs/archive/build-era/agents/` |
| Cross-session bus | `~/Desktop/MULTI_CLAUDE.md` (operator machine) |

---

## Key facts

Counts, migration chain, and shipped-state facts live in `docs/STATUS.md` (human-readable). The machine-readable registry is archived at `docs/archive/build-era/agents/registry.yaml`. This file intentionally restates none of them.

---

## Do not

- Expose `SUPABASE_SERVICE_ROLE_KEY` in any frontend code
- Rename already-applied migration files
- Auto-submit applications — this is a preparation layer
- Write a migration without claiming the number first
- Touch `user_program_fit` or `archived_questions.embedding` without noting it in your claim

---

*For full context: `docs/archive/build-era/CLAUDE.md` (project) · `AGENTS.md` (coordination) · `docs/VISION.md` (product thesis)*
