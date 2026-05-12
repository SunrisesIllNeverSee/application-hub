-- ============================================================
-- Migration 016: Program content and scores seed
-- Application Hub Platform — Ello Cello LLC
-- 2026-05-10
-- ============================================================
-- Seeds heat_score, program_value_score, brand_score,
-- network_score, follow_on_rate_pct, tldr, pros, cons,
-- best_for for all 30 programs.
-- Also corrects deadline_at (closes_at) where noted.
-- All UPDATEs are idempotent — safe to re-run.
-- ============================================================

-- y-combinator
UPDATE programs SET
  heat_score          = 97,
  program_value_score = 99,
  brand_score         = 99,
  network_score       = 99,
  follow_on_rate_pct  = 67,
  tldr     = 'The most influential startup accelerator on earth. $500K for 7% equity, 3 months in SF.',
  pros     = ARRAY['Strongest alumni network on earth','$500K standard deal with clear terms','YC brand opens every investor door','Batch community is a lifelong asset'],
  cons     = ARRAY['7% equity is steep at pre-seed','Batches are 200+ — you compete for mentor time','SF relocation expected','Application bar is extremely high'],
  best_for = 'Any stage, any industry. Highest ROI if you can get in — apply every batch until you do.'
WHERE slug = 'y-combinator';

-- techstars-boulder
UPDATE programs SET
  heat_score          = 72,
  program_value_score = 78,
  brand_score         = 80,
  network_score       = 82,
  follow_on_rate_pct  = 72,
  tldr     = 'Techstars'' flagship program. $120K for 6% equity + 6% warrant. 13 weeks, ~10 companies.',
  pros     = ARRAY['High follow-on rate (70%+)','Mentor-driven model with real depth','Small cohort means real attention','Strong Boulder/Denver investor community'],
  cons     = ARRAY['6% common + 6% warrant = 12% total dilution','Boulder location not for everyone','Brand weaker outside tech circles'],
  best_for = 'B2B SaaS or enterprise founders comfortable with dilution for a dense mentor network.'
WHERE slug = 'techstars-boulder';

-- alchemist-accelerator
UPDATE programs SET
  heat_score          = 68,
  program_value_score = 74,
  brand_score         = 72,
  network_score       = 75,
  follow_on_rate_pct  = 65,
  tldr     = 'The enterprise B2B accelerator. $25K for 5% equity. Deep customer and sales network.',
  pros     = ARRAY['Best enterprise customer intro network in the market','B2B go-to-market focus is rare','Small cohorts mean real relationships','Respected brand among enterprise buyers'],
  cons     = ARRAY['Consumer companies get almost nothing here','Smaller check size','Less known outside enterprise circles'],
  best_for = 'B2B or enterprise founders who need Fortune 500 customer intros more than investor intros.'
WHERE slug = 'alchemist-accelerator';

-- 500-startups
UPDATE programs SET
  heat_score          = 62,
  program_value_score = 68,
  brand_score         = 70,
  network_score       = 65,
  follow_on_rate_pct  = 45,
  tldr     = 'Global accelerator, 30-company batches. $150K for 6% equity. Strong international reach.',
  pros     = ARRAY['Genuinely global network — not SF-centric','Good for international and emerging market founders','Strong marketing and demo day reach','Diverse portfolio across industries'],
  cons     = ARRAY['Brand has diluted vs peak years','Less mentor depth per founder than Techstars','Research current cohort quality carefully'],
  best_for = 'Founders targeting international markets or who want a global network without relocating to SF.'
WHERE slug = '500-startups';

-- a16z-start
UPDATE programs SET
  heat_score          = 82,
  program_value_score = 87,
  brand_score         = 92,
  network_score       = 88,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'a16z''s pre-seed program. Non-dilutive at entry, community access, and a direct path to a16z investment.',
  pros     = ARRAY['a16z brand is tier-1 by any measure','Non-dilutive at entry','Direct path to a16z investment','Deep operator and founder network'],
  cons     = ARRAY['Highly selective','No guaranteed investment','Less structured than traditional accelerators'],
  best_for = 'Pre-seed software, fintech, or crypto founders who want a16z on their side before raising.'
WHERE slug = 'a16z-start';

