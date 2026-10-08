-- ============================================================
-- 049 — M05 reward-integrity corrections (forward-only)
-- ============================================================
-- Found by M05 rehearsal wave-1 (aquarnd m05/evidence/m05-wave1-findings.csv):
--   M05-F-UQU-CHECK   041 re-added user_question_unlocks_source_check without
--                     'contribution', regressing 030 — every accepted
--                     contribution errors inside the SECURITY DEFINER trigger
--                     and rolls back the status UPDATE.
--   M05-F-DOUBLE-MINT process_reward has no per-reward dedup —
--                     approved->pending->approved re-mints credits.
--   M05-F-IQ-MINT     award_submission_credits mints on ANY import_queue
--                     INSERT — historical replay fabricates rewards.
--   M05-F-APPROVED-ASYM  rewards INSERTed already-'approved' mint nothing
--                     (BEFORE UPDATE trigger only) — silent under-credit.
--   M05-F-UQU-SILENT  with a pre-existing contribution row, accept silently
--                     awards nothing (ON CONFLICT early-return).
--
-- Corrections are forward-only: NO historical rows are rewritten and no
-- historical rewards are guessed/backfilled.
--
-- Migration safety: all award paths honor the session flag
--   SET app.migration_mode = 'on'
-- which suppresses every reward side-effect during bulk import/replay.
--
-- THREAT NOTE: app.migration_mode is a self-settable session GUC — a
-- discipline gate, not a privilege boundary (same class as the M05 anchor
-- finding). Any role with SQL access can suppress rewards for its own writes.
-- Mitigation at deploy time: ensure untrusted roles reach the DB only through
-- RPC/PostgREST surfaces where arbitrary SET is not possible; direct SQL
-- sessions are already trusted-context.
-- ============================================================

-- 1. Restore 'contribution' to the unlock-source CHECK (030's intent,
--    regressed by 041; keep 'starter' from 041).
ALTER TABLE user_question_unlocks
  DROP CONSTRAINT IF EXISTS user_question_unlocks_source_check;
ALTER TABLE user_question_unlocks
  ADD CONSTRAINT user_question_unlocks_source_check
  CHECK (source IN ('signup','drip','pro_unlock','manual','starter','contribution'));

