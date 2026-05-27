# 03-programs/ — Entity Index

One file per program/company. Mirrors the parent application-hub's
`programs` table in Supabase.

This is the serialized `EN` lane.
See `../src/archive-serialization-spec.md`.

A "program" is the entity Deric applies *to* — Y Combinator, Redbud VC,
cyber.fund, NextUnicorn.Fund, 3xCapital, etc. The entity exists whether
or not Deric has applied; one entity can have multiple applications over
time (e.g. a16z Speedrun has two submissions on record).

## Naming

`<slug>.md` — same slug used across `04-applications/`,
`05-questions/source/`, `07-apply/`, `08-submitted/archive/`.

## File shape

```markdown
# <Program Name>

- **url:** <canonical website>
- **type:** vc / accelerator / fellowship / grant / job / school
- **form host:** <Tally / Airtable / Google Forms / Lever / custom>
- **geo focus:** <countries / cities>
- **stage:** <pre-seed / seed / open to all>
- **check size:** <range if VC>
- **status:** <open / rolling / closed>

## Description

<one-paragraph description of the program — what it offers, who it's for>

## Cross-references

- application form / Q set: ../05-questions/source/<slug>.md
- submitted record (if applied): ../04-applications/<slug>.md
- answer archive (if applied): ../08-submitted/archive/<slug>.md
- active draft (if in flight): ../07-apply/<slug>.md
```

## Populated by

The strip step: when a raw capture lands in `../01-inbox/` and gets
extracted, the entity gets a record here. For the existing submitted
applications, these were backfilled retroactively from their canonical
records.

## Downstream

This folder feeds the parent's `programs` table when seeding.
