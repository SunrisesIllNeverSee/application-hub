-- ============================================================
-- Migration 023: Funders Schema
-- Application Hub Platform -- Ello Cello LLC
-- ============================================================
-- Creates a `funders` table representing the organizations that
-- run programs (YC the company, NSF the agency, etc.).
-- Adds funder_id FK to programs and seeds 30 funder rows.
-- ============================================================

-- ============================================================
-- FUNDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS funders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'accelerator'
                CHECK (type IN ('accelerator','vc','government','foundation','corporate','nonprofit','other')),
  website       TEXT,
  logo_url      TEXT,
  description   TEXT,
  hq_location   TEXT,
  founded_year  INT,
  domain        TEXT NOT NULL DEFAULT 'founder'
                CHECK (domain IN ('founder','jobs','education','grants','general')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funders_type   ON funders (type);
CREATE INDEX IF NOT EXISTS idx_funders_domain ON funders (domain);

ALTER TABLE funders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funders_public_read" ON funders FOR SELECT USING (true);

-- ============================================================
-- FK on programs
-- ============================================================

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS funder_id UUID REFERENCES funders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_programs_funder ON programs (funder_id);

-- ============================================================
-- SEED: 30 funders matching hand-curated programs
-- (INSERT ... ON CONFLICT DO NOTHING so migration is re-runnable)
-- ============================================================

INSERT INTO funders (slug, name, type, website, hq_location, founded_year, domain)
VALUES
  ('y-combinator',        'Y Combinator',                       'accelerator', 'https://ycombinator.com',         'San Francisco, CA',  2005, 'founder'),
  ('techstars',           'Techstars',                          'accelerator', 'https://techstars.com',           'Boulder, CO',        2006, 'founder'),
  ('500-global',          '500 Global',                         'accelerator', 'https://500.co',                  'San Francisco, CA',  2010, 'founder'),
  ('andreessen-horowitz', 'Andreessen Horowitz (a16z)',          'vc',          'https://a16z.com',                'Menlo Park, CA',     2009, 'founder'),
  ('google',              'Google',                             'corporate',   'https://google.com',              'Mountain View, CA',  1998, 'founder'),
  ('first-round-capital', 'First Round Capital',                'vc',          'https://firstround.com',          'San Francisco, CA',  2004, 'founder'),
  ('pear-vc',             'Pear VC',                            'vc',          'https://pear.vc',                 'Palo Alto, CA',      2013, 'founder'),
  ('nea',                 'New Enterprise Associates (NEA)',     'vc',          'https://nea.com',                 'Chevy Chase, MD',    1977, 'founder'),
  ('alchemist-accelerator','Alchemist Accelerator',             'accelerator', 'https://alchemistaccelerator.com','San Francisco, CA',  2012, 'founder'),
  ('masschallenge',       'MassChallenge',                      'nonprofit',   'https://masschallenge.org',       'Boston, MA',         2009, 'founder'),
  ('echoing-green',       'Echoing Green',                      'foundation',  'https://echoinggreen.org',        'New York, NY',       1987, 'founder'),
  ('nsf',                 'National Science Foundation',        'government',  'https://nsf.gov',                 'Alexandria, VA',     1950, 'grants'),
  ('sba',                 'Small Business Administration',      'government',  'https://sba.gov',                 'Washington, DC',     1953, 'grants'),
  ('doe-arpa-e',          'DOE ARPA-E',                         'government',  'https://arpa-e.energy.gov',       'Washington, DC',     2009, 'grants'),
  ('mozilla',             'Mozilla Foundation',                 'nonprofit',   'https://mozilla.org',             'San Francisco, CA',  2003, 'founder'),
  ('backstage-capital',   'Backstage Capital',                  'vc',          'https://backstagecapital.com',    'Los Angeles, CA',    2015, 'founder'),
  ('kapor-capital',       'Kapor Capital',                      'vc',          'https://kaporcapital.com',        'Oakland, CA',        2011, 'founder'),
  ('hustle-fund',         'Hustle Fund',                        'vc',          'https://hustlefund.vc',           'San Francisco, CA',  2017, 'founder'),
  ('precursor-ventures',  'Precursor Ventures',                 'vc',          'https://precursorvc.com',         'San Francisco, CA',  2015, 'founder'),
  ('village-capital',     'Village Capital',                    'nonprofit',   'https://vilcap.com',              'Washington, DC',     2009, 'founder'),
  ('indie-vc',            'Indie.vc',                           'vc',          'https://indie.vc',                'San Francisco, CA',  2015, 'founder'),
  ('camelback-ventures',  'Camelback Ventures',                 'nonprofit',   'https://camelbackventures.org',   'New Orleans, LA',    2015, 'founder'),
  ('visible-hands',       'Visible Hands',                      'accelerator', 'https://visiblehands.vc',         'Boston, MA',         2020, 'founder'),
  ('capital-factory',     'Capital Factory',                    'accelerator', 'https://capitalfactory.com',      'Austin, TX',         2009, 'founder'),
  ('overlooked-ventures', 'Overlooked Ventures',                'vc',          'https://overlooked.vc',           'New York, NY',       2020, 'founder'),
  ('founders-coop',       'Founders Co-op',                     'vc',          'https://founderscoop.com',        'Seattle, WA',        2008, 'founder'),
  ('accenture',           'Accenture',                          'corporate',   'https://accenture.com',           'Dublin, Ireland',    1989, 'founder'),
  ('fast-forward',        'Fast Forward',                       'nonprofit',   'https://ffwd.org',                'San Francisco, CA',  2014, 'founder'),
  ('halcyon',             'Halcyon',                            'nonprofit',   'https://halcyon.org',             'Washington, DC',     2014, 'founder'),
  ('founder-catalyst',    'Founder Catalyst',                   'accelerator', 'https://foundercatalyst.com',     'United States',      NULL, 'founder')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- MAP programs.funder_id
-- Matched by program slug to funder slug
-- ============================================================

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'y-combinator')
  WHERE slug = 'y-combinator';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'techstars')
  WHERE slug = 'techstars-boulder';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = '500-global')
  WHERE slug = '500-startups';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'andreessen-horowitz')
  WHERE slug = 'a16z-start';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'google')
  WHERE slug = 'google-for-startups';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'first-round-capital')
  WHERE slug = 'first-round-capital';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'pear-vc')
  WHERE slug = 'pear-vc';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'nea')
  WHERE slug = 'nea-venture-studio';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'alchemist-accelerator')
  WHERE slug = 'alchemist-accelerator';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'masschallenge')
  WHERE slug = 'masschallenge';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'echoing-green')
  WHERE slug = 'echoing-green';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'nsf')
  WHERE slug = 'nsf-sbir';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'sba')
  WHERE slug = 'sbir-phase-1';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'doe-arpa-e')
  WHERE slug = 'doe-arpa-e';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'mozilla')
  WHERE slug = 'mozilla-builders';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'backstage-capital')
  WHERE slug = 'backstage-capital';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'kapor-capital')
  WHERE slug = 'kapor-capital';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'hustle-fund')
  WHERE slug = 'hustle-fund';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'precursor-ventures')
  WHERE slug = 'precursor-ventures';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'village-capital')
  WHERE slug = 'village-capital';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'indie-vc')
  WHERE slug = 'indie-vc';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'camelback-ventures')
  WHERE slug = 'camelback-ventures';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'visible-hands')
  WHERE slug = 'visible-hands';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'capital-factory')
  WHERE slug = 'capital-factory';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'overlooked-ventures')
  WHERE slug = 'overlooked-ventures';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'founders-coop')
  WHERE slug = 'founders-coop';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'accenture')
  WHERE slug = 'accenture-fintech-lab';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'fast-forward')
  WHERE slug = 'fast-forward';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'halcyon')
  WHERE slug = 'halcyon-incubator';

UPDATE programs SET funder_id = (SELECT id FROM funders WHERE slug = 'founder-catalyst')
  WHERE slug = 'founder-catalyst';
