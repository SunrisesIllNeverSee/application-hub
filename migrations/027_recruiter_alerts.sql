-- ============================================================
-- 027 — Recruiter alerts deduplication
-- ============================================================
-- Tracks which (user, program, week) combos have already been
-- surfaced by the recruiter agent so we don't re-send weekly.
-- ============================================================

CREATE TABLE IF NOT EXISTS recruiter_alerts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id  UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- week_bucket: floor to ISO week so we dedup within a rolling 7d window
  week_bucket DATE NOT NULL DEFAULT DATE_TRUNC('week', NOW())::date,
  composite_score NUMERIC,
  CONSTRAINT recruiter_alerts_unique_week
    UNIQUE (user_id, program_id, week_bucket)
);

CREATE INDEX IF NOT EXISTS idx_recruiter_alerts_user_sent
  ON recruiter_alerts (user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_recruiter_alerts_week
  ON recruiter_alerts (week_bucket);

ALTER TABLE recruiter_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recruiter_alerts_service_all" ON recruiter_alerts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- pg_cron schedule: Monday 9am UTC
-- ============================================================
-- Calls the recruiter-agent Edge Function weekly.
-- Ensure CRON_SECRET and APP_URL are set in Edge Function secrets.
-- Change the URL to your deployed Supabase project Edge Function URL.
-- ============================================================
-- Uncomment after deploying the recruiter-agent Edge Function:
--
-- SELECT cron.schedule(
--   'recruiter-agent-weekly',
--   '0 9 * * 1',
--   $$
--   SELECT net.http_post(
--     url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/recruiter-agent',
--     headers := '{"Authorization": "Bearer <SUPABASE_SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb
--   )
--   $$
-- );
