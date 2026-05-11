-- ============================================================
-- 026 — Agent review persistence
-- ============================================================
--
-- Adds append-only persistence for structured answer reviews produced
-- outside the hosted draft route. This keeps first-pass drafting fast
-- while giving MCP/agent workflows a durable place to save comments,
-- scores, certification metadata, and reviewer run context.
-- ============================================================

CREATE TABLE IF NOT EXISTS answer_reviews (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_answer_id    UUID NOT NULL REFERENCES profile_answers(id) ON DELETE CASCADE,
  program_id           UUID REFERENCES programs(id) ON DELETE SET NULL,
  archived_question_id UUID REFERENCES archived_questions(id) ON DELETE SET NULL,
  reviewer_name        TEXT NOT NULL DEFAULT 'unknown_reviewer',
  reviewer_type        TEXT NOT NULL DEFAULT 'agent',
  reviewer_version     TEXT,
  provider             TEXT,
  model_used           TEXT,
  overall_status       TEXT NOT NULL,
  summary              TEXT NOT NULL,
  comments             JSONB NOT NULL DEFAULT '[]'::jsonb,
  scores               JSONB NOT NULL DEFAULT '{}'::jsonb,
  certification        JSONB,
  source_tool          TEXT NOT NULL DEFAULT 'hub_save_answer_review',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT answer_reviews_status_check
    CHECK (overall_status IN ('draft', 'usable', 'strong', 'certify')),
  CONSTRAINT answer_reviews_reviewer_name_not_blank
    CHECK (btrim(reviewer_name) <> ''),
  CONSTRAINT answer_reviews_reviewer_type_not_blank
    CHECK (btrim(reviewer_type) <> ''),
  CONSTRAINT answer_reviews_summary_not_blank
    CHECK (btrim(summary) <> ''),
  CONSTRAINT answer_reviews_comments_is_array
    CHECK (jsonb_typeof(comments) = 'array'),
  CONSTRAINT answer_reviews_scores_is_object
    CHECK (jsonb_typeof(scores) = 'object'),
  CONSTRAINT answer_reviews_certification_is_object
    CHECK (certification IS NULL OR jsonb_typeof(certification) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_answer_reviews_user_created
  ON answer_reviews (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_answer_reviews_answer_created
  ON answer_reviews (profile_answer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_answer_reviews_program_created
  ON answer_reviews (program_id, created_at DESC);

ALTER TABLE answer_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "answer_reviews_owner_select" ON answer_reviews;
CREATE POLICY "answer_reviews_owner_select"
  ON answer_reviews FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "answer_reviews_owner_insert" ON answer_reviews;
CREATE POLICY "answer_reviews_owner_insert"
  ON answer_reviews FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "answer_reviews_service_all" ON answer_reviews;
CREATE POLICY "answer_reviews_service_all"
  ON answer_reviews FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Reviews are append-only for user-scoped agent workflows. If edits or
-- moderation become necessary later, add explicit update/delete policies
-- rather than quietly broadening owner permissions now.
