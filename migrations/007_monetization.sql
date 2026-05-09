-- ============================================================
-- Migration 007: Monetization Layer
-- Application Hub Platform — Ello Cello LLC
-- ============================================================
-- Three revenue streams:
--   1. SUBSCRIPTIONS — tiered SaaS (Free / Pro / Team)
--   2. PROGRAM LISTINGS — funders pay to feature/boost programs
--   3. FEATURED PLACEMENT — heat-weighted auction for hub position
-- ============================================================

-- ============================================================
-- SUBSCRIPTION PLANS
-- Defines the available tiers. Managed via Stripe products.
-- ============================================================

CREATE TYPE subscription_tier AS ENUM (
  'free',
  'pro',
  'team'
);

CREATE TYPE subscription_status AS ENUM (
  'active',
  'trialing',
  'past_due',
  'canceled',
  'paused'
);

CREATE TABLE subscription_plans (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier                subscription_tier UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  price_monthly_cents INT NOT NULL,              -- 0 for free
  price_annual_cents  INT,
  stripe_product_id   TEXT,
  stripe_price_id_monthly TEXT,
  stripe_price_id_annual  TEXT,
  -- Feature limits
  max_active_applications INT NOT NULL DEFAULT 3,   -- free = 3, pro = unlimited (-1)
  ai_drafts_per_month     INT NOT NULL DEFAULT 10,  -- free = 10, pro = unlimited (-1)
  can_export              BOOLEAN NOT NULL DEFAULT FALSE,
  can_see_acceptance_rates BOOLEAN NOT NULL DEFAULT FALSE,
  can_see_heat_scores     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the three tiers
INSERT INTO subscription_plans (tier, name, price_monthly_cents, price_annual_cents, max_active_applications, ai_drafts_per_month, can_export, can_see_acceptance_rates, can_see_heat_scores) VALUES
  ('free',  'Free',  0,     0,      3,  10,  FALSE, FALSE, FALSE),
  ('pro',   'Pro',   1900,  15900,  -1, -1,  TRUE,  TRUE,  TRUE),
  ('team',  'Team',  4900,  39900,  -1, -1,  TRUE,  TRUE,  TRUE);

-- ============================================================
-- USER SUBSCRIPTIONS
-- One active subscription per user. Linked to Stripe customer.
-- ============================================================

CREATE TABLE user_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier                  subscription_tier NOT NULL DEFAULT 'free',
  status                subscription_status NOT NULL DEFAULT 'active',
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,
  trial_end             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_subscriptions_user ON user_subscriptions (user_id);
CREATE INDEX idx_user_subscriptions_stripe ON user_subscriptions (stripe_customer_id);
CREATE INDEX idx_user_subscriptions_tier ON user_subscriptions (tier);

CREATE TRIGGER set_updated_at_user_subscriptions
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create free subscription on user creation
CREATE OR REPLACE FUNCTION create_free_subscription_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auto_create_subscription_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_free_subscription_on_signup();

-- ============================================================
-- PROGRAM LISTINGS
-- Funders pay to list programs with verified/featured status.
-- Tier determines placement boost and badge display.
-- ============================================================

CREATE TYPE listing_tier AS ENUM (
  'standard',    -- free, community-sourced or funder-submitted
  'verified',    -- funder pays — gets verified badge, priority in search
  'featured'     -- funder pays premium — pinned at top of hub for their type/tags
);

CREATE TYPE listing_status AS ENUM (
  'pending_payment',
  'active',
  'expired',
  'canceled'
);

CREATE TABLE program_listings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id          UUID UNIQUE NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  tier                listing_tier NOT NULL DEFAULT 'standard',
  status              listing_status NOT NULL DEFAULT 'active',
  funder_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_payment_intent TEXT,
  amount_paid_cents   INT NOT NULL DEFAULT 0,
  starts_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,                  -- NULL = doesn't expire (standard)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_program_listings_program ON program_listings (program_id);
CREATE INDEX idx_program_listings_tier ON program_listings (tier);
CREATE INDEX idx_program_listings_status ON program_listings (status);

CREATE TRIGGER set_updated_at_program_listings
  BEFORE UPDATE ON program_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Listing pricing (managed separately, this is reference data)
-- verified: $299/cycle (per program open period)
-- featured: $999/cycle, slot-limited per program type

-- ============================================================
-- AI DRAFT USAGE TRACKING
-- Enforce monthly limits on free/pro tiers.
-- Resets on billing cycle start.
-- ============================================================

CREATE TABLE ai_usage (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_year    TEXT NOT NULL,                  -- "2025-09" — reset key
  draft_count   INT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month_year)
);

CREATE INDEX idx_ai_usage_user ON ai_usage (user_id);

-- Increment on each ai_draft_run insert
CREATE OR REPLACE FUNCTION increment_ai_usage()
RETURNS TRIGGER AS $$
DECLARE
  current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
  user_tier     subscription_tier;
  monthly_limit INT;
  current_count INT;
BEGIN
  -- Get user's tier limit
  SELECT sp.ai_drafts_per_month INTO monthly_limit
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.tier = us.tier
  WHERE us.user_id = NEW.user_id;

  -- -1 = unlimited
  IF monthly_limit = -1 THEN
    RETURN NEW;
  END IF;

  -- Upsert usage row
  INSERT INTO ai_usage (user_id, month_year, draft_count)
  VALUES (NEW.user_id, current_month, 1)
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET draft_count = ai_usage.draft_count + 1, updated_at = NOW()
  RETURNING draft_count INTO current_count;

  -- Hard stop if over limit (app layer should check first, this is the guardrail)
  IF current_count > monthly_limit THEN
    RAISE EXCEPTION 'Monthly AI draft limit (%) reached. Upgrade to Pro for unlimited drafts.', monthly_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_ai_usage_on_draft
  BEFORE INSERT ON ai_draft_runs
  FOR EACH ROW EXECUTE FUNCTION increment_ai_usage();

-- ============================================================
-- RLS: MONETIZATION TABLES
-- ============================================================

ALTER TABLE subscription_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_listings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage              ENABLE ROW LEVEL SECURITY;

-- subscription_plans — public read (users need to see what tiers exist)
CREATE POLICY "subscription_plans_public_read"
  ON subscription_plans FOR SELECT USING (TRUE);

-- user_subscriptions — owner only
CREATE POLICY "user_subscriptions_owner_select"
  ON user_subscriptions FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_subscriptions_service_write"
  ON user_subscriptions FOR ALL USING (auth.role() = 'service_role');

-- program_listings — public read (badge display on hub), funder/service write
CREATE POLICY "program_listings_public_read"
  ON program_listings FOR SELECT USING (TRUE);

CREATE POLICY "program_listings_funder_insert"
  ON program_listings FOR INSERT
  WITH CHECK (funder_user_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "program_listings_funder_update"
  ON program_listings FOR UPDATE
  USING (funder_user_id = auth.uid() OR auth.role() = 'service_role');

-- ai_usage — owner only
CREATE POLICY "ai_usage_owner_select"
  ON ai_usage FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "ai_usage_service_write"
  ON ai_usage FOR ALL USING (auth.role() = 'service_role');
