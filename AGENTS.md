# Application Hub — Agent Coordination

> Read this before touching anything. Both Cowork (Claude) and Codex should read this file at the start of every session.
> Then read `.agents/PROTOCOL.md` for the machine-readable coordination workflow.
> Then check `SCRATCH.md` for active claims before editing.
> Then check `ROADMAP.md` for sequence and `TASKS.md` for implementation detail.
> For factual counts/state, treat `STATUS.md` as the single fact source and link back to it instead of restating counts in multiple places.

---

## What this project is

**Application Hub** is a founder-first application operating system built on a portable application graph.

Publicly, the product starts with founders applying to accelerators, grants, fellowships, and adjacent startup programs.
Under the hood, the same question archive / answer bank / fit / review spine is being kept broad enough to support jobs, school applications, and grants without a ground-up rebuild.

Core asset: a **question archive** plus reusable **answer bank**.

Business model:
- Free: 10 AI drafts/month
- Pro: $19/mo unlimited
- Team: $49/mo shared answer library + multi-seat

Company:
- Ello Cello LLC
- Deric McHenry — deric.mchenry@gmail.com

---

## Architecture

```text
Supabase (PostgreSQL + pgvector)   ← source of truth, project: betcyfbzsgusaghriptz
  ↕
MCP Server (TypeScript)            ← intelligence layer, 21 tools / 7 resources / 3 prompts
  ↕
Next.js app (app/)                 ← live product on Vercel
```

---

## Current phase

**Launch hardening + repo cleanup sync**

The product spine is already live. Current work is:
- polish and QA
- reviewer/agent expansion
- signal-layer iteration
- repo/docs cleanup so all sessions work from the same truth

---

## Current truth

| Component | Status | Notes |
|---|---|---|
| Supabase migrations | ✅ See `STATUS.md` / `.agents/registry.yaml` | Duplicate numeric prefixes exist for parallel-track history; see migration policy docs |
| Program archive | ✅ See `STATUS.md` | Summarize here; keep numeric counts in canonical truth docs |
| Question archive | ✅ See `STATUS.md` | significance + DNA live |
| MCP server | ✅ 21 tools | review persistence + stress-test persistence included |
| Next.js app | ✅ live-data wired | Hub, `/bank`, workspace, profile split, import flows |
| BYOK | ✅ shipped | Anthropic/OpenAI/Ollama/Google path in repo |
| Reviewer family | ✅ starter set shipped | RNS reviewer, fit reviewer, fidelity certifier, stress-test conductor |
| Stripe | ⏳ code-ready | env / dashboard activation still partly manual |

---

## Active ownership defaults

These are defaults, not walls. Shared files are fine when the commit scope is clear.

| Path | Default owner | Notes |
|---|---|---|
| `app/` | **Cowork** | user-facing product surfaces, browser QA, wiring |
| `migrations/` | **Cowork** | schema changes; document duplicate-prefix convention, do not rename applied files casually |
| `seed/` | **Shared** | seed promotion and staging lane both active now |
| `application-hub-mcp-server/src/` | **Shared** | coordinate through commit messages |
| `application-hub-mcp-server/package.json` | **Shared** | may change from MCP or eval work |
| `.github/workflows/` | **Codex** | CI/CD |
| `README.md` | **Shared** | public-facing repo surface |
| `ROADMAP.md`, `TASKS.md`, `STATUS.md` | **Shared** | canonical planning/state docs |
| `CLAUDE.md`, `AGENTS.md`, `SCRATCH.md` | **Shared** | coordination/memory layer |
| `VISION.md` | **Shared** | product thesis and portability story |
| `docs/` | **Shared** | active operational docs + archive policy |

If a shared file is touched, keep the commit tight and explicit.

---

## Coordination rules

1. **Read `SCRATCH.md` first.**
2. **Pull before starting.**
3. **Prefer small commits with clear scope.**
4. **Do not “helpfully” rewrite unrelated files.**
5. **If a file is already in flight, either avoid it or make the overlap explicit in the commit message.**
6. **Before writing a migration, claim the next migration number in `SCRATCH.md`.**
7. **Prefer `.agents/registry.yaml` and `.agents/claims.yaml` for machine-readable state and claims.**

