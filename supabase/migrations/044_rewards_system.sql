-- ============================================================
-- 044 — Canonical Rewards System
-- ============================================================
-- Credits plus payout-ready contribution rewards. Real money payouts are
-- intentionally gated by approval status and Stripe Connect metadata.
-- ============================================================

CREATE TABLE IF NOT EXISTS canonical_user_credits (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance         INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned INT NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  stripe_account_id TEXT,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contribution_rewards (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       UUID,
  action          TEXT NOT NULL,
  credit_amount   INT NOT NULL DEFAULT 0,
  cash_amount_cents INT NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'usd',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  stripe_account_id TEXT,
  stripe_transfer_id TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  approved_at     TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contribution_rewards_user ON contribution_rewards(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contribution_rewards_status ON contribution_rewards(status);
CREATE INDEX IF NOT EXISTS idx_contribution_rewards_entity ON contribution_rewards(entity_type, entity_id);

ALTER TABLE canonical_user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "canonical_user_credits_owner_select" ON canonical_user_credits;
CREATE POLICY "canonical_user_credits_owner_select" ON canonical_user_credits
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "canonical_user_credits_service_all" ON canonical_user_credits;
CREATE POLICY "canonical_user_credits_service_all" ON canonical_user_credits
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "contribution_rewards_owner_select" ON contribution_rewards;
CREATE POLICY "contribution_rewards_owner_select" ON contribution_rewards
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "contribution_rewards_service_all" ON contribution_rewards;
CREATE POLICY "contribution_rewards_service_all" ON contribution_rewards
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION process_reward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    INSERT INTO canonical_user_credits (user_id, balance, lifetime_earned)
    VALUES (NEW.user_id, GREATEST(NEW.credit_amount, 0), GREATEST(NEW.credit_amount, 0))
    ON CONFLICT (user_id) DO UPDATE
    SET balance = canonical_user_credits.balance + GREATEST(NEW.credit_amount, 0),
        lifetime_earned = canonical_user_credits.lifetime_earned + GREATEST(NEW.credit_amount, 0),
        updated_at = NOW();

    NEW.approved_at = COALESCE(NEW.approved_at, NOW());
  END IF;

  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    NEW.paid_at = COALESCE(NEW.paid_at, NOW());
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_process_reward ON contribution_rewards;
CREATE TRIGGER trg_process_reward
  BEFORE UPDATE ON contribution_rewards
  FOR EACH ROW EXECUTE FUNCTION process_reward();