-- masschallenge
UPDATE programs SET
  heat_score          = 48,
  program_value_score = 58,
  brand_score         = 60,
  network_score       = 55,
  follow_on_rate_pct  = NULL,
  tldr     = 'Non-equity accelerator with $1M+ in total cash prizes. No dilution. 128-company cohorts.',
  pros     = ARRAY['Zero equity taken','Strong Boston and regional network','Diverse industries accepted','Good for regulated or grant-eligible sectors'],
  cons     = ARRAY['128-company cohorts — low signal-per-founder','Less investor focus than top accelerators','Brand is regional, not global'],
  best_for = 'Founders who need validation and network without dilution — especially life sciences, social impact, or regulated industries.'
WHERE slug = 'masschallenge';

-- google-for-startups
UPDATE programs SET
  heat_score          = 62,
  program_value_score = 70,
  brand_score         = 82,
  network_score       = 70,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'Google''s equity-free accelerator. $200K+ in Cloud credits, mentorship, and customer intros.',
  pros     = ARRAY['Non-dilutive — no equity taken','Google brand and network is massive','Cloud credits have real dollar value','AI/ML focus aligns with current market'],
  cons     = ARRAY['No cash — credits and support only','Large program, less personalized','Highly competitive to get into'],
  best_for = 'AI/ML, cloud-native, or developer tool startups that can leverage Google infrastructure.'
WHERE slug = 'google-for-startups';

-- first-round-capital
UPDATE programs SET
  heat_score          = 72,
  program_value_score = 78,
  brand_score         = 82,
  network_score       = 82,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'Tier-1 seed VC with deep founder community. Rolling applications. Known for hands-on support.',
  pros     = ARRAY['Extremely strong portfolio network','First Round Review signals real founder commitment','High brand credibility with downstream investors','Known for going deep with portfolio companies'],
  cons     = ARRAY['Low acceptance rate','Investment-first, not program-first','SF/NYC-centric'],
  best_for = 'Software and marketplace founders raising a seed round who want a brand-name lead investor.'
WHERE slug = 'first-round-capital';

-- nea-venture-studio
UPDATE programs SET
  heat_score          = 65,
  program_value_score = 72,
  brand_score         = 75,
  network_score       = 72,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'NEA''s studio arm. Co-creation model with resources and capital for pre-product founders.',
  pros     = ARRAY['Patient capital from a top-tier VC','Studio resources for pre-product stage','NEA portfolio network is substantial','Good for repeat founders wanting institutional backing early'],
  cons     = ARRAY['Highly selective','Studio model means significant equity expectations','Less transparent process than traditional programs'],
  best_for = 'Pre-product founders who want to co-build with an institutional partner from day zero.'
WHERE slug = 'nea-venture-studio';

-- precursor-ventures
UPDATE programs SET
  heat_score          = 52,
  program_value_score = 60,
  brand_score         = 60,
  network_score       = 58,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'Pre-seed VC focused on first checks before product exists. $200–$500K, founder-first.',
  pros     = ARRAY['Invests truly pre-product — rare','Check sizes right for idea-stage','Founder-first reputation in the community','Fast decisions'],
  cons     = ARRAY['Limited follow-on capital vs larger funds','Small team = limited bandwidth per company','Smaller brand than tier-1 VCs'],
  best_for = 'Pre-product founders who need a first check and genuine validation more than operational support.'
WHERE slug = 'precursor-ventures';

-- hustle-fund
UPDATE programs SET
  heat_score          = 45,
  program_value_score = 52,
  brand_score         = 52,
  network_score       = 48,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'Micro-VC writing fast, small checks at pre-seed. $25–$50K, decisions often in 2 weeks.',
  pros     = ARRAY['Extremely fast decisions — often under 2 weeks','Good for founders passed on elsewhere','Straightforward transparent process','Strong founder community'],
  cons     = ARRAY['Small check sizes','Limited network vs tier-1 VCs','Less brand value post-investment'],
  best_for = 'Founders who need a fast first check and aren''t yet fundable by larger VCs.'
WHERE slug = 'hustle-fund';

-- indie-vc
UPDATE programs SET
  heat_score          = 32,
  program_value_score = 42,
  brand_score         = 40,
  network_score       = 38,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'Bootstrapping-friendly fund. Revenue-based returns, no equity required at close.',
  pros     = ARRAY['Revenue-share model preserves founder ownership','Good for profitability-focused founders','No equity required upfront','Aligned with sustainable growth'],
  cons     = ARRAY['Revenue-share can be expensive if you scale fast','Model less understood by traditional VCs','Smaller community and network'],
  best_for = 'Revenue-focused founders who want growth capital without VC-style dilution or exit pressure.'
