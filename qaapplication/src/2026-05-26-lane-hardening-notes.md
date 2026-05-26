# 2026-05-26 — QAApplication Lane Hardening Notes

## What changed

- Migrated the active drafting lane from `06-workshop/` to `08-apply/`.
- Split submitted material out of `07-answers/` into a dedicated
  `09-submitted/` lane:
  - `09-submitted/archive/` — paired Q+A per submitted program
  - `09-submitted/archived_applications/` — fuller filled-record snapshots
- Reduced `07-answers/` to the compounding answer-bank role:
  - `07-answers/index/`
- Rewrote the live docs/spec references to match the new lane model.
- Added `qaapplication` lane-parity enforcement to `.agents/check.py`.

## Why

The repo workflow now reads in the intended order:

```text
answers → apply → submitted
```

This makes the filesystem itself teach the workflow:

- `07-answers/` = reusable knowledge bank
- `08-apply/` = active application assembly
- `09-submitted/` = immutable submission record

## Enforcement

`.agents/check.py` now validates:

- active `08-apply` slugs have matching `03-programs/` and
  `05-questions/source/`
- submitted slugs line up across:
  - `03-programs/`
  - `04-applications/`
  - `05-questions/source/`
  - `09-submitted/archive/`
  - `09-submitted/archived_applications/`

## Companion backfills added

To keep the new parity rule green, placeholder or companion records were
added for active apply / submitted paths that were missing:

- `03-programs/redbud.md`
- `03-programs/founding500.md`
- `03-programs/yc.md`
- `03-programs/cohort-5.md`
- `05-questions/source/redbud.md`
- `05-questions/source/founding500.md`
- `05-questions/source/yc.md`
- `05-questions/source/cohort-5.md`
- `04-applications/yc.md`
- `09-submitted/archived_applications/yc.md`

## Verification

- `python3 .agents/check.py` — passes
- `python3 .agents/check.py --strict` — passes
- `git diff --check` — clean for the touched files
