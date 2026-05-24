# qaapplication — Application, Company & Question Capture Workspace

This folder exists for **one purpose**: to capture, document, and index
real-world applications (jobs, accelerators, grants, fellowships, funds,
schools), the companies that run them, and the **questions** those
applications ask — *plus the answers Deric gives them*. Questions are
the product of this work; answers are how the product is built.

If a file isn't an application, a company, a question, an answer, or
methodology for indexing them, it doesn't belong here.

## Folder map

```text
qaapplication/
├── README.md          ← this file (folder index + conventions)
├── src/               ← canonical living docs (indexing methodology)
├── inbox/             ← raw captures awaiting triage (front door)
├── applications/      ← canonical filled records, one per program
│                         └── _drafting/ — active intake workspace
├── questions/         ← formatted Q→A index per program (normalization layer)
├── answers/           ← cross-program indexed answer data bank (reuse layer)
└── snapshots/         ← immutable dated/point-in-time captures
```

## The processing pipeline

Three lanes flow forward; each layer is denser and more reusable than
the last:

```text
inbox/incoming/                          ← raw drops
   ↓ extract, draft, submit
applications/<slug>.md                   ← canonical filled record (native shape per program)
   ↓ normalize to clean Q→A pairs
questions/<slug>.md                      ← formatted Q→A per program (uniform shape)
   ↓ harvest across programs by question theme/recurrence
answers/<theme-or-question>.md           ← indexed answer bank, for filling NEW applications
```

When a NEW application arrives in `inbox/incoming/`, the system loops:
the answer bank in `answers/` is the source for first-pass drafts in
`applications/_drafting/draft/<slug>.md`. Every new submission then
contributes back: its filled record gets normalized to `questions/<slug>.md`
and its answers get re-indexed into `answers/`. Compounding asset.

## Canonical docs (the `src/` lane)

| File | What it is |
| --- | --- |
| [src/seeding-plan.md](src/seeding-plan.md) | The category-seeding playbook — how to take a new program category (accelerators, universities, grants, fellowships, jobs) from raw list → parent's Supabase question archive. Living methodology. |

## Submitted applications (the `applications/` lane)

| File | Program | Status |
| --- | --- | --- |
| [applications/a16z-speedrun.md](applications/a16z-speedrun.md) | a16z Speedrun | Submission #1 rejected; #2 pending |
| [applications/cyberfund.md](applications/cyberfund.md) | cyber.fund Monastery | Submitted 2026-05-23, awaiting |
| [applications/unicorn-fund.md](applications/unicorn-fund.md) | NextUnicorn.Fund | **L2 escalated · 6/2 follow-up scheduled** |
| [applications/solo-fund.md](applications/solo-fund.md) | Solo Fund | Question-archive capture only (not submitted) |

In-progress drafts live in [applications/_drafting/](applications/_drafting/)
with subfolders for `questions/` (intake), `draft/` (active drafts),
`context/`, `sources/`, `raw/` (raw HTML source), and `uploads/`
(submission-ready assets).

## Normalized Q→A index (the `questions/` lane)

| File | What it is |
| --- | --- |
| [questions/a16z-speedrun.md](questions/a16z-speedrun.md) | a16z Speedrun, normalized Q→A in form order |
| [questions/cyberfund.md](questions/cyberfund.md) | cyber.fund agent transcript, normalized Q→A in conversation order |
| [questions/unicorn-fund.md](questions/unicorn-fund.md) | NextUnicorn.Fund, Q-only capture (answers not preserved locally) |

See [questions/README.md](questions/README.md) for the normalization convention.

## Cross-program answer data bank (the `answers/` lane)

| File | What it is |
| --- | --- |
| [answers/README.md](answers/README.md) | The reuse-layer spec — taxonomy decision pending (3 options outlined) |

This is where indexed answers get reorganized by question theme or
recurrence so the bank can be queried when filling out new applications.
First harvest pass pending — see `answers/README.md`.

## Submission audit log (`inbox/done/`)

| Record | Program | Date |
| --- | --- | --- |
| [a16z-speedrun-submitted-2026-05.md](inbox/done/a16z-speedrun-submitted-2026-05.md) | a16z Speedrun | Mid-May 2026 (×2) |
| [cyberfund-submitted-2026-05-23.md](inbox/done/cyberfund-submitted-2026-05-23.md) | cyber.fund | 2026-05-23 |
| [unicorn-fund-submitted-2026-05.md](inbox/done/unicorn-fund-submitted-2026-05.md) | NextUnicorn.Fund | Mid-May 2026 |

## Conventions

1. **`src/` filenames carry no dates.** A date in a filename signals
   snapshot; the absence of one signals "this is current truth." Time-bound
   captures go to `snapshots/` instead.
2. **`snapshots/` is append-only.** Never edit a file once it lands there.
3. **`applications/<slug>.md` is one file per submitted program** in its
   native shape (form / chat / wizard / etc.).
4. **`questions/<slug>.md` is one file per submitted program** in uniform
   Q→A shape, regardless of how the original was captured.
5. **`answers/` is the cross-program reuse layer** — one file per question
   theme (Option A) or per archived question (Option B). Structure TBD.
6. **`inbox/` is the front door for raw captures.** See
   [inbox/README.md](inbox/README.md) for the per-lane semantics.
7. **Promotion direction is one-way:** `inbox/ → applications/_drafting/ → applications/ → questions/ → answers/`.
   Files don't bounce back.
8. **Files that aren't applications, companies, questions, answers, or
   indexing methodology don't live here.** Tooling docs, engineering
   accountability, QA records for unrelated systems belong elsewhere.

## Downstream pipeline (toward parent's Supabase question archive)

Eventually, `questions/` and `answers/` feed the parent application-hub's
question archive:

```text
qaapplication/questions/<slug>.md          ← per-program normalized
qaapplication/answers/<theme>.md           ← cross-program indexed
   ↓ harvesting pass + significance scoring
application-hub/seed/staging/              ← parent: candidate question rows
   ↓ promotion (write production SQL)
application-hub/seed/programs/<slug>.sql   ← parent: canonical seed
   ↓ apply migration
Supabase                                   ← live archive (programs, archived_questions, program_questions, profile_answers)
```

Anything inside `qaapplication/` is our responsibility. Anything in
`application-hub/seed/` is parent-scope and is only touched on explicit
request.
