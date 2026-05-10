-- Migration 013: cohort context columns
-- Adds cohort_name, program_start_date, and cohort_size to the programs table.
-- Seeds known values for 8 programs.

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS cohort_name TEXT,
  ADD COLUMN IF NOT EXISTS program_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cohort_size INTEGER;

-- Seed known values by slug

UPDATE programs SET
  cohort_name = 'S26',
  program_start_date = '2026-11-01',
  cohort_size = 200
WHERE slug = 'y-combinator';

UPDATE programs SET
  cohort_name = 'Fall 2026',
  program_start_date = '2026-10-01',
  cohort_size = 10
WHERE slug = 'techstars-boulder';

UPDATE programs SET
  cohort_name = 'Batch 31',
  cohort_size = 30
WHERE slug = '500-startups';

UPDATE programs SET
  cohort_name = 'Class 22',
  cohort_size = 15
WHERE slug = 'alchemist-accelerator';

UPDATE programs SET
  cohort_name = '2026 Cohort',
  cohort_size = 128
WHERE slug = 'masschallenge';

UPDATE programs SET
  cohort_name = '2026 Fellowship',
  cohort_size = 20
WHERE slug = 'echoing-green';

UPDATE programs SET
  cohort_size = 150
WHERE slug = 'nsf-sbir';

UPDATE programs SET
  cohort_size = 500
WHERE slug = 'sbir-phase-1';
