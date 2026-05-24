# qaapplication — Application Processing Workspace

A sequential pipeline. Each top-level folder is one step in the flow. Read the
list top-to-bottom and you see the workflow.

## The pipeline

```text
inbox/        ← 1. raw drops (HTML, markdown, screenshots — single-program captures)
processing/   ← 2. multi-program captures being triaged into candidates
applications/ ← 3. formatted + indexed canonical records of submitted applications
questions/    ← 4. normalized Q-only index per submitted application (first part of Q→A)
drafting/     ← 5. active drafts — Q's get answered here (second part of Q→A); seeding input
answers/      ← 6. raw answer bank harvested from drafting/, indexed for reuse
```

`questions/` and `drafting/` are paired: `questions/` is the Q side,
`drafting/` is the A side getting filled in. `answers/` is what
crystallizes out of accumulated drafting work — the reusable bank.

Plus three folders that are **orthogonal** to the lifecycle (don't carry forward):

```text
audit-log.md  ← append-only ledger of every received/distributed event
snapshots/    ← immutable dated/point-in-time captures
src/          ← canonical methodology docs
```

## How a file moves through the pipeline

```text
new capture → inbox/<raw>.html
   ↓ extract questions
questions/<slug>.md                 ← Q-only structure pulled out
drafting/<slug>.md                  ← Q + A workspace being filled
drafting/_shared/raw/<slug>.html    ← raw moved here for audit
   ↓ submit
applications/<slug>.md              ← canonical filled record
   ↓ harvest answers across all submissions
answers/<slug>.md                   ← reusable bank, indexed for next draft
```

Each step's output is the next step's input. The bank compounds.

## Current state (read directly from folders)

- `applications/` — 5 submitted (a16z-speedrun, 3xcapital, cyberfund, solo-fund, unicorn-fund)
- `drafting/` — 4 in flight (redbud, founding500, yc, cohort-5)
- `questions/` + `answers/` — 5 paired records each
- `processing/` — Safari open-tabs capture (14 program candidates, partial triage)
- `inbox/` — empty (ready for the next drop)

## Conventions

1. **One slug per program, used across every lane.** `<slug>.md` is the
   same filename in `drafting/`, `applications/`, `questions/`, `answers/`.
2. **Forward-only.** Files move forward through the pipeline; they don't
   bounce back. Edits happen in place at the lane the file currently
   lives in.
3. **The folder system carries state.** What lane a file lives in tells
   you what stage it's at. No need to maintain a separate status field.
4. **`audit-log.md` is append-only.** Each move = one line at the top.
5. **`drafting/_shared/`** holds shared resources used to write drafts:
   `context/`, `sources/`, `raw/` (original HTML), `uploads/` (submission-
   ready files). Shared across every draft.

## Downstream (parent application-hub Supabase pipeline)

```text
qaapplication/questions/<slug>.md          ← per-program normalized
qaapplication/answers/<slug>.md            ← per-program raw bank
   ↓ harvesting pass + significance scoring (parent-level work)
application-hub/seed/staging/              ← parent: candidate rows
application-hub/seed/programs/<slug>.sql   ← parent: canonical seed
Supabase                                   ← live archive
```
