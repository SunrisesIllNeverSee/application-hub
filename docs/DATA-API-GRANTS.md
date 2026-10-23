---
type: Reference
title: Application Hub — Data API Grants (M09 W11)
description: Inventory of anon/authenticated/service_role grants on every public table, view, sequence and function; classes; mismatches; the 2026-10-30 Supabase default-privilege change and the owner apply order for 058/059.
tags: [database, supabase, grants, rls, migrations]
timestamp: 2026-10-22
---

# Data API grants

_Captured 2026-10-22. Migration files: `059` (applied chain, PREPARED),
`058` (PREPARED), `proposed/060` (not in the chain)._

## 1. What changes on 2026-10-30

| Date | Supabase change |
|---|---|
| 2026-05-30 | New projects stop granting `anon`, `authenticated` and `service_role` access to new tables and sequences in `public`. |
| **2026-10-30** | The same applies to **existing projects** (AppFeeder included). Existing tables keep their grants. |

Covered: tables (SELECT, INSERT, UPDATE, DELETE) and sequences (USAGE,
SELECT) created after the date in `public`. Supabase's opt-in revokes
exactly these privileges. New tables still default to TRUNCATE,
REFERENCES, TRIGGER and MAINTAIN, and sequences to UPDATE. Functions are
not affected. A missing grant shows up as PostgREST error **42501**.

What it means here:

- **Production today:** no effect. Every table that exists keeps its grants.
- **Fresh rebuilds** (local reset, branches, a new project): before 059,
  the chain created every table without Data API grants, and every route
  would get 42501. 059 states the grants explicitly. The harness shows
  that a rebuild under the new defaults equals production (section 7).
- **New migrations:** from 059 on, each one grants its own objects in the
  same file (`docs/MIGRATIONS.md`, CI lint).

## 2. Owner steps (in this order)

All steps need owner authorization. Run them as `postgres` against
AppFeeder. Nothing in this branch has been applied.

1. **Before 2026-10-30, apply 059**
   (`supabase/migrations/20261022200000_059_explicit_data_api_grants.sql`).
   On production it only restates existing grants, so no effective
   privilege changes. It also switches `postgres`' default privileges in
   `public` to the new Supabase default, which Supabase does for you on
   2026-10-30 anyway. Then run the read-only verification at the end of
   the file.
2. **Apply 058** (`20261022190000_058_...`) **together with or after 059.**
   On production 058 behaves the same before or after 2026-10-30. Every
   058 table and sequence starts from `REVOKE ALL` and gets explicit
   grants, and the harness gets byte-identical grants under the old, new
   and fully revoked defaults. Applying 058 first is also safe on
   production, because the existing tables its functions write already
   carry the grants. It is the fresh rebuild that needs 059, so ship them
   together. With `supabase db push` the ledger order is 058 then 059,
   which is fine.
3. **Optional, separate decision: 060.** Adopt sections of
   `supabase/migrations/proposed/060_tighten_data_api_grants.sql` one by
   one (section 6). Each adopted section becomes a new migration after
   059, and its expectations move into
   `supabase/tests/m09/50_grants_tests.sql`.

If a step is missed: without 059, production keeps working (existing
grants), but any table created after 2026-10-30 without explicit grants
returns 42501. Without 059, fresh rebuilds are broken.

## 3. Baseline source

The baseline is **production**, from read-only catalog queries on
2026-10-22 (`pg_class.relacl` via `aclexplode`, `pg_policies`,
`relrowsecurity`, `pg_default_acl`, `information_schema`). It is stored in
`supabase/tests/m09/fixtures/production_grants_2026-10-22.psv`.

- 75 relations in `public`: 65 tables, 4 views and 6 sequences. 66 come from
  this repository and 9 were created by other apps sharing the project
  (`sigrank_*`, `exchange_*`; out of repo).
- No column-level ACLs. No PUBLIC grants on tables.
- Policy counts and RLS flags in production match a full local rebuild
  table for table.