Cross-workspace session state belongs in:
- `~/Desktop/MULTI_CLAUDE.md`

Repo-local active claims belong in:
- `SCRATCH.md`

Cold-start note:
- if a session lands without desktop context, tell it that cross-workspace coordination lives at `~/Desktop/MULTI_CLAUDE.md` on the operator machine and ask for it if needed

Fact-source rule:
- `STATUS.md` is the canonical source for counts, migration chain, shipped features, and current remote truth
- `README.md`, `AGENTS.md`, and `CLAUDE.md` should summarize and link, not maintain their own competing fact tables unless there is a good reason
- `.agents/registry.yaml` is the machine-readable truth ledger that future tooling can validate against

Review-gate rule:
- use a review gate when a change crosses repo docs + desktop coordination + README/public framing + active memory at the same time
- do not require a multi-reviewer gate for small archive-only or single-doc cleanup passes

Protocol files:
- `.agents/registry.yaml` — machine-readable truth ledger
- `.agents/claims.yaml` — machine-readable session/claim ledger
- `.agents/PROTOCOL.md` — procedure for sessions

---

## Important live facts

- Site: `https://mos2es.xyz`
- Supabase project: `betcyfbzsgusaghriptz`
- MCP server local rebuild path:
  - `/Users/dericmchenry/Desktop/application-hub/application-hub-mcp-server/dist/index.js`
- App builds currently use:
  - `cd app && npm run type-check`
  - `cd app && npm run build`
- MCP verification uses:
  - `cd application-hub-mcp-server && npm run check`

---

## Do not do these things

- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code.
- Do not rename already-applied migration files lightly.
- Do not treat Firecrawl output as production truth without review.
- Do not let founder-first copy harden the underlying architecture into founder-only assumptions.
- Do not auto-submit applications; this is still a preparation and intelligence layer.


<claude-mem-context>
# Memory Context

# [application-hub] recent context, 2026-05-27 7:49am EDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (19,282t read) | 405,479t work | 95% savings

