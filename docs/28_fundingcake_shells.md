# FundingCake Shell Programs

## What they are

Migration `019_fundingcake_seed.sql` bulk-imported 812 programs from FundingCake.com. These are **directory-only shells** — they have names, logos, URLs, and location metadata, but nothing else.

```
812 programs, source = 'fundingcake'
  0 / 812  have apply_url
  0 / 812  have questions mapped
  0 / 812  have heat score
  0 / 812  have program value score
  0 / 812  have DNA computed
```

## Breakdown by type

| Type (our schema) | FundingCake type | Count | Application surface |
|---|---|---|---|
| `accel` | accelerator | 300 | Unknown — FundingCake didn't capture apply URLs |
| `vc` | vc | 290 | Mostly none — relationship-driven deal flow |
| `other` | community (96), other (122) | 218 | None — meetups, coworking, events |
| `fellowship` | fellowship | 4 | Unknown |

## What the "800+ programs indexed" claim means

The landing page says "800+ programs indexed." This is accurate but qualified:
- ~30 programs are **fully curated** (seeded by hand: questions mapped, DNA computed, value scores)
- ~812 programs are **directory shells** (FundingCake import: name + logo + metadata only)

The shells power the directory — they're real programs in the Hub — but they have no question coverage, so fit scoring doesn't work for them and they sort to the bottom (heat_score = 0).

## The problem with the 290 VCs

Per the ingest lane policy (`docs/21_curated_ingest_lane.md`), VCs with no application surface should be excluded. 290 FundingCake entries are pure VC prestige directory items — no apply URL, no questions, no application intake. They're noise in Founder mode.

They're in the DB because the original bulk import didn't filter by application surface. No questions can ever be mapped to them because they don't have public application forms.

## Plan

### Accelerators (300) — RFC fill path
These are the highest-priority shells. Most real accelerators DO have application questions — FundingCake just didn't capture them. 

The RFC mechanic handles this:
- When a user hits an accelerator shell in the Hub, the empty state prompts them to submit the program URL
- Community submissions → Cowork/admin reviews → questions mapped → program becomes curated
- Submitter earns credits

No bulk action needed. This fills organically as users engage.

### VCs (290) — filter or curate selectively
Options:
1. **Add `hidden = true` flag** to VCs that have no apply_url in details JSONB — they stay in DB but don't appear in Hub
2. **Curate the ones that matter** — a16z Scout, Sequoia Arc, First Round Fast Track, Precursor, etc. have actual intake forms. Manually add apply URLs and questions for the ~20 that matter.
3. **Leave as-is** — they sort last anyway (heat = 0), users see them as dead links

Recommendation: option 2 for the top ~20, option 1 to hide the rest.

### Community entries (96) — hide
Meetups, coworking spaces, conferences. Not programs anyone applies to. Should be hidden from Hub via the `hidden` column or a type filter.

### Fellowships (4) — manual review
Small enough to look at individually. May have real application surfaces.

## How to add questions to a shell

When a program URL has been validated:
1. Scrape the application page (Firecrawl)
2. Extract questions
3. Add to `archived_questions` if new (or map to existing)
4. Add rows to `program_questions` linking program → question
5. Run `compute_program_dna()` for the program
6. Run `compute_significance_scores()` if any new questions were added

See `CONTRIBUTING.md` for the full seed SQL pattern.

## Current state in the app

FundingCake shells appear in `/hub` for Founder mode (type = `accel` or `vc`) but:
- No questions → no answer pre-fill
- No DNA → no DNA radar chart
- No heat/value score → sorted to the bottom
- No deadline → shows as "Rolling"

Users can save them to their applications list but get nothing from the intelligence layer until questions are mapped.