- Production `postgres` default privileges in `public`: ALL on tables,
  sequences and functions for anon, authenticated and service_role (the
  old default).
- 47 app functions in `public`, plus extension functions from `vector`
  and `pg_trgm`.

A full local rebuild of 001 to 058 under the old defaults reproduces the
snapshot exactly for all 66 in-repo relations.

## 4. Classes

| Class | Meaning | Ideal grants |
|---|---|---|
| (a) | public catalog / reference | anon + authenticated SELECT; service_role CRUD |
| (b) | user-owned Data API table | authenticated only the CRUD its routes use, under RLS; anon none |
| (c) | server-only / internal | service_role only |
| (d) | legacy private-answer tables kept for local-first-off legacy mode | authenticated SELECT (writes only in legacy mode); anon none |
| (e) | Teams (deferred, locked by 056/057) | authenticated SELECT; anon none |

Two rules refine the ideals:

- **RLS policy dependencies.** A policy's subqueries run with the
  caller's privileges, so a role a policy applies to needs SELECT on
  every relation the policy references. anon therefore keeps SELECT on
  `user_applications`, which the catalog read policies reference.
  anon and authenticated keep SELECT on `answer_variants` and
  `application_packages`, which `lineage_events` references. The 50
  suite enforces this (`GR-POLDEP-*`).
- **Triggers and views run as the caller.** authenticated needs
  INSERT/UPDATE on `ai_usage` (the `increment_ai_usage` trigger) and
  INSERT on `profile_answer_history` in legacy mode (the
  `snapshot_profile_answer` trigger). It needs SELECT on `credit_events`
  and `user_contributions`, which the security_invoker views
  `user_credit_balance` and `user_contribution_summary` read.

Role usage per table comes from a code survey of the app, the MCP server,
the extension, the companion and the edge functions. Only the public
`/applications` pages and the companion catalog run as anon, and only
against class (a) tables.

### Counts

| Class | Tables | Views | Sequences | Of which 058 (not yet in production) |
|---|---|---|---|---|
| (a) | 20 | 2 | 0 | 5 tables |
| (b) | 27 | 2 | 4 | 3 tables |
| (c) | 7 | 0 | 5 | 5 sequences |
| (d) | 8 | 0 | 0 | 0 |
| (e) | 4 | 0 | 0 | 0 |
| total | 66 | 4 | 9 | 13 (79 relations rebuilt) |

There are also 9 out-of-repo relations (7 tables, 2 sequences), listed
for completeness and not classified.

### Mismatches

- **Excessive:** all 66 in-repo production relations carry more than their class
  needs (395 CRUD/USAGE findings: anon 228, authenticated 155,
  service_role 12 on views). On top of those, anon/authenticated hold
  non-CRUD privileges (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) on 62 relations.
  The root cause is the old Supabase default of ALL to every API role. The
  13 relations 058 adds have **no** mismatch.
- **Missing:** **none.** Every class need is granted. Teams (e) are
  missing client writes **on purpose**: `api/teams` and
  `api/teams/[id]/invite` still try authenticated writes and get 42501
  since 056/057, by design while Teams are deferred.

## 5. Inventory

Privilege letters: a=INSERT r=SELECT w=UPDATE d=DELETE D=TRUNCATE
x=REFERENCES t=TRIGGER m=MAINTAIN U=USAGE; `-` none. "Class needs" uses
CRUD/USAGE letters. "Pol" is the RLS policy count. Grants are production
values for production relations and 058's values for 058 relations; the
rebuild is identical.

### (a) public catalog/reference

