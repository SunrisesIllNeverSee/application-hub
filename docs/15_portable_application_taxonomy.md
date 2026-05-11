# Application Intake Taxonomy

> Internal architecture doc. Public product stays founder-first. This is the engine layer.

## The Principle

The Answer Bank and Question Archive are domain-agnostic by design — they link questions to answers by UUID. The founder framing is a surface concern, not a schema constraint. This migration (018) proves that by adding two fields that unlock any application domain without changing any existing behavior.

## The Three Layers

```
Public surface     →  founder-first (Hub, Workspace, Bank)
                       stays exactly as is, no changes

Intake engine      →  accepts any application text:
                       YC app, job description, grad school essay,
                       grant form, fellowship application

Portable taxonomy  →  universal_theme normalizes questions across
                       domains so "Tell me about yourself" from YC
                       and Harvard map to the same concept
```

## Domain Values

| Domain | What it covers |
|---|---|
| `founder` | Accelerators, VCs, grants for startups (current) |
| `jobs` | Job applications, cover letters, role-specific prompts |
| `education` | College, grad school, MBA, fellowship essays |
| `grants` | Research grants, arts funding, government programs |
| `general` | Cross-domain or unclassifiable |

All existing questions and programs default to `founder`. New imports are tagged at ingest time.

## Universal Theme Map

The `universal_theme` column normalizes founder-specific themes into portable concepts. When a question arrives from a non-founder domain, it gets tagged with the universal theme — not a founder-specific one.

| Universal theme | Founder (theme) | Jobs | Education | Grants |
|---|---|---|---|---|
| `background` | team | experience | academic_background | qualifications |
| `competency` | traction | skills | activities | track_record |
| `problem` | problem | challenge | research_gap | problem_statement |
| `approach` | solution | methodology | research_plan | methodology |
| `impact` | market | scope | contribution | impact |
| `motivation` | vision | culture_fit | goals | sustainability |
| `personal` | personal | personal | personal_statement | personal |
| `fit` | fit | role_fit | program_fit | eligibility |
| `general` | (other) | (other) | (other) | (other) |

## What This Unlocks (Without New Public Surfaces)

1. **Domain-aware import** — `/api/import/application` detects domain from pasted text and tags the session and extracted questions correctly

2. **Cross-domain Answer Bank** — a founder's answer to "Tell me about a challenge you overcame" from a YC app can surface when they're applying to a job or grad school — same `archived_question_id`, same answer

3. **Question deduplication across domains** — "Why us?" from YC and "Why this role?" from a job posting normalize to `fit` / `fit` — potentially the same archived question

4. **Future public verticals** — `/jobs`, `/school`, `/grants` routes just filter `domain = 'jobs'` etc. No schema migration required.

## What Stays Founder-Only

- `/hub` — program directory (all `domain = 'founder'`)
- `/bank` — question drip (queries `domain = 'founder'`)
- `/workspace` — application workspace (program-specific)
- Landing page, marketing copy, onboarding

## Import Detection Logic

When `/api/import/application` receives pasted text, the LLM prompt includes domain detection:

```
Classify the application domain as one of: founder, jobs, education, grants, general.
Signals:
- founder: mentions startup, funding, equity, cohort, accelerator, MVP, traction
- jobs: mentions role, salary, team, company, responsibilities, qualifications
- education: mentions program, degree, GPA, campus, research, thesis, advisor
- grants: mentions funding period, budget, deliverables, IRB, PI, award
```

The detected domain is stored on `app_import_sessions.domain` and propagated to extracted question tags.

## Schema Added (Migration 018)

```sql
archived_questions.domain          TEXT DEFAULT 'founder'
archived_questions.universal_theme TEXT  -- backfilled from theme
programs.domain                    TEXT DEFAULT 'founder'
app_import_sessions.domain         TEXT DEFAULT 'founder'
import_queue.domain                TEXT DEFAULT 'founder'
```

Indexes: `idx_aq_domain`, `idx_aq_universal_theme`, `idx_programs_domain`

## The Non-Move

We are NOT:
- Building `/jobs`, `/school`, or `/grants` routes yet
- Renaming existing tables or columns
- Changing any existing UI
- Forcing founders to think about cross-domain features

This is purely anti-backtracking infrastructure. The public product is unchanged.
