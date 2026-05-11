# Application Hub Archive

This folder holds completed, superseded, duplicate, exploratory, or time-bound docs that still have reference value.

## What stays active

The active planning / coordination lane is:
- `README.md`
- `ROADMAP.md`
- `TASKS.md`
- `STATUS.md`
- `VISION.md`
- `SCRATCH.md`
- `AGENTS.md`
- `CLAUDE.md`

Active operational docs stay in `docs/` when they are still used by ongoing work, setup, or product operation.

## Archive instead of delete

Archive a file when it is:
- superseded by a newer canonical doc
- a dated session snapshot
- a milestone recap that is no longer the current one
- a duplicate planning/spec artifact
- a stale static reference replaced by the live product

Do not archive a file just because it is long. Archive it when it is no longer a source of current direction.

## Naming rules

- keep descriptive names
- prefer suffixes like `_legacy`, `_snapshot`, or a date when helpful
- dated files should keep `YYYY-MM-DD`

Examples:
- `program_directory_30_programs_legacy.md`
- `MILESTONE_2026-05-11.md`
- `SESSION_STATE_2026-05-11.md`

## Dated snapshot policy

Dated coordination snapshots such as:
- `docs/MILESTONE_YYYY-MM-DD.md`
- `docs/SESSION_STATE_YYYY-MM-DD.md`

may live in `docs/` while they describe the current coordination window.

Once a newer milestone/session snapshot is created, move the older one here.

## Current archived files

| File | Why it moved |
|---|---|
| `roadmap_legacy_full_product.md` | Superseded by root `ROADMAP.md`. |
| `research_and_plan_legacy.md` | Early research/build plan, no longer active task source. |
| `devin_session_2026-05-10.md` | Session transcript archived after synthesis elsewhere. |
| `Application_Hub_Build_Summary.docx` | Early summary superseded by `STATUS.md`. |
| `02_build_plan.md` | Superseded by `ROADMAP.md` + `TASKS.md`. |
| `03_mcp_spec.md` | Superseded by the live MCP server and current docs. |
| `05_mcp_implementation.md` | Superseded by implementation. |
| `program_directory_30_programs_legacy.md` | Static 30-program snapshot replaced by the live 842-program archive in the product. |