WHERE slug = 'indie-vc';

-- camelback-ventures
UPDATE programs SET
  heat_score          = 35,
  program_value_score = 48,
  brand_score         = 42,
  network_score       = 42,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'Accelerator for underrepresented founders in education and workforce. High-touch, small cohorts.',
  pros     = ARRAY['Specifically built for underrepresented founders','Unique ed/workforce sector focus','High-touch mentorship model','Genuine community, not just a program'],
  cons     = ARRAY['Narrow sector fit — education and workforce only','Smaller brand nationally','Limited follow-on capital'],
  best_for = 'Underrepresented founders building in education or workforce development who want a sector-specialist champion.'
WHERE slug = 'camelback-ventures';

-- visible-hands
UPDATE programs SET
  heat_score          = 38,
  program_value_score = 50,
  brand_score         = 48,
  network_score       = 46,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'Pre-seed accelerator for underrepresented founders. $100K for 3% equity. 12-week program.',
  pros     = ARRAY['Low dilution for an accelerator (3%)','Underrepresented founder focus','Good operator mentors','National — not geographically constrained'],
  cons     = ARRAY['Newer program — track record still building','Smaller network vs established accelerators','Less investor brand recognition'],
  best_for = 'Early-stage underrepresented founders who want a structured program with fair terms.'
WHERE slug = 'visible-hands';

-- capital-factory
UPDATE programs SET
  heat_score          = 42,
  program_value_score = 52,
  brand_score         = 55,
  network_score       = 52,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'Austin''s dominant startup accelerator and VC. Strong Texas ecosystem and defense tech network.',
  pros     = ARRAY['Dominant player in Texas startup scene','Good for defense tech and enterprise','Less competitive than coastal programs','Strong local investor syndicate'],
  cons     = ARRAY['Regional brand — limited national recognition','Large cohorts','Less pressure to grow fast'],
  best_for = 'Founders based in Texas or targeting enterprise and defense customers in the South.'
WHERE slug = 'capital-factory';

-- founders-coop
UPDATE programs SET
  heat_score          = 30,
  program_value_score = 40,
  brand_score         = 38,
  network_score       = 38,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'Pacific Northwest seed fund. Small checks, local focus, founder-friendly terms.',
  pros     = ARRAY['Strong PNW founder network','Founder-friendly approach','Less competitive than coastal VCs','Local champion for Seattle/Portland founders'],
  cons     = ARRAY['Very regional — limited national brand','Small check sizes','Limited follow-on capital'],
  best_for = 'Pacific Northwest-based founders at pre-seed who want a local champion and community.'
WHERE slug = 'founders-coop';

-- kapor-capital
UPDATE programs SET
  heat_score          = 45,
  program_value_score = 55,
  brand_score         = 58,
  network_score       = 52,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'Impact-focused seed VC. $500K–$2M checks with a strong DEI and social impact lens.',
  pros     = ARRAY['Genuine mission alignment for impact founders','Strong DEI-focused network','Meaningful check sizes ($500K–$2M)','Mitch and Freada Kapor are known champions'],
  cons     = ARRAY['Impact lens narrows fit significantly','Smaller fund than tier-1 VCs','SF-centric operations'],
  best_for = 'Impact founders in edtech, healthtech, or fintech targeting underserved markets.'
WHERE slug = 'kapor-capital';

-- overlooked-ventures
UPDATE programs SET
  heat_score          = 30,
  program_value_score = 42,
  brand_score         = 38,
  network_score       = 36,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'Micro-fund for underrepresented founders. First-check pre-seed, $25–$100K, fast and accessible.',
  pros     = ARRAY['Underrepresented founder focus','Very approachable and accessible team','Fast decisions','Good for founders overlooked by traditional VCs'],
  cons     = ARRAY['Very small check sizes','Limited follow-on and network','Newer fund — track record building'],
  best_for = 'Underrepresented founders who need a first check and a community that believes in them.'
WHERE slug = 'overlooked-ventures';

