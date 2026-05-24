# Inbox — Application Processing Center

Front door for any raw capture that might become an application Deric fills
out. Drop a raw HTML dump (from the dev-console `copy(document.body.innerText)`
or `outerHTML` trick), a tabs export, an email forward, a screenshot OCR —
anything that contains application questions — into `incoming/`. Then walk
it through the lanes below.

## Lanes

```text
inbox/
├── incoming/    ← raw captures, untriaged (drop files here)
├── processing/  ← multi-item captures being triaged (e.g. Safari tabs file)
└── done/        ← applications that have been filled out AND submitted (submission records)
```

Raw HTMLs that have been extracted but not yet submitted are **drafting
source material** — they live alongside their structured outputs at
`applications/_drafting/raw/<slug>.html`, not in this folder.

## What goes in each lane

| Lane | Contains | Lifetime |
| --- | --- | --- |
| `incoming/` | Raw HTML / markdown captures that haven't been touched yet. New drops land here. | Until extracted (usually same session) |
| `processing/` | Multi-program captures still being triaged (one file → many candidate programs). The Safari open-tabs file lives here while its 14 candidates are being researched. Single-program raw HTML doesn't need this lane — it goes incoming → extract → _drafting/raw. | Until every candidate inside is resolved |
| `done/` | One record per submitted application. Format: `<slug>-submitted-YYYYMMDD.md` — short file noting submission date, program name, assets uploaded, and a pointer to the canonical record at `applications/<slug>.md`. | Indefinite — submission audit log |

## Application processing pipeline

```text
inbox/incoming/<raw>.html
   ↓ extract (grep aria-labels + placeholders + h-tags)
applications/_drafting/questions/<slug>.md   ← structured question set
   ↓ raw HTML moves to applications/_drafting/raw/<slug>.html
applications/_drafting/draft/<slug>.md       ← drafted answers
   ↓ resolve open questions, polish
[submit to program]
   ↓ record submission in inbox/done/<slug>-submitted-YYYYMMDD.md
applications/<slug>.md                       ← canonical finished record
```

`done/` and `applications/<slug>.md` are paired: the `done/` file is a
lightweight audit marker (when, where, what was sent); the `applications/`
file is the substantive record (questions + answers + assets list).

## Multi-program captures (the `processing/` exception)

Some captures contain multiple programs at once — e.g.
`processing/open-tabs-safari-2026-05-21T22-09-49-989Z.md` was 21 browser
tabs with 14 program candidates inside. Those captures stay in `processing/`
with a sibling `<capture>.todo.md` triage file until each candidate is
classified and either:

- queued for full question extraction (next pass), or
- archived as `skip` with a verdict noted in the todo file.

Once every candidate in a multi-program capture is resolved, the capture
and its todo file move together to `archive/`.

## Triage rules for new drops

When a capture lands in `incoming/`:

1. **Identify the program** — `<title>` + meta description + URL usually tell you what you're looking at within 30 seconds.
2. **Extract the question structure** — aria-labels, placeholders, h-tags, and visible text usually cover 95% of form fields. Write to `applications/_drafting/questions/<slug>.md`.
3. **Move the raw HTML** — `incoming/` → `archive/` once extraction is complete.
4. **Tell Deric** the extraction is done and ready for him to draft.

## What does NOT belong in inbox/

- Long-form research drafts → `applications/_drafting/context/` or `applications/_drafting/sources/`
- Final canonical applications → `applications/<slug>.md`
- Working notes about MO§ES™ itself → `src/`
- Anything that isn't an application or a question being captured for one

## Downstream: question archive (longer-term)

Beyond the per-application workflow, the eventual pipeline for harvested
questions is:

```text
applications/<slug>.md   ← per-program canonical
   ↓ question harvesting (extract recurring Qs across programs)
parent application-hub/seed/staging/   ← candidate question rows
   ↓ promotion (write production SQL)
parent application-hub/seed/programs/<slug>.sql   ← canonical seed
   ↓ apply migration
Supabase   ← live archive (programs, archived_questions, program_questions)
```

This is the question-archive side of the work and lives at the parent
level. Inside qaapplication/, our job is to capture cleanly enough that
harvesting later is straightforward.

## Owner

Anything sitting in `incoming/` for more than a few days should be either
extracted or deleted with a reason. Don't leave dead captures lying around.