### May 21, 2026
7 6:05p 🔴 Safari tab export script line ending parsing bug fixed
8 6:06p ✅ Safari tab export feature committed and pushed to remote
9 6:09p ✅ Safari tab export script verified working after fix deployment
### May 22, 2026
105 12:11p ⚖️ Multi-level loop architecture for project management
106 12:12p 🔵 Pre-commit validation hook with strict mode enforcement
107 12:16p 🔵 Claude Code historical usage data preserved in ccusage tool
108 12:17p 🔵 May 2026 API usage shows $2,102 spending with peak days exceeding $230
109 12:18p 🔵 Model-level cost breakdown reveals Opus-4-6 sessions driving $11-14 per session
112 1:26p 🔵 Groq free-tier TPM limit blocks Hermes agent initialization
### May 23, 2026
145 4:21p 🔵 User exploring Claude API prompt caching feature
146 " 🔵 Claude-mem configuration reviewed showing infrastructure and provider settings
### May 24, 2026
337 9:47a 🔵 AQUA parallel vertical intake pipeline architecture documented
338 9:48a 🔵 Application Hub current production architecture with MCP server and archive scale
339 9:55a ⚖️ Layered development strategy for application-hub core system
341 10:37a 🔵 Application hub data entry points identified in API layer
342 10:38a 🔵 Application hub implements multi-channel data ingestion architecture with BYOK AI extraction
343 10:39a 🔵 Import queue evolved from simple question mapper to multi-domain submission system with staged workflow
348 10:50a 🟣 Manual intake review gate API with checkpoint-based approvals
349 10:52a 🟣 Manual intake workbench UI with checkpoint review controls
350 " ✅ Profile import page wired to new AQUA 7-layer intake workbench
352 " 🔵 Migration 047_manual_intake_workflow.sql pending registration in agent coordination protocol
353 " 🔵 Six TypeScript compilation errors in manual intake implementation
354 10:53a 🔴 TypeScript compilation errors resolved with type annotations and guards
355 " ✅ Migration 047 registered in agent coordination protocol
356 10:54a 🔵 Production build succeeds with manual intake workflow integrated
357 " 🔵 Manual intake workflow implementation spans 10 files with three new untracked directories
382 1:08p 🔵 qaapplication folder structure uses consistent slug-based naming across five parallel layers
383 1:09p 🟣 Created canonical serialization specification for qaapplication workspace with stable reference IDs
384 1:10p ✅ Updated qaapplication documentation to reference new serialization spec and serial ref conventions
385 " ✅ Added serialization lane identification to questions and answers folder READMEs
389 1:26p 🔵 Field benchmark raw data structure identified in Artificial Analysis scrape
390 1:28p 🔵 Artificial Analysis page renders benchmark data without HTML tables
391 1:29p 🔵 Complete token distribution data extracted from live Artificial Analysis page
392 " 🔵 SVG text elements contain all benchmark chart data with 328 extractable values
393 1:30p 🔵 Token distribution data structure parsed with 13 agents and three value rows
394 1:34p 🔵 Git worktree deleted causing data loss
S901 Strategy for continuing benchmark review conversation without cache overhead and extracting token data via Codex (May 24 at 1:34 PM)
### May 25, 2026
S906 User requested prompt templates for analyzing MO§ES™ benchmark session data (May 8-14) and extracting Codex usage statistics (May 25 at 1:50 AM)
S916 Extract Codex usage statistics for May 8-14 benchmark build period after data loss event (May 25 at 2:08 AM)
524 2:21a 🔵 Codex usage data shows daily aggregates but no session-level records for May 8-14 window
526 2:22a 🔵 Codex session data found after correcting query field from 'id' to 'directory'
S920 Extract Codex 5-kernel usage statistics for May 8-14 benchmark period after data loss event (May 25 at 2:22 AM)
S925 Re-analyze Codex usage statistics for May 8-14 benchmark period with corrected token label mapping (Codex input/output are inverted vs Claude) (May 25 at 2:28 AM)
532 2:36a 🔵 Token usage chart reading convention clarified for Codex vs Claude
S926 Explain the practical meaning of Codex's corrected 5-kernel metrics and how the two-engine architecture (Claude Code + Codex) functioned during May 8-14 benchmark build (May 25 at 2:37 AM)
S928 Display raw Codex daily and per-session usage data for May 8-14 with corrected label mapping for user verification before export (May 25 at 2:39 AM)
534 2:42a 🔵 Codex May 8-14 window shows 4 active days with 70% cost concentration in single May 9 multi-model session
S941 Recover benchmark data after data loss by extracting ccusage statistics and creating canonical truth files for May 8-14, 2026 benchmark period (May 25 at 2:43 AM)
535 2:51a 🔵 Claude Code usage statistics extracted for May 8-14 benchmark period
537 2:52a 🔵 Benchmark data discrepancy: fresh ccusage shows 21% higher cache reads than locked poster numbers
538 2:53a ✅ Codex raw benchmark numbers documented for May 8-14 period
539 " ✅ Claude Code MO§ES raw benchmark numbers documented with canonical JSONL extract methodology
540 2:54a ✅ Combined two-engine benchmark truth file created showing Claude-Codex complementary roles
S1164 User requested location of commitment kernel demo v7 file for sharing with external recipient (May 25 at 2:55 AM)
### May 26, 2026
S1165 User requested location of commitment kernel demo v7 file for external sharing (May 26 at 3:24 AM)
### May 27, 2026
941 7:45a 🔐 Postgres SECURITY DEFINER view bypasses RLS in public schema
943 7:46a 🔵 program_next_cycle view created without security_invoker flag in migration 039
944 " 🔴 program_next_cycle view fixed with security_invoker flag
945 7:47a ✅ Migration 048 validated by agent coordination consistency check
946 " ✅ Migration 048 security fix committed to repository

Access 405k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
