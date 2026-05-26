# 07-answers/index — Rolling Answer Bank (TOC)

Every answer ever submitted, harvested across programs and indexed by
canonical question. Each theme file is a flat append-only log; entries
are keyed by `QU-XXXX · AP-<slug> · YYYY-MM-DD` and the body is the
verbatim answer.

The question text itself is *not* repeated in entries — it lives once
in the **Question legend** table at the top of each theme file.

## How to read an entry

```markdown
## QU-0035 · AP-cyberfund · 2026-05-23
[verbatim answer text]
```

- `QU-0035` — canonical question identity (look up in the file's
  question legend, or in the parent `05-questions/index/` lane once
  the question index is harvested)
- `AP-cyberfund` — application identity (matches the slug used across
  `03-programs/`, `04-applications/`, `09-submitted/archived_applications/`)
- `2026-05-23` — submission date

## Themes

| Theme | File | QU range | Coverage |
| --- | --- | --- | --- |
| Bio (identity, social, location, education, experience) | [bio.md](answer-index/bio.md) | QU-0001 → QU-0018 | name, email, LinkedIn, X, GitHub, phone, country/state/city, citizenship, visa, education, years of experience, technical Y/N, portfolio URLs, co-founder, relationship |
| Background (proudest, founder experience) | [background.md](answer-index/background.md) | QU-0019 → QU-0020 | relevant experience, most-proud-of accomplishments |
| Project (identity, description, taxonomy) | [project.md](answer-index/project.md) | QU-0021 → QU-0029 | name, one-liner, description, sector, stage, websites, founded date, legal entity, architecture link |
| Problem (statement, motivation, urgency) | [problem.md](answer-index/problem.md) | QU-0030 → QU-0032 | what problem, why solving, what makes it urgent |
| Moat (defensibility, team) | [moat.md](answer-index/moat.md) | QU-0033 → QU-0034 | competitive advantage, team description |
| Traction (current evidence) | [traction.md](answer-index/traction.md) | QU-0035 | substrate traction, products, patents, papers, metrics |
| Funding (history, structure) | [funding.md](answer-index/funding.md) | QU-0036 → QU-0042 | amount raised, round, raise type, valuation, range, rationale, terms |
| Goals (milestones) | [goals.md](answer-index/goals.md) | QU-0043 | plans by target date |
| Source (referral) | [source.md](answer-index/source.md) | QU-0044 | how learned about program |

## Application provenance

Every `AP-<slug>` referenced in this lane resolves to:

- Entity: `../../03-programs/<slug>.md`
- Bare form: `../../04-applications/<slug>.md`
- Filled record: `../../09-submitted/archived_applications/<slug>.md`
- Paired Q+A: `../../09-submitted/archive/<slug>.md`

Currently indexed applications:

| AP | Program | Submitted |
| --- | --- | --- |
| AP-cyberfund | cyber•Fund Monastery | 2026-05-23 |
| AP-3xcapital | 3xCapital | 2026-05-13 |
| AP-a16z-speedrun | a16z Speedrun | Mid-May 2026 |
| AP-solo-fund | Solo Fund (SFP) | ~May 2026 (no verbatim captured) |
| AP-unicorn-fund | NextUnicorn.Fund | Mid-May 2026 (no verbatim captured) |

## Adding new entries

When harvesting an answer from a new application:

1. Identify the canonical question — does it already have a `QU-XXXX`?
   If yes, use it. If no, assign the next available code (currently
   QU-0045 onward) and add to the legend table of the right theme.
2. Append the entry under the matching `## QU-XXXX` block, in the
   format `## QU-XXXX · AP-<slug> · YYYY-MM-DD` followed by the
   verbatim answer.
3. If the answer doesn't fit any existing theme, create a new theme
   file alongside this one and link it from the Themes table above.

## QU code allocation

| Range | Used by |
| --- | --- |
| QU-0001 → QU-0018 | bio.md |
| QU-0019 → QU-0020 | background.md |
| QU-0021 → QU-0029 | project.md |
| QU-0030 → QU-0032 | problem.md |
| QU-0033 → QU-0034 | moat.md |
| QU-0035 | traction.md |
| QU-0036 → QU-0042 | funding.md |
| QU-0043 | goals.md |
| QU-0044 | source.md |
| QU-0045 → | unassigned |