-- pear-vc
UPDATE programs SET
  heat_score          = 65,
  program_value_score = 72,
  brand_score         = 72,
  network_score       = 70,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'Stanford-connected pre-seed and seed VC. $1–3M first checks, strong technical founder focus.',
  pros     = ARRAY['Deep Stanford and Silicon Valley network','Technical founder friendly','Pear Match co-founder program is unique','Good follow-on capital available'],
  cons     = ARRAY['Very Stanford/SF-centric','Competitive to get into','Less known outside the Valley'],
  best_for = 'Technical founders in Silicon Valley or with Stanford connections building deep tech or B2B software.'
WHERE slug = 'pear-vc';

-- backstage-capital
UPDATE programs SET
  heat_score          = 42,
  program_value_score = 52,
  brand_score         = 55,
  network_score       = 48,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'VC fund for underrepresented founders. Arlan Hamilton''s platform opens doors beyond the check.',
  pros     = ARRAY['Strong community of underrepresented founders','Arlan''s public profile creates real visibility','Mission-aligned investors','Accessible team'],
  cons     = ARRAY['Smaller fund — limited follow-on','Slower deployment in recent years','Niche brand vs tier-1 VCs'],
  best_for = 'Underrepresented founders (women, POC, LGBTQ+) who want a public champion and community.'
WHERE slug = 'backstage-capital';

-- village-capital
UPDATE programs SET
  heat_score          = 38,
  program_value_score = 50,
  brand_score         = 48,
  network_score       = 46,
  follow_on_rate_pct  = NULL,
  tldr     = 'Accelerator with peer-selected investment model. Cohort votes on who gets funded at the end.',
  pros     = ARRAY['Peer-selection builds unusually strong cohort bonds','Global reach — programs on multiple continents','Good for social enterprise founders','Non-traditional path for non-traditional founders'],
  cons     = ARRAY['Peer-selection creates internal competition','Funding amounts are modest','Less known in traditional VC circles'],
  best_for = 'Social enterprise or impact founders comfortable with a peer-based selection model and global cohorts.'
WHERE slug = 'village-capital';

-- accenture-fintech-lab
UPDATE programs SET
  heat_score          = 45,
  program_value_score = 55,
  brand_score         = 65,
  network_score       = 58,
  follow_on_rate_pct  = NULL,
  tldr     = 'Accenture''s fintech accelerator. Non-dilutive. Direct access to top banks and financial institutions.',
  pros     = ARRAY['Direct intros to major bank and insurance partners','Non-dilutive program','Strong enterprise sales acceleration','Accenture brand adds credibility in financial services'],
  cons     = ARRAY['Very narrowly focused on fintech and insurtech','Not a path to VC investment','Enterprise sales cycles are slow'],
  best_for = 'B2B fintech founders who need bank and insurance partnerships more than investor intros.'
WHERE slug = 'accenture-fintech-lab';

-- mozilla-builders
UPDATE programs SET
  heat_score          = 35,
  program_value_score = 48,
  brand_score         = 50,
  network_score       = 42,
  follow_on_rate_pct  = NULL,
  tldr     = 'Mozilla''s startup program for privacy-focused and open-source products. $75K non-dilutive.',
  pros     = ARRAY['Non-dilutive grant','Mission alignment for privacy and open-source founders','Mozilla network in developer communities','Good credibility signal for technical audiences'],
  cons     = ARRAY['Must genuinely align with open internet values','Smaller check','Limited follow-on investment path'],
  best_for = 'Privacy, open-source, or browser-adjacent founders who align with Mozilla''s open internet mission.'
WHERE slug = 'mozilla-builders';

-- halcyon-incubator
UPDATE programs SET
  heat_score          = 30,
  program_value_score = 42,
  brand_score         = 38,
  network_score       = 38,
  follow_on_rate_pct  = NULL,
  tldr     = 'DC-based social impact incubator. 18-month residency with stipend, mentors, and co-working.',
  pros     = ARRAY['Long program gives real runway for complex problems','Strong DC policy and government network','Good for civic tech and social enterprise','Stipend covers living costs'],
  cons     = ARRAY['DC residency required','Not a traditional investment or VC path','Stipend-based, not equity investment'],
  best_for = 'Civic tech, social enterprise, or policy-adjacent founders based in or targeting Washington DC.'
WHERE slug = 'halcyon-incubator';

