-- ============================================================
-- 032 — Credits & Achievements
-- ============================================================
-- Append-only credit ledger + achievement tracking.
-- Credits are earned by social actions, app actions, and
-- community contributions. Balance is a view over the ledger.
-- Achievements unlock at milestones and are displayed as badges.
-- ============================================================

-- ── credit_events: append-only ledger ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  amount      INT  NOT NULL DEFAULT 0,
  metadata    JSONB NOT NULL DEFAULT '{}',
  -- dedup_key prevents double-claiming once-per-user actions.
  -- NULL = no dedup (milestone triggers, etc.)
  -- 'social_twitter_follow' = once per user, ever
  -- 'social_share:2026-W20' = once per week (rolling)
  dedup_key   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT credit_events_dedup UNIQUE (user_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_credit_events_user_created
  ON credit_events (user_id, created_at DESC);

ALTER TABLE credit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_events_owner_select" ON credit_events
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "credit_events_service_all" ON credit_events
  FOR ALL USING (auth.role() = 'service_role');

-- ── user_achievements: one row per earned achievement ───────────────────────
CREATE TABLE IF NOT EXISTS user_achievements (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON user_achievements (user_id, earned_at DESC);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_achievements_owner_select" ON user_achievements
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_achievements_service_all" ON user_achievements
  FOR ALL USING (auth.role() = 'service_role');

-- ── user_credit_balance: computed view ──────────────────────────────────────
CREATE OR REPLACE VIEW user_credit_balance AS
SELECT
  user_id,
  COALESCE(SUM(amount), 0)::INT AS balance,
  COUNT(*)::INT                 AS event_count,
  MAX(created_at)               AS last_earned_at
FROM credit_events
GROUP BY user_id;

-- ── Trigger: award credits when an answer is saved ──────────────────────────
-- Fires on INSERT into profile_answers. Awards milestone credits when user
-- reaches 1, 25, or 100 answers. Uses dedup_key to ensure once-only.
CREATE OR REPLACE FUNCTION award_answer_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM profile_answers
  WHERE user_id = NEW.user_id;

  -- First answer
  IF v_count = 1 THEN
    INSERT INTO credit_events (user_id, event_type, amount, dedup_key)
    VALUES (NEW.user_id, 'answer_first', 10, 'answer_first')
    ON CONFLICT (user_id, dedup_key) DO NOTHING;

    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (NEW.user_id, 'first_answer')
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  -- 25 answers
  IF v_count = 25 THEN
    INSERT INTO credit_events (user_id, event_type, amount, dedup_key)
    VALUES (NEW.user_id, 'answer_25', 50, 'answer_25')
    ON CONFLICT (user_id, dedup_key) DO NOTHING;

    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (NEW.user_id, 'answer_25')
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  -- 100 answers
  IF v_count = 100 THEN
    INSERT INTO credit_events (user_id, event_type, amount, dedup_key)
    VALUES (NEW.user_id, 'answer_100', 150, 'answer_100')
    ON CONFLICT (user_id, dedup_key) DO NOTHING;

    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (NEW.user_id, 'answer_100')
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_answer_credits ON profile_answers;
CREATE TRIGGER trg_award_answer_credits
  AFTER INSERT ON profile_answers
  FOR EACH ROW
  EXECUTE FUNCTION award_answer_credits();

-- ── Trigger: award credits when a program is submitted ──────────────────────
CREATE OR REPLACE FUNCTION award_submission_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.submitted_by IS NULL THEN RETURN NEW; END IF;

  INSERT INTO credit_events (user_id, event_type, amount, metadata, dedup_key)
  VALUES (
    NEW.submitted_by,
    'program_submit',
    25,
    jsonb_build_object('import_queue_id', NEW.id, 'kind', NEW.kind),
    'program_submit:' || NEW.id::text
  )
  ON CONFLICT (user_id, dedup_key) DO NOTHING;

  -- Achievement: first submission ever
  INSERT INTO user_achievements (user_id, achievement_id)
  VALUES (NEW.submitted_by, 'first_submission')
  ON CONFLICT (user_id, achievement_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_submission_credits ON import_queue;
CREATE TRIGGER trg_award_submission_credits
  AFTER INSERT ON import_queue
  FOR EACH ROW
  EXECUTE FUNCTION award_submission_credits();
