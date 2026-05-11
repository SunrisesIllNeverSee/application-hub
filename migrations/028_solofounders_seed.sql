-- ============================================================
-- 028 — Solofounders seed
-- ============================================================
-- Adds Solofounders as a funder + program.
-- solofounders.xyz — accelerator/community for solo founders.
-- ============================================================

INSERT INTO funders (slug, name, type, website, hq_location, founded_year, domain, description)
VALUES (
  'solofounders',
  'Solofounders',
  'accelerator',
  'https://solofounders.xyz',
  'Remote',
  2021,
  'founder',
  'Community and accelerator program specifically for solo founders building startups without co-founders.'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO programs (
  slug, name, type, description, url, is_rolling, domain,
  funder_id,
  pros, cons, best_for,
  tldr,
  heat_score, program_value_score
)
VALUES (
  'solofounders',
  'Solofounders',
  'accel',
  'An accelerator and community built specifically for solo founders. Provides mentorship, peer support, and resources tailored to founders building without co-founders.',
  'https://solofounders.xyz',
  true,
  'founder',
  (SELECT id FROM funders WHERE slug = 'solofounders'),
  '["Built for solo founders specifically", "Rolling admissions — no batch pressure", "Strong peer community", "Founder-paced program structure"]',
  '["Smaller network than major accelerators", "Less brand recognition than YC/Techstars", "Limited funding compared to equity-based programs"]',
  'Solo founders building a product or service who want community and structure without the co-founder requirement.',
  'The only major accelerator built from the ground up for solo founders. Rolling admissions, community-first, no batch pressure.',
  55,
  58
)
ON CONFLICT (slug) DO NOTHING;
