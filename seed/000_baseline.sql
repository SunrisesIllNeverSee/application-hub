-- ============================================================
-- Application Hub — Baseline Schema (Fresh Install)
-- ============================================================
-- This file is a squash of migrations 001–020 for fresh-install
-- convenience. It does NOT replace supabase/migrations/ — those
-- remain the canonical migration chain for the live Supabase project.
--
-- Use this file ONLY when spinning up a brand-new Supabase project
-- from scratch (e.g. local dev, staging, CI). Never run this against
-- a database that already has migrations 001–020 applied.
--
-- To apply to a fresh project:
--   psql $DATABASE_URL -f seed/000_baseline.sql
--
-- After applying this baseline, continue from migration 021 onward:
--   supabase db push  (or apply 021–current in order)
--
-- Last updated: 2026-05-12 (squash planned at migration 050 milestone)
-- When migration 050 lands: regenerate this file from the live schema
-- using: pg_dump --schema-only --no-owner --no-acl $DATABASE_URL
-- ============================================================

-- PLACEHOLDER — regenerate at migration 050 milestone
-- Run: pg_dump --schema-only --no-owner --no-acl $DATABASE_URL > seed/000_baseline.sql
-- Then strip all ALTER DEFAULT PRIVILEGES and \connect lines.
-- Test by: spin up fresh Supabase project, apply this file, then apply 021+, run smoke tests.

SELECT 'seed/000_baseline.sql: placeholder — regenerate at migration 050' AS status;
