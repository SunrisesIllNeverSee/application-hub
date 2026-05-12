-- ============================================================
-- Migration 018: Portable Application Taxonomy
-- Application Hub Platform — Ello Cello LLC
-- ============================================================
-- Adds domain + universal_theme to archived_questions so the
-- question archive and answer bank can serve any application
-- type (jobs, education, grants) without rebuilding the engine.
--
-- Public surface stays founder-first. This is infrastructure.
--
-- Universal theme map:
--   background  → team / experience / academic_background / qualifications
--   competency  → traction / skills / activities / track_record
--   problem     → problem / challenge / research_gap / problem_statement
--   approach    → solution / methodology / research_plan / methodology
--   impact      → market / scope / contribution / impact
--   motivation  → vision / culture_fit / goals / sustainability
--   personal    → personal / personal_statement (all domains)
--   fit         → fit / role_fit / program_fit / eligibility
-- ============================================================

-- ── archived_questions ──────────────────────────────────────

ALTER TABLE archived_questions
  ADD COLUMN IF NOT EXISTS domain TEXT NOT NULL DEFAULT 'founder'
    CHECK (domain IN ('founder', 'jobs', 'education', 'grants', 'general'));

ALTER TABLE archived_questions
  ADD COLUMN IF NOT EXISTS universal_theme TEXT;

-- Backfill universal_theme from existing founder themes
UPDATE archived_questions SET universal_theme = CASE theme
  WHEN 'team'       THEN 'background'
  WHEN 'traction'   THEN 'competency'
  WHEN 'problem'    THEN 'problem'
  WHEN 'solution'   THEN 'approach'
  WHEN 'market'     THEN 'impact'
  WHEN 'vision'     THEN 'motivation'
  WHEN 'personal'   THEN 'personal'
  WHEN 'fit'        THEN 'fit'
  ELSE 'general'
END
WHERE universal_theme IS NULL;

CREATE INDEX IF NOT EXISTS idx_aq_domain
  ON archived_questions (domain);

CREATE INDEX IF NOT EXISTS idx_aq_universal_theme
  ON archived_questions (domain, universal_theme);

-- ── programs ────────────────────────────────────────────────

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS domain TEXT NOT NULL DEFAULT 'founder'
    CHECK (domain IN ('founder', 'jobs', 'education', 'grants', 'general'));

CREATE INDEX IF NOT EXISTS idx_programs_domain
  ON programs (domain);

-- ── app_import_sessions ──────────────────────────────────────

ALTER TABLE app_import_sessions
  ADD COLUMN IF NOT EXISTS domain TEXT NOT NULL DEFAULT 'founder'
    CHECK (domain IN ('founder', 'jobs', 'education', 'grants', 'general'));

-- ── import_queue ────────────────────────────────────────────

ALTER TABLE import_queue
  ADD COLUMN IF NOT EXISTS domain TEXT NOT NULL DEFAULT 'founder'
    CHECK (domain IN ('founder', 'jobs', 'education', 'grants', 'general'));

-- ============================================================
-- Verification
-- ============================================================
-- SELECT domain, universal_theme, COUNT(*)
-- FROM archived_questions
-- GROUP BY domain, universal_theme
-- ORDER BY domain, universal_theme;
