-- ============================================================
-- Migration 004: Functions, Triggers, and Cron Jobs
-- Application Hub Platform — Ello Cello LLC
-- ============================================================

-- ============================================================
-- UPDATED_AT AUTO-MAINTENANCE
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_archived_questions
  BEFORE UPDATE ON archived_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_programs
  BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_profile_answers
  BEFORE UPDATE ON profile_answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_user_applications
  BEFORE UPDATE ON user_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_application_answers
  BEFORE UPDATE ON application_answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_connected_integrations
  BEFORE UPDATE ON connected_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- PROFILE ANSWER HISTORY — auto-snapshot on save
-- ============================================================

CREATE OR REPLACE FUNCTION snapshot_profile_answer()
RETURNS TRIGGER AS $$
BEGIN
  -- Only snapshot when content actually changes
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO profile_answer_history (profile_answer_id, content, version, word_count)
    VALUES (NEW.id, NEW.content, NEW.version, NEW.word_count);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profile_answer_history_snapshot
  AFTER UPDATE ON profile_answers
  FOR EACH ROW EXECUTE FUNCTION snapshot_profile_answer();

-- ============================================================
-- WORD COUNT — auto-recompute on answer save
-- ============================================================

CREATE OR REPLACE FUNCTION compute_word_count()
RETURNS TRIGGER AS $$
BEGIN
  NEW.word_count = array_length(regexp_split_to_array(trim(NEW.content), '\s+'), 1);
  -- Handle empty string → word_count = 0
  IF trim(NEW.content) = '' THEN
    NEW.word_count = 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_word_count_profile_answers
  BEFORE INSERT OR UPDATE ON profile_answers
  FOR EACH ROW EXECUTE FUNCTION compute_word_count();

CREATE TRIGGER auto_word_count_application_answers
  BEFORE INSERT OR UPDATE ON application_answers
  FOR EACH ROW EXECUTE FUNCTION compute_word_count();

-- ============================================================
-- APPLICATION COMPLETION PERCENT — recomputed on answer save
-- ============================================================

CREATE OR REPLACE FUNCTION recompute_completion_pct()
RETURNS TRIGGER AS $$
DECLARE
  total_required    INT;
  answered_required INT;
BEGIN
  -- Count required questions for this application's program
  SELECT COUNT(*) INTO total_required
  FROM program_questions pq
  JOIN user_applications ua ON ua.program_id = pq.program_id
  WHERE ua.id = NEW.application_id
    AND pq.is_required = TRUE;

  -- Count required questions with non-empty answers
  SELECT COUNT(*) INTO answered_required
  FROM application_answers aa
  JOIN program_questions pq ON pq.id = aa.program_question_id
  JOIN user_applications ua ON ua.id = aa.application_id
  WHERE aa.application_id = NEW.application_id
    AND pq.is_required = TRUE
    AND length(trim(aa.content)) > 0;

  -- Update completion_pct on the application
  IF total_required > 0 THEN
    UPDATE user_applications
    SET completion_pct = answered_required::FLOAT / total_required
    WHERE id = NEW.application_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recompute_completion_on_answer_save
  AFTER INSERT OR UPDATE ON application_answers
  FOR EACH ROW EXECUTE FUNCTION recompute_completion_pct();

-- ============================================================
-- PROGRAM STATS — update on submission signal
-- ============================================================

CREATE OR REPLACE FUNCTION update_program_stats_on_signal()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO program_stats (program_id, application_count, updated_at)
  VALUES (NEW.program_id, 0, NOW())
  ON CONFLICT (program_id) DO NOTHING;

  IF NEW.signal_type = 'submit' THEN
    UPDATE program_stats
    SET
      application_count  = application_count + 1,
      last_submission_at = NEW.created_at,
      updated_at         = NOW()
    WHERE program_id = NEW.program_id;

    -- Mirror to programs table for fast hub listing queries
    UPDATE programs
    SET applicant_count = applicant_count + 1
    WHERE id = NEW.program_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER program_stats_on_signal
  AFTER INSERT ON program_signals
  FOR EACH ROW EXECUTE FUNCTION update_program_stats_on_signal();

-- ============================================================
-- HEAT SCORE COMPUTATION FUNCTION
-- Called by Edge Function cron every 6 hours.
--
-- Formula:
--   raw = saves×1.0 + starts×2.0 + submits×4.0 + views×0.5
--   deadline_multiplier = GREATEST(0, 1 - days_remaining/60)^2
--   acceptance_inverse  = 1 / (acceptance_rate + 0.05)
--   heat_score = raw × (1 + deadline_multiplier) × acceptance_inverse
--
-- Only open programs are scored. Closed programs get 0.
-- ============================================================

