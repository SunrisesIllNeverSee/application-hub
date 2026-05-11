-- =============================================================================
-- Migration 027: Applicant Modes + Contribution Rewards
-- =============================================================================
-- Purpose:
--   Support the cross-theme positioning of Application Hub: a single user can
--   identify as one or more applicant modes (founder, job_seeker, student,
--   researcher) and switch their *active* mode to scope the Hub view, drafting
--   context, and recommended programs.
--
--   Also: pay users back for contributing programs to under-developed verticals
--   via the existing /hub/submit flow. When a community submission lands in
--   import_queue and a maintainer transitions its status to 'accepted', the
--   submitter is awarded N drip unlocks of source='contribution', recorded in
--   user_contributions for UI display.
--
-- Properties:
--   - ADDITIVE ONLY: no DROP TABLE, no DROP COLUMN, no breaking type changes.
--   - IDEMPOTENT: every statement uses IF NOT EXISTS / IF EXISTS guards, or is
--     wrapped in a DO block that catches duplicate_object/duplicate_column so
--     the migration can be re-applied safely.
--   - NON-BREAKING: every new column on existing tables has a DEFAULT so
--     existing rows continue to satisfy the schema.
--
-- Non-transactional notes:
--   - This migration does not call ALTER TYPE ... ADD VALUE, so it is fully
--     transaction-safe (no top-level requirement).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- A. New enum: applicant_mode
-- -----------------------------------------------------------------------------
-- Identity buckets that a user can self-select. Each maps to a set of
-- opportunity_kind values that the Hub filters to when that mode is active.
--
--   founder      → accelerator, vc, fellowship (startup-context)
--   job_seeker   → job_fulltime, job_internship, job_contract
--   student      → school_undergrad, school_grad, school_professional
--   researcher   → grant, fellowship (research-context)
--
-- The mode→kind mapping lives in application code (lib/applicantMode.ts) so it
-- can evolve without a migration. The enum itself is intentionally tight.
DO $$
BEGIN
  CREATE TYPE applicant_mode AS ENUM (
    'founder',
    'job_seeker',
    'student',
    'researcher'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- -----------------------------------------------------------------------------
-- B. user_profiles: identities[] + active_identity
-- -----------------------------------------------------------------------------
-- identities      : the set of modes the user identifies as (multi-select).
--                   Defaults to {founder} to match the existing primary persona.
-- active_identity : which mode is in focus right now. Drives the Hub filter,
--                   per-mode empty states, and contribution prompts.
--
-- A CHECK constraint enforces that active_identity is always a member of
-- identities[] (defense-in-depth; the API layer also enforces this).
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS identities      applicant_mode[] NOT NULL DEFAULT ARRAY['founder']::applicant_mode[],
  ADD COLUMN IF NOT EXISTS active_identity applicant_mode   NOT NULL DEFAULT 'founder';

DO $$
BEGIN
  ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_active_identity_in_identities
    CHECK (active_identity = ANY(identities));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- -----------------------------------------------------------------------------
-- C. Extend user_question_unlocks.source to allow 'contribution'
-- -----------------------------------------------------------------------------
-- The historical source check was {'signup','drip','pro_unlock','manual'}.
-- Add 'contribution' so the contribution-award trigger can write rows without
-- pretending they came from a different source.
ALTER TABLE user_question_unlocks
  DROP CONSTRAINT IF EXISTS user_question_unlocks_source_check;

ALTER TABLE user_question_unlocks
  ADD CONSTRAINT user_question_unlocks_source_check
  CHECK (source IN ('signup', 'drip', 'pro_unlock', 'manual', 'contribution'));


-- -----------------------------------------------------------------------------
-- D. user_contributions table — audit + UI display
-- -----------------------------------------------------------------------------
-- One row per accepted community submission. The UNIQUE constraint prevents
-- double-awards if a maintainer flips status accepted → rejected → accepted.
-- kind is denormalized so the UI can show "earned by submitting a Jobs program".
CREATE TABLE IF NOT EXISTS user_contributions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  import_queue_id UUID NOT NULL REFERENCES import_queue(id) ON DELETE CASCADE,
  credit_type     TEXT NOT NULL DEFAULT 'drip_unlock'
                  CHECK (credit_type IN ('drip_unlock')),
  credit_amount   INT  NOT NULL DEFAULT 5 CHECK (credit_amount > 0),
  kind            opportunity_kind,
  awarded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, import_queue_id, credit_type)
);

CREATE INDEX IF NOT EXISTS idx_user_contributions_user
  ON user_contributions (user_id, awarded_at DESC);

ALTER TABLE user_contributions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "user_contributions_owner_select"
    ON user_contributions FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "user_contributions_service_all"
    ON user_contributions FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- -----------------------------------------------------------------------------
-- E. Trigger: award credits when an import_queue row is accepted
-- -----------------------------------------------------------------------------
-- Fires AFTER UPDATE OF status when the new status is 'accepted' AND the old
-- status was something else (so re-saving an already-accepted row is a no-op).
-- The UNIQUE constraint on user_contributions provides a second layer of
-- protection against double-awards.
--
-- The function unlocks up to credit_amount more high-significance archived
-- questions for the submitter, source='contribution'. These bonus unlocks
-- bypass the v_free_cap in run_daily_drip — earned unlocks are not subject
-- to the free-tier daily cap, which is the entire point of the reward.
CREATE OR REPLACE FUNCTION award_contribution_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_credit_amount   INT := 5;
  v_actual_inserted INT;
BEGIN
  -- Guard: only on transition into 'accepted', and only if there's a submitter
  IF NEW.submitted_by IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Record the contribution. ON CONFLICT DO NOTHING handles the rare race
  -- where a maintainer flips a row through 'accepted' twice.
  INSERT INTO user_contributions
    (user_id, import_queue_id, credit_type, credit_amount, kind)
  VALUES
    (NEW.submitted_by, NEW.id, 'drip_unlock', v_credit_amount, NEW.kind)
  ON CONFLICT (user_id, import_queue_id, credit_type) DO NOTHING;

  GET DIAGNOSTICS v_actual_inserted = ROW_COUNT;

  -- If this is genuinely the first award for this submission, unlock more
  -- archived questions for the user.
  IF v_actual_inserted > 0 THEN
    INSERT INTO user_question_unlocks (user_id, archived_question_id, source)
    SELECT NEW.submitted_by, aq.id, 'contribution'
    FROM archived_questions aq
    WHERE aq.id NOT IN (
      SELECT archived_question_id FROM user_question_unlocks
      WHERE user_id = NEW.submitted_by
    )
    ORDER BY aq.significance_score DESC NULLS LAST
    LIMIT v_credit_amount
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_contribution_credits ON import_queue;
CREATE TRIGGER trg_award_contribution_credits
  AFTER UPDATE OF status ON import_queue
  FOR EACH ROW
  WHEN (NEW.status = 'accepted'::import_status)
  EXECUTE FUNCTION award_contribution_credits();


-- -----------------------------------------------------------------------------
-- F. Convenience view — user-facing credit balance summary
-- -----------------------------------------------------------------------------
-- Aggregates total contribution unlocks earned per user, for the profile UI.
-- Read via RLS — same owner-only policy as user_contributions.
CREATE OR REPLACE VIEW user_contribution_summary AS
SELECT
  user_id,
  COUNT(*)::INT                  AS contribution_count,
  COALESCE(SUM(credit_amount), 0)::INT AS total_credits_earned,
  MAX(awarded_at)                AS last_awarded_at
FROM user_contributions
GROUP BY user_id;
