-- ============================================================
-- 062 — Tighten Data API grants (adopts proposed/060, owner decision G15)
-- ============================================================
-- Source: supabase/migrations/proposed/060_tighten_data_api_grants.sql and
-- docs/DATA-API-GRANTS.md §6. OWNER (Deric) decided G15 on 2026-10-24
-- (all sections yes) on these terms:
--   A   explicit relation list, not a loop over every public relation, so
--       tables another app adds to this database are never touched;
--   B   as proposed;
--   B2  after GB1: aqua-mcp-server 1.x was deprecated on npm on
--       2026-10-24 (1.x hub_stress_test_answer was the only writer as
--       authenticated; 2.0 removed the tool), so B2 is included;
--   C, D, F as proposed;
--   E   with the E1 decision: authors may delete their own community
--       messages. authenticated keeps DELETE on community_messages and a
--       sender delete policy is added (today the route's delete is a
--       silent 0-row no-op because no policy allows it);
--   G   already done by 061 (section 8 resets EXECUTE on every function
--       the proposal listed), so 062 has no G statements.
-- The class expectations are in supabase/tests/m09/50_grants_tests.sql.
-- Out-of-repo objects (sigrank_*, exchange_*) are never touched.
--
-- Idempotent: REVOKE of a privilege not held is a no-op; the policy is
-- dropped and recreated.
--
-- ROLLBACK (restores the 061 state: 059's explicit per-relation baseline
-- plus the residual default privileges F removes):
--   BEGIN;
--   DROP POLICY IF EXISTS cm_sender_delete ON public.community_messages;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES TO anon, authenticated, service_role;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT UPDATE ON SEQUENCES TO anon, authenticated, service_role;
--   COMMIT;
--   then re-apply supabase/migrations/20261022200000_059_explicit_data_api_grants.sql
--   (it states every relation's baseline grants explicitly).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- A. Non-CRUD table privileges held by client roles (62 relations)
-- TRUNCATE/REFERENCES/TRIGGER/MAINTAIN came from the pre-2026-10-30
-- default privileges. PostgREST never issues them and RLS does not govern
-- TRUNCATE. No code path uses them (no direct DB session as anon or
-- authenticated; no SECURITY INVOKER function or trigger runs TRUNCATE,
-- LOCK or a maintenance command; no materialized views).
-- ------------------------------------------------------------
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE
  -- (a) catalog / reference
  public.aggregate_versions, public.archived_questions, public.beta_settings,
  public.canonical_commitments, public.funders, public.lineage_events,
  public.opportunities, public.program_cycles, public.program_dna,
  public.program_listings, public.program_next_cycle, public.program_questions,
  public.program_stats, public.programs, public.seeding_entities,
  public.starter_packages, public.subscription_plans,
  -- (b) user-owned
  public.acceptance_reports, public.ai_usage, public.canonical_user_credits,
  public.community_messages, public.contribution_rewards, public.credit_events,
  public.deadline_alerts, public.import_queue, public.intake_application_layers,
  public.intake_applications, public.intake_entities, public.intake_events,
  public.intake_gate_reviews, public.intake_questions, public.reward_credit_receipts,
  public.user_achievements, public.user_applications, public.user_contribution_summary,
  public.user_contributions, public.user_credit_balance, public.user_integrations,
  public.user_profiles, public.user_program_fit, public.user_question_unlocks,
  public.user_starter_claims, public.user_subscriptions,
  -- (c) server-only
  public._deploy_flags, public.answer_variants, public.application_packages,
  public.connected_integrations, public.program_signals, public.recruiter_alerts,
  public.stripe_events,
  -- (d) legacy private-answer
  public.ai_draft_runs, public.answer_reviews, public.answer_stress_tests,
  public.app_import_sessions, public.application_answers, public.intake_submissions,
  public.profile_answer_history, public.profile_answers,
  -- (e) teams
  public.team_answers, public.team_invites, public.team_members, public.teams
FROM anon, authenticated;

-- ------------------------------------------------------------
-- B. Class (d) legacy private-answer tables: the durable server-side
--    backstop for local-first custody
-- With local-first active (production since 2026-10-14) private answer
-- text must never be written by a client role. Until now that rested on
-- 051 RESTRICTIVE policies reading a flag row; a revoked grant does not
-- depend on data. app_import_sessions and answer_stress_tests are not
-- covered by 051 at all.
-- Affected: local-first-off legacy mode only (AnswerEditor upsert, the
-- extension userscript, MCP 1.x hub_save_answer / hub_save_answer_review,
-- and the user-client writes in api/answers/capture,
-- api/applications/[id]/fill, api/draft, api/hub/ingest,
-- api/import/paste, api/applications/intake). All of these are already
-- refused while local-first is on. Re-enabling legacy mode now needs a
-- re-grant migration; flipping the flag alone is no longer enough.
-- authenticated keeps SELECT (own rows via RLS) for export and history.
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

-- B2. answer_stress_tests writes from authenticated (after GB1, 2026-10-24).
-- Only the deprecated aqua-mcp-server 1.x hub_stress_test_answer wrote it
-- as authenticated; 2.0 has no such tool. The dash and persona pages only
-- read it.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.answer_stress_tests FROM authenticated;

-- ------------------------------------------------------------
-- C. anon on user-owned, server-only and Teams tables (classes b, c, e)
-- No code path touches these as anon. anon keeps SELECT where an RLS
-- policy's subquery needs it (user_applications for the catalog read
-- policies; answer_variants and application_packages for lineage_events);
-- RLS still returns none of their rows to anon. 50_grants_tests.sql
-- GR-POLDEP-* fails if a revoke cuts such a dependency.
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
-- Only service_role paths use them (Stripe webhook, recruiter cron,
-- edge functions). _deploy_flags keeps SELECT (051 reads it as the
-- caller) and loses writes: its flag row is what 051's backstop reads.
-- answer_variants / application_packages keep SELECT for the
-- lineage_events read policy.
-- ------------------------------------------------------------
REVOKE ALL ON TABLE
  public.connected_integrations, public.program_signals, public.recruiter_alerts,
  public.stripe_events
FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.answer_variants, public.application_packages
FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public._deploy_flags FROM authenticated;

-- ------------------------------------------------------------
-- E. Client writes a table's class and RLS never allow
-- No INSERT/UPDATE/DELETE policy exists for these, so today the
-- statements affect 0 rows or fail RLS; the revoke makes the refusal
-- explicit. community_messages DELETE is kept (E1, below).
-- ------------------------------------------------------------
-- class (a) catalog: read only, except the user-owned program/intake
-- writes kept on programs, program_questions, archived_questions
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
  public.ai_usage, public.intake_application_layers,
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

-- E1. Authors may delete their own community messages (OWNER 2026-10-24).
-- api/community/messages/[id] DELETE is sender-only and already filters
-- on from_user_id; without a policy it deleted nothing. Replies keep
-- existing: parent_id is ON DELETE SET NULL.
DROP POLICY IF EXISTS cm_sender_delete ON public.community_messages;
CREATE POLICY cm_sender_delete ON public.community_messages
  FOR DELETE TO authenticated
  USING (from_user_id = auth.uid());

-- ------------------------------------------------------------
-- F. Residual default privileges for FUTURE objects
-- The 2026-10-30 Supabase default (and 059 section 4) only revokes
-- SELECT/INSERT/UPDATE/DELETE on tables and USAGE/SELECT on sequences.
-- New tables would still get TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, and
-- new sequences UPDATE (setval). Every new object carries explicit
-- grants from 059 on (CI lint), so nothing relies on these.
-- ------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE UPDATE ON SEQUENCES FROM anon, authenticated, service_role;

COMMIT;

-- ------------------------------------------------------------
-- VERIFY (read-only; run after the apply, every row should say true)
-- ------------------------------------------------------------
-- SELECT 'A: no client non-CRUD privileges' AS chk, count(*) = 0 AS ok
--   FROM pg_class c, LATERAL aclexplode(c.relacl) a
--  WHERE c.relnamespace = 'public'::regnamespace AND c.relname !~ '^(sigrank_|exchange_)'
--    AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)
--    AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
-- UNION ALL SELECT 'B: authenticated cannot write profile_answers',
--   NOT has_table_privilege('authenticated', 'public.profile_answers', 'INSERT,UPDATE,DELETE')
-- UNION ALL SELECT 'B2: authenticated cannot write answer_stress_tests',
--   NOT has_table_privilege('authenticated', 'public.answer_stress_tests', 'INSERT,UPDATE,DELETE')
-- UNION ALL SELECT 'C: anon keeps SELECT on user_applications (policy dependency)',
--   has_table_privilege('anon', 'public.user_applications', 'SELECT')
-- UNION ALL SELECT 'C: anon cannot read user_profiles',
--   NOT has_table_privilege('anon', 'public.user_profiles', 'SELECT')
-- UNION ALL SELECT 'D: authenticated cannot write _deploy_flags',
--   NOT has_table_privilege('authenticated', 'public._deploy_flags', 'INSERT,UPDATE,DELETE')
-- UNION ALL SELECT 'E1: sender delete policy present',
--   EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
--            AND tablename = 'community_messages' AND policyname = 'cm_sender_delete')
-- UNION ALL SELECT 'E1: authenticated keeps DELETE on community_messages',
--   has_table_privilege('authenticated', 'public.community_messages', 'DELETE');
