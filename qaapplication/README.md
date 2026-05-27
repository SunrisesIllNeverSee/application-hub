# qaapplication — Application Processing Workspace

Sequential pipeline. Top-level folders are numbered so `ls` shows them
in pipeline order.

## Workflow shape

The workspace now reads as:

```text
answers → apply → submitted
```

Current lane order:

```text
06-answers/   reusable answer bank
07-apply/     active application assembly / submission prep
08-submitted/ immutable submitted packets and final snapshots
```

This is now the live shape of the workspace: reusable answers first,
active application assembly second, immutable submitted material third.

## Current filesystem

```text
01-inbox/         raw drops (single-program HTML / markdown captures)
02-processing/    multi-program captures being triaged
03-programs/      entity index — companies/programs themselves (one file per program)
04-applications/  bare application form structure per program (no answers — filled records live in 08-submitted/archive/)
05-questions/
  ├── source/     normalized Q-only per program (where each Q came from)
  └── index/      master index of every unique question asked across all programs
06-answers/
  └── index/      rolling indexed answers per theme (bio.md, project.md, moat.md, …); entries keyed by QU-XXXX serialize code · slug · timestamp
07-apply/      active application assembly — where Q's get answered before submission
  ├── need-to-apply/ seeded and queued, but not yet actively pushed
  └── _shared/    shared resources (context, sources, raw, uploads)
08-submitted/
  ├── archived_applications/  full filled application records
  └── archive/    paired Q+A per submitted program
```

Notes:
- `06-answers/` is now the compounding knowledge bank only.
- `07-apply/` is the live application workbench.
- `07-apply/need-to-apply/` is the seeded-but-not-yet-filed queue marker.
- `08-submitted/` is the immutable submission lane.

Plus orthogonal files/folders (don't carry forward in the flow):

```text
audit-log.md  append-only ledger of every received/distributed event
tracker.md    operator-facing status and deadline tracker
snapshots/    immutable dated/point-in-time captures
src/          canonical methodology docs
```

See also:
- `src/archive-serialization-spec.md` — canonical EN/AP/QU/AQ serialization contract

## Current file flow

```text
new capture → 01-inbox/<raw>.html
   ↓ strip (extract entity + questions + form structure)
03-programs/<slug>.md              ← entity record indexed right away
05-questions/source/<slug>.md      ← Q-only normalized right away
07-apply/<slug>.md              ← active application packet ready for filling
07-apply/_shared/raw/<raw>.x    ← raw moved for audit
   ↓ fill in answers in apply
   ↓ submit
04-applications/<slug>.md          ← bare form structure (sections, field types, no answers)
08-submitted/archived_applications/<slug>.md  ← full filled application record
08-submitted/archive/<slug>.md       ← paired Q+A archived
   ↓ harvest across programs
05-questions/index/                ← every unique Q seen, cross-referenced (QU-XXXX)
06-answers/index/<theme>.md        ← rolling indexed answers per theme; entries keyed by QU-XXXX · slug · timestamp
   ↓ next draft
07-apply/<new-slug>.md          ← pulls reusable answers from 06-answers/index/
```

The bank compounds. Each step's output feeds the next.

## Why this flow works

- `06-answers/` becomes the compounding knowledge asset.
- `07-apply/` becomes the active workbench for one application at a time.
- `07-apply/need-to-apply/` distinguishes queued applications from actively worked ones.
- `08-submitted/` becomes the immutable record after the work is done.

## Current state

- Treat folder placement as the truth of workflow state.
- `07-apply/` is the only live drafting lane.
- `07-apply/need-to-apply/` is the queue for seeded applications that still need filing.
- `08-submitted/` is the only live submission lane.
- `tracker.md` is the fast-glance status/deadline view.
- `snapshots/` holds recovered or superseded structures that should not be used for new work.
- `06-answers/index/` is the live reusable answer bank. Duplicate answer-index copies have been moved out of the active lane.

## Conventions

1. **One slug per program, used across every lane.** `<slug>.md` is the
   same filename in `03-programs/`, `04-applications/`,
   `05-questions/source/`, `07-apply/`, `08-submitted/archive/`.
2. **Serial refs carry machine identity.** `EN-` = entity/program host,
   `AP-` = application instance, `QU-` = canonical question, `AQ-` =
   application-question instance.
3. **Forward-only.** Files move forward through the pipeline.
4. **The folder system carries state.** What lane a file lives in tells
   you what stage it's at.
5. **`audit-log.md` is append-only.** Each move = one line at the top.
6. **Strip happens on the way out of `01-inbox/`.** Drop a single-program
   capture → strip produces entity + question entries + active apply draft,
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
qaapplication/08-submitted/archive/...     ← per-program A
qaapplication/06-answers/index/...       ← cross-program A bank (mirrors `profile_answers`)
   ↓ harvesting + significance scoring (parent-level)
application-hub/seed/staging/
application-hub/seed/programs/<slug>.sql
Supabase                                 ← live archive
```
