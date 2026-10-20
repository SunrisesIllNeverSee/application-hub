-- ============================================================
-- 054 — Canonical write boundary (M08 / P0 auth)
-- ============================================================
-- STATUS: PREPARED — DO NOT APPLY without separate owner
-- prod-exec-auth. Requires 052 and 053 applied (programs.source enum
-- value 'canonical'; canonical policies). Forward-only, idempotent,
-- transactional. Touches NO data rows. Does not modify 052/053.
--
-- Closes only audit-confirmed gaps (diagnosis-db-canonical.md):
--   DBC-01  programs UPDATE: an owner could flip their own program to
--           source='canonical' (WITH CHECK was NULL, USING reused, no
--           source guard) -> publishes arbitrary rows into the anon-
--           readable canonical catalog.
--   DBC-02  archived_questions UPDATE open to ANY authenticated user
--           (policy "admin_update" only checks auth.role()) -> canonical
--           question text could be rewritten.
--   DBC-03  archived_questions INSERT open to ANY authenticated user.
--   DBC-05  canonical programs protected only by data (funder_user_id
--           NULL), not by rule -> made explicit (policy + trigger).
--   DBC-06  program_questions on canonical programs protected only
--           transitively -> explicit policy + trigger guard.
--
-- Mechanism (defense in depth):
--   1. RLS policies: owners may edit only NON-canonical programs and can
--      never write source='canonical' (old AND new row checked);
--      archived_questions has no authenticated write policy (writes are
--      service-side only); program_questions writes require an owned,
--      non-canonical program.
--   2. Row guard triggers (SECURITY INVOKER) that raise 42501 unless the
--      CURRENT role is postgres / supabase_admin / service_role / a
--      superuser: they hold even if a permissive policy is added later.
--      current_user is the role PostgREST switched to (authenticated /
--      anon / service_role), or the migration role (postgres), or the
--      definer-function owner (postgres) — so the 053-style promotion
--      path, the intake route's service-role client, and existing
--      SECURITY DEFINER jobs keep working unchanged.
--   3. asked_by_count trigger functions become SECURITY DEFINER so owned
--      program question links keep incrementing counters now that users
--      can no longer UPDATE archived_questions.
--
-- NOT included on purpose (not confirmed gaps / needs a product decision):
--   * DBC-07 asked_by_count inflation via owned-program links
--     (P2; residual, documented in the test matrix).
--   * DBC-08 adjacent tables (program_listings, program_signals, ...).
--   * DBC-09 REVOKE of TRUNCATE/DML grants (defense in depth).
--
-- ROLLBACK (owner-run), restores the exact pre-054 state captured from
-- pg_policies / pg_proc on 2026-10-20:
--   BEGIN;
--   DROP TRIGGER IF EXISTS programs_canonical_guard ON programs;
--   DROP TRIGGER IF EXISTS program_questions_canonical_guard ON program_questions;
--   DROP TRIGGER IF EXISTS archived_questions_service_only_guard ON archived_questions;
--   DROP FUNCTION IF EXISTS guard_canonical_programs();
--   DROP FUNCTION IF EXISTS guard_canonical_program_questions();
--   DROP FUNCTION IF EXISTS guard_archived_questions_writes();
--   DROP FUNCTION IF EXISTS is_canonical_program(uuid);
--   DROP FUNCTION IF EXISTS is_canonical_writer();
--   DROP POLICY IF EXISTS programs_owner_or_admin_update ON programs;
--   CREATE POLICY programs_owner_or_admin_update ON programs FOR UPDATE
--     USING ((funder_user_id = auth.uid()) OR (auth.role() = 'service_role'::text));
--   DROP POLICY IF EXISTS program_questions_auth_insert ON program_questions;
--   CREATE POLICY program_questions_auth_insert ON program_questions FOR INSERT
--     WITH CHECK (EXISTS (SELECT 1 FROM programs p WHERE p.id = program_questions.program_id
--       AND (p.funder_user_id = auth.uid() OR auth.role() = 'service_role'::text)));
--   DROP POLICY IF EXISTS program_questions_auth_update ON program_questions;
--   CREATE POLICY program_questions_auth_update ON program_questions FOR UPDATE
--     USING (EXISTS (SELECT 1 FROM programs p WHERE p.id = program_questions.program_id
--       AND (p.funder_user_id = auth.uid() OR auth.role() = 'service_role'::text)));
--   CREATE POLICY archived_questions_admin_insert ON archived_questions FOR INSERT
--     WITH CHECK (auth.role() = 'authenticated'::text);
--   CREATE POLICY archived_questions_admin_update ON archived_questions FOR UPDATE
--     USING (auth.role() = 'authenticated'::text);
--   CREATE OR REPLACE FUNCTION public.increment_asked_by_count() RETURNS trigger LANGUAGE plpgsql AS $f$
--   BEGIN UPDATE archived_questions SET asked_by_count=asked_by_count+1, updated_at=NOW() WHERE id=NEW.archived_question_id; RETURN NEW; END; $f$;
--   CREATE OR REPLACE FUNCTION public.decrement_asked_by_count() RETURNS trigger LANGUAGE plpgsql AS $f$
--   BEGIN UPDATE archived_questions SET asked_by_count=GREATEST(0,asked_by_count-1), updated_at=NOW() WHERE id=OLD.archived_question_id; RETURN OLD; END; $f$;
--   COMMIT;
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Helpers
-- ------------------------------------------------------------

