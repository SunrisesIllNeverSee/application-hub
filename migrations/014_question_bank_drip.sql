-- ============================================================
-- Migration 014: Question Bank + Drip Mechanic
-- Application Hub Platform — Ello Cello LLC
-- ============================================================
-- 1. user_question_unlocks — append-only log of which questions
--    a user has access to, and how they got them.
-- 2. update_is_universal() — populates is_universal flag using
--    top 20% by significance_score (since asked_by_count is
--    uniform in the current seed).
-- 3. run_daily_drip() — called at /bank load; unlocks 3 more
--    questions per day for free users (no-op for Pro).
-- 4. signup_question_unlock trigger — seeds 8 high-significance
--    questions spread across themes on new user creation.
-- ============================================================

-- ============================================================
-- 1. USER QUESTION UNLOCKS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_question_unlocks (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  archived_question_id  UUID NOT NULL REFERENCES archived_questions(id) ON DELETE CASCADE,
  unlocked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source                TEXT NOT NULL DEFAULT 'drip'
    CHECK (source IN ('signup', 'drip', 'pro_unlock', 'manual')),
  UNIQUE (user_id, archived_question_id)
);

CREATE INDEX idx_uqu_user          ON user_question_unlocks (user_id);
CREATE INDEX idx_uqu_unlocked_at   ON user_question_unlocks (user_id, unlocked_at DESC);

ALTER TABLE user_question_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uqu_owner_select"
  ON user_question_unlocks FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "uqu_owner_insert"
  ON user_question_unlocks FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "uqu_service_all"
  ON user_question_unlocks FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 2. POPULATE is_universal FLAG
-- Top ~20% by significance_score across all questions.
-- ============================================================

UPDATE archived_questions
SET is_universal = TRUE
WHERE id IN (
  SELECT id FROM archived_questions
  ORDER BY significance_score DESC
  LIMIT 45  -- ~20% of 225
);

-- ============================================================
-- 3. SIGNUP SEED — unlock 8 high-significance questions
--    spread across the top themes (team, traction, problem,
--    solution, market, vision, personal, fit).
-- ============================================================

CREATE OR REPLACE FUNCTION seed_signup_questions(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_theme TEXT;
  v_question_id UUID;
  v_count INT := 0;
  v_themes TEXT[] := ARRAY['team','traction','problem','solution','market','vision','personal','fit'];
BEGIN
  FOREACH v_theme IN ARRAY v_themes LOOP
    -- Pick highest significance question in this theme not yet unlocked
    SELECT id INTO v_question_id
    FROM archived_questions
    WHERE theme = v_theme
      AND id NOT IN (
        SELECT archived_question_id FROM user_question_unlocks
        WHERE user_id = p_user_id
      )
    ORDER BY significance_score DESC
    LIMIT 1;

    IF v_question_id IS NOT NULL THEN
      INSERT INTO user_question_unlocks (user_id, archived_question_id, source)
      VALUES (p_user_id, v_question_id, 'signup')
      ON CONFLICT DO NOTHING;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- 4. DAILY DRIP — unlock 3 questions per day for free users
--    Call this at /bank page load. Idempotent within a day.
-- ============================================================

CREATE OR REPLACE FUNCTION run_daily_drip(p_user_id UUID)
RETURNS TABLE (
  question_id  UUID,
  question_text TEXT,
  theme        TEXT,
  significance FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_last_drip      TIMESTAMPTZ;
  v_unlock_count   INT;
  v_user_tier      TEXT;
  v_free_cap       INT := 30;
  v_drip_per_day   INT := 3;
BEGIN
  -- Get user's subscription tier
  SELECT tier::TEXT INTO v_user_tier
  FROM user_subscriptions
  WHERE user_id = p_user_id;

  v_user_tier := COALESCE(v_user_tier, 'free');

  -- Pro/Team: unlock everything immediately and return empty (already have all)
  IF v_user_tier IN ('pro', 'team') THEN
    INSERT INTO user_question_unlocks (user_id, archived_question_id, source)
    SELECT p_user_id, aq.id, 'pro_unlock'
    FROM archived_questions aq
    WHERE aq.id NOT IN (
      SELECT archived_question_id FROM user_question_unlocks
      WHERE user_id = p_user_id
    )
    ON CONFLICT DO NOTHING;
    RETURN;
  END IF;

  -- Free: check if drip has already run today
  SELECT MAX(unlocked_at) INTO v_last_drip
  FROM user_question_unlocks
  WHERE user_id = p_user_id AND source = 'drip';

  IF v_last_drip IS NOT NULL AND v_last_drip > NOW() - INTERVAL '20 hours' THEN
    RETURN; -- Already ran today
  END IF;

  -- Check free tier cap
  SELECT COUNT(*) INTO v_unlock_count
  FROM user_question_unlocks
  WHERE user_id = p_user_id;

  IF v_unlock_count >= v_free_cap THEN
    RETURN; -- Hit the free cap
  END IF;

  -- Unlock next N questions by significance, not yet unlocked
  RETURN QUERY
  INSERT INTO user_question_unlocks (user_id, archived_question_id, source)
  SELECT p_user_id, aq.id, 'drip'
  FROM archived_questions aq
  WHERE aq.id NOT IN (
    SELECT archived_question_id FROM user_question_unlocks
    WHERE user_id = p_user_id
  )
  ORDER BY aq.significance_score DESC
  LIMIT LEAST(v_drip_per_day, v_free_cap - v_unlock_count)
  ON CONFLICT DO NOTHING
  RETURNING
    archived_question_id,
    (SELECT text FROM archived_questions WHERE id = archived_question_id),
    (SELECT theme FROM archived_questions WHERE id = archived_question_id),
    (SELECT significance_score FROM archived_questions WHERE id = archived_question_id);
END;
$$;

-- ============================================================
-- 5. TRIGGER — seed questions on new user signup
-- ============================================================

CREATE OR REPLACE FUNCTION auto_seed_questions_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM seed_signup_questions(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_questions_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auto_seed_questions_on_signup();

-- Backfill existing users who have no unlocks yet
DO $$
DECLARE v_uid UUID;
BEGIN
  FOR v_uid IN
    SELECT u.id FROM auth.users u
    LEFT JOIN user_question_unlocks uqu ON uqu.user_id = u.id
    WHERE uqu.user_id IS NULL
  LOOP
    PERFORM seed_signup_questions(v_uid);
  END LOOP;
END;
$$;
