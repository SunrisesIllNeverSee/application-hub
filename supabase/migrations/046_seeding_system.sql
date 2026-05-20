-- ============================================================
-- 046 — Canonical Seeding System
-- ============================================================
-- Real-data staging lane for applications, portals, screenshots, and
-- user-submitted source packages.
-- ============================================================

CREATE TABLE IF NOT EXISTS seeding_entities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id       TEXT UNIQUE,
  name            TEXT NOT NULL,
  vertical        TEXT NOT NULL CHECK (vertical IN ('founder', 'college', 'grants', 'jobs')),
  url             TEXT,
  tos_url         TEXT,
  deadline        TIMESTAMPTZ,
  rolling         BOOLEAN NOT NULL DEFAULT false,
  requirements    JSONB NOT NULL DEFAULT '{}',
  data_package    JSONB NOT NULL DEFAULT '{}',
  outcomes_example JSONB NOT NULL DEFAULT '{}',
  seeded_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_status   TEXT NOT NULL DEFAULT 'staged' CHECK (review_status IN ('staged', 'approved', 'rejected', 'needs_more_data')),
  hash            TEXT,
  lineage         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seeding_entities_vertical ON seeding_entities(vertical);
CREATE INDEX IF NOT EXISTS idx_seeding_entities_review_status ON seeding_entities(review_status);
CREATE INDEX IF NOT EXISTS idx_seeding_entities_seeded_by ON seeding_entities(seeded_by);
CREATE INDEX IF NOT EXISTS idx_seeding_entities_hash ON seeding_entities(hash);

ALTER TABLE seeding_entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seeding_entities_public_approved_select" ON seeding_entities;
CREATE POLICY "seeding_entities_public_approved_select" ON seeding_entities
  FOR SELECT USING (review_status = 'approved' OR seeded_by = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "seeding_entities_owner_insert" ON seeding_entities;
CREATE POLICY "seeding_entities_owner_insert" ON seeding_entities
  FOR INSERT WITH CHECK (seeded_by = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "seeding_entities_owner_update_staged" ON seeding_entities;
CREATE POLICY "seeding_entities_owner_update_staged" ON seeding_entities
  FOR UPDATE USING (seeded_by = auth.uid() OR auth.role() = 'service_role')
  WITH CHECK (seeded_by = auth.uid() OR auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_seeding_entities_updated_at ON seeding_entities;
CREATE TRIGGER update_seeding_entities_updated_at
  BEFORE UPDATE ON seeding_entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
