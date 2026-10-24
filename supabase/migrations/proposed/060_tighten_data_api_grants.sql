-- ============================================================
-- 060 — Tighten Data API grants (PROPOSED, NOT IN THE MIGRATION CHAIN)
-- ============================================================
-- ADOPTED 2026-10-24 as supabase/migrations/20261024090000_062_tighten_data_api_grants.sql
-- (OWNER decision G15): A as an explicit list, B2 after GB1, E with
-- the E1 sender delete policy, G already done by 061. This file is kept
-- for provenance only; 062 is authoritative.
-- STATUS: PROPOSAL ONLY. Lives under supabase/migrations/proposed/, which
-- the Supabase CLI and the CI migration lint do not read. Nothing here is
-- applied by any runner. It needs an OWNER DECISION per section; to adopt
-- a section, copy it into a new timestamped migration after 059 and add
-- its expectations to supabase/tests/m09/50_grants_tests.sql.
--
-- Source: the "Excessive" findings of docs/DATA-API-GRANTS.md, produced
-- by supabase/tests/m09/50_grants_tests.sql against the 059 baseline
-- (= production 2026-10-22). Every REVOKE removes a privilege the table's
-- class does not need. service_role is left as is except on views.
-- Out-of-repo objects (sigrank_*, exchange_*) are never touched.
--
-- Reading guide: each section states WHY and the BLAST RADIUS, meaning
-- the routes or modes that would get 42501 instead of today's behaviour.
-- RLS already filters most of these to zero rows. These revokes make
-- the boundary hold at the privilege layer too, so it does not depend on
-- a policy or on a _deploy_flags row.
--
-- ROLLBACK for any section: GRANT back the same privileges (059 lists
-- the exact baseline per table).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- A. Non-CRUD table privileges held by client roles (62 relations)
-- WHY: anon/authenticated hold TRUNCATE, REFERENCES, TRIGGER (and
--   MAINTAIN on PG17) on 62 relations through the pre-2026-10-30 default
--   privileges. The Data API (PostgREST) never issues these commands, and
--   RLS does not govern TRUNCATE.
-- BLAST RADIUS: none for PostgREST, supabase-js, the MCP server, the
--   companion or the extension. It only affects a direct SQL session
--   running as anon/authenticated, which no code path uses.
-- ------------------------------------------------------------
DO $a$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind IN ('r','v','p')
              AND c.relname !~ '^(sigrank_|exchange_)' LOOP
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM anon, authenticated', r.relname);
    IF current_setting('server_version_num')::int >= 170000 THEN
      EXECUTE format('REVOKE MAINTAIN ON TABLE public.%I FROM anon, authenticated', r.relname);
    END IF;
  END LOOP;
END
$a$;

-- ------------------------------------------------------------
-- B. Class (d) legacy private-answer tables: the durable server-side
--    backstop for local-first custody
-- WHY: with local-first active (production, _deploy_flags local_first=1
--   since 2026-10-14), private answer text must never be written by a
--   client role. Today that is enforced by 051 RESTRICTIVE policies that
--   read a flag row, so the boundary depends on data. A grant revoke does
--   not. app_import_sessions and
--   answer_stress_tests are NOT covered by 051 at all.
-- BLAST RADIUS (local-first-off legacy mode only; in local-first mode
--   these paths are already refused by app/lib/local-first-guard.ts and/or
--   051 RLS):
--   * profile_answers: browser upsert in components/AnswerEditor.tsx; the
--     webextension userscript REST writes; MCP hub_save_answer
--     (userClient); user-client writes in api/answers/capture and
--     api/applications/[id]/fill.
--   * profile_answer_history: the snapshot_profile_answer() trigger
--     (SECURITY INVOKER) on profile_answers UPDATE as authenticated.
--     (That path already fails today with RLS 42501; see the doc.)
--   * answer_reviews: MCP hub_save_answer_review (userClient).
--   * ai_draft_runs: api/draft insert as authenticated. (Already fails
--     today: its increment_ai_usage trigger hits RLS on ai_usage.)
--   * intake_submissions: api/hub/ingest insert as authenticated.
--   * app_import_sessions: api/import/paste and api/applications/intake
--     writes (both refused by the app guard in local-first mode).
--   * application_answers: no code path.
--   Re-enabling legacy mode then needs a migration that re-grants.
--   Flipping the flag alone is no longer enough.
-- Reads stay: authenticated keeps SELECT (own rows via RLS) for export
--   and history views; service_role keeps everything.
-- ------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.profile_answers, public.profile_answer_history, public.answer_reviews,
  public.application_answers, public.ai_draft_runs, public.intake_submissions,
  public.app_import_sessions
