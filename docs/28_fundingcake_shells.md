# FundingCake Programs

## What they are

Migration `019_fundingcake_seed.sql` imported 812 programs from FundingCake.com — a platform that specifically curates **funding opportunities with real money attached** (accelerators, VCs, grants, fellowships). These are legitimate entities, not junk.

```
812 programs, source = 'fundingcake'
 782 / 812  have a program URL (their website)
 778 / 812  have a description
  29 / 812  have money_terms data in JSONB
   9 / 812  have equity_pct data
   0 / 812  have apply_url  ← the actual gap
   0 / 812  have questions mapped
   0 / 812  have heat/value scores computed
```

## The real gap: apply_url was never captured

FundingCake records the program's **homepage URL** but not the **application intake URL**. So every program has a `url` you can visit, but the field `details->apply_url` is null across all 812.

This means:
- The programs are real and have money
- We know their website (782/812)
- We just don't have the direct link to "apply here" or the questions on that page

The work is: take the 782 URLs → find the application page → extract questions. That's the standard curated ingest path (`docs/21_curated_ingest_lane.md`).

## Breakdown by type

| Type | Count | Notes |
|---|---|---|
| `accel` (accelerator) | 300 | Real accelerators. Most have application intake. Top targets for question ingest. |
| `vc` | 290 | Mix: some run structured programs (scout, cohort, fast-track) with real intake; others are pure deal flow with no public application form. Need case-by-case review. |
| `other` | 218 | Includes 96 "community" (meetups, coworking, events) — those are noise. The remaining ~122 are uncategorized programs worth reviewing. |
| `fellowship` | 4 | Likely have application intake. Small enough to curate manually. |

## What "800+ programs indexed" means on the landing page

- ~30 programs: **fully curated** — questions mapped, DNA computed, fit scores active
- ~812 programs: **URL-indexed** — in the directory, show in Hub, but no question coverage yet

Both are legitimate. "Indexed" = in the archive. "Curated" = questions mapped and scored. The landing page claim is accurate.

## How these programs appear in the app today

FundingCake programs show up in `/hub` filtered by mode (Founder = accel/vc, Researcher = grant/fellowship). They appear in the Hub list but:
- No questions → no answer pre-fill in workspace
- No DNA → no radar chart on program detail
- No heat/value score → sort to bottom (heat_score = 0)
- No deadline → shows as "Rolling"

A user can save them and track applications, but gets nothing from the intelligence layer until questions are mapped.

## Fill path

### Short-term: RFC mechanic (passive)
When a logged-in user hits an empty program in Hub, the sparse empty state already prompts them to submit the program URL. Community submissions → admin review → questions extracted. Submitter earns credits. This fills organically.

### Medium-term: targeted ingest (active)
Priority order for manual curation:
1. Top 50 accelerators by brand recognition (YC, Techstars, 500 Global, etc. — most are already in the curated 30)
2. VC scout/cohort programs that have real application forms (a16z Scout, Sequoia Arc, First Round Fast Track, Precursor, Hustle Fund, etc.)
3. Fellowships (only 4 from FundingCake)
4. "Community" entries — evaluate individually, hide those that are meetups/events

### How to map questions to a program
1. Visit `programs.url` → find the application page
2. Extract questions (manually or via Firecrawl)
3. Insert new questions into `archived_questions` if not already there
4. Insert `program_questions` rows linking program → question
5. Run `compute_program_dna()` for that program
6. Run `compute_significance_scores()` if new questions were added

See `CONTRIBUTING.md` for the seed SQL pattern.
