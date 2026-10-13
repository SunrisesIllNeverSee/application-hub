-- ============================================================
-- 051 — IR-015 local-first database write boundary (PROPOSAL)
-- ============================================================
-- Status: PROPOSAL — DO NOT APPLY to production without explicit
-- owner authorization. Prepared migration per the M07 reconciliation
-- directive; application is a deployment-custody decision.
--
-- EXECUTION-VERIFIED against PostgreSQL 16.15 on a scratch database
-- carrying the REAL production table names (2026-10-13):
--   flag absent → INSERT INTO profile_answers / intake_submissions
--                 / ai_draft_runs / answer_reviews / application_answers
--                 / profile_answer_history succeeds
--   flag='1'   → INSERT/UPDATE/DELETE all denied on those tables
--   flag='1'   → SELECT still returns rows (reads untouched)
--   flag off   → writes restored (rollback path verified)
-- Syntax notes: one command keyword per CREATE POLICY; INSERT carries
-- WITH CHECK only; UPDATE carries USING + WITH CHECK; DELETE USING only.
--
-- Purpose: AQUA_LOCAL_FIRST + NEXT_PUBLIC_AQUA_LOCAL_FIRST gating lives
-- in application code. A misconfigured deploy (server flag only) used to
-- leave direct client→Supabase private writes ungated — build-time
-- pairing validation (next.config.mjs) now prevents that deploy, but the
-- durable database boundary is RLS: make the DB itself refuse private-
-- content writes whenever local-first custody is active.
--
-- Design: a single-row deployment flag table read by RLS policies.
--   _deploy_flags(key='local_first', value='1')  → private writes denied
--   flag row absent / value != '1'              → hosted behavior
-- The same schema serves both custody models — flipping is a data change
-- (owner operation), not a schema change.
--
-- Tables covered — every user-private free-text store in the hosted
-- model (server routes AND direct client writes alike):
--   profile_answers        — answer bodies (direct client upsert exists)
--   profile_answer_history — prior answer versions
--   answer_reviews         — private review notes
--   application_answers    — per-application answer text
--   ai_draft_runs          — generation prompts + outputs
--   intake_submissions     — RAW pasted application text (most sensitive)
--
-- Excluded deliberately: user_profiles / user_applications are structured
-- account metadata (no free-text private content) and remain writable;
-- team_* tables are collaborative state outside the per-user boundary;
-- public catalog tables are public by definition.
-- Each policy is guarded by to_regclass() so a renamed/dropped table
-- cannot abort the block.
-- ============================================================

-- 1. Deployment flag table (service-role managed; read-only to clients).
CREATE TABLE IF NOT EXISTS _deploy_flags (
  key   text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE _deploy_flags ENABLE ROW LEVEL SECURITY;
-- clients may READ the flag (client bundles already know the flag);
-- only service_role writes it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='_deploy_flags' AND policyname='deploy_flags_read'
  ) THEN
    CREATE POLICY deploy_flags_read ON _deploy_flags
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 2. Helper: true when local-first custody is active at the database.
CREATE OR REPLACE FUNCTION local_first_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM _deploy_flags WHERE key='local_first' AND value='1'
) $$;

-- 3. Deny private-content WRITES while local-first custody is active.
DO $outer$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profile_answers', 'profile_answer_history', 'answer_reviews',
    'application_answers', 'ai_draft_runs', 'intake_submissions'
  ]
  LOOP
    -- existence guard: a renamed/dropped table must not abort the block
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'local_first boundary: table % not present — skipped', t;
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'local_first_deny_insert'
    ) THEN
      EXECUTE format(
        'CREATE POLICY local_first_deny_insert ON %I
           AS RESTRICTIVE FOR INSERT TO authenticated
           WITH CHECK (NOT local_first_active())',
        t);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'local_first_deny_update'
    ) THEN
      EXECUTE format(
        'CREATE POLICY local_first_deny_update ON %I
           AS RESTRICTIVE FOR UPDATE TO authenticated
           USING (NOT local_first_active())
           WITH CHECK (NOT local_first_active())',
        t);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'local_first_deny_delete'
    ) THEN
      EXECUTE format(
        'CREATE POLICY local_first_deny_delete ON %I
           AS RESTRICTIVE FOR DELETE TO authenticated
           USING (NOT local_first_active())',
        t);
    END IF;
  END LOOP;
END $outer$;

-- 4. Rollback (manual, owner-run) — three policies per covered table:
--    DROP POLICY local_first_deny_insert ON <table>;
--    DROP POLICY local_first_deny_update ON <table>;
--    DROP POLICY local_first_deny_delete ON <table>;
--    for each of: profile_answers, profile_answer_history,
--                 answer_reviews, application_answers, ai_draft_runs,
--                 intake_submissions
--    then optionally: DROP FUNCTION local_first_active();
--                     DROP TABLE _deploy_flags;
--
-- 5. Activation (manual, owner-run, alongside the Vercel env pair):
--    INSERT INTO _deploy_flags(key, value) VALUES ('local_first','1');
--    Deactivation: DELETE FROM _deploy_flags WHERE key='local_first';
--    Note: policies deny WRITES only — authenticated SELECT remains.
--
-- 6. Tests (verified on scratch Postgres 16.15, 2026-10-13):
--   a. flag absent → authenticated INSERT succeeds on every covered table
--   b. flag='1'    → INSERT/UPDATE/DELETE refused (RLS violation)
--   c. flag='1'    → SELECT on covered tables still returns rows
--   d. flag off    → writes restored
--   e. missing table → NOTICE logged, block completes for the rest