FROM authenticated;
REVOKE ALL ON TABLE
  public.profile_answers, public.profile_answer_history, public.answer_reviews,
  public.application_answers, public.ai_draft_runs, public.intake_submissions,
  public.app_import_sessions, public.answer_stress_tests
FROM anon;

-- B2. answer_stress_tests (separate decision)
-- BLAST RADIUS: MCP hub_stress_test_answer persists its result with the
--   caller's userClient (authenticated), and the MCP local-first guard
--   does not cover that tool. Adopting B2 breaks stress-test persistence
--   in every mode until the tool writes through service_role.
--   (app)/dash and profile/persona reads are unaffected.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.answer_stress_tests FROM authenticated;

-- ------------------------------------------------------------
-- C. anon on user-owned, server-only and Teams tables (classes b, c, e)
-- WHY: no code path reads or writes these as anon (only the public
--   /applications pages and the companion run as anon, and they touch
--   class (a) catalog tables only). Every user policy keys on auth.uid(),
--   which is NULL for anon. Two RLS policies do admit anon today:
--   program_signals_anon_insert and user_profiles_public_read
--   (profile_visibility='public'); neither has an anon code path.
--   Teams (e) are deferred; anon has no reason to read them.
-- KEPT ON PURPOSE (RLS policy dependencies): a policy's subqueries run with
--   the caller's privileges, so anon keeps SELECT on
--   * user_applications: referenced by the programs / program_questions /
--     archived_questions / program_dna / program_stats read policies.
--     Without it every public catalog read by anon fails with 42501. The
--     harness verified this: the 058 suite's anon provenance reads broke.
--   * answer_variants, application_packages: referenced by the
--     lineage_events read policy (section D keeps SELECT for authenticated).
--   RLS still returns no rows of these to anon (auth.uid() is NULL).
--   50_grants_tests.sql GR-POLDEP-* fails if a revoke cuts such a
--   dependency.
-- BLAST RADIUS: none found in code. A future public-profile page would
--   need GRANT SELECT ON user_profiles TO anon again.
-- ------------------------------------------------------------
REVOKE ALL ON TABLE
  -- (b)
  public.acceptance_reports, public.ai_usage, public.canonical_user_credits,
  public.community_messages, public.contribution_rewards, public.credit_events,
  public.deadline_alerts, public.import_queue, public.intake_application_layers,
  public.intake_applications, public.intake_entities, public.intake_events,
  public.intake_gate_reviews, public.intake_questions, public.reward_credit_receipts,
  public.user_achievements, public.user_contribution_summary,
  public.user_contributions, public.user_credit_balance, public.user_integrations,
  public.user_profiles, public.user_program_fit, public.user_question_unlocks,
  public.user_starter_claims, public.user_subscriptions,
  -- (c)
  public._deploy_flags, public.connected_integrations, public.program_signals,
  public.recruiter_alerts, public.stripe_events,
  -- (e)
  public.teams, public.team_members, public.team_invites, public.team_answers
FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.user_applications, public.answer_variants, public.application_packages
FROM anon;
REVOKE ALL ON SEQUENCE
  public.intake_applications_ref_seq_seq, public.intake_entities_ref_seq_seq,
  public.intake_questions_ref_seq_seq, public.intake_submissions_ref_seq_seq
FROM anon;

-- ------------------------------------------------------------
-- D. authenticated on server-only tables (class c)
-- WHY: only service_role code paths use them (Stripe webhook, recruiter
--   cron, canonical-hub / smart-matcher edge functions). answer_variants
--   and application_packages carry owner ALL policies that no client
--   uses. connected_integrations and program_signals have no code path.
--   _deploy_flags keeps SELECT (051 grants clients read-by-design) and
--   loses writes. The flag row is what 051's backstop depends on.
-- BLAST RADIUS: none found. Edge functions use the service key.
-- ------------------------------------------------------------
REVOKE ALL ON TABLE
  public.connected_integrations, public.program_signals, public.recruiter_alerts,
  public.stripe_events
FROM authenticated;
-- SELECT kept: the lineage_events read policy references both tables.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.answer_variants, public.application_packages
FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public._deploy_flags FROM authenticated;