-- True only for the roles that may write canonical catalog records.
-- SECURITY INVOKER on purpose: current_user must be the CALLER's role.
CREATE OR REPLACE FUNCTION public.is_canonical_writer()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT current_user::text IN ('postgres', 'supabase_admin', 'service_role')
      OR COALESCE((SELECT r.rolsuper FROM pg_catalog.pg_roles r WHERE r.rolname = current_user), false)
$$;

-- Canonical-ness lookup that does not depend on the caller's RLS view.
CREATE OR REPLACE FUNCTION public.is_canonical_program(p_program_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.programs p
     WHERE p.id = p_program_id AND p.source::text = 'canonical'
  )
$$;

-- ------------------------------------------------------------
-- 1. programs: owners edit NON-canonical rows only (DBC-01, DBC-05)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "programs_owner_or_admin_update" ON programs;

CREATE POLICY "programs_owner_or_admin_update"
  ON programs FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (funder_user_id = auth.uid() AND source <> 'canonical')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (funder_user_id = auth.uid() AND source <> 'canonical')
  );

-- Row guard: canonical rows (old or new) change only via service-side roles.
CREATE OR REPLACE FUNCTION public.guard_canonical_programs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_canonical_writer() THEN
    IF (TG_OP = 'INSERT' AND NEW.source::text = 'canonical')
       OR (TG_OP = 'UPDATE' AND (OLD.source::text = 'canonical' OR NEW.source::text = 'canonical'))
       OR (TG_OP = 'DELETE' AND OLD.source::text = 'canonical')
    THEN
      RAISE EXCEPTION 'canonical programs are service-side only'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS programs_canonical_guard ON programs;
CREATE TRIGGER programs_canonical_guard
  BEFORE INSERT OR UPDATE OR DELETE ON programs
  FOR EACH ROW EXECUTE FUNCTION public.guard_canonical_programs();

-- ------------------------------------------------------------
-- 2. program_questions: no user writes against canonical programs (DBC-06)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "program_questions_auth_insert" ON program_questions;
CREATE POLICY "program_questions_auth_insert"
  ON program_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM programs p
       WHERE p.id = program_questions.program_id
         AND (
           auth.role() = 'service_role'
           OR (p.funder_user_id = auth.uid() AND p.source <> 'canonical')
         )
    )
  );