| Object | Kind | anon | auth | svc | RLS | Pol | Class needs (anon / auth / svc) | Mismatch vs class |
|---|---|---|---|---|---|---|---|---|
| `aggregate_versions` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | r / r / arwd | **excessive**: anon +awd; auth +awd; anon/auth +Dxtm |
| `archived_questions` | table | arwdxm | arwdxm | arwdDxtm | on | 1 | r / arw / arwd | **excessive**: anon +awd; auth +d; anon/auth +xm |
| `beta_settings` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 1 | r / r / arwd | **excessive**: anon +awd; auth +awd; anon/auth +Dxtm |
| `canonical_commitments` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | r / r / arwd | **excessive**: anon +awd; auth +awd; anon/auth +Dxtm |
| `catalog_entities` (058) | table | r | r | arwd | on | 1 | r / r / arwd | none |
| `catalog_serials` (058) | table | r | r | arwd | on | 1 | r / r / arwd | none |
| `catalog_sources` (058) | table | - | - | arwd | on | 2 | column SELECT / column SELECT / arwd | none |
| `funders` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 1 | r / r / arwd | **excessive**: anon +awd; auth +awd; anon/auth +Dxtm |
| `lineage_events` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | r / r / arwd | **excessive**: anon +awd; auth +awd; anon/auth +Dxtm |
| `opportunities` | view | arwdDxtm | arwdDxtm | arwdDxtm | n/a | - | r / r / r | **excessive**: anon +awd; auth +awd; svc +awd; anon/auth +Dxtm |
| `program_cycles` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | r / r / arwd | **excessive**: anon +awd; auth +awd; anon/auth +Dxtm |
| `program_dna` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | r / r / arwd | **excessive**: anon +awd; auth +awd; anon/auth +Dxtm |
| `program_listings` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 3 | r / r / arwd | **excessive**: anon +awd; auth +awd; anon/auth +Dxtm |
| `program_next_cycle` | view | arwdDxtm | arwdDxtm | arwdDxtm | n/a | - | r / r / r | **excessive**: anon +awd; auth +awd; svc +awd; anon/auth +Dxtm |
| `program_questions` | table | arwdxm | arwdxm | arwdDxtm | on | 3 | r / arw / arwd | **excessive**: anon +awd; auth +d; anon/auth +xm |
| `program_stats` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | r / r / arwd | **excessive**: anon +awd; auth +awd; anon/auth +Dxtm |
| `program_template_revisions` (058) | table | - | - | arwd | on | 1 | column SELECT / column SELECT / arwd | none |
| `programs` | table | arwdxm | arwdxm | arwdDxtm | on | 3 | r / arw / arwd | **excessive**: anon +awd; auth +d; anon/auth +xm |
| `question_mapping_decisions` (058) | table | - | - | arwd | on | 1 | column SELECT / column SELECT / arwd | none |
| `seeding_entities` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 3 | r / r / arwd | **excessive**: anon +awd; auth +awd; anon/auth +Dxtm |
| `starter_packages` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 1 | r / r / arwd | **excessive**: anon +awd; auth +awd; anon/auth +Dxtm |
| `subscription_plans` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 1 | r / r / arwd | **excessive**: anon +awd; auth +awd; anon/auth +Dxtm |
| `sigrank_operators` (out of repo) | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 1 | not classified here: other app (SigRank), public read | not in 060 (owned elsewhere) |
| `sigrank_operators_id_seq` (out of repo) | seq | rwU | rwU | rwU | n/a | - | not classified here: other app | not in 060 (owned elsewhere) |
| `sigrank_sessions` (out of repo) | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | not classified here: other app (SigRank); INSERT policy WITH CHECK true for public | not in 060 (owned elsewhere) |
| `sigrank_sessions_id_seq` (out of repo) | seq | rwU | rwU | rwU | n/a | - | not classified here: other app | not in 060 (owned elsewhere) |

### (b) user-owned Data API