-- echoing-green
UPDATE programs SET
  heat_score          = 44,
  program_value_score = 58,
  brand_score         = 60,
  network_score       = 55,
  follow_on_rate_pct  = NULL,
  tldr     = 'Two-year fellowship for social entrepreneurs. $80K (individuals) or $90K (organizations). Global brand.',
  pros     = ARRAY['Prestigious global social enterprise brand','Lifelong fellowship community','Non-dilutive','Strong for policy and systems-change work'],
  cons     = ARRAY['Narrow social entrepreneur focus','Long application and evaluation process','Not a path to VC or commercial funding'],
  best_for = 'Social entrepreneurs working on systemic change, global development, or equity-focused ventures.'
WHERE slug = 'echoing-green';

-- nsf-sbir
UPDATE programs SET
  heat_score          = 55,
  program_value_score = 68,
  brand_score         = 65,
  network_score       = 40,
  follow_on_rate_pct  = NULL,
  tldr     = 'Federal R&D grant for science-based startups. Phase I up to $275K, non-dilutive. Prestigious signal.',
  pros     = ARRAY['Non-dilutive federal funding — no equity','Strong credibility signal with downstream investors','Phase II follows with $750K+','Good for deeptech, biotech, hardware, climate'],
  cons     = ARRAY['6–12 month decision timeline','R&D focus — not for pure software plays','Significant paperwork and compliance overhead'],
  best_for = 'Deeptech, biotech, hardware, or climate founders with defensible scientific IP and a long horizon.'
WHERE slug = 'nsf-sbir';

-- sbir-phase-1
UPDATE programs SET
  heat_score          = 42,
  program_value_score = 55,
  brand_score         = 58,
  network_score       = 35,
  follow_on_rate_pct  = NULL,
  tldr     = 'DOD/agency-backed Phase I SBIR. Up to $250K non-dilutive for early R&D with a government customer.',
  pros     = ARRAY['Non-dilutive government funding','Validates tech with a real government customer','Phase II path to $750K+','Strong signal for defense-adjacent investors'],
  cons     = ARRAY['Government procurement cycles are very slow','ITAR and compliance overhead is real','Not suitable for commercial-first businesses'],
  best_for = 'Defense-adjacent, dual-use, or government-focused deeptech founders with a clear agency problem.'
WHERE slug = 'sbir-phase-1';

-- doe-arpa-e
UPDATE programs SET
  heat_score          = 55,
  program_value_score = 65,
  brand_score         = 70,
  network_score       = 48,
  follow_on_rate_pct  = NULL,
  tldr     = 'DOE''s high-risk, high-reward energy technology program. $1–3M non-dilutive. Highly prestigious.',
  pros     = ARRAY['Massive credibility in energy and climate','Non-dilutive, large grants ($1–3M)','DOE lab resources and network access','Strong path to DOE loan programs and institutional climate investors'],
  cons     = ARRAY['Extremely competitive and slow','R&D focus only','Significant compliance and reporting overhead'],
  best_for = 'Deeptech or climate/energy founders with credible scientific IP and a long development horizon.'
WHERE slug = 'doe-arpa-e';

-- fast-forward
UPDATE programs SET
  heat_score          = 35,
  program_value_score = 48,
  brand_score         = 45,
  network_score       = 42,
  follow_on_rate_pct  = NULL,
  tldr     = 'Accelerator for tech nonprofits. $25K non-dilutive grant plus year-round support.',
  pros     = ARRAY['Non-dilutive','Strong nonprofit tech community','Year-round support, not just a cohort','Good for mission-driven software founders'],
  cons     = ARRAY['Nonprofit-only — not for for-profit founders','Small grant amount','Limited investor access'],
  best_for = 'Nonprofit tech founders building software for social impact.'
WHERE slug = 'fast-forward';

-- founder-catalyst
UPDATE programs SET
  heat_score          = 25,
  program_value_score = 38,
  brand_score         = 32,
  network_score       = 30,
  follow_on_rate_pct  = NULL,
  closes_at           = NULL,
  is_rolling          = TRUE,
  tldr     = 'Community-based accelerator for very early-stage founders. Light-touch structure, small cohorts.',
  pros     = ARRAY['Accessible for first-time founders','Community-focused model','Less competitive to enter','Good for founders who need accountability structure'],
  cons     = ARRAY['Limited brand recognition','Small network','Light-touch means less intensive support'],
  best_for = 'First-time founders who need structure and community more than capital or investor intros.'
WHERE slug = 'founder-catalyst';
