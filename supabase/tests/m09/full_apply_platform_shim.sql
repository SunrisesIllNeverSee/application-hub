-- ============================================================
-- M09 W11 full-chain harness: Supabase platform shim
-- ============================================================
-- LOCAL THROWAWAY POSTGRES ONLY. Loaded after p0/00_bootstrap.sql and
-- BEFORE migration 001 when the runner replays the whole chain
-- (001 -> 059) on a fresh database. It stands in for platform pieces the
-- migrations call but that a plain Postgres cluster does not ship:
--   * pg_cron: schema cron, table cron.job, cron.schedule()/unschedule()
--     (006/008/050 register jobs; nothing ever runs them here). The runner
--     strips 006's "CREATE EXTENSION IF NOT EXISTS pg_cron" line.
--   * schema extensions (functions SET search_path = public, extensions)
--   * auth.users columns GoTrue has and signup triggers may read
-- Nothing here lives in schema public, so it cannot affect the grants
-- under test.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS cron;

CREATE TABLE IF NOT EXISTS cron.job (
  jobid    bigserial PRIMARY KEY,
  jobname  text UNIQUE,
  schedule text NOT NULL,
  command  text NOT NULL
);

CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO cron.job (jobname, schedule, command) VALUES (job_name, schedule, command)
  ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command
  RETURNING jobid
$$;

CREATE OR REPLACE FUNCTION cron.schedule(schedule text, command text)
RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO cron.job (jobname, schedule, command) VALUES (NULL, schedule, command) RETURNING jobid
$$;

CREATE OR REPLACE FUNCTION cron.unschedule(job_name text)
RETURNS boolean LANGUAGE sql AS $$
  WITH d AS (DELETE FROM cron.job WHERE jobname = job_name RETURNING 1) SELECT count(*) > 0 FROM d
$$;

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS raw_app_meta_data  jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS phone              text,
  ADD COLUMN IF NOT EXISTS last_sign_in_at    timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz NOT NULL DEFAULT now();
