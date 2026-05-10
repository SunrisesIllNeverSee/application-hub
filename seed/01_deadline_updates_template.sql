-- ============================================================
-- Deadline update helper
-- ============================================================
--
-- Purpose:
--   Use this file to patch real program deadlines after manually verifying
--   each source. Do not guess. Dates drift constantly.
--
-- How to use:
--   1. Verify each deadline on the official program site.
--   2. Add a row to verified_deadlines.
--   3. Run this file against Supabase.
--   4. Commit the source notes in docs/11_deadline_seed_handoff.md.
--
-- Date convention:
--   Store closes_at as a timestamptz. If the program publishes only a date,
--   use 23:59:00 in the program's primary timezone and note that assumption.
-- ============================================================

WITH verified_deadlines(slug, closes_at, status, is_rolling, source_url, source_note) AS (
  VALUES
    -- Example:
    -- (
    --   'y-combinator',
    --   '2026-08-04 20:00:00-07'::timestamptz,
    --   'open'::program_status,
    --   false,
    --   'https://www.ycombinator.com/apply',
    --   'Official YC apply page; deadline/time copied manually on YYYY-MM-DD.'
    -- )
    (
      '__template_do_not_apply__',
      NULL::timestamptz,
      NULL::program_status,
      NULL::boolean,
      NULL::text,
      NULL::text
    )
),
updates AS (
  SELECT *
  FROM verified_deadlines
  WHERE slug <> '__template_do_not_apply__'
)
UPDATE programs p
SET
  closes_at = u.closes_at,
  status = COALESCE(u.status, p.status),
  is_rolling = COALESCE(u.is_rolling, p.is_rolling),
  updated_at = NOW()
FROM updates u
WHERE p.slug = u.slug
RETURNING
  p.slug,
  p.name,
  p.status,
  p.closes_at,
  p.deadline_at,
  p.is_rolling;
