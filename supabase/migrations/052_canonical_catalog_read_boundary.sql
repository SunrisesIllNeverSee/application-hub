-- ============================================================
-- 052 — Canonical catalog read boundary (M08)
-- ============================================================
-- STATUS: PREPARED — DO NOT APPLY without separate owner
-- prod-exec-auth. Requires migration 051 applied first and the
-- canonical promotion decision (m08:c1–c5) approved.
--
-- Purpose: the approved-only catalog must hold at the database
-- boundary, not just the UI. Today programs, program_questions,
-- archived_questions, program_dna and program_stats are all
-- SELECT USING (TRUE) — the entire synthetic seed corpus is
-- readable via the public anon PostgREST key.
--
-- After this migration:
--   * anon/unauthenticated → canonical program rows only, and
--     questions/stats belonging to canonical programs only.
--   * authenticated → same canonical set PLUS programs the user
--     has saved (user_applications) — personal surfaces
--     (My Applications, workspaces) keep working.
--   * service_role → unchanged (bypasses RLS).
--
-- Historical records are NOT removed or rewritten; they simply
-- stop being publicly readable. Signed-in users' saved-program
-- reads are preserved by the saved-read policies below.
-- ============================================================

-- 1. Canonical source value (promotion rows carry this)
ALTER TYPE program_source ADD VALUE IF NOT EXISTS 'canonical';

-- 1b. Canonical records are service-side only: authenticated users must
--     not be able to mint source='canonical' rows via the existing
--     permissive insert policy. (service_role bypasses RLS entirely —
--     promotion runs through the migration path regardless.)
DROP POLICY IF EXISTS "programs_auth_insert" ON programs;

CREATE POLICY "programs_auth_insert"
  ON programs FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (source IS NULL OR source <> 'canonical')
  );

-- 2. PROGRAMS — approved-only public read
DROP POLICY IF EXISTS "programs_public_read" ON programs;

CREATE POLICY "programs_canonical_read"
  ON programs FOR SELECT
  USING (
    source = 'canonical'
    OR (
      auth.role() = 'authenticated'
      AND EXISTS (
        SELECT 1 FROM user_applications ua
        WHERE ua.program_id = programs.id
          AND ua.user_id = auth.uid()
      )
    )
  );

-- 3. PROGRAM QUESTIONS — readable only for programs the caller
--    can read (canonical, or own saved)
DROP POLICY IF EXISTS "program_questions_public_read" ON program_questions;

CREATE POLICY "program_questions_visible_program_read"
  ON program_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM programs p
      WHERE p.id = program_questions.program_id
        AND (
          p.source = 'canonical'
          OR (
            auth.role() = 'authenticated'
            AND EXISTS (
              SELECT 1 FROM user_applications ua
              WHERE ua.program_id = p.id
                AND ua.user_id = auth.uid()
            )
          )
        )
    )
  );

-- 4. ARCHIVED QUESTIONS — readable only when referenced by a
--    readable program's question set. The 779 synthetic rows stay
--    in place but are no longer anonymously enumerable.
DROP POLICY IF EXISTS "archived_questions_public_read" ON archived_questions;

CREATE POLICY "archived_questions_visible_program_read"
  ON archived_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM program_questions pq
      JOIN programs p ON p.id = pq.program_id
      WHERE pq.archived_question_id = archived_questions.id
        AND (
          p.source = 'canonical'
          OR (
            auth.role() = 'authenticated'
            AND EXISTS (
              SELECT 1 FROM user_applications ua
              WHERE ua.program_id = p.id
                AND ua.user_id = auth.uid()
            )
          )
        )
    )
  );

-- 5. PROGRAM DNA — same boundary (566 synthetic-derived rows)
DROP POLICY IF EXISTS "program_dna_public_read" ON program_dna;

CREATE POLICY "program_dna_visible_program_read"
  ON program_dna FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM programs p
      WHERE p.id = program_dna.program_id
        AND (
          p.source = 'canonical'
          OR (
            auth.role() = 'authenticated'
            AND EXISTS (
              SELECT 1 FROM user_applications ua
              WHERE ua.program_id = p.id
                AND ua.user_id = auth.uid()
            )
          )
        )
    )
  );

-- 6. PROGRAM STATS — same boundary
DROP POLICY IF EXISTS "program_stats_public_read" ON program_stats;

CREATE POLICY "program_stats_visible_program_read"
  ON program_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM programs p
      WHERE p.id = program_stats.program_id
        AND (
          p.source = 'canonical'
          OR (
            auth.role() = 'authenticated'
            AND EXISTS (
              SELECT 1 FROM user_applications ua
              WHERE ua.program_id = p.id
                AND ua.user_id = auth.uid()
            )
          )
        )
    )
  );

-- ============================================================
-- Known follow-on checks before applying (reviewer notes):
-- * Any other public-read policy touching programs must be
--   audited in the same execution window (grep migrations for
--   CREATE POLICY ... USING (TRUE)).
-- * The /applications surfaces already filter to canonical slugs
--   in code (lib/canonical-catalog.ts); this migration makes the
--   boundary hold even if the UI is bypassed.
-- * funders/program_next_cycle read policies: verify separately
--   whether they require the same canonical join before apply.
-- ============================================================