-- 2. Mint-once receipts: durable per-reward dedup independent of status churn.
CREATE TABLE IF NOT EXISTS reward_credit_receipts (
  reward_id   UUID PRIMARY KEY,           -- contribution_rewards.id
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      INT  NOT NULL,
  minted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE reward_credit_receipts IS
  'Mint-once receipt for canonical_user_credits. A row means the reward was
   credited exactly once; status churn on contribution_rewards cannot remint.';

ALTER TABLE reward_credit_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rcr_owner_select" ON reward_credit_receipts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "rcr_service_all" ON reward_credit_receipts
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Append-only: receipts are evidence of minting, never edited.
CREATE OR REPLACE FUNCTION deny_receipt_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'reward_credit_receipts is append-only'; END $$;
DROP TRIGGER IF EXISTS trg_rcr_immutable ON reward_credit_receipts;
CREATE TRIGGER trg_rcr_immutable BEFORE UPDATE OR DELETE ON reward_credit_receipts
  FOR EACH ROW EXECUTE FUNCTION deny_receipt_mutation();

-- 3. process_reward: mint-once via receipt, symmetric on INSERT,
--    suppressed in migration mode.
CREATE OR REPLACE FUNCTION process_reward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_minted INT;
BEGIN
  -- migration/replay safety: no reward side-effects in migration mode
  IF current_setting('app.migration_mode', true) = 'on' THEN
    NEW.updated_at = NOW();  -- suppress reward side-effects, still stamp row metadata
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    -- Mint-once: the receipt row is the durable dedup. If it already exists
    -- (re-approval, replayed transition), no credit is added again.
    INSERT INTO reward_credit_receipts (reward_id, user_id, amount)
    VALUES (NEW.id, NEW.user_id, GREATEST(NEW.credit_amount, 0))
    ON CONFLICT (reward_id) DO NOTHING;
    GET DIAGNOSTICS v_minted = ROW_COUNT;
    IF v_minted > 0 THEN
      INSERT INTO canonical_user_credits (user_id, balance, lifetime_earned)
      VALUES (NEW.user_id, GREATEST(NEW.credit_amount, 0), GREATEST(NEW.credit_amount, 0))
      ON CONFLICT (user_id) DO UPDATE
      SET balance = canonical_user_credits.balance + GREATEST(NEW.credit_amount, 0),
          lifetime_earned = canonical_user_credits.lifetime_earned + GREATEST(NEW.credit_amount, 0),
          updated_at = NOW();
      NEW.approved_at = COALESCE(NEW.approved_at, NOW());
    END IF;
  END IF;

  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    NEW.paid_at = COALESCE(NEW.paid_at, NOW());
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- INSERT path now symmetric (M05-F-APPROVED-ASYM): a reward arriving
-- already-approved mints via the same receipt path — still exactly once.
DROP TRIGGER IF EXISTS trg_process_reward ON contribution_rewards;
CREATE TRIGGER trg_process_reward
  BEFORE INSERT OR UPDATE ON contribution_rewards
  FOR EACH ROW EXECUTE FUNCTION process_reward();

-- 4. award_* functions: honor migration mode so bulk import/replay cannot
--    mint historical rewards (M05-F-IQ-MINT). Unchanged semantics otherwise.
CREATE OR REPLACE FUNCTION award_submission_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF current_setting('app.migration_mode', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.submitted_by IS NULL THEN RETURN NEW; END IF;

  INSERT INTO credit_events (user_id, event_type, amount, metadata, dedup_key)
  VALUES (
    NEW.submitted_by, 'program_submit', 25,
    jsonb_build_object('import_queue_id', NEW.id, 'kind', NEW.kind),
    'program_submit:' || NEW.id::text)
  ON CONFLICT (user_id, dedup_key) DO NOTHING;

  INSERT INTO user_achievements (user_id, achievement_id)
  VALUES (NEW.submitted_by, 'first_submission')
  ON CONFLICT (user_id, achievement_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION award_answer_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_count INT;
BEGIN
  IF current_setting('app.migration_mode', true) = 'on' THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_count FROM profile_answers WHERE user_id = NEW.user_id;

  IF v_count = 1 THEN
    INSERT INTO credit_events (user_id, event_type, amount, dedup_key)
    VALUES (NEW.user_id, 'answer_first', 10, 'answer_first')
    ON CONFLICT (user_id, dedup_key) DO NOTHING;
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (NEW.user_id, 'first_answer')
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;
  IF v_count = 25 THEN
    INSERT INTO credit_events (user_id, event_type, amount, dedup_key)
    VALUES (NEW.user_id, 'answer_25', 50, 'answer_25')
    ON CONFLICT (user_id, dedup_key) DO NOTHING;
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (NEW.user_id, 'answer_25')
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;
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
  IF current_setting('app.migration_mode', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.submitted_by IS NULL THEN RETURN NEW; END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  INSERT INTO user_contributions
    (user_id, import_queue_id, credit_type, credit_amount, kind)
  VALUES
    (NEW.submitted_by, NEW.id, 'drip_unlock', v_credit_cap, NEW.kind)
  ON CONFLICT (user_id, import_queue_id, credit_type) DO NOTHING
  RETURNING id INTO v_contribution_id;

  -- V-06 silent-skip nuance is intentional: a replayed accept against an
  -- existing contribution row is a no-op, not an error. Reconciliation must
  -- compare unlock counts to contribution rows, not assume every accept mints.
  IF v_contribution_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO user_question_unlocks (user_id, archived_question_id, source)
  SELECT NEW.submitted_by, aq.id, 'contribution'
  FROM archived_questions aq
  WHERE aq.id NOT IN (
    SELECT archived_question_id FROM user_question_unlocks
    WHERE user_id = NEW.submitted_by)
  ORDER BY aq.significance_score DESC NULLS LAST
  LIMIT v_credit_cap
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_unlocks_inserted = ROW_COUNT;
  UPDATE user_contributions SET credit_amount = v_unlocks_inserted
  WHERE id = v_contribution_id;

  RETURN NEW;
END;
$$;
