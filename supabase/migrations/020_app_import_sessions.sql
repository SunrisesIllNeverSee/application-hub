-- ============================================================
-- Migration 020: paste-import session columns
-- Application Hub Platform — Ello Cello LLC
-- ============================================================
-- The base `app_import_sessions` table was introduced in
-- migration 017. This migration is additive — it brings the
-- table in line with the paste-import contract used by
-- POST /api/import/paste:
--
--   id              uuid pk default uuid_generate_v4()
--   user_id         uuid (auth.users)
--   source_kind     text (accelerator|job|school|grant|other)
--   raw_text        text
--   extracted_count int default 0
--   error_text      text null
--   created_at      timestamptz default now()
--
-- All ALTERs are guarded with IF NOT EXISTS so this is safe to
-- re-run and safe to apply on a database that already shipped
-- migration 017.
-- ============================================================

CREATE TABLE IF NOT EXISTS app_import_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text        TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_import_sessions
  ADD COLUMN IF NOT EXISTS source_kind     TEXT,
  ADD COLUMN IF NOT EXISTS extracted_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_text      TEXT;

-- Enum-style guard for source_kind. Use a NOT VALID constraint
-- first so we don't fail if older rows have NULL values, then
-- validate.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_import_sessions_source_kind_check'
  ) THEN
    EXECUTE $c$
      ALTER TABLE app_import_sessions
        ADD CONSTRAINT app_import_sessions_source_kind_check
        CHECK (source_kind IS NULL OR source_kind IN (
          'accelerator','job','school','grant','other'
        )) NOT VALID
    $c$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_app_import_sessions_user_created
  ON app_import_sessions (user_id, created_at DESC);

-- RLS — owner-only access. Migration 017 already enabled RLS
-- and added an "ais_owner" policy; this is a guarded no-op for
-- fresh databases that skip 017.
ALTER TABLE app_import_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'app_import_sessions'
      AND policyname = 'ais_owner'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "ais_owner" ON app_import_sessions
        FOR ALL USING (user_id = auth.uid())
    $p$;
  END IF;
END $$;
