-- ============================================================
-- 010 — Launch hardening: BYOK contract + answer stress tests
-- ============================================================
--
-- This migration adds the backend contracts needed for the launch roadmap:
--   1. BYOK provider metadata, without storing raw API keys in user-readable rows.
--   2. Persisted answer stress-test runs, building on hub_stress_test_answer.
--
-- Secret storage note:
--   user_integrations.key_storage_ref points to a server-side secret store
--   such as Supabase Vault/KMS. The key itself must never be stored in a
--   frontend-readable column.
-- ============================================================

DO $$
BEGIN
  CREATE TYPE ai_provider_type AS ENUM (
    'anthropic',
    'openai',
    'google',
    'ollama',
    'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE integration_status AS ENUM (
    'pending',
    'active',
    'invalid',
    'disabled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE answer_stress_depth AS ENUM (
    'light',
    'medium',
    'deep'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_integrations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider            ai_provider_type NOT NULL,
  label               TEXT NOT NULL DEFAULT 'Default',
  status              integration_status NOT NULL DEFAULT 'pending',
  is_default          BOOLEAN NOT NULL DEFAULT FALSE,
  key_storage_ref     TEXT,         -- server-side secret pointer, not the raw key
  key_fingerprint     TEXT,         -- safe display hint, e.g. last 4 chars/hash prefix
  base_url            TEXT,         -- custom provider / local Ollama endpoint
  model_preference    TEXT,
  last_verified_at    TIMESTAMPTZ,
  last_error          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_integrations_label_not_blank CHECK (btrim(label) <> '')
);

CREATE INDEX IF NOT EXISTS idx_user_integrations_user
  ON user_integrations (user_id);

CREATE INDEX IF NOT EXISTS idx_user_integrations_provider
  ON user_integrations (provider);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_integrations_one_default
  ON user_integrations (user_id)
  WHERE is_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_integrations_unique_label
  ON user_integrations (user_id, provider, lower(label));

DROP TRIGGER IF EXISTS set_updated_at_user_integrations ON user_integrations;
CREATE TRIGGER set_updated_at_user_integrations
  BEFORE UPDATE ON user_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS answer_stress_tests (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_answer_id     UUID NOT NULL REFERENCES profile_answers(id) ON DELETE CASCADE,
  program_id            UUID REFERENCES programs(id) ON DELETE SET NULL,
  archived_question_id  UUID REFERENCES archived_questions(id) ON DELETE SET NULL,
  depth                 answer_stress_depth NOT NULL DEFAULT 'medium',
  mode                  TEXT NOT NULL DEFAULT 'stub_no_llm',
  provider              TEXT,
  model_used            TEXT,
  prompt_used           TEXT,
  detected_signals      JSONB NOT NULL DEFAULT '{}'::jsonb,
  follow_up_prompts     JSONB NOT NULL DEFAULT '[]'::jsonb,
  checklist             JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_flags            JSONB NOT NULL DEFAULT '[]'::jsonb,
  score_payload         JSONB,
  fidelity_certificate  JSONB,
  persisted_from_tool   TEXT NOT NULL DEFAULT 'hub_stress_test_answer',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_answer_stress_tests_user_created
  ON answer_stress_tests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_answer_stress_tests_answer_created
  ON answer_stress_tests (profile_answer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_answer_stress_tests_program
  ON answer_stress_tests (program_id);

ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_stress_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_integrations_owner_select"
  ON user_integrations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_integrations_owner_insert"
  ON user_integrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_integrations_owner_update"
  ON user_integrations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_integrations_owner_delete"
  ON user_integrations FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "user_integrations_service_all"
  ON user_integrations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "answer_stress_tests_owner_select"
  ON answer_stress_tests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "answer_stress_tests_owner_insert"
  ON answer_stress_tests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "answer_stress_tests_service_all"
  ON answer_stress_tests FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Stress-test records are append-only for users. Service role may manage
-- cleanup/admin tasks through the service policy above.
