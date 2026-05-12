-- ============================================================
-- Migration 038: Program Cycles (Layer 3 schema)
-- ============================================================
-- Adds program_cycles to complete the three-layer hierarchy:
--   funders → programs → program_cycles
--
-- Layer 1: funders     — the org (Y Combinator, NSF, Techstars)
-- Layer 2: programs    — the program type (YC Accelerator, SBIR)
--                        Questions, DNA, fit scores live here.
-- Layer 3: program_cycles — a specific cohort/round
--                           (YC S26, YC W27, Techstars Fall 2026)
--                           Deadlines, cohort names, and apply_url
--                           live here.
--
-- programs.deadline_at / cohort_name / cohort_size are preserved as
-- convenience columns (denormalised "current cycle" view) and updated
-- by application code when a new cycle is added. This avoids a
-- breaking query change across the app.
-- ============================================================

CREATE TABLE IF NOT EXISTS program_cycles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  cycle_name   TEXT        NOT NULL,                  -- 'S26', 'W27', 'Fall 2026', 'Batch 31'
  opens_at     TIMESTAMPTZ,                           -- when applications open (NULL = unknown)
  closes_at    TIMESTAMPTZ,                           -- application deadline
  cohort_name  TEXT,                                  -- display label, e.g. 'Summer 2026 Cohort'
  cohort_size  INT,
  apply_url    TEXT,                                  -- direct application intake URL if known
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,     -- FALSE once the cycle has closed/passed
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_program_cycles_program
  ON program_cycles (program_id, is_active, closes_at);

ALTER TABLE program_cycles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "program_cycles_public_read"
    ON program_cycles FOR SELECT USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "program_cycles_service_all"
    ON program_cycles FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Backfill: promote existing deadline/cohort data on programs
-- into their first cycle row.
-- ============================================================
INSERT INTO program_cycles (program_id, cycle_name, closes_at, cohort_name, cohort_size, is_active)
SELECT
  p.id,
  COALESCE(p.cohort_name, 'Current') AS cycle_name,
  p.deadline_at                      AS closes_at,
  p.cohort_name,
  p.cohort_size,
  CASE
    WHEN p.deadline_at IS NULL                          THEN TRUE
    WHEN p.deadline_at > NOW()                          THEN TRUE
    ELSE FALSE   -- already past deadline → mark inactive
  END AS is_active
FROM programs p
WHERE p.deadline_at IS NOT NULL
  AND p.source = 'seeded'  -- only curated programs have meaningful cycle data
ON CONFLICT DO NOTHING;

-- ============================================================
-- Convenience view: next active cycle per program
-- Used by application code to get the upcoming deadline without
-- a LATERAL JOIN.
-- ============================================================
CREATE OR REPLACE VIEW program_next_cycle AS
SELECT DISTINCT ON (program_id)
  program_id,
  id           AS cycle_id,
  cycle_name,
  opens_at,
  closes_at,
  cohort_name,
  cohort_size,
  apply_url
FROM program_cycles
WHERE is_active = TRUE
ORDER BY program_id, closes_at ASC NULLS LAST;

ALTER VIEW program_next_cycle OWNER TO postgres;
