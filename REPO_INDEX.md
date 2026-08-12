# Repo Index — application-hub

> Single navigational map of the repository. Start here when you land cold.
> Last updated: 2026-08-12. Update this file whenever you move or add a top-level directory.

---

## Quick orientation

**What this is:** Application Hub (`mos2es.xyz`) — founder-first application infrastructure. Question archive + reusable answer bank + fit/review spine. Built on Supabase + Next.js + MCP server.

**Company:** Ello Cello LLC — Deric McHenry

**Live surfaces:**
- Web app: `mos2es.xyz` (Vercel)
- MCP server: 21 tools, stdio, local
- Supabase project: `betcyfbzsgusaghriptz`

**Build/verify commands:**
- `cd app && npm run type-check` — TypeScript
- `cd app && npm run build` — Next.js production build
- `cd application-hub-mcp-server && npm run check` — MCP typecheck + build
- `cd application-hub-mcp-server && npm test` — MCP vitest suite

---

## Top-level layout

| Path | Purpose | Status |
|---|---|---|
| `app/` | Next.js 14 web app — the live product | Active |
| `application-hub-mcp-server/` | TypeScript MCP server — 21 tools, stdio | Active |
| `appfeeder/` | Browser extension (Appfeeder) — captures answers from form fields | Active |
| `webextension/` | Older web extension surface | Active |
| `qaapplication/` | Operator's real application corpus — the data the pound-out loop loads | Active (8.6MB, 326 files) |
| `supabase/` | Supabase project config + migrations + edge functions | Active |
| `seed/` | Seed SQL + program seed files (150 programs) | Active |
| `scripts/` | Operator tooling — corpus loader, embedders, scrapers | Active |
| `docs/` | Numbered design docs + ADRs + reviews + archive | Active |
| `.github/` | CI workflows (`ci.yml`, `agents-check.yml`) + issue templates | Active |
| `migrations/` | **Legacy** — root migration dir, abandoned for `supabase/migrations/` | Archive candidate |
| `codex/` | **Build-era** — raw LLM dumps, scratch notes | Archive candidate |
| `REBUILD/` | **Build-era** — ChatGPT reviews, brainstorm docs | Archive candidate |
| `inbox/` | **Stale** — Safari tab export from 2026-05-21 | Archive candidate |
| `.planning/codebase/` | **Build-era** — codebase analysis (ARCHITECTURE/CONCERNS/etc.) | Archive candidate |
| `.agents/` | **Stale** — multi-agent coordination protocol (registry, claims, check.py) | Archive candidate |
| `.claude/` `.codex/` | Tool-local agent config dirs | Archive candidate |

---

## Root markdown files

| File | Purpose | Disposition |
|---|---|---|
| `README.md` | Public repo face — badges, what it does, quickstart | **Keep at root** |
| `CONTRIBUTING.md` | Public contributor guide — program/question enrichment | **Keep at root** |
| `AGENTS.md` | Multi-agent coordination protocol — references `.agents/` | Archive with `.agents/` (Phase 4) |
| `REPO_INDEX.md` | This file — the navigational map | **Keep at root** |
| `VISION.md` | Product vision — north star, positioning, landscape | Move to `docs/` |
| `ROADMAP.md` | Sequence + milestones | Move to `docs/` |
| `STATUS.md` | Canonical shipped-state truth (counts, migration chain) | Move to `docs/` |
| `REPAIR_PLAN.md` | Repo rehabilitation runbook (Phase 1–8, all complete) | Move to `docs/` |
| `START_HERE.md` | Cold-start pointer doc | Move to `docs/` |
| `ARCHIVE_NOTES.md` | Frozen 2026-05-14 — closes out "first build" | Archive |
| `TASKS.md` | Build-era task ledger — last real entry 2026-08-12 (shipped) | Archive |
| `SCRATCH.md` | Active claims section is empty; protocol retired | Archive |
| `CLAUDE.md` | Build-era Claude-specific instructions | Archive |

---

## `app/` — Next.js web app

