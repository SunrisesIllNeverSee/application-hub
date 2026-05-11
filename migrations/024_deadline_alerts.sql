-- ============================================================
-- Migration 024: Deadline Alerts
-- Application Hub Platform -- Ello Cello LLC
-- ============================================================
-- Tracks which deadline alert windows (30d / 7d / 24h) have
-- been sent for each (user, program) pair. Prevents duplicate
-- alerts across nightly cron runs.
--
-- Also adds deadline_alerts_enabled to user_profiles so users
-- can opt out of all deadline email alerts.
-- ============================================================

-- ============================================================
-- DEADLINE_ALERTS
-- ============================================================

CREATE TABLE IF NOT EXISTS deadline_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id      UUID NOT NULL REFERENCES programs(id)   ON DELETE CASCADE,
  alert_window    TEXT NOT NULL CHECK (alert_window IN ('30d','7d','24h')),
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, program_id, alert_window)
);

CREATE INDEX IF NOT EXISTS idx_deadline_alerts_user    ON deadline_alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_deadline_alerts_program ON deadline_alerts (program_id);
CREATE INDEX IF NOT EXISTS idx_deadline_alerts_sent_at ON deadline_alerts (sent_at) WHERE sent_at IS NULL;

ALTER TABLE deadline_alerts ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own alert records
CREATE POLICY "da_owner" ON deadline_alerts FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- USER PROFILES: opt-out flag
-- ============================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS deadline_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE;