| Object | Kind | anon | auth | svc | RLS | Pol | Class needs (anon / auth / svc) | Mismatch vs class |
|---|---|---|---|---|---|---|---|---|
| `acceptance_reports` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | - / ar / arwd | **excessive**: anon +arwd; auth +wd; anon/auth +Dxtm |
| `ai_usage` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | - / arw / arwd | **excessive**: anon +arwd; auth +d; anon/auth +Dxtm |
| `canonical_user_credits` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `catalog_candidate_events` (058) | table | - | - | arwd | on | 1 | - / column SELECT / arwd | none |
| `catalog_candidates` (058) | table | - | r | arwd | on | 1 | - / r / arwd | none |
| `catalog_curators` (058) | table | - | r | arwd | on | 1 | - / r / arwd | none |
| `community_messages` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 3 | - / arw / arwd | **excessive**: anon +arwd; auth +d; anon/auth +Dxtm |
| `contribution_rewards` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `credit_events` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `deadline_alerts` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 1 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `import_queue` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 5 | - / ar / arwd | **excessive**: anon +arwd; auth +wd; anon/auth +Dxtm |
| `intake_application_layers` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 1 | - / arw / arwd | **excessive**: anon +arwd; auth +d; anon/auth +Dxtm |
| `intake_applications` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 1 | - / arw / arwd | **excessive**: anon +arwd; auth +d; anon/auth +Dxtm |
| `intake_applications_ref_seq_seq` | seq | rwU | rwU | rwU | n/a | - | - / U / rwU | **excessive**: anon +rwU; auth +rw |
| `intake_entities` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 1 | - / arw / arwd | **excessive**: anon +arwd; auth +d; anon/auth +Dxtm |
| `intake_entities_ref_seq_seq` | seq | rwU | rwU | rwU | n/a | - | - / U / rwU | **excessive**: anon +rwU; auth +rw |
| `intake_events` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | - / ar / arwd | **excessive**: anon +arwd; auth +wd; anon/auth +Dxtm |
| `intake_gate_reviews` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 1 | - / ar / arwd | **excessive**: anon +arwd; auth +wd; anon/auth +Dxtm |
| `intake_questions` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 1 | - / arw / arwd | **excessive**: anon +arwd; auth +d; anon/auth +Dxtm |
| `intake_questions_ref_seq_seq` | seq | rwU | rwU | rwU | n/a | - | - / U / rwU | **excessive**: anon +rwU; auth +rw |
| `intake_submissions_ref_seq_seq` | seq | rwU | rwU | rwU | n/a | - | - / U / rwU | **excessive**: anon +rwU; auth +rw |
| `reward_credit_receipts` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `user_achievements` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `user_applications` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 4 | r / arwd / arwd | **excessive**: anon +awd; anon/auth +Dxtm |
| `user_contribution_summary` | view | arwdDxtm | arwdDxtm | arwdDxtm | n/a | - | - / r / r | **excessive**: anon +arwd; auth +awd; svc +awd; anon/auth +Dxtm |
| `user_contributions` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `user_credit_balance` | view | arwdDxtm | arwdDxtm | arwdDxtm | n/a | - | - / r / r | **excessive**: anon +arwd; auth +awd; svc +awd; anon/auth +Dxtm |
| `user_integrations` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 5 | - / arwd / arwd | **excessive**: anon +arwd; anon/auth +Dxtm |
| `user_profiles` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 5 | - / arw / arwd | **excessive**: anon +arwd; auth +d; anon/auth +Dxtm |
| `user_program_fit` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `user_question_unlocks` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 3 | - / ar / arwd | **excessive**: anon +arwd; auth +wd; anon/auth +Dxtm |
| `user_starter_claims` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `user_subscriptions` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |

### (c) server-only/internal

