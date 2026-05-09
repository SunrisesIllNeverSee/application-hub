# Contributing to Application Hub

The highest-leverage contribution right now is **seed data** — real programs with real questions. The intelligence layer (significance scores, DNA weights, fit scores) isn't meaningful until the archive has substance. Adding 30 well-researched programs is worth more than any UI feature.

---

## Adding a program

Each program lives in `seed/programs/[slug].sql`. The slug format is `[org-name]-[round-or-type]`, e.g. `yc-s25`, `techstars-boulder-2025`, `sbir-phase-1`.

### Step 1: Find the actual application

Most programs publish their questions:
- YC: published annually, widely documented
- Techstars: available in application portal (create free account)
- SBIR: solicitations published at grants.gov and sbir.gov
- Foundation programs: typically on program website

Do not guess questions. Use exact phrasing from the real application.

### Step 2: Create the seed file

```sql
-- seed/programs/yc-s25.sql

-- 1. Insert the program
INSERT INTO programs (
  slug, name, organization, type, status,
  round, opens_at, closes_at,
  check_size_min, check_size_max,  -- in USD cents
  equity_taken,                     -- as decimal: 0.07 = 7%
  is_rolling,
  cash_value_usd, credit_value_usd,
  program_value_score,              -- leave NULL if unknown, cron will compute
  description, url
) VALUES (
  'yc-s25',
  'Y Combinator S25',
  'Y Combinator',
  'accelerator',
  'open',
  'S25',
  '2025-01-10 00:00:00+00',
  '2025-04-01 00:00:00+00',
  50000 * 100,    -- $500K check (fictitious example)
  50000 * 100,
  0.07,           -- 7% equity
  FALSE,          -- cohort, not rolling
  500000,         -- cash_value_usd
  NULL,           -- no AWS credits
  NULL,           -- program_value_score — let cron compute
  'Y Combinator is a startup accelerator that invests in a wide range of startups twice a year.',
  'https://www.ycombinator.com/apply'
);

-- 2. Insert archived questions (one row per unique question)
-- If a question already exists (same text, same theme), use its existing UUID.
-- These get deduped by the platform over time.

INSERT INTO archived_questions (text, theme, response_type, typical_word_limit, asked_by_count, is_universal, example_programs)
VALUES
  ('Describe what your company does in 50 characters or less.', 'product', 'text_short', 50, 1, FALSE, ARRAY['Y Combinator']),
  ('What is your company going to make?', 'product', 'text_long', 150, 1, FALSE, ARRAY['Y Combinator']),
  ('Who are your founders, and what makes them the right team to build this?', 'team', 'text_long', 200, 1, TRUE, ARRAY['Y Combinator']),
  ('How far along are you?', 'traction', 'text_long', 150, 1, TRUE, ARRAY['Y Combinator']),
  ('Why did you pick this idea to work on?', 'vision', 'text_long', 200, 1, FALSE, ARRAY['Y Combinator']),
  ('What do you understand about your users that similar companies have missed?', 'market', 'text_long', 200, 1, FALSE, ARRAY['Y Combinator'])
ON CONFLICT DO NOTHING;

-- 3. Link questions to this program with exact phrasing + word limits
-- Use the archived_question_id (you may need to query by text if just inserted above)

WITH inserted_questions AS (
  SELECT id, text FROM archived_questions
  WHERE text IN (
    'Describe what your company does in 50 characters or less.',
    'What is your company going to make?',
    'Who are your founders, and what makes them the right team to build this?',
    'How far along are you?',
    'Why did you pick this idea to work on?',
    'What do you understand about your users that similar companies have missed?'
  )
),
program AS (SELECT id FROM programs WHERE slug = 'yc-s25')
INSERT INTO program_questions (program_id, archived_question_id, asked_as, word_limit, is_required, order_index)
SELECT
  (SELECT id FROM program),
  iq.id,
  iq.text,  -- for YC the phrasing matches; adjust as needed
  CASE iq.text
    WHEN 'Describe what your company does in 50 characters or less.' THEN 50
    WHEN 'What is your company going to make?' THEN 150
    WHEN 'Who are your founders, and what makes them the right team to build this?' THEN 200
    WHEN 'How far along are you?' THEN 150
    WHEN 'Why did you pick this idea to work on?' THEN 200
    WHEN 'What do you understand about your users that similar companies have missed?' THEN 200
  END,
  TRUE,
  ROW_NUMBER() OVER (ORDER BY iq.text)  -- adjust order_index to match actual form order
FROM inserted_questions iq
ON CONFLICT (program_id, archived_question_id) DO NOTHING;
```

### Step 3: Run significance + DNA refresh

After seeding, trigger a refresh manually:

```sql
SELECT compute_significance_scores();
SELECT compute_program_dna();
```

Or just wait for the nightly cron (runs at 02:00-03:30 UTC).

### Step 4: Verify

```sql
-- Check DNA weights look right
SELECT theme, weight_pct FROM program_dna
WHERE program_id = (SELECT id FROM programs WHERE slug = 'yc-s25')
ORDER BY weight_pct DESC;

-- Check significance scores are populated
SELECT text, significance_score, asked_by_count
FROM archived_questions
ORDER BY significance_score DESC
LIMIT 10;
```

---

## Question themes

Use one of these exact theme values when inserting archived questions:

| Theme | What it covers |
|---|---|
| `team` | Founders, background, co-founder relationship, advisors |
| `traction` | Revenue, users, growth, metrics, milestones |
| `product` | What you're building, technical approach, demo |
| `market` | TAM, competition, positioning, customer insight |
| `vision` | Why this, why now, long-term mission |
| `financials` | Revenue model, burn, runway, pricing |
| `impact` | Social/environmental impact (for foundations + impact programs) |
| `legal` | Entity structure, IP, prior funding |
| `other` | Logistics, references, video pitches, etc. |

---

## Universal questions

Set `is_universal = TRUE` for any question asked by 80% or more of programs in the archive. At <30 programs seeded, be conservative — mark universal only the ones you've verified appear in 5+ programs.

Universal questions surface first in profile onboarding. They're the highest-leverage answers to write first.

Examples of likely universals:
- "What does your company do?"
- "Who is on the team?"
- "How far along are you?"
- "What's your revenue / traction?"

---

## Code contributions

- TypeScript only in `application-hub-mcp-server/src/`
- Run `npm run build` before submitting — must compile clean
- New tools go in `src/tools/[category]/hub_[tool_name].ts` and must be registered in `src/index.ts`
- Follow the existing Zod schema pattern — `.strict()` on all input schemas
- Supabase join access pattern: `Array.isArray(row.joined) ? row.joined[0] : row.joined` then `as unknown as T`

---

## Questions?

Open an issue. See `.github/ISSUE_TEMPLATE/` for templates.
