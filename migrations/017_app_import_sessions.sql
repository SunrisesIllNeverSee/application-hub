-- Migration 017: app_import_sessions + import_queue RLS
-- Adds persistent session table for application imports and secures import_queue

CREATE TABLE IF NOT EXISTS app_import_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text        TEXT NOT NULL,
  program_name    TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processing','complete','failed')),
  extracted_pairs JSONB,
  saved_count     INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_import_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ais_owner" ON app_import_sessions FOR ALL USING (user_id = auth.uid());

ALTER TABLE import_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'import_queue'
      AND policyname = 'iq_owner_insert'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "iq_owner_insert" ON import_queue
        FOR INSERT WITH CHECK (submitted_by = auth.uid())
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'import_queue'
      AND policyname = 'iq_owner_select'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "iq_owner_select" ON import_queue
        FOR SELECT USING (submitted_by = auth.uid())
    $p$;
  END IF;
END $$;