| Object | Kind | anon | auth | svc | RLS | Pol | Class needs (anon / auth / svc) | Mismatch vs class |
|---|---|---|---|---|---|---|---|---|
| `_deploy_flags` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 1 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `answer_variants` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | r / r / arwd | **excessive**: anon +awd; auth +awd; anon/auth +Dxtm |
| `application_packages` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | r / r / arwd | **excessive**: anon +awd; auth +awd; anon/auth +Dxtm |
| `catalog_candidate_events_id_seq` (058) | seq | - | - | rU | n/a | - | - / - / rU | none |
| `catalog_serial_ap_seq` (058) | seq | - | - | rU | n/a | - | - / - / rU | none |
| `catalog_serial_aq_seq` (058) | seq | - | - | rU | n/a | - | - / - / rU | none |
| `catalog_serial_en_seq` (058) | seq | - | - | rU | n/a | - | - / - / rU | none |
| `catalog_serial_qu_seq` (058) | seq | - | - | rU | n/a | - | - / - / rU | none |
| `connected_integrations` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 4 | - / - / arwd | **excessive**: anon +arwd; auth +arwd; anon/auth +Dxtm |
| `program_signals` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 2 | - / - / arwd | **excessive**: anon +arwd; auth +arwd; anon/auth +Dxtm |
| `recruiter_alerts` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 1 | - / - / arwd | **excessive**: anon +arwd; auth +arwd; anon/auth +Dxtm |
| `stripe_events` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 1 | - / - / arwd | **excessive**: anon +arwd; auth +arwd; anon/auth +Dxtm |
| `exchange_agents` (out of repo) | table | - | - | arwdDxtm | on | 0 | not classified here: other app (exchange); already service-only | not in 060 (owned elsewhere) |
| `exchange_companies` (out of repo) | table | - | - | arwdDxtm | on | 0 | not classified here: other app (exchange); already service-only | not in 060 (owned elsewhere) |
| `exchange_events` (out of repo) | table | - | - | arwdDxtm | on | 0 | not classified here: other app (exchange); already service-only | not in 060 (owned elsewhere) |
| `exchange_records` (out of repo) | table | - | - | arwdDxtm | on | 0 | not classified here: other app (exchange); already service-only | not in 060 (owned elsewhere) |
| `exchange_settlements` (out of repo) | table | - | - | arwdDxtm | on | 0 | not classified here: other app (exchange); already service-only | not in 060 (owned elsewhere) |

### (d) legacy private-answer

| Object | Kind | anon | auth | svc | RLS | Pol | Class needs (anon / auth / svc) | Mismatch vs class |
|---|---|---|---|---|---|---|---|---|
| `ai_draft_runs` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 5 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `answer_reviews` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 6 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `answer_stress_tests` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 3 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `app_import_sessions` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 1 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `application_answers` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 7 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `intake_submissions` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 4 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `profile_answer_history` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 4 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |
| `profile_answers` | table | arwdDxtm | arwdDxtm | arwdDxtm | on | 7 | - / r / arwd | **excessive**: anon +arwd; auth +awd; anon/auth +Dxtm |

### (e) teams (deferred)

| Object | Kind | anon | auth | svc | RLS | Pol | Class needs (anon / auth / svc) | Mismatch vs class |
|---|---|---|---|---|---|---|---|---|
| `team_answers` | table | rxtm | rxtm | arwdDxtm | on | 3 | - / r / arwd | **excessive**: anon +r; anon/auth +xtm |
| `team_invites` | table | rxtm | rxtm | arwdDxtm | on | 2 | - / r / arwd | **excessive**: anon +r; anon/auth +xtm |
| `team_members` | table | rxtm | rxtm | arwdDxtm | on | 2 | - / r / arwd | **excessive**: anon +r; anon/auth +xtm |
| `teams` | table | rxtm | rxtm | arwdDxtm | on | 2 | - / r / arwd | **excessive**: anon +r; anon/auth +xtm |

### Functions

Functions are outside the 2026-10-30 change: new functions still default to EXECUTE for PUBLIC and the API roles. 058 revokes EXECUTE on each of its 17 functions explicitly. Trigger functions need no EXECUTE grant to fire.

