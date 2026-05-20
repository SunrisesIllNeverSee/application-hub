-- ============================================================
-- 045 — Canonical Aggregate System
-- ============================================================
-- Maintains growth stats for canonicals as high-quality variants arrive.
-- ============================================================

ALTER TABLE canonical_commitments
  ADD COLUMN IF NOT EXISTS aggregate_stats JSONB NOT NULL DEFAULT '{"count":0,"avg_fidelity":0,"top_rated":null}'::jsonb;

CREATE TABLE IF NOT EXISTS aggregate_versions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_id   UUID NOT NULL REFERENCES canonical_commitments(id) ON DELETE CASCADE,
  version        INT NOT NULL,
  aggregate_stats JSONB NOT NULL DEFAULT '{}',
  source_variant_id UUID REFERENCES answer_variants(id) ON DELETE SET NULL,
  lineage        JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (canonical_id, version)
);

CREATE INDEX IF NOT EXISTS idx_aggregate_versions_canonical ON aggregate_versions(canonical_id, version DESC);

ALTER TABLE aggregate_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aggregate_versions_public_select" ON aggregate_versions;
CREATE POLICY "aggregate_versions_public_select" ON aggregate_versions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "aggregate_versions_service_all" ON aggregate_versions;
CREATE POLICY "aggregate_versions_service_all" ON aggregate_versions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION refresh_canonical_aggregate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_stats JSONB;
  v_next_version INT;
BEGIN
  IF NEW.fidelity_score IS NULL OR NEW.fidelity_score < 0.72 THEN
    RETURN NEW;
  END IF;

  SELECT jsonb_build_object(
    'count', COUNT(*),
    'avg_fidelity', ROUND(COALESCE(AVG(fidelity_score), 0)::NUMERIC, 4),
    'top_rated', (
      SELECT to_jsonb(tv)
      FROM answer_variants tv
      WHERE tv.canonical_id = NEW.canonical_id
      ORDER BY tv.fidelity_score DESC NULLS LAST, tv.updated_at DESC
      LIMIT 1
    )
  )
  INTO v_stats
  FROM answer_variants
  WHERE canonical_id = NEW.canonical_id
    AND fidelity_score >= 0.72;

  UPDATE canonical_commitments
  SET aggregate_stats = v_stats,
      updated_at = NOW()
  WHERE id = NEW.canonical_id;

  SELECT COALESCE(MAX(version), 0) + 1
  INTO v_next_version
  FROM aggregate_versions
  WHERE canonical_id = NEW.canonical_id;

  INSERT INTO aggregate_versions (canonical_id, version, aggregate_stats, source_variant_id, lineage)
  VALUES (
    NEW.canonical_id,
    v_next_version,
    v_stats,
    NEW.id,
    jsonb_build_object('action', 'aggregate', 'source', 'answer_variants')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_canonical_aggregate ON answer_variants;
CREATE TRIGGER trg_refresh_canonical_aggregate
  AFTER INSERT OR UPDATE OF fidelity_score, content, qualification ON answer_variants
  FOR EACH ROW EXECUTE FUNCTION refresh_canonical_aggregate();
