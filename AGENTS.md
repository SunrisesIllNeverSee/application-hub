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

# [application-hub] recent context, 2026-05-21 6:09pm EDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 7 obs (2,472t read) | 87,013t work | 97% savings

### May 21, 2026
1 5:42p 🟣 Safari QA Link Capture Installation Guide
2 5:43p ✅ Safari QA Capture Documentation Committed
3 5:44p ✅ Safari QA Capture Documentation Pushed to Remote
5 5:51p 🔵 Extension consolidation complete but runtime-unverified; canonical rebuild branch active
6 6:03p 🔵 Safari tab export script broken after delimiter refactor
7 6:05p 🔴 Safari tab export script line ending parsing bug fixed
8 6:06p ✅ Safari tab export feature committed and pushed to remote

Access 87k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>