DROP POLICY IF EXISTS "program_questions_auth_update" ON program_questions;
CREATE POLICY "program_questions_auth_update"
  ON program_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM programs p
       WHERE p.id = program_questions.program_id
         AND (
           auth.role() = 'service_role'
           OR (p.funder_user_id = auth.uid() AND p.source <> 'canonical')
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM programs p
       WHERE p.id = program_questions.program_id
         AND (
           auth.role() = 'service_role'
           OR (p.funder_user_id = auth.uid() AND p.source <> 'canonical')
         )
    )
  );

CREATE OR REPLACE FUNCTION public.guard_canonical_program_questions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_canonical_writer() THEN
    IF (TG_OP IN ('INSERT', 'UPDATE') AND public.is_canonical_program(NEW.program_id))
       OR (TG_OP IN ('UPDATE', 'DELETE') AND public.is_canonical_program(OLD.program_id))
    THEN
      RAISE EXCEPTION 'canonical program relationships are service-side only'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS program_questions_canonical_guard ON program_questions;
CREATE TRIGGER program_questions_canonical_guard
  BEFORE INSERT OR UPDATE OR DELETE ON program_questions
  FOR EACH ROW EXECUTE FUNCTION public.guard_canonical_program_questions();

-- ------------------------------------------------------------
-- 3. archived_questions: shared catalog infrastructure, service-side
--    writes only (DBC-02, DBC-03). No policy = default deny for anon and
--    authenticated; service_role bypasses RLS.
--    Legit flows: intake route uses the service-role client; the
--    user-client insert path (insert ... returning) already fails under
--    052 because an orphan row is not SELECT-visible (DBC-03b test).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "archived_questions_admin_insert" ON archived_questions;
DROP POLICY IF EXISTS "archived_questions_admin_update" ON archived_questions;

CREATE OR REPLACE FUNCTION public.guard_archived_questions_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_canonical_writer() THEN
    RAISE EXCEPTION 'archived_questions are service-side only'
      USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS archived_questions_service_only_guard ON archived_questions;
CREATE TRIGGER archived_questions_service_only_guard
  BEFORE INSERT OR UPDATE OR DELETE ON archived_questions
  FOR EACH ROW EXECUTE FUNCTION public.guard_archived_questions_writes();

-- ------------------------------------------------------------
-- 4. Keep asked_by_count maintenance working for owned-program links.
--    These trigger functions UPDATE archived_questions as the invoker and
--    depended on the dropped authenticated UPDATE policy. Run as owner.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_asked_by_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE archived_questions
     SET asked_by_count = asked_by_count + 1, updated_at = NOW()
   WHERE id = NEW.archived_question_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_asked_by_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE archived_questions
     SET asked_by_count = GREATEST(0, asked_by_count - 1), updated_at = NOW()
   WHERE id = OLD.archived_question_id;
  RETURN OLD;
END;
$$;

-- DBC-09: row-level guard triggers do not fire on TRUNCATE, and nothing in the app
-- truncates or creates triggers through client roles.
REVOKE TRUNCATE, TRIGGER ON public.programs, public.program_questions, public.archived_questions FROM anon, authenticated;

COMMIT;

-- ============================================================
-- Post-apply read-only verification (owner-run):
--   SELECT policyname, cmd FROM pg_policies
--    WHERE tablename IN ('programs','program_questions','archived_questions') ORDER BY 1;
--     -- expect NO archived_questions_admin_insert / _admin_update
--   SELECT tgname FROM pg_trigger WHERE tgname IN
--    ('programs_canonical_guard','program_questions_canonical_guard','archived_questions_service_only_guard');
--     -- expect 3 rows
--   SELECT count(*) FROM programs WHERE source='canonical';              -- 5
--   SELECT count(*) FROM program_questions pq JOIN programs p
--     ON p.id=pq.program_id WHERE p.source='canonical';                   -- 103
-- ============================================================
