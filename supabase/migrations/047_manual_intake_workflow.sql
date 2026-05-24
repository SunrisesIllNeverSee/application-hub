-- ============================================================
-- 047 — Manual Intake Workflow
-- ============================================================
-- Manual-first 7-layer intake engine with grouped checkpoints
-- and append-only audit history.
-- ============================================================

CREATE TABLE IF NOT EXISTS intake_submissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_seq            BIGSERIAL UNIQUE,
  ref                TEXT GENERATED ALWAYS AS ('IN-' || LPAD(ref_seq::TEXT, 4, '0')) STORED,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type        TEXT NOT NULL CHECK (source_type IN (
    'manual_url',
    'manual_paste',
    'manual_markdown',
    'manual_screenshot',
    'browser_extension',
    'api',
    'import_queue_legacy'
  )),
  raw_input          TEXT NOT NULL,
  source_url         TEXT,
  source_title       TEXT,
  vertical_hint      TEXT NOT NULL DEFAULT 'unknown' CHECK (vertical_hint IN ('tech', 'university', 'grants', 'jobs', 'unknown')),
  kind_hint          TEXT,
  captured_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  capture_method     TEXT NOT NULL CHECK (capture_method IN (
    'paste',
    'url_submit',
    'markdown_upload',
    'screenshot_upload',
    'extension_capture',
    'api_post',
    'legacy_import'
  )),
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  workflow_status    TEXT NOT NULL DEFAULT 'pending_review' CHECK (workflow_status IN (
    'draft',
    'pending_review',
    'in_progress',
    'needs_revision',
    'rejected',
    'finalized',
    'promoted'
  )),
  current_checkpoint TEXT NOT NULL DEFAULT 'entity_checkpoint' CHECK (current_checkpoint IN (
    'entity_checkpoint',
    'application_checkpoint',
    'structured_layers_checkpoint',
    'questions_checkpoint',
    'finalized'
  )),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intake_entities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_seq        BIGSERIAL UNIQUE,
  ref            TEXT GENERATED ALWAYS AS ('EN-' || LPAD(ref_seq::TEXT, 4, '0')) STORED,
  submission_id  UUID NOT NULL REFERENCES intake_submissions(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL,
  host_domain    TEXT,
  entity_type    TEXT,
  vertical       TEXT NOT NULL DEFAULT 'unknown' CHECK (vertical IN ('tech', 'university', 'grants', 'jobs', 'unknown')),
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_status  TEXT NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'approved', 'rejected', 'needs_revision')),
  approved_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id)
);

CREATE TABLE IF NOT EXISTS intake_applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_seq             BIGSERIAL UNIQUE,
  ref                 TEXT GENERATED ALWAYS AS ('AP-' || LPAD(ref_seq::TEXT, 4, '0')) STORED,
  submission_id       UUID NOT NULL REFERENCES intake_submissions(id) ON DELETE CASCADE,
  entity_id           UUID REFERENCES intake_entities(id) ON DELETE SET NULL,
  vertical            TEXT NOT NULL CHECK (vertical IN ('tech', 'university', 'grants', 'jobs')),
  title               TEXT NOT NULL,
  cycle_label         TEXT,
  deadline_at         TIMESTAMPTZ,
  application_status  TEXT NOT NULL DEFAULT 'indexed',
  source_url          TEXT,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_status       TEXT NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'approved', 'rejected', 'needs_revision')),
  approved_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id)
);

CREATE TABLE IF NOT EXISTS intake_application_layers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES intake_submissions(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES intake_applications(id) ON DELETE CASCADE,
  layer_key      TEXT NOT NULL CHECK (layer_key IN ('obtained', 'terms', 'requirements')),
  layer_order    INT NOT NULL CHECK (layer_order IN (4, 5, 6)),
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_status  TEXT NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'approved', 'rejected', 'needs_revision')),
  approved_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (application_id, layer_key)
);

