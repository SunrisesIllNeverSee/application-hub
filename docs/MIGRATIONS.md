---
type: Reference
title: Application Hub — Migration Policy
description: Application Hub — Migration Policy — documentation in docs/.
tags: [documentation, docs]
timestamp: 2026-08-19
---

# Application Hub — Migration Policy

_Last updated: 2026-08-12_

## Canonical chain

The canonical migration chain lives in `supabase/migrations/`. The current
high-water mark is recorded in `docs/archive/build-era/agents/registry.yaml` (machine-readable) and
`docs/STATUS.md` (human-readable). Check those files for the current applied/next
numbers rather than relying on this doc.

## Legacy root `migrations/` — frozen

The root `migrations/` directory is **frozen legacy**. It holds 4 tracked files
that predate the move to `supabase/migrations/`. New migrations must go in
`supabase/migrations/` only.

| Legacy file | Canonical counterpart | Relationship |
|---|---|---|
| `migrations/022_stripe_events.sql` | `supabase/migrations/022_stripe_events.sql` | Byte-identical duplicate (same content, relocated). |
| `migrations/033_fix_security_definer_views.sql` | `supabase/migrations/033_fix_security_definer_views.sql` | Byte-identical duplicate (same content, relocated). |
| `migrations/042_persona_profiles.sql` | `supabase/migrations/042_canonical_hub_and_lineage.sql` | **Collision — different content.** Legacy creates `profiles`, `persona_profile_answers`, `profile_persona_enrichments` tables + indexes/policies/triggers. Canonical creates `canonical_commitments`, `answer_variants`, `application_packages`, `lineage_events`. |
| `migrations/043_smart_matcher.sql` | `supabase/migrations/043_canonical_rpc_functions.sql` | **Collision — different content.** Legacy adds `programs.program_embedding` column + `compute_smart_matcher_recommendations()` RPC. Canonical adds `embedding` column to `canonical_commitments` + `semantic_search_canonicals()` RPC. |

### Live-DB verification status (2026-08-12)

The legacy `022` and `033` files are identical to their canonical counterparts,
so their objects are confirmed applied (the canonical chain is the applied
chain).

The legacy `042_persona_profiles.sql` and `043_smart_matcher.sql` create
objects that are **not** part of the canonical chain. Whether those objects
exist on the live Supabase project has not been verified via
`information_schema` query (no Supabase MCP configured in this session).
**Deric should verify** by running:

```sql
-- Check for legacy 042 objects
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'persona_profile_answers', 'profile_persona_enrichments');

-- Check for legacy 043 objects
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'programs'
  AND column_name = 'program_embedding';

SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'compute_smart_matcher_recommendations';
```

If any of those return rows, the legacy migration was applied to the live DB
at some point and the objects should be evaluated for removal or integration.
If they return no rows, the legacy files were never applied and are pure
dead code.

### Policy for the legacy root

- **Do not rename** any file under `migrations/` (root) or `supabase/migrations/`.
- **Do not add** new migrations to the root `migrations/` directory.
- The canonical chain is `supabase/migrations/` only.
- The root `migrations/` directory is kept for history; it is not an active
  migration target.

## Why duplicate numeric prefixes exist

This repo has a few duplicated numeric prefixes within `supabase/migrations/`:
- `018_opportunity_taxonomy.sql`
- `018_portable_taxonomy.sql`
- `022_stripe_events.sql`
- `022_user_integrations_unique_provider.sql`

These are historical artifacts from parallel feature work that landed on the
same day, not signs of a broken database history.

## Policy

- Do **not** rename already-applied migration files casually just to make the numbers prettier.
- When documenting state, refer to `docs/archive/build-era/agents/registry.yaml` for the current high-water mark.
- When adding new work, use the next clear numeric prefix rather than trying to retroactively normalize old collisions.

## Practical guidance

- If you are applying to a fresh environment manually, use the repository order intentionally and double-check the duplicate-prefix files.
- If you are writing docs, point to this file instead of re-explaining the duplicate-prefix caveat everywhere.

The goal is stable history, not cosmetic perfection.

## Production application status, 052 to 057 (recorded 2026-10-22)

Migrations 052 to 057 are **applied in production**. The file headers of 052 to 055 still read "PREPARED, DO NOT APPLY"; those headers are historical (written before owner authorization) and are intentionally not edited, per the no-rename and no-casual-edit policy above.

| Migration | Applied effect |
|---|---|
| 052 canonical catalog read boundary | Public/anon reads limited to canonical program rows and their questions/stats |
| 053 canonical promotion | Promotion of the 5 canonical programs |
| 054 canonical write boundary | Database-level write boundary for canonical catalog tables |
| 055 team invite acceptance | Team invite acceptance path |
| 056 deferred teams write boundary | Write lockdown for deferred Teams tables |
| 057 complete deferred teams write lockdown | Completes the Teams write lockdown |

056 and 057 use timestamp-style prefixes (`20261021214324_`, `20261021214559_`) because they were created through the Supabase CLI. Treat the production migration ledger as authoritative over file headers.
