-- =============================================================================
-- Migration 021: Import Queue Extensions
-- =============================================================================
-- Purpose:
--   Extend `import_queue` to support the user-facing program URL submission
--   feature. Add structured URL, kind (opportunity taxonomy), free-form notes,
--   metadata jsonb, and a submitted_at timestamp alongside the existing
--   created_at column (kept for backwards compatibility with the MCP server
--   and any seed scripts that write directly to created_at).
--
-- Status enum extensions:
--   The historical `import_status` enum was {'pending','mapped','rejected',
--   'manual'}. The launch hardening UX surfaces submissions via richer
--   pipeline states. We extend the enum (additively — old values still
--   accepted) with:
--     - 'pending_review'  : community-submitted URL awaiting maintainer triage
--     - 'accepted'        : maintainer accepted, scraping/extraction queued
--     - 'processed'       : program + questions are now in the archive
--
-- Properties:
--   - ADDITIVE ONLY (no DROP, no breaking type changes)
--   - IDEMPOTENT (IF NOT EXISTS guards + DO blocks catching duplicate_object)
--   - NON-BREAKING (every new column is nullable or has a DEFAULT)
--
-- Non-transactional notes:
--   - ALTER TYPE ... ADD VALUE must run outside an explicit BEGIN/COMMIT in
--     PostgreSQL. Apply this migration as a top-level statement (the Supabase
--     SQL editor + apply_migration tool both do this implicitly).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- A. Extend import_status enum (additive)
-- -----------------------------------------------------------------------------
ALTER TYPE import_status ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE import_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE import_status ADD VALUE IF NOT EXISTS 'processed';


-- -----------------------------------------------------------------------------
-- B. New columns on import_queue
-- -----------------------------------------------------------------------------
ALTER TABLE import_queue
  ADD COLUMN IF NOT EXISTS url           text,
  ADD COLUMN IF NOT EXISTS kind          opportunity_kind,
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at  timestamptz NOT NULL DEFAULT now();

-- Backfill submitted_at for pre-existing rows from created_at where possible
UPDATE import_queue
SET submitted_at = created_at
WHERE submitted_at IS NULL AND created_at IS NOT NULL;


-- -----------------------------------------------------------------------------
-- C. raw_text was NOT NULL historically — relax to allow URL-only submissions
--    where the user hasn't provided pasted questions yet. The route always
--    falls back to writing the URL into raw_text, so this is defense-in-depth.
-- -----------------------------------------------------------------------------
ALTER TABLE import_queue
  ALTER COLUMN raw_text DROP NOT NULL;


-- -----------------------------------------------------------------------------
-- D. Helpful indexes for the dedupe + rate-limit lookups
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS import_queue_url_idx
  ON import_queue (url)
  WHERE url IS NOT NULL;

CREATE INDEX IF NOT EXISTS import_queue_submitted_by_submitted_at_idx
  ON import_queue (submitted_by, submitted_at DESC);


-- -----------------------------------------------------------------------------
-- E. RLS — owner-read policy already exists from migration 005:
--      "import_queue_owner_read" USING (submitted_by = auth.uid() OR
--                                       auth.role() = 'service_role')
--    and the auth-insert + service-update policies remain in force.
--    No new policies needed.
-- -----------------------------------------------------------------------------