| Function | SECURITY DEFINER | EXECUTE | Note |
|---|---|---|---|
| `accept_team_invite()` | yes | authenticated | 055: authenticated only |
| `auto_update_program_status()` | no | PUBLIC, anon, authenticated, service_role |  |
| `calculate_fit_score()` | no | PUBLIC, anon, authenticated, service_role |  |
| `catalog_assign_serial()` | no | service_role | 058 |
| `catalog_norm()` | no | service_role | 058 |
| `catalog_publish_candidate(uuid, uuid, text)` | no | service_role | 058 |
| `catalog_question_set_sha256()` | no | service_role | 058 |
| `catalog_submit_candidate()` | no | service_role | 058 |
| `catalog_transition_allowed()` | no | service_role | 058 |
| `catalog_transition_candidate()` | no | service_role | 058 |
| `claim_starter_package()` | yes | PUBLIC, anon, authenticated, service_role | authenticated RPC (onboarding); 061: caller-bound, authenticated + service_role |
| `compute_heat_scores()` | yes | PUBLIC, anon, authenticated, service_role | owner only; 061: service_role only, search_path pinned |
| `compute_program_dna()` | yes | PUBLIC, anon, authenticated, service_role | pg_cron (owner); 061: service_role only, search_path pinned |
| `compute_significance_scores()` | yes | PUBLIC, anon, authenticated, service_role | pg_cron (owner); 061: service_role only, search_path pinned |
| `compute_user_fit_scores()` | yes | PUBLIC, anon, authenticated, service_role | cron/owner only; 061: caller-bound, service_role only, search_path pinned |
| `get_canonical_package()` | no | PUBLIC, anon, authenticated, service_role | edge function (service_role) |
| `get_top_programs_by_value()` | yes | PUBLIC, anon, authenticated, service_role | MCP (service_role); 061: SECURITY INVOKER, approved programs only, service_role only |
| `increment_draft_count()` | yes | PUBLIC, anon, authenticated, service_role | unused; 061: caller-bound, service_role only, search_path pinned |
| `is_canonical_program()` | yes | PUBLIC, anon, authenticated, service_role | called inside 054/058 guard triggers as the writer; 061: authenticated + service_role |
| `is_canonical_writer()` | no | PUBLIC, anon, authenticated, service_role | 054 guard |
| `local_first_active()` | yes | PUBLIC, anon, authenticated, service_role | 051 RLS policies (authenticated); 061: authenticated + service_role |
| `match_archived_questions()` | no | PUBLIC, anon, authenticated, service_role | service_role RPC |
| `recompute_all_heat_scores()` | no | PUBLIC, anon, authenticated, service_role |  |
| `run_daily_drip()` | yes | PUBLIC, anon, authenticated, service_role | authenticated RPC (today/dash/questions); 061: SECURITY INVOKER, caller-bound, authenticated + service_role |
| `search_canonicals_hybrid()` | no | PUBLIC, anon, authenticated, service_role |  |
| `seed_signup_questions()` | yes | PUBLIC, anon, authenticated, service_role | signup trigger (owner); 061: caller-bound (trigger allowed), service_role only |
| `semantic_search_canonicals()` | no | PUBLIC, anon, authenticated, service_role |  |
| `smart_matcher_search()` | no | PUBLIC, anon, authenticated, service_role | edge function (service_role) |

