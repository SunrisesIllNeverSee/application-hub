# Deadline Seed Handoff

The product should not show every program as "Rolling" at public launch, but deadlines change too often to guess.

Use `seed/01_deadline_updates_template.sql` as the update helper after manually verifying official sources.

## Rules

- Use official program pages whenever possible.
- If a program gives only a date, store 23:59 in the program's primary timezone and note the assumption.
- If a program has no current public deadline, leave `closes_at` null and `is_rolling` true only when the program explicitly says rolling.
- Do not backfill old deadlines as if they are upcoming.
- Do not use blog/speculation dates without source notes.

## Suggested Priority Programs

Verify these first because they are high-signal in the Hub:

- Y Combinator
- Techstars Boulder
- 500 Global
- Alchemist Accelerator
- Google for Startups
- SBIR Phase I
- NSF SBIR/STTR
- DOE ARPA-E
- Echoing Green
- Fast Forward
- Halcyon
- MassChallenge

## SQL Workflow

1. Open `seed/01_deadline_updates_template.sql`.
2. Replace the template row with verified rows.
3. Include the source URL and source note in the SQL row for human review.
4. Run the SQL.
5. Confirm the returned rows match expectations.
6. Run the app and verify `/hub` urgency sorting/display.

## Example Row

```sql
(
  'y-combinator',
  '2026-08-04 20:00:00-07'::timestamptz,
  'open'::program_status,
  false,
  'https://www.ycombinator.com/apply',
  'Official apply page; manually verified on 2026-05-10.'
)
```

The example is a shape example, not a source of truth. Verify before applying.

## App Behavior Target

- Non-rolling programs with upcoming deadlines sort first.
- Rolling programs sort after dated opportunities, then by composite score.
- Unknown deadlines should look honest, not broken.
