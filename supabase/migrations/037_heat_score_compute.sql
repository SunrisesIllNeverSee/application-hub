-- Migration 037: Synthetic heat_score compute
--
-- Formula:
--   heat_score = ROUND(
--     (brand_component * 0.50)       -- brand prestige (0-100)
--   + (exclusivity_component * 0.30) -- cohort exclusivity (inverse cohort_size)
--   + (value_component * 0.20)       -- program value score
--   )
--
-- Components normalized 0-100 before weighting.
-- Programs with no data on any component get a floor of 10.
-- Re-run compute_heat_scores() any time brand_score or cohort_size changes.

CREATE OR REPLACE FUNCTION compute_heat_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  max_brand   NUMERIC;
  max_value   NUMERIC;
BEGIN
  SELECT COALESCE(MAX(brand_score), 100)         INTO max_brand  FROM programs;
  SELECT COALESCE(MAX(program_value_score), 100) INTO max_value  FROM programs;

  UPDATE programs
  SET heat_score = GREATEST(10, ROUND(
    COALESCE((brand_score::NUMERIC / NULLIF(max_brand, 0)) * 100, 30) * 0.50
    + COALESCE(
        GREATEST(10, LEAST(100, 100 - ((cohort_size::NUMERIC - 10) / 2))),
        40
      ) * 0.30
    + COALESCE((program_value_score::NUMERIC / NULLIF(max_value, 0)) * 100, 30) * 0.20
  )::INTEGER);
END;
$$;

-- Run immediately on migration
SELECT compute_heat_scores();
