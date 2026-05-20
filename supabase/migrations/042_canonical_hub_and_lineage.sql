-- ============================================================
-- 042 — Canonical Hub + Lineage
-- ============================================================
-- Hub-and-spoke core for portable application commitments.
-- Canonicals are public reusable commitments; variants and packages are
-- user-scoped spokes with lineage preserved as a DAG.
-- ============================================================

CREATE TABLE IF NOT EXISTS canonical_commitments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hash                  TEXT UNIQUE NOT NULL,
  version               TEXT NOT NULL DEFAULT '1.0',
  vertical              TEXT NOT NULL CHECK (vertical IN ('founder', 'college', 'grants', 'jobs')),
  title                 TEXT NOT NULL,
  aggregate_description TEXT,
  significance_score    NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (significance_score BETWEEN 0 AND 1),
  qualification_tags    TEXT[] NOT NULL DEFAULT '{}',
  lineage               JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS answer_variants (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_id          UUID NOT NULL REFERENCES canonical_commitments(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entity                TEXT,
  flavor_text           TEXT,
  fidelity_score        NUMERIC(5,4) CHECK (fidelity_score IS NULL OR fidelity_score BETWEEN 0 AND 1),
  content               TEXT NOT NULL,
  qualification         JSONB NOT NULL DEFAULT '{}',
  used_in_packages      UUID[] NOT NULL DEFAULT '{}',
  lineage               JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS application_packages (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  program_entity        TEXT,
  vertical              TEXT NOT NULL CHECK (vertical IN ('founder', 'college', 'grants', 'jobs')),
  commitments           JSONB NOT NULL DEFAULT '[]',
  outcomes              JSONB NOT NULL DEFAULT '{}',
  hash                  TEXT,
  lineage               JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lineage_events (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type           TEXT NOT NULL CHECK (entity_type IN ('canonical', 'variant', 'package', 'seeding_entity', 'reward')),
  entity_id             UUID NOT NULL,
  action                TEXT NOT NULL,
  parent_hashes         TEXT[] NOT NULL DEFAULT '{}',
  new_hash              TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canonical_hash ON canonical_commitments(hash);
CREATE INDEX IF NOT EXISTS idx_canonical_vertical ON canonical_commitments(vertical);
CREATE INDEX IF NOT EXISTS idx_canonical_qualification_tags ON canonical_commitments USING gin (qualification_tags);
CREATE INDEX IF NOT EXISTS idx_answer_canonical ON answer_variants(canonical_id);
CREATE INDEX IF NOT EXISTS idx_answer_user ON answer_variants(user_id);
CREATE INDEX IF NOT EXISTS idx_answer_entity ON answer_variants(entity);
CREATE INDEX IF NOT EXISTS idx_package_user ON application_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_package_vertical ON application_packages(vertical);
CREATE INDEX IF NOT EXISTS idx_lineage_entity ON lineage_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_lineage_new_hash ON lineage_events(new_hash);

ALTER TABLE canonical_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "canonical_commitments_public_select" ON canonical_commitments;
CREATE POLICY "canonical_commitments_public_select" ON canonical_commitments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "canonical_commitments_service_all" ON canonical_commitments;
CREATE POLICY "canonical_commitments_service_all" ON canonical_commitments
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "answer_variants_owner_all" ON answer_variants;
CREATE POLICY "answer_variants_owner_all" ON answer_variants
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "answer_variants_service_all" ON answer_variants;
CREATE POLICY "answer_variants_service_all" ON answer_variants
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "application_packages_owner_all" ON application_packages;
CREATE POLICY "application_packages_owner_all" ON application_packages
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "application_packages_service_all" ON application_packages;
CREATE POLICY "application_packages_service_all" ON application_packages
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "lineage_events_owner_or_public_select" ON lineage_events;
CREATE POLICY "lineage_events_owner_or_public_select" ON lineage_events
  FOR SELECT USING (
    entity_type = 'canonical'
    OR auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM answer_variants av
      WHERE lineage_events.entity_type = 'variant'
        AND lineage_events.entity_id = av.id
        AND av.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM application_packages ap
      WHERE lineage_events.entity_type = 'package'
        AND lineage_events.entity_id = ap.id
        AND ap.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lineage_events_service_all" ON lineage_events;
CREATE POLICY "lineage_events_service_all" ON lineage_events
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_canonical_updated_at ON canonical_commitments;
CREATE TRIGGER update_canonical_updated_at
  BEFORE UPDATE ON canonical_commitments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_variant_updated_at ON answer_variants;
CREATE TRIGGER update_variant_updated_at
  BEFORE UPDATE ON answer_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_package_updated_at ON application_packages;
CREATE TRIGGER update_package_updated_at
  BEFORE UPDATE ON application_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
