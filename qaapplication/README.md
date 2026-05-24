# qaapplication — Application Processing Workspace

Sequential pipeline. Top-level folders are numbered so `ls` shows them
in pipeline order.

## The pipeline

```text
01-inbox/         raw drops (single-program HTML / markdown captures)
02-processing/    multi-program captures being triaged
03-programs/      entity index — companies/programs themselves (one file per program)
04-applications/  canonical filled records of submitted applications
05-questions/
  ├── source/     normalized Q-only per program (where each Q came from)
  └── index/      master index of every unique question asked across all programs
06-workshop/      active editing — where Q's get answered before submission
  └── _shared/    shared resources (context, sources, raw, uploads)
07-answers/
  ├── archive/    paired Q+A per submitted program
  └── index/      flat bank of every answer text, indexed for retrieval
```

Plus orthogonal files/folders (don't carry forward in the flow):

```text
audit-log.md  append-only ledger of every received/distributed event
snapshots/    immutable dated/point-in-time captures
src/          canonical methodology docs
```

See also:
- `src/archive-serialization-spec.md` — canonical EN/AP/QU/AQ serialization contract

## How a file moves through the pipeline

```text
new capture → 01-inbox/<raw>.html
   ↓ strip (extract entity + questions + form structure)
03-programs/<slug>.md              ← entity record indexed right away
05-questions/source/<slug>.md      ← Q-only normalized right away
06-workshop/<slug>.md              ← editable workspace ready for filling
06-workshop/_shared/raw/<raw>.x    ← raw moved for audit
   ↓ fill in answers in workshop
   ↓ submit
04-applications/<slug>.md          ← canonical filled record
07-answers/archive/<slug>.md       ← paired Q+A archived
   ↓ harvest across programs
05-questions/index/                ← every unique Q seen, cross-referenced
07-answers/index/                  ← every answer text, indexed for retrieval
   ↓ next draft
06-workshop/<new-slug>.md          ← pulls reusable answers from 07-answers/index/
```

The bank compounds. Each step's output feeds the next.

## Current state

- **03-programs/** — 5 entity records (the submitted programs); workshop programs need backfill
- **04-applications/** — 5 submitted (a16z-speedrun, 3xcapital, cyberfund, solo-fund, unicorn-fund)
- **06-workshop/** — 4 in flight (redbud, founding500, yc, cohort-5)
- **05-questions/source/** + **07-answers/archive/** — 5 paired records each
- **05-questions/index/** + **07-answers/index/** — scaffolded, awaiting first harvest
- **02-processing/** — Safari open-tabs capture (14 program candidates, partial triage)
- **01-inbox/** — empty (ready for the next drop)

## Conventions

1. **One slug per program, used across every lane.** `<slug>.md` is the
   same filename in `03-programs/`, `04-applications/`,
   `05-questions/source/`, `06-workshop/`, `07-answers/archive/`.
2. **Serial refs carry machine identity.** `EN-` = entity/program host,
   `AP-` = application instance, `QU-` = canonical question, `AQ-` =
   application-question instance.
3. **Forward-only.** Files move forward through the pipeline.
4. **The folder system carries state.** What lane a file lives in tells
   you what stage it's at.
5. **`audit-log.md` is append-only.** Each move = one line at the top.
6. **Strip happens on the way out of `01-inbox/`.** Drop a single-program
   capture → strip produces entity + question entries + workshop draft,
   all at once.
7. **Multi-program captures go through `02-processing/`** for triage
   before stripping.
8. **`index/` lanes are downstream of `source/`/`archive/`.** Built by
   harvesting across the source files. Not authored from scratch.

## Downstream (parent application-hub Supabase pipeline)

```text
qaapplication/03-programs/<slug>.md      ← entity (mirrors `programs` table)
qaapplication/05-questions/source/...    ← per-program Q
qaapplication/05-questions/index/...     ← unique-Q index (mirrors `archived_questions`)
qaapplication/07-answers/archive/...     ← per-program A
qaapplication/07-answers/index/...       ← cross-program A bank (mirrors `profile_answers`)
   ↓ harvesting + significance scoring (parent-level)
application-hub/seed/staging/
application-hub/seed/programs/<slug>.sql
Supabase                                 ← live archive
```