-- ------------------------------------------------------------
-- E. Client writes a table's class and RLS never allow
-- WHY: no INSERT/UPDATE/DELETE policy exists for the client role on
--   these, so today the statements silently affect 0 rows or fail RLS.
--   Revoking makes the refusal explicit.
-- BLAST RADIUS:
--   * community_messages DELETE: app/api/community/messages/[id] issues a
--     delete as authenticated. There is no delete policy, so it is a
--     silent no-op today. After the revoke it returns 42501. Decide
--     whether message deletion should exist (add a policy) or the route
--     should go.
--   * everything else: no code path.
-- ------------------------------------------------------------
-- class (a) catalog: anon and authenticated read only (except the
-- user-owned program/intake writes kept on programs, program_questions,
-- archived_questions)
REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.aggregate_versions, public.beta_settings, public.canonical_commitments,
  public.funders, public.lineage_events, public.program_cycles, public.program_dna,
  public.program_listings, public.program_stats, public.seeding_entities,
  public.starter_packages, public.subscription_plans,
  public.opportunities, public.program_next_cycle
FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.programs, public.program_questions, public.archived_questions
FROM anon;
REVOKE DELETE ON TABLE
  public.programs, public.program_questions, public.archived_questions
FROM authenticated;
-- class (b): authenticated keeps exactly what its routes use
REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.canonical_user_credits, public.contribution_rewards, public.credit_events,
  public.deadline_alerts, public.reward_credit_receipts, public.user_achievements,
  public.user_contributions, public.user_program_fit, public.user_starter_claims,
  public.user_subscriptions, public.user_contribution_summary, public.user_credit_balance
FROM authenticated;
REVOKE UPDATE, DELETE ON TABLE
  public.acceptance_reports, public.import_queue, public.intake_events,
  public.intake_gate_reviews, public.user_question_unlocks
FROM authenticated;
REVOKE DELETE ON TABLE
  public.ai_usage, public.community_messages, public.intake_application_layers,
  public.intake_applications, public.intake_entities, public.intake_questions,
  public.user_profiles
FROM authenticated;
-- views are read-only aggregates/joins for every role
REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.user_contribution_summary, public.user_credit_balance,
  public.opportunities, public.program_next_cycle
FROM service_role;
-- intake ref_seq serials: authenticated inserts need USAGE only
REVOKE SELECT, UPDATE ON SEQUENCE
  public.intake_applications_ref_seq_seq, public.intake_entities_ref_seq_seq,
  public.intake_questions_ref_seq_seq, public.intake_submissions_ref_seq_seq
FROM authenticated;

-- ------------------------------------------------------------
-- F. Residual default privileges for FUTURE objects
-- WHY: Supabase's new default (and 059 section 4) only revokes
--   SELECT/INSERT/UPDATE/DELETE on tables and USAGE/SELECT on sequences.
--   New tables still get TRUNCATE/REFERENCES/TRIGGER/MAINTAIN for all
--   three roles, and new sequences UPDATE (setval).
-- BLAST RADIUS: none. From 059 on, every new object carries explicit
--   grants (CI lint), so nothing relies on these defaults.
-- ------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE UPDATE ON SEQUENCES FROM anon, authenticated, service_role;
DO $f$
BEGIN
  IF current_setting('server_version_num')::int >= 170000 THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
             REVOKE MAINTAIN ON TABLES FROM anon, authenticated, service_role';
  END IF;
END
$f$;

-- ------------------------------------------------------------
-- G. EXECUTE on SECURITY DEFINER functions (outside the 2026-10-30
--    change, which does not touch functions; listed because step 1
--    inventoried them)
-- WHY: these run as their owner (bypassing RLS) and are callable over
--   /rest/v1/rpc by anon and authenticated through the default EXECUTE
--   grant. No client code path calls the first group (pg_cron, the
--   signup triggers and the MCP server's service_role do).
--   claim_starter_package and run_daily_drip are called by signed-in
--   pages only.
-- KEPT: accept_team_invite (055: authenticated only already),
--   local_first_active (051 RLS policies call it as authenticated),
--   is_canonical_program / is_canonical_writer (called inside the 054
--   SECURITY INVOKER guard triggers as the writing role).
-- BLAST RADIUS: none found. pg_cron jobs and the signup triggers run as
--   the owner. get_top_programs_by_value is called by the MCP server
--   with service_role.
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION
  public.compute_heat_scores(), public.compute_program_dna(),
  public.compute_significance_scores(), public.compute_user_fit_scores(uuid),
  public.increment_draft_count(uuid, text), public.seed_signup_questions(uuid),
  public.get_top_programs_by_value(public.program_type[], text, numeric, public.program_status[], integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.compute_heat_scores(), public.compute_program_dna(),
  public.compute_significance_scores(), public.compute_user_fit_scores(uuid),
  public.increment_draft_count(uuid, text), public.seed_signup_questions(uuid),
  public.get_top_programs_by_value(public.program_type[], text, numeric, public.program_status[], integer)
TO service_role;
REVOKE EXECUTE ON FUNCTION public.run_daily_drip(uuid), public.claim_starter_package(uuid)
FROM PUBLIC, anon;

COMMIT;