CREATE OR REPLACE FUNCTION recompute_all_heat_scores()
RETURNS VOID AS $$
DECLARE
  p RECORD;
  sig RECORD;
  saves_count     FLOAT := 0;
  starts_count    FLOAT := 0;
  submits_count   FLOAT := 0;
  views_count     FLOAT := 0;
  raw_score       FLOAT;
  days_remaining  FLOAT;
  deadline_mult   FLOAT;
  acc_rate        FLOAT;
  acc_inverse     FLOAT;
  computed_score  FLOAT;
BEGIN
  FOR p IN
    SELECT id, closes_at FROM programs WHERE status = 'open'
  LOOP
    -- Aggregate signals from last 30 days
    SELECT
      COALESCE(SUM(CASE WHEN signal_type = 'save'   THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN signal_type = 'start'  THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN signal_type = 'submit' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN signal_type = 'view'   THEN 1 ELSE 0 END), 0)
    INTO saves_count, starts_count, submits_count, views_count
    FROM program_signals
    WHERE program_id = p.id
      AND created_at > NOW() - INTERVAL '30 days';

    raw_score := (saves_count * 1.0) + (starts_count * 2.0) + (submits_count * 4.0) + (views_count * 0.5);

    -- Deadline proximity multiplier (max pressure in last 60 days)
    IF p.closes_at IS NOT NULL THEN
      days_remaining := GREATEST(0, EXTRACT(EPOCH FROM (p.closes_at - NOW())) / 86400);
      deadline_mult  := POWER(GREATEST(0, 1 - days_remaining / 60.0), 2);
    ELSE
      deadline_mult := 0;
    END IF;

    -- Acceptance rate inverse (rarer acceptance = higher opportunity signal)
    SELECT COALESCE(
      SUM(CASE WHEN outcome = 'accepted' THEN 1 ELSE 0 END)::FLOAT /
      NULLIF(COUNT(*), 0),
      0.1  -- default 10% if no data
    ) INTO acc_rate
    FROM acceptance_reports
    WHERE program_id = p.id AND verified = TRUE;

    acc_inverse := 1.0 / (acc_rate + 0.05);

    computed_score := raw_score * (1.0 + deadline_mult) * acc_inverse;

    UPDATE programs
    SET heat_score = computed_score, updated_at = NOW()
    WHERE id = p.id;
  END LOOP;

  -- Zero out closed programs
  UPDATE programs
  SET heat_score = 0
  WHERE status IN ('closed', 'results');

  -- Update trending_score in program_stats (48h signal velocity)
  UPDATE program_stats ps SET
    trending_score = (
      SELECT COUNT(*) FROM program_signals sig
      WHERE sig.program_id = ps.program_id
        AND sig.created_at > NOW() - INTERVAL '48 hours'
    ),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PROGRAM STATUS AUTO-UPDATE
-- Transition upcoming→open, open→closed based on timestamps.
-- Called by cron every hour.
-- ============================================================

CREATE OR REPLACE FUNCTION auto_update_program_status()
RETURNS VOID AS $$
BEGIN
  -- upcoming → open
  UPDATE programs
  SET status = 'open', updated_at = NOW()
  WHERE status = 'upcoming'
    AND opens_at IS NOT NULL
    AND opens_at <= NOW();

  -- open → closed
  UPDATE programs
  SET status = 'closed', updated_at = NOW()
  WHERE status = 'open'
    AND closes_at IS NOT NULL
    AND closes_at <= NOW();

  -- closed → results (if results_at configured)
  UPDATE programs
  SET status = 'results', updated_at = NOW()
  WHERE status = 'closed'
    AND results_at IS NOT NULL
    AND results_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ASKED_BY_COUNT MAINTENANCE on archived_questions
-- Increments when a new program_question maps to an archived_question
-- ============================================================

CREATE OR REPLACE FUNCTION increment_asked_by_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE archived_questions
  SET asked_by_count = asked_by_count + 1, updated_at = NOW()
  WHERE id = NEW.archived_question_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_asked_by_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE archived_questions
  SET asked_by_count = GREATEST(0, asked_by_count - 1), updated_at = NOW()
  WHERE id = OLD.archived_question_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_asked_by_on_program_question_insert
  AFTER INSERT ON program_questions
  FOR EACH ROW EXECUTE FUNCTION increment_asked_by_count();

CREATE TRIGGER decrement_asked_by_on_program_question_delete
  AFTER DELETE ON program_questions
  FOR EACH ROW EXECUTE FUNCTION decrement_asked_by_count();

-- ============================================================
-- ENSURE ONE DEFAULT INTEGRATION PER USER
-- When a new integration is set as default, unset others.
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_single_default_integration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE connected_integrations
    SET is_default = FALSE
    WHERE user_id = NEW.user_id
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER single_default_integration
  BEFORE INSERT OR UPDATE ON connected_integrations
  FOR EACH ROW EXECUTE FUNCTION enforce_single_default_integration();
