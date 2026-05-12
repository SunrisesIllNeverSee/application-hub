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

## Key facts (check `STATUS.md` for full detail)

- **Live site**: https://mos2es.xyz
- **Supabase project**: `betcyfbzsgusaghriptz`
- **Migrations applied**: 001–031
- **Programs**: 843 (31 with mapped questions, 812 shells)
- **Questions**: 225 archived, 0 embeddings seeded yet
- **Stripe**: fully live
- **BYOK**: Anthropic / OpenAI / Ollama — all working

---

## Do not

- Expose `SUPABASE_SERVICE_ROLE_KEY` in any frontend code
- Rename already-applied migration files
- Auto-submit applications — this is a preparation layer
- Write a migration without claiming the number first
- Touch `user_program_fit` or `archived_questions.embedding` without noting it in your claim

---

## Seed embeddings (one-time, not done yet)

```bash
# Requires Ollama running with nomic-embed-text pulled
ollama pull nomic-embed-text
SUPABASE_URL="https://betcyfbzsgusaghriptz.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service role key from Supabase dashboard>" \
npx tsx scripts/seed-question-embeddings.ts
```

---

*For full context: `CLAUDE.md` (project) · `AGENTS.md` (coordination) · `VISION.md` (product thesis)*