| Path | Purpose |
|---|---|
| `app/app/` | Next.js App Router — pages + route handlers |
| `app/app/(app)/` | Authenticated app routes (workspace, profile, bank, etc.) |
| `app/app/api/` | API route handlers |
| `app/app/api/applications/intake/` | **Pound-out step 1** — one-call application intake |
| `app/app/api/applications/[id]/fill/` | **Pound-out step 2** — bank fill (direct/borrow/gap) |
| `app/app/api/answers/capture/` | Appfeeder extension → answer version capture |
| `app/app/api/import/paste/` | Paste-import flow (AI + regex fallback) |
| `app/app/api/match-question/` | Vector match against archived questions |
| `app/components/` | React components (39 files) — IntakeForm, StressTestPanel, etc. |
| `app/lib/` | Shared libs (13 files) — **`intake-extract.ts`**, **`embed.ts`**, supabase clients, encryption |
| `app/lib/intake-extract.ts` | **Shared extraction/find-or-create/program helpers** — used by 4 routes + corpus loader |
| `app/lib/embed.ts` | **Shared 768d embedding helper** — Ollama-first, OpenAI gated behind `ALLOW_OPENAI_EMBED_FALLBACK=1` |
| `app/lib/database.types.ts` | Supabase generated types |
| `app/lib/supabase/server.ts` | Server client factory (cookie auth) |
| `app/lib/verify-jwt.ts` | Local JWKS verification fallback for ES256 tokens (in-flight) |

---

## `application-hub-mcp-server/` — MCP server

| Path | Purpose |
|---|---|
| `src/index.ts` | Server entry — registers all tools |
| `src/services/supabase.ts` | Service-role + user-scoped clients |
| `src/services/embed.ts` | **Embedding helper (MCP copy — drift risk vs `app/lib/embed.ts`)** |
| `src/services/auth.ts` | `validateUserToken` — JWT verification |
| `src/services/cache.ts` `rate_limit.ts` | Infra |
| `src/tools/intelligence/` | Intelligence tools (acceptance stats, etc.) |
| `src/tools/user/` | 18 user-facing tools including the pound-out trio: |
| `src/tools/user/hub_intake_application.ts` | **Pound-out step 1 (MCP)** — intake via stdio |
| `src/tools/user/hub_fill_application.ts` | **Pound-out step 2 (MCP)** — bank fill |
| `src/tools/user/hub_search_answer_bank.ts` | **Answer bank search** — vector + FTS fallback |
| `src/constants.ts` | `CHARACTER_LIMIT`, `ResponseFormat` enum |

---

## `supabase/` — Database layer

| Path | Purpose |
|---|---|
| `supabase/migrations/` | **Canonical migration chain** — 48 files (001–048), next = 049 |
| `supabase/functions/` | Edge functions — `canonical-hub`, `deadline-alerts`, `recruiter-agent`, `smart-matcher` |
| `supabase/config.toml` | Supabase project config |

**Migration high-water mark:** 048 applied. Registry: `.agents/registry.yaml` (will move with `.agents/` archive).

**Key schema facts:**
- `archived_questions.embedding` — `vector(768)`, seeded with `nomic-embed-text`
- `profile_answers` — `UNIQUE (user_id, archived_question_id)`, versioning via UPDATE + trigger to `profile_answer_history`
- `app_import_sessions.status` — CHECK constraint: `'pending'/'processing'/'complete'/'failed'` (NOT `'completed'`)
- `match_archived_questions(vector(768), float, int)` — pgvector cosine similarity RPC

---

## `qaapplication/` — Operator corpus

The real application data the pound-out loop loads. 8-lane structure:

| Lane | Purpose |
|---|---|
| `01-inbox/` | Raw incoming material |
| `02-processing/` | In-flight |
| `03-programs/` | Per-program material (31 entries) |
| `04-applications/` | Per-application material (31 entries) |
| `05-questions/` | Question source material (16 in `source/`) |
| `06-answers/canonical/` | **Confidence: `solid`** — canonical answers |
| `07-apply/` | **Confidence: `draft`** — working drafts (22 entries) |
| `08-submitted/` | **Confidence: `locked`** — actually submitted |
| `src/` | Multi-claude substrate docs, integrations |
| `snapshots/` | Recovered pre-8-lane snapshots |

Loaded by `scripts/import-qaapplication-corpus.ts`.

---

## `docs/` — Documentation

