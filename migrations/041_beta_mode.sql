-- ============================================================
-- Migration 041: Beta Mode Transition
-- ============================================================
-- Adds beta-mode infrastructure: beta_settings config, payment
-- method capture on user_subscriptions, enhanced outcome tracking
-- columns on user_applications, the 10-question Founder Starter
-- Pack, community messaging, and a 'starter' source for unlocks.
-- ============================================================

-- 1. beta_settings — single-row config for beta lifecycle
CREATE TABLE IF NOT EXISTS beta_settings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  is_beta_mode  BOOLEAN NOT NULL DEFAULT TRUE,
  beta_end_date TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE beta_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'beta_settings' AND policyname = 'beta_public_read') THEN
    CREATE POLICY "beta_public_read" ON beta_settings FOR SELECT USING (TRUE);
  END IF;
END $$;

INSERT INTO beta_settings (is_beta_mode, beta_end_date)
SELECT TRUE, '2026-09-30 23:59:59+00'::timestamptz
WHERE NOT EXISTS (SELECT 1 FROM beta_settings);

-- 2. user_subscriptions beta columns
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS beta_payment_method_id TEXT,
  ADD COLUMN IF NOT EXISTS beta_grace_period_days INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS beta_participant       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at   TIMESTAMPTZ;

-- 3. user_applications enhanced outcome columns
ALTER TABLE user_applications
  ADD COLUMN IF NOT EXISTS outcome_notes      TEXT,
  ADD COLUMN IF NOT EXISTS interview_date     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS program_feedback   TEXT,
  ADD COLUMN IF NOT EXISTS would_recommend    INTEGER CHECK (would_recommend BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS outcome_logged_at  TIMESTAMPTZ;

-- 4. Starter packages
CREATE TABLE IF NOT EXISTS starter_packages (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL UNIQUE,
  description  TEXT,
  question_ids UUID[] NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_starter_claims (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starter_package_id  UUID NOT NULL REFERENCES starter_packages(id) ON DELETE CASCADE,
  claimed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, starter_package_id)
);

ALTER TABLE starter_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_starter_claims ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'starter_packages' AND policyname = 'sp_public_read') THEN
    CREATE POLICY "sp_public_read" ON starter_packages FOR SELECT USING (is_active = TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_starter_claims' AND policyname = 'usc_owner_select') THEN
    CREATE POLICY "usc_owner_select" ON user_starter_claims FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_starter_claims' AND policyname = 'usc_owner_insert') THEN
    CREATE POLICY "usc_owner_insert" ON user_starter_claims FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Seed the Founder Starter Pack — top 10 universal high-significance questions
INSERT INTO starter_packages (name, description, question_ids)
SELECT
  'Founder Starter Pack',
  'The 10 most significant questions for accelerator applications',
  ARRAY(
    SELECT id FROM archived_questions
    WHERE is_universal = TRUE
    ORDER BY significance_score DESC
    LIMIT 10
  )
WHERE NOT EXISTS (SELECT 1 FROM starter_packages WHERE name = 'Founder Starter Pack');

-- 5. Community messaging
CREATE TABLE IF NOT EXISTS community_messages (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  submission_id  UUID REFERENCES import_queue(id) ON DELETE SET NULL,
  parent_id      UUID REFERENCES community_messages(id) ON DELETE SET NULL,
  subject        TEXT NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  body           TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  is_read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_to_unread
  ON community_messages(to_user_id, is_read)
  WHERE to_user_id IS NOT NULL AND is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_cm_from
  ON community_messages(from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_to
  ON community_messages(to_user_id, created_at DESC);

ALTER TABLE community_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'cm_party_select') THEN
    CREATE POLICY "cm_party_select" ON community_messages FOR SELECT
      USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'cm_sender_insert') THEN
    CREATE POLICY "cm_sender_insert" ON community_messages FOR INSERT
      WITH CHECK (from_user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'cm_recipient_update') THEN
    CREATE POLICY "cm_recipient_update" ON community_messages FOR UPDATE
      USING (to_user_id = auth.uid()) WITH CHECK (to_user_id = auth.uid());
  END IF;
END $$;

-- 6. Extend unlock source enum to include 'starter'
ALTER TABLE user_question_unlocks DROP CONSTRAINT IF EXISTS user_question_unlocks_source_check;
ALTER TABLE user_question_unlocks ADD CONSTRAINT user_question_unlocks_source_check
  CHECK (source IN ('signup', 'drip', 'pro_unlock', 'manual', 'starter'));

-- 7. claim_starter_package(p_user_id) RPC — idempotent
CREATE OR REPLACE FUNCTION claim_starter_package(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pack_id    UUID;
  v_question_ids UUID[];
  v_qid        UUID;
  v_total      INTEGER := 0;
BEGIN
  SELECT id, question_ids INTO v_pack_id, v_question_ids
  FROM starter_packages WHERE name = 'Founder Starter Pack' AND is_active = TRUE LIMIT 1;

  IF v_pack_id IS NULL THEN RETURN 0; END IF;

  INSERT INTO user_starter_claims (user_id, starter_package_id)
  VALUES (p_user_id, v_pack_id)
  ON CONFLICT (user_id, starter_package_id) DO NOTHING;

  FOREACH v_qid IN ARRAY v_question_ids LOOP
    INSERT INTO user_question_unlocks (user_id, archived_question_id, source)
    VALUES (p_user_id, v_qid, 'starter')
    ON CONFLICT (user_id, archived_question_id) DO NOTHING;
    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_starter_package(UUID) TO authenticated;
