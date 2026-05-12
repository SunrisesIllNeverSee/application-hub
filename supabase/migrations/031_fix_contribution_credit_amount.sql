-- ============================================================
-- 031 — Fix contribution trigger credit_amount accuracy
-- ============================================================
-- Bug: award_contribution_credits() always recorded credit_amount=5
-- even when fewer unlocks were actually inserted (e.g. user already
-- had most questions). Fixed by capturing ROW_COUNT from the unlock
-- INSERT and updating the contribution row to reflect reality.
-- Applied to Supabase 2026-05-11.
-- ============================================================

CREATE OR REPLACE FUNCTION award_contribution_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_credit_cap       INT := 5;
  v_contribution_id  UUID;
  v_unlocks_inserted INT;
BEGIN
  IF NEW.submitted_by IS NULL THEN RETURN NEW; END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  INSERT INTO user_contributions
    (user_id, import_queue_id, credit_type, credit_amount, kind)
  VALUES
    (NEW.submitted_by, NEW.id, 'drip_unlock', v_credit_cap, NEW.kind)
  ON CONFLICT (user_id, import_queue_id, credit_type) DO NOTHING
  RETURNING id INTO v_contribution_id;

  IF v_contribution_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO user_question_unlocks (user_id, archived_question_id, source)
  SELECT NEW.submitted_by, aq.id, 'contribution'
  FROM archived_questions aq
  WHERE aq.id NOT IN (
    SELECT archived_question_id FROM user_question_unlocks
    WHERE user_id = NEW.submitted_by
  )
  ORDER BY aq.significance_score DESC NULLS LAST
  LIMIT v_credit_cap
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_unlocks_inserted = ROW_COUNT;

  UPDATE user_contributions
  SET credit_amount = v_unlocks_inserted
  WHERE id = v_contribution_id;

  RETURN NEW;
END;
$$;