| Subpath | Purpose |
|---|---|
| `01_`–`31_` | Numbered design/handoff docs (31 files) — chronological |
| `31_poundout_loop.md` | **Current operator guide** — the pound-out loop |
| `adr/` | Architecture Decision Records (`ADR-001-portability.md`) |
| `reviews/2026-08-11-aqua-wolfram/` | Wolfram structural review (14 files) |
| `archive/` | Closed-out docs — build plans, legacy roadmaps, session notes |
| `ARCHITECTURE.md` `SECURITY.md` `MIGRATIONS.md` `BYOK_OLLAMA.md` `STRIPE_SETUP.md` `BETA_MODE.md` `CANONICAL_HUB.md` `BROWSER_EXTENSION.md` | Reference docs |
| `SESSION_STATE_2026-05-11.md` `MILESTONE_2026-05-11.md` `AFTER_LAUNCH.md` `CANONICAL_RESET_RECIPE.md` `SECURITY_AUDIT_BETA.md` | Milestone/session snapshots |

---

## `scripts/` — Operator tooling

| File | Purpose |
|---|---|
| `import-qaapplication-corpus.ts` | **Corpus loader** — loads qaapplication/ into the bank (dry-run default, `--write` to apply) |
| `seed-question-embeddings.ts` | Backfill embeddings for un-embedded archived questions |
| `scrape-apply-questions.ts` `.py` | Application question scraper |
| `parse_fundingcake.py` | FundingCake parser |
| `build_active_applications.py` | Active applications CSV builder |
| `aggregate-question-frequency.py` | Question frequency aggregator |
| `export-open-tabs.mjs` | Safari tabs exporter |
| `local-extension-agent.mjs` | Local extension agent |
| `indexnow-ping.sh` | IndexNow SEO pinger |
| `*.csv` `*.json` | Data files (fundingcake programs, active applications) |

---

## `seed/` — Seed data

| Path | Purpose |
|---|---|
| `seed/000_baseline.sql` | Baseline seed |
| `seed/00_run_all.sql` | Run-all entrypoint |
| `seed/01_deadline_updates_template.sql` | Deadline template |
| `seed/programs/` | 150 per-program seed SQL files |
| `seed/staging/` | Staging lane seed |

---

## Archive candidates (proposed `docs/archive/build-era/`)

These are build-era or stale materials. Nothing deletes — all move to `docs/archive/build-era/` with original structure preserved.

| Source | Files | Why archive |
|---|---|---|
| `migrations/` (root) | 4 | Abandoned for `supabase/migrations/`. 2 byte-identical dupes, 2 number-collisions never applied. Documented in `docs/MIGRATIONS.md`. |
| `codex/` | 14 | Build-era raw LLM dumps (`Grokraw.md` 93KB, `raw.md` 22KB), scratch notes |
| `REBUILD/` | 13 | Build-era ChatGPT reviews (91KB), brainstorm docs |
| `inbox/` | 3 | Stale Safari tab export from 2026-05-21 |
| `.planning/codebase/` | 7 | Build-era codebase analysis (ARCHITECTURE/CONCERNS/CONVENTIONS/INTEGRATIONS/STACK/STRUCTURE/TESTING) |
| `.agents/` | 9 | Multi-agent coordination protocol — all sessions `status: wrapped`, no active claims |
| `.claude/` `.codex/` | 2 dirs | Tool-local agent config, empty except config |
| `AGENTS.md` | 1 | Coordination protocol doc — references `.agents/` |
| `ARCHIVE_NOTES.md` | 1 | Frozen 2026-05-14 closeout |
| `TASKS.md` | 1 | Build-era task ledger |
| `SCRATCH.md` | 1 | Empty active claims; protocol retired |
| `CLAUDE.md` | 1 | Build-era Claude-specific instructions |
| `.github/workflows/agents-check.yml` | 1 | CI job running `.agents/check.py` — dead if `.agents/` archives |

**Total: ~57 files archived, 0 deleted.**

---

## How to use this index

1. **Cold start?** Read `README.md` (public face) → this file (map) → `docs/31_poundout_loop.md` (current operator flow).
2. **Looking for a doc?** Check `docs/` numbered files first, then `docs/archive/` for older material.
3. **Looking for code?** `app/` for web, `application-hub-mcp-server/` for MCP, `appfeeder/`/`webextension/` for browser surfaces.
4. **Looking for data?** `qaapplication/` for operator corpus, `seed/` for program seeds, `supabase/migrations/` for schema.
5. **Looking for build-era context?** `docs/archive/build-era/` after reorg — everything preserved, nothing deleted.

---

## Maintenance

Update this file when:
- A top-level directory is added, moved, or archived
- A major subsystem lands (new tool family, new surface)
- The migration high-water mark advances
- The live surfaces change (new deployment target, etc.)

This is the one root-level doc that earns its place permanently.
