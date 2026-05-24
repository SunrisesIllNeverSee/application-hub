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
| Supabase migrations | ✅ Through `026` | Duplicate numeric prefixes exist for parallel-track history; see migration policy docs |
| Program archive | ✅ 842 programs | 30 manually seeded + large imported archive |
| Question archive | ✅ 225 scored questions | significance + DNA live |
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

# [application-hub] recent context, 2026-05-24 1:16pm EDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 35 obs (13,145t read) | 321,410t work | 96% savings

### May 21, 2026
1 5:42p 🟣 Safari QA Link Capture Installation Guide
2 5:43p ✅ Safari QA Capture Documentation Committed
3 5:44p ✅ Safari QA Capture Documentation Pushed to Remote
5 5:51p 🔵 Extension consolidation complete but runtime-unverified; canonical rebuild branch active
6 6:03p 🔵 Safari tab export script broken after delimiter refactor
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
S171 Discovered built-in project exclusion setting in claude-mem to prevent future Hermes observation overhead (May 22 at 1:54 PM)
S228 User asked about prompt caching documentation relevance and verified Hermes project exclusion status in claude-mem (May 22 at 1:55 PM)
### May 23, 2026
145 4:21p 🔵 User exploring Claude API prompt caching feature
146 " 🔵 Claude-mem configuration reviewed showing infrastructure and provider settings
S603 User requested to examine mos2es.com/benchmarks and review the "honest take" benchmark analysis (May 23 at 4:22 PM)
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
S605 User requested to examine mos2es.com/benchmarks website and review the "honest take" benchmark analysis and comparison data (May 24 at 12:54 PM)
S607 Review mos2es.com/benchmarks website and analyze the "honest take" benchmark comparison data showing MO§ES vs field average across five measured economic kernels (May 24 at 12:56 PM)
S610 Examine LOC (Lines of Code) breakdown for the 35,242 lines shipped during the MO§ES benchmark measurement window (May 8–14, 2026) (May 24 at 12:56 PM)
S624 User requested field average metrics across benchmark models from the MO§ES benchmark data (May 24 at 12:58 PM)
S625 User requested individual model performance metrics breakdown from the benchmark visualization poster (May 24 at 1:08 PM)
382 1:08p 🔵 qaapplication folder structure uses consistent slug-based naming across five parallel layers
383 1:09p 🟣 Created canonical serialization specification for qaapplication workspace with stable reference IDs
384 1:10p ✅ Updated qaapplication documentation to reference new serialization spec and serial ref conventions
385 " ✅ Added serialization lane identification to questions and answers folder READMEs
S626 User reviewed consolidated poster average metrics summary table from 13-model benchmark subset (May 24 at 1:10 PM)
S627 User reviewed field average raw token breakdown from portrait poster showing detailed consumption across token categories (May 24 at 1:13 PM)
**Investigated**: Raw token consumption breakdown from portrait poster detailing input tokens, output tokens, cache create tokens, and cache read tokens across the benchmark measurement period

**Learned**: Field average token distribution documented: 274M input tokens, 29.2M output tokens (9.6% of input), 35M cache create tokens, 3.59B cache read tokens (13.1× total non-cache tokens) totaling 7.51B tokens across 1,465 tasks spanning ~7,325 turns producing ~29,300 lines of code. Cache read volume represents 47.8% of total token consumption, demonstrating prompt caching as dominant architectural pattern. Task-level averages: 187K input, 19.9K output, 23.9K cache create, 2.45M cache read per task; turn-level averages: ~5 turns per task

**Completed**: Field average raw token breakdown documented, completing the metric hierarchy with both high-level performance indicators (cache hit rate, output:input ratio, time, cost) and underlying token consumption mechanics now fully extracted from benchmark visualizations

**Next Steps**: Primary session has complete benchmark dataset spanning performance metrics, cost metrics, and raw token breakdowns available for continued analysis or comparative work


Access 321k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>