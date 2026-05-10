# Scratch — active work in progress

> **Both agents check this BEFORE picking up a task from `TASKS.md`.**
> Claim by appending your line. Release by removing it (or moving to "recently released").
> Stale claims = no commits touching the claimed paths since the claim landed.

---

## For Codex — most recent context

If you're picking up after Cowork's 2026-05-10 session, read these in order:

1. **`AGENTS.md`** — refreshed ownership table, includes new files: ROADMAP.md, VISION.md, SCRATCH.md
2. **`ROADMAP.md`** — canonical priority-ordered list of work. P0 = Drip mechanic, Question Bank UI, **BYOK** (now P0 above /api/draft rate-limiting because user can't subsidize AI calls), `/api/draft` rate-limiting. P1 = home dashboard, stress-testing groundwork, responsive layout (mobile drawer toggle still pending), real deadlines, program TL;DR, user profile split, custom SMTP (your lane). P2/P3 below.
3. **`VISION.md`** — 551-line product vision. Key recent additions: positioning ("infrastructure for the application graph, not an AI writer"), levelling story (novice vs seasoned-funded founder, stress testing levels presentation skill), BYOK as cost reality (Free tier requires user keys, no platform fallback), MoatScore framework status (waiting on user spec), home dashboard mockup, integrations roadmap (4 tiers).
4. **`TASKS.md`** — finer-grained backlog with 16+ smoke-test follow-ups.

What landed since your last commit (`ea820dc`):
- `9d40f5d` — DNA % display + sidebar active-state fixes
- `69f387d` — dev-only password sign-in escape hatch
- `8184a19` — package-lock resync
- `c710d06` — VISION.md created
- `59d686c` — TASKS/STATUS/AGENTS smoke-test capture
- `4e5c7a2` — Question Bank framing refinement
- `6ca8cd4` — SCRATCH.md introduced (this file)
- `bd44b01` — ROADMAP.md introduced + timeline language stripped
- `70089d3` — stress testing, BYOK, MoatScore, home dashboard, integrations captured in VISION
- `24acbc5` — positioning reframe (infrastructure layer, not AI writer; BYOK cost reality)
- `9d83151` — responsive layout sweep verified across mobile/tablet/desktop
- `3e5e7a9` — Codex infra bundle: Resend SMTP guide, `hub_stress_test_answer`, `/api/draft` metering

Open items in your lane (from ROADMAP):
- **Manual SMTP completion** — docs are done; remaining work is Resend domain verification + Supabase dashboard SMTP entry
- **P3 — Heat scores compute job, recruiter agent cron, Stripe webhook handler**
- **Stress-test persistence/scoring** — MCP stub is done; table, quota, UI, BYOK/LLM generation are still future work

Cowork will not touch `app/components/`, `app/app/(app)/`, or `app/app/auth/` while these P1 bugs are in flight (responsive sweep landed; deadlines + program TL;DR + user profile split queued). You're clear to take MCP server, deps, CI, doc-architecture work.

---

---

## Currently claimed

| Agent | Task | Files / paths | Claimed at | Notes |
|---|---|---|---|---|

---

## Recently released

| Codex | Marked cross-theme portability as a core product requirement | `README.md`, `ROADMAP.md`, `TASKS.md`, `VISION.md` | Released 2026-05-10 | Captured the importance of switching between founder, jobs, grants, and school application themes without re-architecting the core spine. |
| Codex | BYOK/policy, deadlines helper, stress persistence, launch checklist, SMTP handoff docs | `migrations/010_launch_hardening.sql`, `docs/09_launch_checklist.md`, `docs/10_byok_and_draft_policy.md`, `docs/11_deadline_seed_handoff.md`, `docs/12_stress_test_persistence.md`, `docs/13_smtp_launch_handoff.md`, `seed/01_deadline_updates_template.sql`, `app/app/api/draft/route.ts` | Released 2026-05-10 | Route now fails closed unless hosted drafts are explicitly enabled; app/MCP checks passed. |
| Codex | Refined launch roadmap/tasks and added archive lane | `ROADMAP.md`, `TASKS.md`, `STATUS.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/archive/` | Released 2026-05-10 | External launch roadmap merged with current repo truth; legacy planning docs archived. |

---

## How to use this file

### When you start a task

Append a row to "Currently claimed" with:
- **Agent**: `Cowork` or `Codex`
- **Task**: short description matching the TASKS.md item
- **Files / paths**: which directories/files you'll touch
- **Claimed at**: ISO timestamp (UTC)
- **Notes**: optional — blockers, expected duration, related issues

Commit the SCRATCH.md change BEFORE starting work. That's the claim.

### When you finish

- Remove your row from "Currently claimed"
- (Optional) Move to "Recently released" with a note pointing at the commit SHA that landed the work
- Commit the SCRATCH.md change with the work itself, or in a follow-up commit

### When you see a conflict

If you want to start a task but someone else has it claimed:
1. Run `git log --since="<claim's claimed at>" -- <their claimed paths>` — if no commits, the claim is stale and you can take it (leave a one-line note in commit message)
2. Otherwise, pick a different task from TASKS.md
3. If the work is genuinely urgent and the other agent's claim has recent commits, leave a note in their row's "Notes" column

### What goes here vs TASKS.md

- **TASKS.md** = the canonical roadmap. Items live there until done.
- **SCRATCH.md** = the working state. Who's doing what RIGHT NOW.

A task lives in TASKS.md whether claimed or not. SCRATCH.md is just the layer on top that says "Cowork is touching `migrations/009` right now, don't grab it."

### Stale claims

We are **nonlinear and temporal** — claims don't expire on a schedule. They're stale when:
- The claiming agent's `git log` shows no commits touching the claimed paths since the claim landed, AND
- The other agent has work to do that needs those paths

When that happens:
- Leave a one-line note: "Reclaimed — original claim had no commits since landing"
- Take the work
- Update the claim row to your name

Don't argue about claims. Just communicate via commit messages.
