# Registry gaps surfaced by `.agents/check.py`

_Snapshot taken 2026-05-11. Run `python3 .agents/check.py` for the current state._

When Phase B (the checker) landed, it surfaced 11 warnings — real inconsistencies between `.agents/registry.yaml`, the filesystem, and `STATUS.md`. These are not new bugs; they're drift the cleanup session left behind. This doc is the punch list so any session can pick up the reconciliation work without auditing from scratch.

## What's drifted (11 warnings, 0 blockers)

| # | Warning | Cause | Fix |
|---|---|---|---|
| 1–7 | Migrations `001`–`007` exist on disk but not in `registry.yaml.migrations.applied` | When `registry.yaml` was hand-rolled during the cleanup pass, only newer migrations were enumerated. The foundational 001–007 chain was applied long before the registry existed. | Append the 7 missing rows to `registry.yaml.migrations.applied` with their actual commit shas (`git log --follow migrations/001_*.sql`). |
| 8 | `027_applicant_modes_and_contributions.sql` on disk but not in registry | Number `027` was reused — `027_recruiter_alerts.sql` IS registered, this second one isn't. Same duplicate-prefix pattern documented in `docs/MIGRATIONS.md`. | Add a second `{ n: 27, file: 027_applicant_modes_and_contributions.sql, ... }` row to the applied list. |
| 9 | `migrations.next=24` but highest applied is `29` (would be `30` once 027b registered) | The `next` field wasn't updated as new migrations landed. | Set `migrations.next: 30` (or whatever the actual next free number is after the registry catches up). |
| 10 | `claim-2026-05-11-002` is released but has no `landed_commits` | Codex's claim was released but the commit shas weren't recorded back. | Add `landed_commits: [<short-sha>, ...]` to that claim entry. `git log --oneline --author=...` or check related commits. |
| 11 | `STATUS.md` migration chain `[26]` doesn't include registry high `029` | `STATUS.md` still says "001–026" but the registry has migrations through 029. | Edit `STATUS.md` to reference the current high-water mark (likely `001–029` or split for duplicate-prefix nuance). |

## Who can fix this

All three files are **Shared** ownership per `AGENTS.md`:

- `.agents/registry.yaml` — coordination/memory layer
- `.agents/claims.yaml` — coordination/memory layer
- `STATUS.md` — canonical planning/state doc

Any session can reconcile, but the protocol is: **claim it first** (file_lane on the three files), do all 11 in one tight commit, release. That way the next claimer doesn't conflict.

## Why this wasn't auto-fixed

`.agents/check.py` is deliberately read-only. A checker that mutates `registry.yaml` invites edit-conflicts with whoever has it open in another session — and silently rewriting another agent's coordination state violates AGENTS.md rule 4 ("Do not 'helpfully' rewrite unrelated files"). Phase D might ship a `--fix` mode that opens a PR with the patch, but that's not landed yet.

## Suggested reconciliation commit

A single claim + commit, scoped tightly. Pseudocode for the claim entry:

```yaml
- id: claim-2026-05-XX-registry-reconcile
  session: <whoever-picks-this-up>
  type: file_lane
  paths:
    - .agents/registry.yaml
    - .agents/claims.yaml
    - STATUS.md
  purpose: reconcile registry/claims/STATUS to match filesystem + Supabase ledger
  acquired_at: <iso>
```

Then the commit:

```
chore(.agents): reconcile registry + STATUS — close 11 check.py warnings

- registry.yaml: add migrations 001-007 + duplicate 027 to applied list
- registry.yaml: bump migrations.next to 30
- claims.yaml: backfill landed_commits on claim-2026-05-11-002
- STATUS.md: update migration chain reference from 001–026 to 001–029

After this, python3 .agents/check.py should exit 0 clean and the
agents-check CI workflow can be flipped to --strict.
```

## How to verify

```bash
python3 .agents/check.py        # should exit 0 — no warnings
python3 .agents/check.py --strict  # also exit 0 — proves CI can flip
```

When both pass, the `agents-check.yml` workflow's main step can change from `python3 .agents/check.py` to `python3 .agents/check.py --strict` and warnings become CI-blockers for future drift.

## Why this matters

These 11 warnings are intentionally not blockers — they're advisory. But every commit a session makes while the warnings exist re-prints them in the pre-commit output, which becomes noise that trains contributors to ignore the checker. Closing them once preserves the signal-to-noise ratio for actual future drift.

The point of Phase C wasn't "make everything perfect today." It was "make drift visible." That's working. This doc converts the visibility into a closable task.
