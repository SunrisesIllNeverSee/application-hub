# qaapplication — Application Processing Workspace

Sequential pipeline. Top-level folders are numbered so `ls` shows them
in pipeline order.

## The pipeline

```text
01-inbox/         raw drops (single-program HTML / markdown captures)
02-processing/    multi-program captures being triaged
03-applications/  formatted + indexed canonical records of submitted apps
04-questions/
  ├── source/     normalized Q-only per submitted application (where the Q came from)
  └── index/      master index of every unique question asked across all programs
05-drafting/      active drafts — Q's get answered here (second part of Q→A)
  └── _shared/    shared drafting resources (context, sources, raw, uploads)
06-answers/
  ├── archive/    paired Q+A per submitted application (the archive)
  └── index/      flat bank of every answer text, indexed for retrieval
```

Plus orthogonal files/folders (don't carry forward in the flow):

```text
audit-log.md  append-only ledger of every received/distributed event
snapshots/    immutable dated/point-in-time captures
src/          canonical methodology docs
```

## How a file moves through the pipeline

```text
new capture                       → 01-inbox/<raw>.html
   ↓ extract questions
05-drafting/<slug>.md             ← workspace: questions + space to answer
05-drafting/_shared/raw/<slug>.x  ← raw moves here for audit
   ↓ submit
03-applications/<slug>.md         ← canonical filled record
   ↓ split into source layers
04-questions/source/<slug>.md     ← Q-only normalized
06-answers/archive/<slug>.md      ← paired Q+A per program
   ↓ harvest across programs
04-questions/index/               ← every unique Q seen, cross-referenced
06-answers/index/                 ← every answer text, indexed
   ↓ next time Deric drafts a new application
05-drafting/<new-slug>.md         ← pulls reusable answers from 06-answers/index/
```

Each step's output is the next step's input. The bank compounds.

## Current state

- **03-applications/** — 5 submitted (a16z-speedrun, 3xcapital, cyberfund, solo-fund, unicorn-fund)
- **05-drafting/** — 4 in flight (redbud, founding500, yc, cohort-5)
- **04-questions/source/** + **06-answers/archive/** — 5 paired records each
- **04-questions/index/** + **06-answers/index/** — scaffolded, awaiting first harvest pass
- **02-processing/** — Safari open-tabs capture (14 program candidates, partial triage)
- **01-inbox/** — empty (ready for the next drop)

## Conventions

1. **One slug per program, used across every lane.** `<slug>.md` is the
   same filename in `05-drafting/`, `03-applications/`,
   `04-questions/source/`, and `06-answers/archive/`.
2. **Forward-only.** Files move forward through the pipeline.
3. **The folder system carries state.** What lane a file lives in tells
   you what stage it's at.
4. **`audit-log.md` is append-only.** Each move = one line at the top.
5. **`05-drafting/_shared/`** = drafting toolkit (context, sources, raw HTML,
   submission-ready uploads). Shared across every draft.
6. **`index/` lanes are downstream of `source/`/`archive/`.** Build by
   harvesting across the source files. Not authored from scratch.

## Downstream (parent application-hub Supabase pipeline)

```text
qaapplication/04-questions/source/   ← per-program normalized
qaapplication/04-questions/index/    ← cross-program unique-Q index
qaapplication/06-answers/archive/    ← per-program paired Q+A
qaapplication/06-answers/index/      ← cross-program flat answer bank
   ↓ harvesting + significance scoring (parent-level work)
application-hub/seed/staging/        ← parent: candidate rows
application-hub/seed/programs/<slug>.sql
Supabase                             ← live archive
```
