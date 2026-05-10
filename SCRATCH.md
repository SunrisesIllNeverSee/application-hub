# Scratch — active work in progress

> **Both agents check this BEFORE picking up a task from `TASKS.md`.**
> Claim by appending your line. Release by removing it (or moving to "recently released").
> Stale claims (>24h with no commits) get auto-pruned.

---

## Currently claimed

| Agent | Task | Files / paths | Claimed at | Notes |
|---|---|---|---|---|

---

## Recently released (last 24h)

_(empty)_

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
1. Check the claim's "Claimed at" — if it's >24h old, ping in commit message and reclaim
2. Otherwise, pick a different task from TASKS.md
3. If the work is genuinely urgent and the other agent's claim is recent, leave a note in their row's "Notes" column

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
