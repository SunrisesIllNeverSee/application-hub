# answers/ — Cross-Program Answer Data Bank

This folder is the **indexed layer** — answers harvested from
`questions/<slug>.md` and reorganized cross-program for reuse when
filling out new applications.

## Two-stage flow into this folder

```text
applications/<slug>.md          ← raw canonical (native shape per program)
   ↓ normalize to clean Q→A pairs
questions/<slug>.md             ← formatted Q→A by program
   ↓ harvest across programs by question theme/recurrence
answers/<theme-or-question>.md  ← indexed answer bank, this folder
```

Each layer is denser and more reusable than the last:

- `applications/` is a per-program canonical (one file per program, varied shape)
- `questions/` is per-program normalized (one file per program, uniform Q→A shape)
- `answers/` is **per question or per theme, cross-program** (one file per
  recurring question or thematic bucket, with answer variants and provenance)

## Why "full formatted" goes into this folder (per Deric's pipeline decision)

We index **the full Q→A**, not just the answers. Answers without their
originating questions lose context — the same answer can be a strong fit
for one question and a non-sequitur for another. By keeping the question
attached, every answer in the bank is auditable: where did this come
from, what was it answering, when was it last used, what was the result?

The indexing happens **inside** this folder. The input is full Q→A from
`questions/`. The output is the same Q→A organized for retrieval.

## Structure (TBD — three viable options)

Three reasonable structures, none picked yet. Deric to decide.

### Option A — by question theme (flat, low-ceremony)

```text
answers/
├── README.md
├── founder-bio.md       ← all "tell us about yourself" variants
├── why-this-team.md     ← all "why you / why this team" variants
├── what-do-you-do.md    ← all product-description variants
├── traction.md          ← all traction variants
├── moat.md              ← all competitive-moat variants
├── revenue-model.md     ← all "how do you make money" variants
├── why-now.md           ← all "why is this urgent" variants
├── why-this-program.md  ← all "why are you applying here" variants
└── ...
```

Each file holds 2-N answer variants, each tagged with the source program
and the exact question that was asked.

**Pro:** human-readable, easy to grep.
**Con:** theme taxonomy has to be defined up-front and maintained.

### Option B — by archived question (mirrors parent application-hub's data model)

```text
answers/
├── README.md
├── q-why-this-team/
│   ├── question.md                ← the canonical question text + variants
│   ├── a-a16z-speedrun.md         ← the a16z-specific answer
│   ├── a-cyberfund.md             ← the cyber.fund-specific answer
│   └── a-redbud.md                ← the Redbud-specific answer (when drafted)
├── q-what-is-your-moat/
│   └── ...
└── ...
```

Mirrors the parent's `archived_questions` + `program_questions` +
`profile_answers` tables directly. One folder per unique question across
all programs.

**Pro:** maps 1:1 to the Supabase schema; eventual export is mechanical.
**Con:** heavier filesystem; more files.

### Option C — single indexed file

```text
answers/
├── README.md
└── answer-bank.yaml   ← flat-file index of every Q→A with metadata
```

One queryable file. Frontmatter per entry: question_id, theme,
source_program, last_used_date, performance_signal (rejected? accepted?
got_interview?).

**Pro:** single source of truth, easy to query programmatically.
**Con:** harder to read at a glance; merge conflicts if multiple drafts
edit simultaneously.

## Recommendation (mine, until Deric decides)

**Option A for now.** It's the lowest-ceremony structure that still
produces usable output. We can migrate to Option B later when the parent
Supabase pipeline is ready to consume from this folder — the theme files
naturally map to archived_questions rows.

## How this folder gets populated (the actual work)

Once a sample of 3-5 submitted applications exists in `questions/`, the
harvesting pass is:

1. Read every `questions/<slug>.md` file.
2. For each Q, ask: "is this question recurring across multiple programs?"
3. If yes, create or update the relevant theme file in `answers/`.
4. Each entry in a theme file records: source program, exact question
   asked, the verbatim answer that was given, optional commentary on what
   worked / what didn't (per `inbox/done/<slug>-submitted-*.md` status).

This is **not** an automated pipeline — it's a deliberate editorial pass
that produces clean reusable answer variants.

## Status

- [ ] Structure decided (Option A / B / C)
- [ ] First harvest pass across the three submitted applications
- [ ] First theme files populated (recommended starting bucket:
  `founder-bio.md`, since every program asks for it)
