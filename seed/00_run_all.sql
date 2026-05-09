-- seed/00_run_all.sql
-- Application Hub — Run all 30 program seed files in order
--
-- Usage (from the repo root, against your Supabase project):
--   psql "$DATABASE_URL" -f seed/00_run_all.sql
--
-- Or using the Supabase CLI:
--   supabase db reset  (applies migrations + seeds)
--
-- Each file is self-contained and idempotent within a single run.
-- Programs are deduped by slug (UNIQUE constraint on programs.slug).
-- Archived questions are fetched-or-inserted by exact text match.
-- ============================================================

-- Accelerators & VC (top-tier)
\i seed/programs/y-combinator.sql
\i seed/programs/techstars-boulder.sql
\i seed/programs/a16z-start.sql
\i seed/programs/500-startups.sql
\i seed/programs/alchemist-accelerator.sql

-- Major VC Funds
\i seed/programs/first-round-capital.sql
\i seed/programs/pear-vc.sql
\i seed/programs/nea-venture-studio.sql
\i seed/programs/precursor-ventures.sql
\i seed/programs/hustle-fund.sql
\i seed/programs/indie-vc.sql

-- Google / Corporate Programs
\i seed/programs/google-for-startups.sql
\i seed/programs/accenture-fintech-lab.sql
\i seed/programs/mozilla-builders.sql

-- Government Grants
\i seed/programs/sbir-phase-1.sql
\i seed/programs/nsf-sbir.sql
\i seed/programs/doe-arpa-e.sql

-- Impact & Social Innovation
\i seed/programs/echoing-green.sql
\i seed/programs/fast-forward.sql
\i seed/programs/halcyon-incubator.sql
\i seed/programs/masschallenge.sql
\i seed/programs/village-capital.sql

-- Diversity-Focused Investors
\i seed/programs/backstage-capital.sql
\i seed/programs/visible-hands.sql
\i seed/programs/camelback-ventures.sql
\i seed/programs/overlooked-ventures.sql
\i seed/programs/kapor-capital.sql

-- Regional & Early-Stage
\i seed/programs/capital-factory.sql
\i seed/programs/founders-coop.sql
\i seed/programs/founder-catalyst.sql
