# Scratch — active work in progress

> **Both agents check this BEFORE picking up a task from `TASKS.md`.**
> Claim by appending your line. Release by removing it (or moving to "recently released").
> Stale claims = no commits touching the claimed paths since the claim landed.

---

## For Codex — most recent context

_Updated 2026-05-10 after BYOK, Question Bank, and sidebar work landed._

If you're picking up after the recent launch hardening burst, read these in order:

1. **`AGENTS.md`** — refreshed ownership table and current launch framing
2. **`STATUS.md`** — shortest source of truth for what is actually shipped now
3. **`ROADMAP.md`** — what is left after MVP pieces landed
4. **`TASKS.md`** — concrete remaining bugs and polish items

### Open items in your lane (current priorities)

- **Live BYOK draft verification** — verify `/profile/integrations` → save real Anthropic key → workspace Draft with AI → `ai_draft_runs.integration_type = byok_anthropic`
- **Heat scores + applicant counts** — still 0 across the directory; synthetic compute or seeded fallback needed
- **Copy button on answer boxes** — subtle but high-value founder UX
- **OTP 6-digit login path** — support code-entry flow in addition to magic-link click
- **Docs / architecture hygiene** — keep coordination files aligned as launch state changes

Recent product work already landed:
- Question Bank `/bank`
- Drip mechanic via `user_question_unlocks`
- Profile split (`about`, `answers`, `settings`, `integrations`)
- BYOK key storage and `/api/integrations`
- Sidebar IA redesign
- Workspace index using `user_applications`

---

---

## Currently claimed

| Agent | Task | Files / paths | Claimed at | Notes |
|---|---|---|---|---|

---

## Recently released

| Codex | Stabilized coordination/docs after Milestone 2-3 changes | `SCRATCH.md`, `TASKS.md`, `STATUS.md`, `ROADMAP.md`, `README.md`, `AGENTS.md`, `CLAUDE.md` | Released 2026-05-10 | Synced docs to latest shipped BYOK, Question Bank, sidebar, profile split, and workspace state. |
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
