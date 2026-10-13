-- ============================================================
-- 051 — IR-015 local-first database write boundary (PROPOSAL)
-- ============================================================
-- Status: PROPOSAL — DO NOT APPLY to production without explicit
-- owner authorization. Prepared migration per the M07 reconciliation
-- directive; application is a deployment-custody decision.
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
-- Public catalog + structured account metadata stays writable —
-- local-first never needed a database gate for non-private data.
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

-- 3. Deny private-content writes while local-first custody is active.
--    Pattern: deny policy (WITH CHECK false when flag on) layered over the
--    existing permissive policies. PostgreSQL uses PERMISSIVE policies by
--    default — an explicit RESTRICTIVE policy ANDs with them.
DO $outer$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profile_answers', 'answer_reviews', 'draft_runs']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'local_first_deny_write'
    ) THEN
      EXECUTE format(
        'CREATE POLICY local_first_deny_write ON %I
           AS RESTRICTIVE FOR ALL TO authenticated
           USING (NOT local_first_active())
           WITH CHECK (NOT local_first_active())',
        t)
    END IF;
  END LOOP;
END $outer$;

-- 4. Rollback (manual, owner-run):
--    DROP POLICY local_first_deny_write ON profile_answers;
--    DROP POLICY local_first_deny_write ON answer_reviews;
--    DROP POLICY local_first_deny_write ON draft_runs;
--    DROP FUNCTION local_first_active();
--    DROP TABLE _deploy_flags;
-- (table+function drops optional — policies no longer reference them.)
--
-- 5. Activation (manual, owner-run, alongside the Vercel env pair):
--    INSERT INTO _deploy_flags(key, value) VALUES ('local_first','1');
--    Deactivation: DELETE FROM _deploy_flags WHERE key='local_first';
--
-- Tests (run on a staging project BEFORE apply):
--   a. flag absent → authenticated INSERT INTO profile_answers succeeds.
--   b. flag='1'    → the same INSERT fails with RLS violation.
--   c. flag='1'    → DELETE FROM _deploy_flags restores write access.
--   d. flag='1'    → SELECT on _deploy_flags works for authenticated.
--   e. flag='1'    → INSERT into a public catalog-adjacent table still OK.
