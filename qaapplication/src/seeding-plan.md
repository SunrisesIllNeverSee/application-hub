# Application Hub — Category Seeding Plan
_A prompt doc and execution guide for Claude Code / vscode-claude sessions in mcp_eval_

---

## What this doc is

How to seed new program categories into Application Hub — replicating what worked for
tech startup accelerators, scaled to universities, grants, fellowships, and job categories.

Designed to be handed to a Claude Code agent in vscode-claude as a standalone prompt.
Each section = one agent session (or one parallel batch of sessions).

---

## The proven pipeline (how tech seeding worked)

```
Phase A  — Source list curation           (human-curated CSV or known DB)
Phase B  — Homepage -> apply_url discovery (10 parallel agents, Firecrawl + curl)
Phase C  — apply_url -> question extraction (headless Playwright, batch JSONL)
Phase D  — Question deduplication + scoring (Python aggregate, significance calc)
Phase E  — Promote to Supabase             (reviewed SQL, human-gated)
```

What FundingCake gave us for tech: 843 program shells with 0 apply_urls.
We ran Phase B-E to get 31 programs fully seeded with questions.
For other categories, we start at Phase A — we own the list.

---

## Target categories + source strategy

### 1. Universities / Graduate Programs
- Target: Top 250 MBA, CS, Design, Public Policy programs (US + international)
- Source: US News rankings, QS World rankings (manually curated CSV)
- Apply URL pattern: school.edu/graduate/apply or Common App / Slate portal
- Question format: Slate ATS (most schools), Common App, PDF uploads
- Expected yield: 40-60% (Slate is JS-heavy but parseable)
- Priority first: Stanford GSB, HBS, Wharton, MIT Sloan; CMU SCS, MIT EECS

### 2. Federal + Foundation Grants
- Target: NSF SBIR/STTR, NIH SBIR, USDA, MacArthur, Knight, Melinda Gates
- Source: Grants.gov export (XML), Foundation Directory Online, agency websites
- Apply URL pattern: Grants.gov, SAM.gov, FastLane (NSF), eRA Commons (NIH)
- Question format: SF-424 standard forms + narrative sections = excellent signal
- Expected yield: 60-80% (federal forms always HTML/PDF, no JS gates)
- Priority first: NSF SBIR Phase I + II, USDA Value-Added Producer Grants, Knight

### 3. Fellowships (non-tech)
- Target: Rhodes, Marshall, Gates Cambridge, Fulbright, Soros, Obama Foundation
- Source: Manual curation ~80 top fellowships
- Apply URL pattern: Direct portals, Embark (Slate-like), Kaleidoscope
- Question format: Essay-heavy, defined prompts — perfect answer bank signal
- Expected yield: 70%+ (essay prompts always visible in HTML)
- Priority first: Fulbright, Gates Cambridge, Obama Foundation

### 4. Job Applications (sector-specific)
- Target: Top 50 employers per sector (tech, finance, govt, nonprofit)
- Source: Glassdoor "Top Places to Work", LinkedIn Jobs sector filters
- Apply URL pattern: Workday, Greenhouse, Lever, BambooHR portals
- Question format: ATS structured questions, DEI statements
- Expected yield: 50% (Workday often login-gated, Greenhouse fully public)
- Priority first: USAJobs (all public), Big Tech Greenhouse portals, TFA/City Year

---

## Phase A — Source List Curation

Agent prompt template:

```
You are building a seed list of [CATEGORY] programs for Application Hub.
Application Hub tracks programs with structured application questions
(not just "email your resume" or generic contact forms).

Task: Produce a CSV with these columns:
  slug, name, type, url, apply_url_guess, confidence, notes

Rules:
- slug: lowercase-hyphenated (e.g. "stanford-mba")
- type: accelerator | fellowship | grant | university | job_board
- url: program homepage
- apply_url_guess: best guess at the application URL (blank if unknown)
- confidence: high | medium | low | unknown
- notes: platform if known (Slate, Workday, Greenhouse, Grants.gov, etc.)

Target: [specific list — e.g. "US News Top 100 MBA programs"]
Output: CSV only, no commentary.
```

---

## Phase B — apply_url Discovery

Reuses the existing Firecrawl pipeline. Run existing script:

```
npx tsx scripts/scrape-apply-questions.ts \
  --input seed/staging/[category]_source.json \
  --output seed/staging/[category]_apply_urls.jsonl \
  --concurrency 5
```

Or use 10 parallel Claude Code agents (each owns 25 programs = 250 programs in ~20 min).

