# Curated Ingest Lane

Application Hub does not need a broad startup-ecosystem database.

It needs a narrow, compounding intake lane for targets that strengthen the product's actual spine:

- applications
- funding programs
- reusable questions

If a target does not create a real application surface, funding workflow, or reusable question archive value, it does not belong in the active ingest lane.

---

## Boundary

### Include

- Accelerators
- Grants
- Fellowships
- Incubators
- Venture programs with structured application intake
- Founder programs with repeatable application questions
- Funding opportunities with public application pages or documented selection criteria

### Exclude

- Generic VC prestige tracking
- Ecosystem personalities
- Firms with no application surface
- Media lists and startup gossip
- Programs with no usable question, funding, or application signal

---

## Firecrawl's role

Firecrawl is an on-demand research and extraction layer, not a hard dependency inside the core schema.

Use it when we need to:

- discover candidate programs
- scrape a known application page
- pull program details into `.firecrawl/`
- extract question wording from public application flows
- collect deadline, cohort, and funding terms before seeding

Do not treat Firecrawl output as production truth by itself.

Everything should pass through a human-reviewed staging lane first.

---

## Staging flow

1. Discover a candidate target.
2. Check whether it has a real application, funding, or reusable question surface.
3. Add it to `seed/staging/application_targets_watchlist.csv`.
4. Capture source links and the reason it matters.
5. Promote only when there is enough signal to support seed SQL or question extraction.

Status meanings:

- `watchlist` — interesting, but not researched enough yet
- `researching` — source collection in progress
- `seed_ready` — enough verified detail to create or update seed SQL
- `archived` — outdated, duplicate, or out of scope

---

## Minimum evidence for promotion

A candidate should usually have at least two of these before promotion:

- public application page
- visible program details or funding terms
- actual question wording or intake prompts
- deadline/cohort details
- clear fit with founder application workflow

If it has brand prestige but no usable application surface, leave it out.

---

## Suggested fields

The staging CSV uses these columns:

- `slug`
- `org_name`
- `program_name`
- `target_type`
- `application_surface`
- `question_surface`
- `funding_surface`
- `status`
- `priority`
- `why_it_matters`
- `source_url`
- `notes`

These fields are intentionally lightweight. They are for triage, not final schema commitment.

---

## Promotion rule

Promote a target only when it improves at least one of:

- the program directory
- the question archive
- the answer bank
- fit scoring
- deadline tracking

If it does not clearly strengthen one of those, skip it.
