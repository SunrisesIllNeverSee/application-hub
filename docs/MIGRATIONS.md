# Application Hub — Migration Policy

_Last updated: 2026-05-11_

## Canonical chain

The logical migration chain is:

```text
001 → 027
```

## Why duplicate numeric prefixes exist

This repo has a few duplicated numeric prefixes:
- `018_opportunity_taxonomy.sql`
- `018_portable_taxonomy.sql`
- `022_stripe_events.sql`
- `022_user_integrations_unique_provider.sql`

These are historical artifacts from parallel feature work that landed on the same day, not signs of a broken database history.

## Policy

- Treat the logical chain as `001` through `027`.
- Do **not** rename already-applied migration files casually just to make the numbers prettier.
- When documenting state, say “migrations through 026” rather than implying there are only 26 physical files with perfect numbering.
- When adding new work, use the next clear numeric prefix rather than trying to retroactively normalize old collisions.

## Migration 027

`027_recruiter_alerts.sql` adds the `recruiter_alerts` dedup table for the weekly
recruiter email agent. No duplicate prefix — it is the only `027` file. See
`docs/22_recruiter_agent.md` for deployment and activation steps.

## Practical guidance

- If you are applying to a fresh environment manually, use the repository order intentionally and double-check the duplicate-prefix files.
- If you are writing docs, point to this file instead of re-explaining the duplicate-prefix caveat everywhere.

The goal is stable history, not cosmetic perfection.