Agent prompt template:
```
You are discovering apply URLs for a batch of [CATEGORY] programs.
For each program, fetch the homepage and find the actual application form link.

Priority order:
1. Firecrawl / curl
2. Search "[program name] application 2026 apply"
3. Common patterns: /apply, /apply-now, /admissions/apply, /program/apply

Output JSON per program:
{
  "slug": "...",
  "name": "...",
  "homepage": "...",
  "apply_url": null,
  "confidence": "high|medium|low|not_found",
  "platform": "Workday|Greenhouse|Slate|Grants.gov|unknown",
  "notes": "..."
}

Batch: [JSON array of programs]
```

---

## Phase C — Question Extraction

Uses existing Playwright scraper for JS-heavy forms, or curl for HTML forms.

```
# JS-heavy forms (Slate, AcceleratorApp, Typeform):
npx tsx scripts/scrape-apply-questions.ts \
  --input seed/staging/[category]_apply_urls.jsonl \
  --output seed/staging/[category]_questions.jsonl

# Federal / HTML forms:
python3 scripts/scrape_apply_questions.py \
  --input seed/staging/grants_apply_urls.jsonl \
  --output seed/staging/grants_questions.jsonl
```

Per-platform notes:
- Slate (universities): Playwright required. Questions in label tags.
- Workday: Login-gated. Skip or use known public question lists.
- Greenhouse: Fully public. curl works. Questions in label + textarea.
- Grants.gov: XML schema. Narrative sections = questions.

---

## Phase D — Deduplication + Significance Scoring

```
python3 scripts/aggregate-question-frequency.py \
  --input seed/staging/[category]_questions.jsonl \
  --output seed/staging/[category]_questions_aggregated.csv
```

Produces: deduplicated text, asked_by_count, avg_word_limit, suggested_theme, significance.

Manual review needed for:
- New themes not in current enum (universities: research, diversity, financial)
- Word limit detection (PDF forms don't always specify)
- Question quality — reject logistics questions

---

## Phase E — Promote to Supabase (HUMAN-GATED, never auto-promote)

```sql
-- 1. Insert new archived questions
INSERT INTO archived_questions (text, theme, significance_score, asked_by_count, typical_word_limit)
VALUES
  ('Describe your research methodology.', 'technical', 0.72, 14, 500),
  ('Why are you pursuing this fellowship?', 'personal', 0.88, 31, 750)
ON CONFLICT (text) DO UPDATE SET
  asked_by_count = archived_questions.asked_by_count + EXCLUDED.asked_by_count,
  significance_score = GREATEST(archived_questions.significance_score, EXCLUDED.significance_score);

-- 2. Insert or update programs
INSERT INTO programs (slug, name, type, url, apply_url, source)
VALUES ('stanford-mba', 'Stanford Graduate School of Business', 'fellowship',
        'https://gsb.stanford.edu',
        'https://gsb.stanford.edu/programs/mba/admission/applying', 'manual')
ON CONFLICT (slug) DO UPDATE SET apply_url = EXCLUDED.apply_url;

-- 3. Link questions to programs
INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, word_limit, order_index)
SELECT p.id, q.id, q.text, true, 500, 1
FROM programs p, archived_questions q
WHERE p.slug = 'stanford-mba' AND q.text ILIKE '%research methodology%';
```

---

## Parallelization strategy (recommended)

For 250+ programs, run as parallel batches:

```
Session 1: Phase A — curate list (1 agent, ~30 min)
Session 2+3: Phase B — apply_url discovery split 2x (5 parallel agents each)
Session 4: Phase C — question extraction (10 parallel agents, 25 programs each)
Session 5: Phase D — aggregation (1 agent)
Session 6: Phase E — human review + SQL promotion
```

Estimated time for 250 universities: 3-4 hours agent time, 2 hours human review.

---

## Priority order for next sessions

1. Federal grants — highest yield, fully public, massive question quality signal
2. Top 50 fellowships — essay-heavy = perfect answer bank material
3. University grad programs — Slate is crackable, huge user demand
4. Job applications — Greenhouse is fully public, large corpus

---

## Files to reference in each agent session

- scripts/scrape-apply-questions.ts — main scraper (Playwright)
- scripts/aggregate-question-frequency.py — deduplication + scoring
- seed/staging/fundingcake_apply_urls.csv — reference input format
- seed/staging/extracted_questions.jsonl — reference output format
- docs/26_fundingcake_ingest_pipeline.md — full FundingCake methodology audit trail
- migrations/002_core_tables.sql — schema reference
- .agents/registry.yaml — canonical count tracker (update after each Phase E)

---

## Registry update after each Phase E

After promoting any batch, update .agents/registry.yaml:

```yaml
programs:
  total: <new total>
  seeded_with_questions: <new count>
  shells: <total minus seeded>

questions:
  archived_total: <new total>
  category_breakdown:
    tech_accelerators: 225
    federal_grants: <new>
    fellowships: <new>
    universities: <new>
    jobs: <new>
```

---

Last updated: 2026-05-12
Author: Claude Code (Sonnet 4.6) with Deric McHenry
