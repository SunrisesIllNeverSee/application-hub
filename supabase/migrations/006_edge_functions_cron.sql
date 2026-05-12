-- ============================================================
-- Migration 006: Edge Function Cron Registration
-- Application Hub Platform — Ello Cello LLC
-- ============================================================
-- These cron jobs are registered via Supabase's pg_cron extension.
-- They call the functions defined in migration 004.
-- Deploy Edge Functions separately in /supabase/functions/.
-- ============================================================

-- Enable pg_cron (requires Supabase Pro or pg_cron enabled in project settings)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- HEAT SCORE RECOMPUTATION — every 6 hours
-- ============================================================

SELECT cron.schedule(
  'recompute-heat-scores',           -- job name
  '0 */6 * * *',                     -- every 6 hours
  $$SELECT recompute_all_heat_scores();$$
);

-- ============================================================
-- PROGRAM STATUS AUTO-UPDATE — every hour
-- upcoming→open, open→closed based on timestamps
-- ============================================================

SELECT cron.schedule(
  'auto-update-program-status',
  '0 * * * *',                       -- every hour
  $$SELECT auto_update_program_status();$$
);

-- ============================================================
-- IMPORTANCE SCORE REFRESH on archived_questions — daily
-- Recomputes importance based on asked_by_count + program prestige.
-- Simple version: normalize asked_by_count to 0–1 range.
-- ============================================================

SELECT cron.schedule(
  'refresh-question-importance',
  '0 3 * * *',                       -- 3am daily
  $$
    UPDATE archived_questions
    SET importance_score = LEAST(1.0, asked_by_count::FLOAT / NULLIF(
      (SELECT MAX(asked_by_count) FROM archived_questions), 0
    )),
    updated_at = NOW();
  $$
);

-- ============================================================
-- IS_UNIVERSAL FLAG REFRESH — daily
-- Questions asked by 80%+ of programs with 10+ total programs.
-- ============================================================

SELECT cron.schedule(
  'refresh-universal-questions',
  '0 4 * * *',                       -- 4am daily
  $$
    UPDATE archived_questions aq
    SET is_universal = (
      aq.asked_by_count::FLOAT / NULLIF(
        (SELECT COUNT(DISTINCT id) FROM programs WHERE status != 'upcoming'), 0
      ) >= 0.8
    ),
    updated_at = NOW()
    WHERE (
      SELECT COUNT(DISTINCT id) FROM programs WHERE status != 'upcoming'
    ) >= 10;
  $$
);

-- ============================================================
-- CLEANUP: old program_signals — keep 90 days rolling
-- Prevents unbounded table growth in production.
-- ============================================================

SELECT cron.schedule(
  'cleanup-old-signals',
  '0 2 * * 0',                       -- Sunday 2am weekly
  $$
    DELETE FROM program_signals
    WHERE created_at < NOW() - INTERVAL '90 days';
  $$
);
