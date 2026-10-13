-- ============================================================
-- 051 — IR-015 local-first database write boundary (PROPOSAL)
-- ============================================================
-- Status: PROPOSAL — DO NOT APPLY to production without explicit
-- owner authorization. Prepared migration per the M07 reconciliation
-- directive; application is a deployment-custody decision.
--
-- EXECUTION-VERIFIED against PostgreSQL 16.15 (scratch db, 2026-10-13):
--   flag absent → INSERT INTO profile_answers succeeds
--   flag='1'   → INSERT/UPDATE/DELETE all denied via the three policies
--   flag='1'   → SELECT still returns rows (reads untouched)
--   flag off   → writes restored (rollback path verified)
-- Syntax notes: INSERT policies accept WITH CHECK only; UPDATE carries
-- USING + WITH CHECK; DELETE carries USING only; one command keyword per
-- CREATE POLICY statement.
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
-- Tables covered (private-content stores in the hosted model):
--   profile_answers — answer bodies
--   answer_reviews — private review notes
--   draft_runs     — generation history containing prompts/outputs
--
-- Scope: INSERT/UPDATE/DELETE only — reads are NOT denied (the hosted
-- read path may still surface legacy data during transition).
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
--    One policy per command keyword — PostgreSQL accepts exactly one
--    command per CREATE POLICY. INSERT gets WITH CHECK only (USING is
--    illegal on INSERT); UPDATE gets both; DELETE gets USING only.
DO $outer$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profile_answers', 'answer_reviews', 'draft_runs']
  LOOP
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

-- 4. Rollback (manual, owner-run):
--    DROP POLICY local_first_deny_insert ON profile_answers;
--    DROP POLICY local_first_deny_update ON profile_answers;
--    DROP POLICY local_first_deny_delete ON profile_answers;
--    DROP POLICY local_first_deny_insert ON answer_reviews;
--    DROP POLICY local_first_deny_update ON answer_reviews;
--    DROP POLICY local_first_deny_delete ON answer_reviews;
--    DROP POLICY local_first_deny_insert ON draft_runs;
--    DROP POLICY local_first_deny_update ON draft_runs;
--    DROP POLICY local_first_deny_delete ON draft_runs;
--    DROP FUNCTION local_first_active();
--    DROP TABLE _deploy_flags;
-- (table+function drops optional — policies no longer reference them.)
--
-- 5. Activation (manual, owner-run, alongside the Vercel env pair):
--    INSERT INTO _deploy_flags(key, value) VALUES ('local_first','1');
--    Deactivation: DELETE FROM _deploy_flags WHERE key='local_first';
--    Note: policies deny WRITES only — authenticated SELECT remains. The
--    vault does not depend on hosted private reads under local-first.
--
-- 6. Tests (run on a staging project BEFORE apply):
--   a. flag absent → authenticated INSERT INTO profile_answers succeeds.
--   b. flag='1'    → the same INSERT fails with RLS violation;
--                    UPDATE/DELETE similarly refused.
--   c. flag='1'    → SELECT on profile_answers still works (reads allowed).
--   d. flag='1'    → DELETE FROM _deploy_flags restores write access.
--   e. flag='1'    → INSERT into a public catalog-adjacent table still OK.