CREATE TABLE IF NOT EXISTS intake_questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_seq        BIGSERIAL UNIQUE,
  ref            TEXT GENERATED ALWAYS AS ('QU-' || LPAD(ref_seq::TEXT, 4, '0')) STORED,
  submission_id  UUID NOT NULL REFERENCES intake_submissions(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES intake_applications(id) ON DELETE CASCADE,
  question_text  TEXT NOT NULL,
  normalized_text TEXT,
  order_index    INT NOT NULL DEFAULT 0,
  is_required    BOOLEAN NOT NULL DEFAULT TRUE,
  word_limit     INT,
  char_limit     INT,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_status  TEXT NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'approved', 'rejected', 'needs_revision')),
  approved_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intake_gate_reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES intake_submissions(id) ON DELETE CASCADE,
  checkpoint     TEXT NOT NULL CHECK (checkpoint IN (
    'entity_checkpoint',
    'application_checkpoint',
    'structured_layers_checkpoint',
    'questions_checkpoint',
    'finalized'
  )),
  decision       TEXT NOT NULL CHECK (decision IN ('approve', 'reject', 'needs_revision')),
  notes          TEXT,
  edited_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intake_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES intake_submissions(id) ON DELETE CASCADE,
  parent_event_id UUID REFERENCES intake_events(id) ON DELETE SET NULL,
  event_type     TEXT NOT NULL,
  layer_number   INT NOT NULL CHECK (layer_number BETWEEN 0 AND 8),
  layer_name     TEXT NOT NULL,
  checkpoint     TEXT,
  actor_type     TEXT NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),
  actor_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payload_before JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_after  JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_submissions_user_created
  ON intake_submissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_checkpoint
  ON intake_submissions(current_checkpoint, workflow_status);
CREATE INDEX IF NOT EXISTS idx_intake_entities_submission
  ON intake_entities(submission_id);
CREATE INDEX IF NOT EXISTS idx_intake_applications_submission
  ON intake_applications(submission_id);
CREATE INDEX IF NOT EXISTS idx_intake_layers_application
  ON intake_application_layers(application_id, layer_key);
CREATE INDEX IF NOT EXISTS idx_intake_questions_application
  ON intake_questions(application_id, order_index);
CREATE INDEX IF NOT EXISTS idx_intake_gate_reviews_submission
  ON intake_gate_reviews(submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_events_submission_created
  ON intake_events(submission_id, created_at DESC);

ALTER TABLE intake_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_application_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_gate_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intake_submissions_owner_all" ON intake_submissions;
CREATE POLICY "intake_submissions_owner_all" ON intake_submissions
  FOR ALL USING (user_id = auth.uid() OR auth.role() = 'service_role')
  WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "intake_entities_owner_all" ON intake_entities;
CREATE POLICY "intake_entities_owner_all" ON intake_entities
  FOR ALL USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM intake_submissions s
      WHERE s.id = intake_entities.submission_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM intake_submissions s
      WHERE s.id = intake_entities.submission_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "intake_applications_owner_all" ON intake_applications;
CREATE POLICY "intake_applications_owner_all" ON intake_applications
  FOR ALL USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM intake_submissions s
      WHERE s.id = intake_applications.submission_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM intake_submissions s
      WHERE s.id = intake_applications.submission_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "intake_layers_owner_all" ON intake_application_layers;
CREATE POLICY "intake_layers_owner_all" ON intake_application_layers
  FOR ALL USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM intake_submissions s
      WHERE s.id = intake_application_layers.submission_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM intake_submissions s
      WHERE s.id = intake_application_layers.submission_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "intake_questions_owner_all" ON intake_questions;
CREATE POLICY "intake_questions_owner_all" ON intake_questions
  FOR ALL USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM intake_submissions s
      WHERE s.id = intake_questions.submission_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM intake_submissions s
      WHERE s.id = intake_questions.submission_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "intake_gate_reviews_owner_all" ON intake_gate_reviews;
CREATE POLICY "intake_gate_reviews_owner_all" ON intake_gate_reviews
  FOR ALL USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM intake_submissions s
      WHERE s.id = intake_gate_reviews.submission_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM intake_submissions s
      WHERE s.id = intake_gate_reviews.submission_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "intake_events_owner_select" ON intake_events;
CREATE POLICY "intake_events_owner_select" ON intake_events
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM intake_submissions s
      WHERE s.id = intake_events.submission_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "intake_events_owner_insert" ON intake_events;
CREATE POLICY "intake_events_owner_insert" ON intake_events
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM intake_submissions s
      WHERE s.id = intake_events.submission_id
        AND s.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_intake_submissions_updated_at ON intake_submissions;
CREATE TRIGGER update_intake_submissions_updated_at
  BEFORE UPDATE ON intake_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_intake_entities_updated_at ON intake_entities;
CREATE TRIGGER update_intake_entities_updated_at
  BEFORE UPDATE ON intake_entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_intake_applications_updated_at ON intake_applications;
CREATE TRIGGER update_intake_applications_updated_at
  BEFORE UPDATE ON intake_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_intake_layers_updated_at ON intake_application_layers;
CREATE TRIGGER update_intake_layers_updated_at
  BEFORE UPDATE ON intake_application_layers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_intake_questions_updated_at ON intake_questions;
CREATE TRIGGER update_intake_questions_updated_at
  BEFORE UPDATE ON intake_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