- Trigger functions, SECURITY DEFINER, EXECUTE PUBLIC, anon, authenticated, service_role (10): `auto_seed_questions_on_signup`, `award_answer_credits`, `award_contribution_credits`, `award_submission_credits`, `create_free_subscription_on_signup`, `create_user_profile_on_signup`, `decrement_asked_by_count`, `increment_asked_by_count`, `process_reward`, `refresh_canonical_aggregate`
- Trigger functions, SECURITY INVOKER, EXECUTE service_role only (058) (10): `catalog_candidate_events_apply`, `catalog_candidates_created`, `guard_catalog_append_only`, `guard_catalog_candidate_events`, `guard_catalog_candidates`, `guard_catalog_no_truncate`, `guard_catalog_service_only`, `guard_catalog_sources`, `guard_program_questions_provenance`, `guard_programs_entity`
- Trigger functions, SECURITY INVOKER, EXECUTE PUBLIC, anon, authenticated, service_role (16): `compute_word_count`, `deny_receipt_mutation`, `deny_reward_id_change`, `enforce_single_default_integration`, `guard_archived_questions_writes`, `guard_canonical_program_questions`, `guard_canonical_programs`, `increment_ai_usage`, `recompute_completion_pct`, `set_draft_limit_on_insert`, `snapshot_profile_answer`, `sync_draft_limit_on_tier_change`, `sync_profile_answer_columns`, `update_program_stats_on_signal`, `update_updated_at`, `update_updated_at_column`

## 6. Proposed tightening (060, not applied)

`supabase/migrations/proposed/060_tighten_data_api_grants.sql` revokes the
excessive grants above. The CLI and CI do not read that folder, and every
section needs a separate owner decision. On a scratch full-chain database
with all sections applied, the 50 suite reports **0 excessive and 0
missing**, `GR-POLDEP` passes, and the 058 suite passes 131/131.

| Section | Revokes | Blast radius |
|---|---|---|
| A | TRUNCATE/REFERENCES/TRIGGER/MAINTAIN from anon and authenticated (62 relations) | None through the Data API |
| B | INSERT/UPDATE/DELETE on the class (d) tables from authenticated; all from anon. This makes the local-first boundary a grant rather than a flag row. | Local-first-off legacy mode only: AnswerEditor upsert, the extension userscript, MCP `hub_save_answer` / `hub_save_answer_review`, user-client writes in `api/answers/capture`, `api/applications/[id]/fill`, `api/draft`, `api/hub/ingest`, `api/import/paste`, `api/applications/intake`. All of these are already refused while local-first is on. Re-enabling legacy mode would need a re-grant migration. In the harness, p0 P-4d/P-4e turn into 42501 (legacy-mode writes). |
| B2 | answer_stress_tests writes from authenticated | MCP `hub_stress_test_answer` persistence (userClient) breaks in every mode |
| C | anon on classes (b), (c), (e). anon keeps SELECT where a policy depends on it. | None found. A future public-profile page would need anon SELECT on `user_profiles`. |
| D | authenticated on server-only tables; `_deploy_flags` writes | None found (edge functions use service_role) |
| E | Client writes that no RLS policy allows; view writes; extra sequence privileges | `community_messages` DELETE goes from a silent 0-row no-op to 42501 in `api/community/messages/[id]` |
| F | Residual default privileges (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN on new tables, UPDATE on new sequences) | None; new objects carry explicit grants |
| G | EXECUTE on SECURITY DEFINER functions no client calls; anon EXECUTE on `run_daily_drip` / `claim_starter_package` | None found (cron, triggers and the MCP server run as owner or service_role) |

## 7. Harness results

`supabase/tests/m09/run_local.sh` with `GRANTS_MODE=default|revoked`
(needs PostgreSQL 17 and pgvector; `M09_PGBIN`). Both modes were run on
2026-10-22 on PostgreSQL 17.11. The logs are in
`docs/evidence/m09-grants/full-chain-{default,revoked}.log`.

| Check | default | revoked |
|---|---|---|
| Chain 001 to 059 on a fresh database | 59 files applied (008/019/028: known verbatim failures, restated by 050) | same |
| Re-apply 058 + 059 (idempotency) | grants unchanged, 123 ACL lines | same |
| Rebuild equals the other default settings (default / revoked / strict) | EQUAL | EQUAL |
| Rebuild equals production (66 in-repo relations) | EQUAL | EQUAL |
| p0 suites (phase post) | 86: 83 pass, 3 known full-chain divergences, 0 fail | same |
| 058 suite (submit / transition / publish as service_role) | 131/131 | 131/131 |
| 50 grants suite (role probes) | 936/936 | 936/936 |
| 058 rollback + re-apply | PASS; 058 grants identical after re-apply | PASS |

