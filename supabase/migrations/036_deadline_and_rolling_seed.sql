-- Migration 036: Seed deadlines + rolling status for high-value programs
-- deadline_at is a generated column derived from closes_at — only update closes_at.
-- Rolling programs: no fixed cycle — is_rolling=true, status='open'.
-- Cycle programs: next known deadline window; re-seed each cycle.

-- Rolling / evergreen programs
UPDATE programs SET is_rolling = true, status = 'open', updated_at = NOW()
WHERE slug IN (
  'a16z-start',
  'first-round-capital',
  'google-for-startups',
  'nea-venture-studio',
  'pear-vc',
  'precursor-ventures',
  'kapor-capital',
  'backstage-capital',
  'capital-factory',
  'hustle-fund',
  'visible-hands',
  'indie-vc',
  'overlooked-ventures',
  'founders-coop',
  'camelback-ventures',
  'solofounders'
);

-- YC W2027 — applications typically open ~Aug, close early Sep
UPDATE programs SET
  closes_at = '2026-09-04 20:00:00-07'::timestamptz,
  status = 'open', is_rolling = false, updated_at = NOW()
WHERE slug = 'y-combinator';

-- Techstars Boulder
UPDATE programs SET
  closes_at = '2026-07-01 23:59:00-04'::timestamptz,
  status = 'open', is_rolling = false, updated_at = NOW()
WHERE slug = 'techstars-boulder';

-- Techstars (generic)
UPDATE programs SET
  closes_at = '2026-10-01 23:59:00-04'::timestamptz,
  status = 'open', is_rolling = false, updated_at = NOW()
WHERE slug = 'techstars';

-- Founder Catalyst
UPDATE programs SET
  closes_at = '2026-06-15 23:59:00-07'::timestamptz,
  status = 'open', is_rolling = false, updated_at = NOW()
WHERE slug = 'founder-catalyst';
