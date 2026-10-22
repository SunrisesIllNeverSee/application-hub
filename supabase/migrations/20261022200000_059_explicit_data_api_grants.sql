-- ============================================================
-- 059 — Explicit Data API grants (behaviour-preserving baseline) (M09 / W11)
-- ============================================================
-- STATUS: PREPARED — DO NOT APPLY without separate owner production
-- authorization. Apply as the postgres role (the role that owns the
-- objects and whose default privileges are changed in section 4).
-- Idempotent (safe to re-run), transactional, GRANT-only for existing
-- objects: on production as captured 2026-10-22 it changes no effective
-- privilege on any table, view or sequence.
--
-- Why: from 2026-10-30 Supabase no longer grants anon / authenticated /
-- service_role access to NEW tables and sequences in schema public on
-- existing projects (new projects since 2026-05-30). Existing objects keep
-- their grants, but a fresh rebuild of this chain (local reset, branch,
-- new project) would create every table without them and the Data API
-- would answer 42501. This migration states today's production grants
-- explicitly so the chain no longer depends on default privileges.
--
-- Baseline source: production catalog (pg_class.relacl, read-only query,
-- 2026-10-22), recorded in
-- supabase/tests/m09/fixtures/production_grants_2026-10-22.psv. A full
-- local rebuild of 001..058 under the old defaults reproduces that
-- snapshot exactly; docs/DATA-API-GRANTS.md has the inventory.
-- No column-level grants exist in production. 058 states its own table,
-- column and sequence grants and is deliberately not repeated here, so
-- 059 can be applied before or after 058.
--
-- This is NOT a tightening. Several grants below are broader than the
-- table's class needs (see docs/DATA-API-GRANTS.md "Excessive"); the
-- proposed, owner-decision revokes live in
-- supabase/migrations/proposed/060_tighten_data_api_grants.sql and are not
-- part of the applied chain.
--
-- Rule from 059 on (docs/MIGRATIONS.md): every migration that creates a
-- table or sequence in public grants/revokes it explicitly and enables RLS
-- in the same file. CI (scripts/lint_migration_grants.py) enforces it.
--
-- ROLLBACK: nothing to undo for sections 1-3 (they only restate existing
-- grants; revoking them would break the Data API). To restore the old
-- default privileges for objects created later, run as postgres:
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Tables and views with full privileges for all three API roles
--    (production: anon/authenticated/service_role = arwdDxtm).
--    ALL = SELECT INSERT UPDATE DELETE TRUNCATE REFERENCES TRIGGER MAINTAIN.
-- ------------------------------------------------------------
GRANT ALL ON TABLE
  public._deploy_flags,
  public.acceptance_reports,
  public.aggregate_versions,
  public.ai_draft_runs,
  public.ai_usage,
  public.answer_reviews,
  public.answer_stress_tests,
  public.answer_variants,
  public.app_import_sessions,
  public.application_answers,
  public.application_packages,
  public.beta_settings,
  public.canonical_commitments,
  public.canonical_user_credits,
  public.community_messages,
  public.connected_integrations,
  public.contribution_rewards,
  public.credit_events,
  public.deadline_alerts,
  public.funders,
  public.import_queue,
  public.intake_application_layers,
  public.intake_applications,
  public.intake_entities,
  public.intake_events,
  public.intake_gate_reviews,
  public.intake_questions,
  public.intake_submissions,
  public.lineage_events,
  public.profile_answer_history,
  public.profile_answers,
  public.program_cycles,
  public.program_dna,
  public.program_listings,
  public.program_signals,
  public.program_stats,
  public.recruiter_alerts,
  public.reward_credit_receipts,
  public.seeding_entities,
  public.starter_packages,
  public.stripe_events,
  public.subscription_plans,
  public.user_achievements,
  public.user_applications,
  public.user_contributions,
  public.user_integrations,
  public.user_profiles,
  public.user_program_fit,
  public.user_question_unlocks,
  public.user_starter_claims,
  public.user_subscriptions,
  -- views
  public.opportunities,
  public.program_next_cycle,
  public.user_contribution_summary,
  public.user_credit_balance
TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 2. Tables whose client grants were narrowed by earlier migrations
-- ------------------------------------------------------------
-- 054 canonical write boundary: client roles keep SELECT INSERT UPDATE
-- DELETE REFERENCES MAINTAIN (no TRUNCATE, no TRIGGER); RLS + guard
-- triggers decide which rows. service_role keeps everything.
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES
  ON TABLE public.programs, public.program_questions, public.archived_questions
  TO anon, authenticated;
GRANT ALL
  ON TABLE public.programs, public.program_questions, public.archived_questions
  TO service_role;

-- 056/057 deferred Teams: client roles keep SELECT REFERENCES TRIGGER
-- MAINTAIN (no INSERT UPDATE DELETE TRUNCATE); service_role and the
-- SECURITY DEFINER accept_team_invite() keep their access.
GRANT SELECT, REFERENCES, TRIGGER
  ON TABLE public.teams, public.team_members, public.team_invites, public.team_answers
  TO anon, authenticated;
GRANT ALL
  ON TABLE public.teams, public.team_members, public.team_invites, public.team_answers
  TO service_role;

-- MAINTAIN exists from PostgreSQL 17 (production: 17.x).
DO $maintain$
BEGIN
  IF current_setting('server_version_num')::int >= 170000 THEN
    EXECUTE 'GRANT MAINTAIN ON TABLE public.programs, public.program_questions, public.archived_questions,
               public.teams, public.team_members, public.team_invites, public.team_answers
             TO anon, authenticated';
  END IF;
END
$maintain$;

-- ------------------------------------------------------------
-- 3. Sequences (047 intake ref_seq serials): production = rwU for all
--    three roles.
-- ------------------------------------------------------------
GRANT USAGE, SELECT, UPDATE ON SEQUENCE
  public.intake_applications_ref_seq_seq,
  public.intake_entities_ref_seq_seq,
  public.intake_questions_ref_seq_seq,
  public.intake_submissions_ref_seq_seq
TO anon, authenticated, service_role;

-- Objects in the production project that other apps created outside this
-- repository's chain. Restated when present so the production effect is
-- complete; a fresh rebuild of this chain does not create them.
DO $oor$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sigrank_operators','sigrank_sessions'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role', t);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['sigrank_operators_id_seq','sigrank_sessions_id_seq'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.%I TO anon, authenticated, service_role', t);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['exchange_agents','exchange_companies','exchange_events',
                           'exchange_records','exchange_settlements'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    END IF;
  END LOOP;
END
$oor$;

-- ------------------------------------------------------------
-- 4. Default privileges for FUTURE objects created by postgres in public:
--    the new Supabase default (2026-10-30), stated here so local stacks,
--    branches and production behave the same. Statements as published by
--    Supabase. Functions are unaffected by the platform change and keep
--    their default EXECUTE grant; new functions still revoke it explicitly.
-- ------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES FROM anon, authenticated, service_role;

COMMIT;

-- ============================================================
-- Post-apply read-only verification (owner-run):
--   SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public' AND c.relkind IN ('r','v','S')
--      AND NOT has_table_privilege('service_role', c.oid, 'SELECT');   -- 0
--   SELECT has_table_privilege('anon', 'public.teams', 'INSERT');      -- false (056)
--   SELECT defaclobjtype, defaclacl FROM pg_default_acl d
--     JOIN pg_namespace n ON n.oid = d.defaclnamespace
--    WHERE n.nspname = 'public' AND d.defaclrole = 'postgres'::regrole;
--     -- tables: anon/authenticated/service_role = Dxtm (no arwd)
--     -- sequences: anon/authenticated/service_role = w (no rU)
-- ============================================================
