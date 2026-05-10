-- ============================================================
-- Migration 011: User Profiles
-- Application Hub Platform — Ello Cello LLC
-- ============================================================
-- Separates the founder's public/semi-public profile from the
-- auth.users record. Fields here drive:
--   - Sign-up drip: match high-significance questions to founder type
--   - Fit scoring: stage, industry, and geo alignment with programs
--   - MoatScore surface (future): traction signals, team size
-- ============================================================

CREATE TABLE user_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  display_name        TEXT,
  bio                 TEXT,
  avatar_url          TEXT,

  -- Company
  company_name        TEXT,
  company_url         TEXT,
  company_one_liner   TEXT,                                    -- 50 chars max for elevator pitch

  -- Stage — maps to program eligibility filters
  stage               TEXT CHECK (stage IN (
    'idea', 'prototype', 'pre-seed', 'seed', 'series-a', 'growth'
  )),

  -- Industry tags — must overlap with programs.industry_tags for fit scoring
  industry_tags       TEXT[] NOT NULL DEFAULT '{}',

  -- Geography
  location_country    TEXT,
  location_city       TEXT,

  -- Team
  team_size           SMALLINT CHECK (team_size >= 1),
  is_technical_founder BOOLEAN,

  -- Founder background (used for drip matching and program fit)
  founder_type        TEXT CHECK (founder_type IN (
    'first-time', 'repeat', 'academic', 'operator', 'investor-turned-founder'
  )),

  -- Social / integrations (display only; keys go in user_integrations)
  linkedin_url        TEXT,
  github_url          TEXT,
  twitter_url         TEXT,

  -- Settings
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  profile_visibility  TEXT NOT NULL DEFAULT 'private' CHECK (profile_visibility IN ('private', 'public')),

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_user ON user_profiles (user_id);
CREATE INDEX idx_user_profiles_stage ON user_profiles (stage);
CREATE INDEX idx_user_profiles_industry ON user_profiles USING gin (industry_tags);

CREATE TRIGGER set_updated_at_user_profiles
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile row on signup (alongside the free subscription row)
CREATE OR REPLACE FUNCTION create_user_profile_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO user_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_create_user_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile_on_signup();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own profile
CREATE POLICY "user_profiles_owner_select"
  ON user_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_profiles_owner_insert"
  ON user_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_profiles_owner_update"
  ON user_profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Public profiles readable by anyone (for future public directory)
CREATE POLICY "user_profiles_public_read"
  ON user_profiles FOR SELECT
  USING (profile_visibility = 'public');

-- Service role full access
CREATE POLICY "user_profiles_service_write"
  ON user_profiles FOR ALL
  USING (auth.role() = 'service_role');
