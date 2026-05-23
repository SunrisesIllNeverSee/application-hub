# qaapplication — Application, Company & Question Capture Workspace

This folder exists for **one purpose**: to capture, document, and index
real-world applications (jobs, accelerators, grants, fellowships, funds,
schools), the companies that run them, and the **questions** those
applications ask. Questions are the product of this work — the parent
platform's core asset is the question archive, and the captures here exist
so that the questions inside them can be extracted, deduplicated, and scored.

If a file isn't an application, a company, a question (or a question set),
or methodology for indexing them, it doesn't belong in this folder.

## Folder map

```text
qaapplication/
├── README.md          ← this file (folder index + conventions)
├── src/               ← canonical living docs (indexing methodology)
├── applications/      ← captured application forms by company/program
├── snapshots/         ← immutable dated/point-in-time captures
└── inbox/             ← raw captures awaiting triage (front door)
```

## Canonical docs (the `src/` lane)

| File | What it is |
| --- | --- |
| [src/seeding-plan.md](src/seeding-plan.md) | The category-seeding playbook — how to take a new program category (accelerators, universities, grants, fellowships, jobs) from raw list → Supabase question archive. Living methodology. |

## Captured applications (the `applications/` lane)

| File | Program | Type |
| --- | --- | --- |
| [applications/a16z-speedrun.md](applications/a16z-speedrun.md) | a16z Speedrun | Pre-seed accelerator |
| [applications/solo-fund.md](applications/solo-fund.md) | Solo Fund | Fund |
| [applications/unicorn-fund.md](applications/unicorn-fund.md) | NextUnicorn.Fund | Fund / accelerator |

## Conventions

These are the rules that keep this folder from drifting back into a pile.

1. **`src/` filenames carry no dates.** A date in a filename signals snapshot;
   the absence of one signals "this is current truth." Time-bound captures go
   to `snapshots/` instead.

2. **`snapshots/` is append-only.** Never edit a file once it lands there.
   Group related snapshots in subfolders by session or date when relevant.

3. **`applications/` is one file per program (or per fund/company).** Filename
   uses the program slug (`a16z-speedrun.md`, not `andreessen-horowitz.md`).
   Each file holds the captured form + the user's draft answers when relevant.

4. **`inbox/` is the front door for raw captures.** Safari captures and any
   other ingestion pipelines drop files into `inbox/incoming/`. See
   [inbox/README.md](inbox/README.md) for the triage flow.

5. **Promotion direction is one-way:** `inbox/ → snapshots/ or applications/
   or src/`. Files move *out* of inbox once triaged; they don't bounce back.

6. **Files that aren't applications, companies, questions, or indexing
   methodology don't live here.** If a file is tooling docs, engineering
   accountability, QA records about anything other than the captures
   themselves — it belongs somewhere else.

7. **Questions live inside their parent application capture for now.** Each
   `applications/<program>.md` file contains the program's full question set
   plus any draft answers. A dedicated `questions/` lane will be added if/when
   extracted question sets (e.g. cross-program universals, theme bundles)
   need their own home.

## Downstream pipeline

Captures here don't stay here forever. The eventual flow:

```text
qaapplication/inbox/                             ← raw drop
   ↓ triage
qaapplication/inbox/processing/candidates/       ← per-capture YAML stubs
   ↓ research (visit URL, fill TODOs)
application-hub/seed/staging/                    ← parent: candidate seeds
   ↓ promotion (write production SQL)
application-hub/seed/programs/<slug>.sql         ← parent: canonical seed
   ↓ apply migration
Supabase                                         ← live archive
```

Steps inside `qaapplication/` are this folder's responsibility. Anything from
`application-hub/seed/` onward lives at the parent level and is touched only
on explicit request.
