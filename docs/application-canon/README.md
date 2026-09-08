# Application Canon

**Status:** Active
**Effective date:** 2026-09-06
**Owner:** Deric / Ello Cello
**Review cadence:** On application cycle changes or quarterly

## Purpose

The Application Canon is the file-based source of truth for the AQUA application graph. It profiles three core entities — companies, applications, and questions — using the same canon pattern as the social profile canon: source of truth, variants, snippets, changelog.

The database (Supabase) is the production store. This canon is the human-readable, version-controlled, agent-editable layer that sits above it. Changes here are the canonical input; the database is the projection.

## Structure

```
docs/application-canon/
├── README.md                  — this file
├── CHANGELOG.md               — notation of every change
├── companies/                 — one profile per company/funder
│   ├── y-combinator.md
│   ├── techstars.md
│   └── ...
├── applications/              — one profile per application cycle or job posting
│   ├── yc-w26.md
│   ├── techstars-boulder-2026.md
│   └── ...
├── questions/                 — one profile per archived question
│   ├── tell-me-about-yourself.md
│   ├── what-is-your-traction.md
│   └── ...
├── answers/                   — answer variants per question per target
│   ├── tell-me-about-yourself-yc.md
│   ├── tell-me-about-yourself-jobs.md
│   └── ...
└── templates/                 — blank templates for each entity type
    ├── company-profile-template.md
    ├── application-profile-template.md
    ├── question-profile-template.md
    └── answer-variant-template.md
```

## Entity relationships

```
Company ──runs──→ Application ──asks──→ Question ←──answered by──→ Answer
  │                    │                    │                         │
  profile              profile              profile                   variant
  (companies/)         (applications/)      (questions/)              (answers/)
```

- A **company** (YC, Techstars, Google, a specific employer) creates one or more **applications**
- An **application** (YC W26, a specific job posting) asks one or more **questions**
- A **question** (Tell me about yourself, What's your traction?) can appear across many applications
- An **answer** is a variant written for a specific question, tuned for a specific target

## Canon rules

1. **Change the canon first, then sync to database.** Not the other way around.
2. **One file per entity.** No mega-files. Each company, application, question, and answer gets its own file.
3. **No `_final`, `_new`, `_updated` suffixes.** Update the canonical file or archive with provenance.
4. **Every change gets a changelog entry** with date, what changed, and why.
5. **Templates are the schema.** Every profile follows its template. Add fields to the template first, then propagate.
6. **Universal themes normalize across domains.** Use the universal theme map (background, competency, problem, approach, impact, motivation, personal, fit, general).
7. **Significance scores are canonical.** The `significance_score` in a question profile is the source of truth, not a database column.
8. **Answer variants are per-target.** The same question gets different answers for YC vs a job vs a grant. Each variant is a separate file.

## MCP integration

| MCP | Role in this canon |
|---|---|
| `filesystem` | Create, read, edit, move profile files. This is the primary canon tool. |
| `pdf-mcp` | Parse PDF resumes, job postings, old applications into canon format. |
| `markitdown` | Convert any input (URL, DOCX, HTML) to markdown for canon ingestion. |
| `knowledge-graph` | Create entity/relation graph mirroring the canon structure. Query cross-entity relationships. |
| `supabase` | Persist canon content to the AQUA production database. |
| `web-scrape` / `firecrawl` | Capture job postings and application pages for ingestion. |
| `google-workspace` | Read/write resumes and cover letters in Google Docs. |

## Workflow

```
1. INGEST: URL or PDF → markitdown/pdf-mcp → markdown
2. PROFILE: Create company profile, application profile, question profiles
3. CATEGORIZE: Tag by domain (founder/jobs/education/grants) and universal theme
4. MATCH: Find existing questions and answers that overlap
5. VARIANT: Write answer variant for this specific target
6. SYNC: Filesystem canon → supabase database
7. FILL: Browser extension fills application fields from answer bank
8. STRESS TEST: RNS/MO§ES review layer probes answers
9. ARCHIVE: Log outcome (accepted/rejected/waitlisted) back to canon
```
