# QA Archive Serialization Spec

This is the canonical serialization contract for the `qaapplication/`
workspace.

Purpose:
- keep the QA archive human-readable
- keep every lane machine-pullable
- make Supabase the parent system of record
- let automation pull records immediately without guessing structure

The archive is modeled as a linked graph with stable refs:

- `EN-XXXX` — entity / program host
- `AP-XXXX` — application instance
- `QU-XXXX` — canonical question identity
- `AQ-XXXX` — application-question instance (verbatim question as asked by one application)

Slugs remain the file identity. Refs remain the machine identity.

## Core rules

1. **Programs are entities.**
   `03-programs/<slug>.md` is the entity lane.
2. **Every serialized file keeps the slug.**
   Slug is the bridge across QA lanes and the handoff key to Supabase pull jobs.
3. **Refs do not replace slugs.**
   Refs are the stable machine IDs; slugs are the stable file IDs.
4. **Relationships must be explicit.**
   No lane should rely on filename inference alone when a parent ref can be written directly.
5. **Supabase is the parent.**
   QA files are a serialization and transition layer, not the final source of truth.

---

## Object model

### Entity / Program

The host of the application.

Serialized in:
- `03-programs/<slug>.md`

Required identity fields:
- `entity_ref`
- `slug`
- `name`

Recommended supporting fields:
- `url`
- `type`
- `form_host`
- `geo_focus`
- `stage`
- `status`

### Application

A concrete application instance tied to one entity/program.

Serialized in:
- `04-applications/<slug>.md`

Required identity fields:
- `application_ref`
- `entity_ref`
- `slug`
- `program_name`

Recommended supporting fields:
- `cycle`
- `deadline`
- `status`
- `source_url`

### Canonical Question

The deduplicated reusable question identity across programs.

Serialized in:
- `05-questions/index/*.md`

Required identity fields:
- `question_ref`
- `question_slug`
- `canonical_text`

Recommended supporting fields:
- `theme`
- `vertical`
- `significance`
- `asked_by_count`

### Application Question

The exact question as asked by one application.

Serialized in:
- `05-questions/source/<slug>.md`

Required identity fields:
- `application_question_ref`
- `application_ref`
- `entity_ref`
- `slug`

Recommended supporting fields:
- `question_ref` if already mapped
- `verbatim`
- `order_index`
- `required`
- `word_limit`
- `char_limit`

---

## Lane-by-lane contract

## `03-programs/<slug>.md`

This file serializes the entity/program host.

### Required frontmatter

```yaml
entity_ref: EN-0001
slug: yc
name: Y Combinator
url: https://www.ycombinator.com/
type: accelerator
form_host: custom
status: open
```

### Optional frontmatter

```yaml
geo_focus: global
stage: pre-seed-to-seed
source_urls:
  - https://apply.ycombinator.com/
notes: null
```

### Relationship rule

This file is the parent anchor for all downstream files sharing the slug or referencing the `entity_ref`.

---

## `04-applications/<slug>.md`

This file serializes one application instance.

### Required frontmatter

```yaml
application_ref: AP-0001
entity_ref: EN-0001
slug: yc-w26
program_name: Y Combinator
status: submitted
source_url: https://apply.ycombinator.com/
```

### Optional frontmatter

```yaml
cycle: W26
deadline: 2026-05-15
submitted_at: 2026-05-13
vertical: founder
application_type: accelerator
```

### Relationship rule

Every application file must point to exactly one `entity_ref`.

If one host has multiple cycles or submission attempts, the slug may extend:
- `yc-w26`
- `yc-s26`
- `a16z-speedrun-2026-05`

---

## `05-questions/source/<slug>.md`

This file serializes the per-application question set.

### Required frontmatter

```yaml
application_ref: AP-0001
entity_ref: EN-0001
slug: yc-w26
program_name: Y Combinator
source_url: https://apply.ycombinator.com/
status: extracted
```

### Question block shape

Use one block per application question:

```markdown
## AQ-0001

- `application_ref:` AP-0001
- `entity_ref:` EN-0001
- `question_ref:` QU-0007
- `order_index:` 1
- `required:` true
- `word_limit:` 50
- `char_limit:` null

### Verbatim

What are you building?
```

If the canonical question is not yet assigned:

```markdown
- `question_ref:` null
```

### Relationship rule

Each `AQ` block must always belong to one `AP` and one `EN`.
`QU` may be null until dedupe/indexing assigns it.

---

## `05-questions/index/*.md`

This is the canonical question lane.

### Filename rule

Use a stable thematic or text-derived filename:
- `q-what-are-you-building.md`
- `q-founder-background.md`

### Required frontmatter

```yaml
question_ref: QU-0007
question_slug: q-what-are-you-building
canonical_text: What are you building?
theme: solution
vertical: founder
asked_by_count: 6
significance: 0.82
```

### Variant block shape

```markdown
## Variants Seen

- AQ-0001 · AP-0001 · EN-0001 · yc-w26
  - verbatim: What are you building?

- AQ-0014 · AP-0008 · EN-0004 · a16z-speedrun
  - verbatim: Describe your product.
```

### Relationship rule

`QU` is the deduplicated identity.
The index file is where many `AQ` instances converge on one canonical question.

---

## `07-apply/<slug>.md`

This is the active application-assembly surface.

It may include interpretation, draft answers, and manual notes, but it should still be serializable.

### Required frontmatter

```yaml
application_ref: AP-0001
entity_ref: EN-0001
slug: yc-w26
status: drafting
```

### Recommended block shape

```markdown
## AQ-0001 · QU-0007

### Question
What are you building?

### Working Answer
[draft text here]

### Notes
- tighten opener
- add traction proof
```

### Relationship rule

The apply file is not the parent truth, but every draft block should still carry `AQ` and `QU` so the lineage remains machine-pullable.

---

## `08-submitted/archive/<slug>.md`

This is the answer archive per submitted application.

### Required frontmatter

```yaml
application_ref: AP-0001
entity_ref: EN-0001
slug: yc-w26
status: submitted
submitted_at: 2026-05-13
```

### Answer block shape

```markdown
## AQ-0001 · QU-0007

### Answer

We are building...

### Provenance

- `application_ref:` AP-0001
- `entity_ref:` EN-0001
- `question_ref:` QU-0007
- `question_text:` What are you building?
```

### Relationship rule

The archive should always point back to the application-question instance first, then the canonical question if available.

---

## Pull order into Supabase

When automation ingests a slugged QA record set, it should pull in this order:

1. `03-programs/<slug>.md` → entity/program record
2. `04-applications/<slug>.md` → application instance
3. `05-questions/source/<slug>.md` → `AQ` rows
4. `05-questions/index/*.md` → `QU` mappings
5. `07-apply/<slug>.md` → optional draft/review layer
6. `08-submitted/archive/<slug>.md` → answer archive layer

This keeps parent ingestion deterministic:
- entity first
- application second
- question instances third
- canonical question mapping fourth

---

## Minimal automation guarantee

If a slug has:
- one `03-programs/<slug>.md`
- one `04-applications/<slug>.md`
- one `05-questions/source/<slug>.md`

then the parent system has enough serialized structure to pull:
- host identity
- application identity
- question provenance

Everything else improves downstream reuse, but those three files are the minimum machine-ingestible archive unit.
