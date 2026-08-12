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

# 2. Install the coordination hook (once per clone, strict mode)
.agents/install-hook.sh --strict

# 3. Verify registry is clean
python3 .agents/check.py
```

If `check.py` returns warnings, fix them before committing. Warnings now block both local commits and CI.

---

## Before writing a migration

1. Check `migrations.next` in `.agents/registry.yaml`
2. Claim that number in `.agents/claims.yaml` **before** writing SQL
3. Create the file in `supabase/migrations/` (NOT the legacy `migrations/` root)
4. Run `supabase db push` to apply it to production
5. Update `migrations.next` in the registry and release your claim


**Do not skip step 2.** The 027 collision happened because two sessions both claimed the same number without checking first.

**Migration home has moved**: `supabase/migrations/` is the canonical location. The CLI is linked (`supabase db push --dry-run` returns "Remote database is up to date"). The old `migrations/` root folder is the legacy location — new files must go in `supabase/migrations/`.

---

## Where things live

| What | Where |
|---|---|
| Task list | `TASKS.md` |
| Current roadmap | `ROADMAP.md` |
| Confirmed live state | `STATUS.md` |
| Machine-readable truth | `.agents/registry.yaml` |
| Active claims | `.agents/claims.yaml` |
| Coordination protocol | `.agents/PROTOCOL.md` |
| Active work / claims | `SCRATCH.md` |
| Cross-session bus | `~/Desktop/MULTI_CLAUDE.md` |
| All feature docs | `docs/` |

---

## Key facts

Counts, migration chain, and shipped-state facts live in `.agents/registry.yaml` (machine-readable) and `STATUS.md` (human-readable). This file intentionally restates none of them.

---

## Do not

- Expose `SUPABASE_SERVICE_ROLE_KEY` in any frontend code
- Rename already-applied migration files
- Auto-submit applications — this is a preparation layer
- Write a migration without claiming the number first
- Touch `user_program_fit` or `archived_questions.embedding` without noting it in your claim

---

*For full context: `CLAUDE.md` (project) · `AGENTS.md` (coordination) · `VISION.md` (product thesis)*