No suite hit a grant-caused 42501 under revoked defaults. Grants are
byte-identical across modes, so 058 and 059 needed no further grant fixes.

The 3 known p0 divergences come from the p0 live-baseline fixture not
matching the full chain. They are identical under the old defaults:

- P-3e: the 002 unique index on `program_questions` (23505).
- P-4e: the `sync_profile_answer_columns` trigger copies `answer_content`
  into `content` on INSERT.
- P-4f: an RLS 42501, not a grant. authenticated holds INSERT on
  `profile_answer_history` (`GR-RLS-1`), but the table has no INSERT policy.

The fixture-path runners (`p0/run_local.sh`, `m09/run_local.sh` without
`GRANTS_MODE`) still pass on PostgreSQL 16 and 17.

## 8. Other findings (not grants)

These came out of the full-chain runs. They are confirmed on the rebuild.
Function bodies in production do not hash-match the rebuild (possibly
whitespace only), so confirm each in production before acting.

- **Fixed in 058:** `catalog_publish_candidate` wrote `programs.deadline_at`,
  which is `GENERATED ALWAYS AS (closes_at)` (008, confirmed in production).
  The publish would have failed with 428C9. It now writes `closes_at`.
  The p0 fixture declared the column as plain, which hid this, and it now
  matches production.
- `profile_answers` UPDATE as authenticated (legacy mode) fails: the
  SECURITY INVOKER history trigger hits RLS on `profile_answer_history`.
- `ai_draft_runs` INSERT as authenticated (legacy mode) fails: the
  `increment_ai_usage` trigger hits RLS on `ai_usage`, which has no
  authenticated write policy.
- The `team_members` select policy references itself: reads as anon or
  authenticated raise 42P17 (infinite recursion). Teams are deferred.
- `run_daily_drip` from the repository chain fails with "column reference
  theme is ambiguous" (also the production body). Fixed in 061.
- `community_messages` has no DELETE policy, but a route issues deletes.

## 9. How to run

```bash
# fixture path (unchanged), any PostgreSQL 16+
bash supabase/tests/p0/run_local.sh
bash supabase/tests/m09/run_local.sh
# full chain, both default-privilege settings (PostgreSQL 17 + pgvector)
GRANTS_MODE=default M09_PGBIN=/path/to/pg17/bin bash supabase/tests/m09/run_local.sh
GRANTS_MODE=revoked M09_PGBIN=/path/to/pg17/bin bash supabase/tests/m09/run_local.sh
# migration grant lint (CI "Migration lint" job)
python3 scripts/lint_migration_grants.py --self-test && python3 scripts/lint_migration_grants.py
```

To refresh the production snapshot, run this read-only query against
the project (the output has the fixture's format), then diff it against
the fixture:

```sql
with e as (
  select c.relname::text relname, c.relkind::text relkind, r.rn, r.i,
    coalesce((select string_agg(substr('arwdDxtmU', p.ord, 1), '' order by p.ord)
      from aclexplode(c.relacl) a
      join (values ('INSERT',1),('SELECT',2),('UPDATE',3),('DELETE',4),('TRUNCATE',5),
                   ('REFERENCES',6),('TRIGGER',7),('MAINTAIN',8),('USAGE',9)) p(t, ord) on p.t = a.privilege_type
      where a.grantee = case r.rn when 'PUBLIC' then 0::oid else r.rn::regrole::oid end), '-') privs
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('anon',1),('authenticated',2),('PUBLIC',3),('service_role',4)) r(rn, i)
  where n.nspname = 'public' and c.relkind in ('r','v','m','S','p','f'))
select relname || '|' || relkind || '|' || string_agg(rn || '=' || privs, ' ' order by i)
from e group by relname, relkind order by 1;
```
