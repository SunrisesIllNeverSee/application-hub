# Inbox — Application & Question Processing Center

This is the front door for any raw capture that might become a program or a
question in the archive. Drop a markdown file, a tabs export, a screenshot, an
email forward — anything that *might* contain an application — into
`incoming/`. Then walk it through the lanes below.

## Lanes

```
inbox/
├── incoming/    ← raw captures, untriaged (drop files here)
├── processing/  ← currently being triaged into candidates
└── done/        ← captures that have been fully processed (with verdict)
```

## Downstream pipeline

```
inbox/incoming/   ← raw drop
   ↓ triage (classify, extract URLs)
inbox/processing/ ← per-capture TODO with one row per candidate
   ↓ research (visit URL, extract metadata)
seed/staging/     ← YAML/CSV stubs, still candidate
   ↓ promotion (write production SQL)
seed/programs/    ← canonical seed (one .sql per program)
   ↓ apply migration
Supabase           ← live archive (programs, archived_questions, program_questions)
```

## Triage rules

When a capture lands in `incoming/`, the next session should:

1. **Classify each item** as one of:
   - `program-candidate` — a job, accelerator, grant, fellowship, VC, school
     application page that we should consider indexing.
   - `reference` — useful link (docs, tooling, vendor) but not a program.
   - `skip` — social, search results, internal dashboards, login pages.

2. **For each `program-candidate`**, capture:
   - canonical apply URL
   - organization / company name
   - program type (`job`, `accelerator`, `grant`, `fellowship`, `vc`, `school`)
   - any visible deadline
   - whether the application appears essay-driven (otherwise low priority)

3. **Move the original capture file** from `incoming/` → `processing/` while
   triage is in flight, and to `done/` once every item is resolved.
   Pair the moved file with a sibling `<capture>.verdict.md` that lists
   verdicts per item.

## Indexing scope

For the v1 sweep we index **company + application URL** only. We do **not**
need to extract every essay question on first pass. Question extraction is a
second pass once the program row exists in `seed/staging/`.

## What does *not* belong in inbox/

- Long-form research drafts → use `docs/` or `seed/staging/`.
- Final production seed SQL → `seed/programs/`.
- Working notes about how the engine itself works → `docs/` or `STATUS.md`.

## Owner

Anything left in `incoming/` for more than a few days should be either promoted
or moved to `done/` with a `skip` verdict. Don't leave dead captures lying around.
