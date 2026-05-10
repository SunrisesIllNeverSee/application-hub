-- ============================================================
-- Migration 015: BYOK key storage column
-- Application Hub Platform — Ello Cello LLC
-- ============================================================
-- Adds key_encrypted column to user_integrations.
-- The raw API key is AES-256-GCM encrypted server-side using
-- INTEGRATION_ENCRYPTION_KEY env var before storage.
-- key_storage_ref is repurposed as the encryption IV (nonce).
-- key_fingerprint stores last 6 chars for safe display.
-- The raw key NEVER leaves the server route.
-- ============================================================

ALTER TABLE user_integrations
  ADD COLUMN IF NOT EXISTS key_encrypted TEXT;

-- Update RLS to allow authenticated users to manage their own integrations
CREATE POLICY IF NOT EXISTS "integrations_owner_select"
  ON user_integrations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "integrations_owner_insert"
  ON user_integrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "integrations_owner_update"
  ON user_integrations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "integrations_owner_delete"
  ON user_integrations FOR DELETE
  USING (user_id = auth.uid());
