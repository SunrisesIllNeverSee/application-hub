-- =============================================================================
-- Migration 018: Opportunity Taxonomy
-- =============================================================================
-- Purpose:
--   Extend the schema to support cross-theme opportunities (jobs, school,
--   grants, accelerators, fellowships, VC) without breaking the existing
--   `programs` table or any downstream code.
--
-- Properties:
--   - ADDITIVE ONLY: no DROP TABLE, no DROP COLUMN, no breaking type changes.
--   - IDEMPOTENT: every statement uses IF NOT EXISTS / IF EXISTS guards, or
--     is wrapped in a DO block that catches duplicate_object/duplicate_column
--     so the migration can be re-applied safely.
--   - NON-BREAKING: every new column on existing tables is NULLABLE (or has a
--     DEFAULT) so existing rows continue to satisfy the schema.
--   - BACKFILL-AWARE: the `programs.kind` CHECK constraint is only added AFTER
--     the backfill UPDATE has populated values from the legacy `type` column.
--
-- Non-transactional notes:
--   - This file uses no `ALTER TYPE ... ADD VALUE` statements (those cannot run
--     inside a transaction block). The full opportunity_kind enum is created in
--     one CREATE TYPE statement, so the entire migration is transaction-safe.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- A. New enum: opportunity_kind
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE opportunity_kind AS ENUM (
    'accelerator',
    'vc',
    'grant',
    'fellowship',
    'job_fulltime',
    'job_internship',
    'job_contract',
    'school_undergrad',
    'school_grad',
    'school_professional',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- -----------------------------------------------------------------------------
-- B. Add `kind` column to programs, backfill from legacy `type`, then constrain
-- -----------------------------------------------------------------------------
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS kind opportunity_kind;

-- Backfill from legacy `type` (program_type enum) -> new kind (opportunity_kind).
-- Only update rows where kind is still NULL so this is safe on re-run.
UPDATE programs
SET kind = CASE type::text
    WHEN 'accel'      THEN 'accelerator'::opportunity_kind
    WHEN 'vc'         THEN 'vc'::opportunity_kind
    WHEN 'grant'      THEN 'grant'::opportunity_kind
    WHEN 'fellowship' THEN 'fellowship'::opportunity_kind
    WHEN 'job'        THEN 'job_fulltime'::opportunity_kind
    WHEN 'uni'        THEN 'school_grad'::opportunity_kind
    WHEN 'corp'       THEN 'vc'::opportunity_kind
    WHEN 'other'      THEN 'other'::opportunity_kind
    ELSE 'other'::opportunity_kind
  END
WHERE kind IS NULL;

-- Add NOT NULL CHECK only after backfill. Use a named CHECK constraint so the
-- guard is idempotent (we can detect prior creation by name).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'programs_kind_not_null_chk'
      AND conrelid = 'programs'::regclass
  ) THEN
    ALTER TABLE programs
      ADD CONSTRAINT programs_kind_not_null_chk CHECK (kind IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_programs_kind ON programs (kind);


-- -----------------------------------------------------------------------------
-- C. Polymorphic detail column on programs
-- -----------------------------------------------------------------------------
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS details_schema_version SMALLINT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_programs_details_gin
  ON programs USING GIN (details);


-- -----------------------------------------------------------------------------
-- D. Generic columns on programs (promoted from JSONB to real columns)
-- -----------------------------------------------------------------------------
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS apply_url               TEXT,
  ADD COLUMN IF NOT EXISTS remote_ok               BOOLEAN,
  ADD COLUMN IF NOT EXISTS location_city           TEXT,
  ADD COLUMN IF NOT EXISTS location_country        CHAR(2),
  ADD COLUMN IF NOT EXISTS cost_to_apply_cents     INTEGER,
  ADD COLUMN IF NOT EXISTS expected_reward_cents_min BIGINT,
  ADD COLUMN IF NOT EXISTS expected_reward_cents_max BIGINT;


-- -----------------------------------------------------------------------------
-- E. Type-specific columns on programs (nullable; populated per `kind`)
-- -----------------------------------------------------------------------------
-- Jobs
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS salary_min_cents     BIGINT,
  ADD COLUMN IF NOT EXISTS salary_max_cents     BIGINT,
  ADD COLUMN IF NOT EXISTS employment_type      TEXT,   -- fulltime/parttime/contract/intern
  ADD COLUMN IF NOT EXISTS seniority            TEXT,   -- entry/mid/senior/staff/principal/executive
  ADD COLUMN IF NOT EXISTS visa_sponsorship     BOOLEAN;

-- School
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS degree_level         TEXT,   -- bachelors/masters/mba/phd/professional
  ADD COLUMN IF NOT EXISTS program_length_months SMALLINT,
  ADD COLUMN IF NOT EXISTS gre_required         BOOLEAN,
  ADD COLUMN IF NOT EXISTS gmat_required        BOOLEAN,
  ADD COLUMN IF NOT EXISTS tuition_cents        BIGINT;

-- Grant
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS funder_type          TEXT,   -- govt/foundation/corp/individual
  ADD COLUMN IF NOT EXISTS match_required       BOOLEAN,
  ADD COLUMN IF NOT EXISTS funding_amount_cents BIGINT;

-- Indexes (only the four requested)
CREATE INDEX IF NOT EXISTS idx_programs_salary_min   ON programs (salary_min_cents);
CREATE INDEX IF NOT EXISTS idx_programs_salary_max   ON programs (salary_max_cents);
CREATE INDEX IF NOT EXISTS idx_programs_degree_level ON programs (degree_level);
CREATE INDEX IF NOT EXISTS idx_programs_funder_type  ON programs (funder_type);


-- -----------------------------------------------------------------------------
-- F. Extend archived_questions for cross-theme reuse
-- -----------------------------------------------------------------------------
ALTER TABLE archived_questions
  ADD COLUMN IF NOT EXISTS applicable_kinds opportunity_kind[]
    NOT NULL DEFAULT '{}'::opportunity_kind[];

ALTER TABLE archived_questions
  ADD COLUMN IF NOT EXISTS question_archetype TEXT;

-- Backfill: existing questions are all from the startup verticals.
-- Only update rows that still hold the default empty array so re-runs are safe.
UPDATE archived_questions
SET applicable_kinds = ARRAY[
    'accelerator'::opportunity_kind,
    'vc'::opportunity_kind,
    'grant'::opportunity_kind,
    'fellowship'::opportunity_kind
  ]
WHERE applicable_kinds = '{}'::opportunity_kind[];

CREATE INDEX IF NOT EXISTS idx_archived_questions_applicable_kinds
  ON archived_questions USING GIN (applicable_kinds);

CREATE INDEX IF NOT EXISTS idx_archived_questions_archetype
  ON archived_questions (question_archetype);


-- -----------------------------------------------------------------------------
-- G. Loosen user_profiles for non-founder applicants
-- -----------------------------------------------------------------------------
-- The original CHECK constraints on `stage` and `founder_type` were created
-- inline at column-definition time; PostgreSQL auto-names them as
-- `<table>_<column>_check`. Drop by that conventional name if present, then
-- search pg_constraint for any other CHECK that references each column and
-- drop those too. This keeps the migration tolerant of prior re-runs / manual
-- naming.

-- Drop CHECK on user_profiles.stage
DO $$
DECLARE
  con_name TEXT;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum   = ANY (c.conkey)
    WHERE c.conrelid = 'user_profiles'::regclass
      AND c.contype  = 'c'
      AND a.attname  = 'stage'
  LOOP
    EXECUTE format('ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS %I', con_name);
  END LOOP;
END $$;

-- Drop CHECK on user_profiles.founder_type
DO $$
DECLARE
  con_name TEXT;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum   = ANY (c.conkey)
    WHERE c.conrelid = 'user_profiles'::regclass
      AND c.contype  = 'c'
      AND a.attname  = 'founder_type'
  LOOP
    EXECUTE format('ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS %I', con_name);
  END LOOP;
END $$;

-- founder_type column already exists as nullable TEXT; with the CHECK now
-- removed it has no enum constraint. No further column action required.

-- Add applicant_context JSONB for non-founder dimensions
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS applicant_context JSONB NOT NULL DEFAULT '{}'::jsonb;


-- -----------------------------------------------------------------------------
-- H. Back-compat view: `opportunities` aliases `programs`
-- -----------------------------------------------------------------------------
-- This is the rename-without-rename trick: app code can begin referring to
-- `opportunities` immediately. A future migration can swap the underlying
-- table for the view name without touching consumers.
CREATE OR REPLACE VIEW opportunities AS
  SELECT * FROM programs;


-- -----------------------------------------------------------------------------
-- Done.
-- -----------------------------------------------------------------------------
