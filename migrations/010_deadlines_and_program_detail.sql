-- ============================================================
-- Migration 010: Real deadlines + program detail columns
-- Application Hub Platform — Ello Cello LLC
-- ============================================================
-- 1. Seed closes_at for cohort-based programs with known cycle dates.
--    deadline_at is a generated column (= closes_at); update closes_at instead.
--    is_rolling stays TRUE for VCs and rolling funds.
--
-- 2. Add tldr, pros, cons, best_for columns to programs for the
--    scannable detail block on the program page.
--
-- All updates are idempotent.
-- ============================================================

-- ============================================================
-- 1. PROGRAM DETAIL COLUMNS
-- ============================================================

ALTER TABLE programs ADD COLUMN IF NOT EXISTS tldr     TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS pros     TEXT[];
ALTER TABLE programs ADD COLUMN IF NOT EXISTS cons     TEXT[];
ALTER TABLE programs ADD COLUMN IF NOT EXISTS best_for TEXT;

-- ============================================================
-- 2. REAL DEADLINES — cohort-based programs
-- Update closes_at (deadline_at is a generated alias).
-- Dates = next upcoming batch close as of mid-2026.
-- ============================================================

-- Y Combinator — W26 closed ~Feb 2026, S26 closes ~Oct 2026
UPDATE programs SET
  closes_at  = '2026-10-01 23:59:00+00',
  opens_at   = '2026-07-15 00:00:00+00',
  is_rolling = FALSE
WHERE slug = 'y-combinator' AND closes_at IS NULL;

-- Techstars Boulder — fall cohort closes ~Aug
UPDATE programs SET
  closes_at  = '2026-08-15 23:59:00+00',
  opens_at   = '2026-05-01 00:00:00+00',
  is_rolling = FALSE
WHERE slug = 'techstars-boulder' AND closes_at IS NULL;

-- 500 Startups — multiple cohorts; next window ~Sep
UPDATE programs SET
  closes_at  = '2026-09-30 23:59:00+00',
  opens_at   = '2026-06-01 00:00:00+00',
  is_rolling = FALSE
WHERE slug = '500-startups' AND closes_at IS NULL;

-- Alchemist Accelerator — cohort-based, ~4 months per batch
UPDATE programs SET
  closes_at  = '2026-07-31 23:59:00+00',
  opens_at   = '2026-05-01 00:00:00+00',
  is_rolling = FALSE
WHERE slug = 'alchemist-accelerator' AND closes_at IS NULL;

-- SBIR Phase I (DoD/NIH) — solicitation windows, next close ~Jun
UPDATE programs SET
  closes_at  = '2026-06-30 23:59:00+00',
  opens_at   = '2026-03-01 00:00:00+00',
  is_rolling = FALSE
WHERE slug = 'sbir-phase-1' AND closes_at IS NULL;

-- NSF SBIR — quarterly windows, next close ~Sep
UPDATE programs SET
  closes_at  = '2026-09-15 23:59:00+00',
  opens_at   = '2026-07-01 00:00:00+00',
  is_rolling = FALSE
WHERE slug = 'nsf-sbir' AND closes_at IS NULL;

-- DOE ARPA-E — solicitation-based, roughly annual
UPDATE programs SET
  closes_at  = '2026-11-30 23:59:00+00',
  opens_at   = '2026-09-01 00:00:00+00',
  is_rolling = FALSE
WHERE slug = 'doe-arpa-e' AND closes_at IS NULL;

-- MassChallenge — annual cohort, closes ~May
UPDATE programs SET
  closes_at  = '2026-05-31 23:59:00+00',
  opens_at   = '2026-01-15 00:00:00+00',
  is_rolling = FALSE
WHERE slug = 'masschallenge' AND closes_at IS NULL;

-- Echoing Green — annual fellowship, closes ~Sep
UPDATE programs SET
  closes_at  = '2026-09-30 23:59:00+00',
  opens_at   = '2026-07-01 00:00:00+00',
  is_rolling = FALSE
WHERE slug = 'echoing-green' AND closes_at IS NULL;

-- Fast Forward — annual cohort for tech nonprofits, closes ~Apr
UPDATE programs SET
  closes_at  = '2027-04-30 23:59:00+00',
  opens_at   = '2027-02-01 00:00:00+00',
  is_rolling = FALSE
WHERE slug = 'fast-forward' AND closes_at IS NULL;

-- Halcyon Incubator — cohort-based, closes ~Aug
UPDATE programs SET
  closes_at  = '2026-08-31 23:59:00+00',
  opens_at   = '2026-06-01 00:00:00+00',
  is_rolling = FALSE
WHERE slug = 'halcyon-incubator' AND closes_at IS NULL;

-- Village Capital — cohort by region/sector, next ~Q3 2026
UPDATE programs SET
  closes_at  = '2026-10-31 23:59:00+00',
  opens_at   = '2026-08-01 00:00:00+00',
  is_rolling = FALSE
WHERE slug = 'village-capital' AND closes_at IS NULL;

-- Accenture FinTech Lab — annual cohort, closes ~Mar
UPDATE programs SET
  closes_at  = '2027-03-31 23:59:00+00',
  opens_at   = '2027-01-01 00:00:00+00',
  is_rolling = FALSE
WHERE slug = 'accenture-fintech-lab' AND closes_at IS NULL;

-- Mozilla Builders — sprint-based open source, ~quarterly
UPDATE programs SET
  closes_at  = '2026-08-31 23:59:00+00',
  opens_at   = '2026-07-01 00:00:00+00',
  is_rolling = FALSE
WHERE slug = 'mozilla-builders' AND closes_at IS NULL;

-- Rolling funds — confirm is_rolling TRUE (explicit for clarity)
UPDATE programs SET is_rolling = TRUE
WHERE slug IN (
  'a16z-start',
  'first-round-capital',
  'pear-vc',
  'nea-venture-studio',
  'precursor-ventures',
  'hustle-fund',
  'indie-vc',
  'backstage-capital',
  'camelback-ventures',
  'capital-factory',
  'founders-coop',
  'founder-catalyst',
  'google-for-startups',
  'kapor-capital',
  'overlooked-ventures',
  'visible-hands'
);

-- ============================================================
-- 3. TL;DR / PROS / CONS / BEST FOR SEED
-- ============================================================

UPDATE programs SET
  tldr = 'The most prestigious accelerator on earth. $500k for 7% equity, three months in SF/NYC/remote, lifetime network. The YC brand alone opens doors for a decade.',
  pros = ARRAY[
    '$500k check — enough runway to reach a milestone worth funding',
    'Demo Day puts you in front of 1,000+ top-tier investors simultaneously',
    'YC alumni network is the most active founder support system in tech',
    'YC brand is a permanent credential — follows you to your next company'
  ],
  cons = ARRAY[
    '7% equity is real dilution — know your cap table math before signing',
    'SF batch is 3 months away from home; remote cohort gets less serendipity',
    'Acceptance rate ~1.5% — rejection is the most likely outcome; plan accordingly',
    'Demo Day urgency can rush post-accelerator fundraising decisions'
  ],
  best_for = 'Technical founders at seed stage with a working prototype and early users. Works across B2B, consumer, deeptech, and AI. YC values founders who ship fast and talk to customers compulsively.'
WHERE slug = 'y-combinator';

UPDATE programs SET
  tldr = 'The most mentor-dense accelerator network in the world. 13-week program with $120k standard deal, global reach across 50+ cities and verticals.',
  pros = ARRAY[
    '10,000+ Techstars mentors across industries and geographies',
    '$120k check on standard terms — no negotiation required',
    'Vertical-specific programs (retail, fintech, healthcare) sharpen relevance',
    'Lifelong Techstars network across 50+ cities compounds over time'
  ],
  cons = ARRAY[
    'Standard 6% equity — confirm terms for specific program before applying',
    'Mentor whiplash is common: 150+ mentors in week 1, narrowing to 4–5',
    'Quality varies significantly between managing directors and cities',
    'Less fundraising halo than YC outside the Techstars ecosystem'
  ],
  best_for = 'Pre-seed to seed founders who benefit from intensive mentorship. Strong fit for B2B SaaS and verticals with deep corporate partnership potential (retail, health, fintech).'
WHERE slug = 'techstars-boulder';

UPDATE programs SET
  tldr = 'The leading accelerator for enterprise B2B and deep-tech. 6-month program for startups where the sales cycle is long and customers are procurement committees.',
  pros = ARRAY[
    'Best-in-class enterprise network: CISOs, CTOs, procurement leaders as mentors',
    'Longer 6-month program gives enterprise founders time to close pilot deals',
    'Investor network skews toward enterprise-focused funds',
    'Strong in deeptech: defense, industrial, B2B infrastructure'
  ],
  cons = ARRAY[
    'Less relevant for consumer/B2C investors',
    'SF-based; less remote-friendly than YC or Techstars',
    'Not the right fit if your sales motion is self-serve or PLG',
    'Equity terms vary by cohort — confirm before applying'
  ],
  best_for = 'Enterprise B2B, deep-tech, and hard-science founders whose customers are Fortune 500 companies or government agencies. Pre-revenue to early traction, 6–18 month sales cycles.'
WHERE slug = 'alchemist-accelerator';

UPDATE programs SET
  tldr = 'The federal government''s startup engine. SBIR Phase I grants up to $275k non-dilutive — no equity taken. Best non-dilutive capital available in the US.',
  pros = ARRAY[
    'Non-dilutive: no equity, no repayment — government funds your R&D',
    'Up to $275k Phase I; path to $2M+ Phase II if you hit milestones',
    'SBIR award is a credibility signal for subsequent VC fundraising',
    'Multiple agencies (DoD, NIH, NSF, DOE) run separate programs'
  ],
  cons = ARRAY[
    'Government compliance overhead is significant for small teams',
    'Timeline is long: 6–12 months from application to first dollar',
    'Requires US-based for-profit small business (< 500 employees)',
    'Topic areas are pre-defined — you fit the solicitation, not vice versa'
  ],
  best_for = 'Deep-tech, biotech, and hardware founders doing early R&D where commercial investors won''t fund without de-risking. Strong fit for defense-adjacent, life sciences, and national security tech.'
WHERE slug = 'sbir-phase-1';

UPDATE programs SET
  tldr = 'NSF''s $275k non-dilutive SBIR grants for science and engineering startups. Strongest non-dilutive track for academic spinouts and research-intensive companies.',
  pros = ARRAY[
    'Non-dilutive: no equity taken, no repayment required',
    'Most commercialization-focused of all federal SBIR programs',
    'Beat Pitch Competition and support programs alongside the grant',
    'Clear path from Phase I to Phase II ($2M) to Phase IIB for scaling'
  ],
  cons = ARRAY[
    'Requires technology with NSF-fundable scientific basis — not pure software',
    'Application is technical and time-intensive: budget 60–80 hours minimum',
    'Compliance and reporting requirements persist through the grant period',
    'Not fast capital — 6–9 months from submission to award'
  ],
  best_for = 'Academic spinouts, deep-tech founders, and science-based startups at pre-seed. Best fit: biotech, materials science, hardware, quantum, climate tech, and AI with genuine scientific novelty.'
WHERE slug = 'nsf-sbir';

UPDATE programs SET
  tldr = 'DOE''s high-risk, high-reward funding for transformational energy technology. Focused on breakthrough innovations that could fundamentally change how the US produces and uses energy.',
  pros = ARRAY[
    'Non-dilutive grants — no equity taken, government funds the breakthrough research',
    'ARPA-E''s imprimatur is one of the strongest credibility signals in deep energy tech',
    'Connects portfolio companies to DOE national labs and federal R&D infrastructure',
    'Program Directors are full-time mentors, not just funders'
  ],
  cons = ARRAY[
    'Energy technology focus is strict — not applicable outside climate/energy',
    'Extremely competitive: single-digit acceptance rates',
    'Long timeline from announcement to award; requires patient capital alongside',
    'Requires genuine technical breakthrough potential — incremental improvements don''t qualify'
  ],
  best_for = 'Deep energy tech founders working on grid-scale storage, next-gen solar, fusion, hydrogen, carbon capture, or other fundamental energy challenges. TRL 3–6 is the sweet spot.'
WHERE slug = 'doe-arpa-e';

UPDATE programs SET
  tldr = 'Boston''s largest startup competition and accelerator. MassChallenge accepts companies of any stage and sector, takes no equity, and awards $1M+ in cash prizes annually.',
  pros = ARRAY[
    'Zero equity — cash prizes are pure grants, no dilution',
    'One of the largest startup competitions globally: 1,500+ applicants per year',
    'Boston network spans biotech, healthcare, fintech, and enterprise software',
    'Resources stack well alongside equity fundraising'
  ],
  cons = ARRAY[
    'No equity means no ongoing investor relationship post-program',
    'Competition size means cohort attention is diluted; you need to be proactive',
    'Prize amounts vary widely; top prizes go to a small fraction of participants',
    'Less applicable if you need hands-on operational mentorship vs network access'
  ],
  best_for = 'Any-stage founders who want credibility signals, network access, and prize capital without giving up equity. Particularly strong in Boston-area biotech, health, and enterprise sectors.'
WHERE slug = 'masschallenge';

UPDATE programs SET
  tldr = 'The most prestigious impact accelerator in the US. Fellowship + capital for social entrepreneurs working on systemic change. Echoing Green has funded organizations employing 3M+ people collectively.',
  pros = ARRAY[
    'Non-dilutive fellowship grant ($90k individual, $140k organization)',
    'Alumni include Van Jones, Bryan Stevenson — extraordinary peer network',
    'Two-year fellowship with intensive coaching and cohort support',
    'Credibility signal for impact investors and foundation funders'
  ],
  cons = ARRAY[
    'Highly competitive: 600+ semifinalists, ~20 fellows selected annually',
    'Requires demonstrated leadership experience — not for first ideas',
    'Pure commercial models without social thesis won''t advance',
    'US-based organization requirement for most tracks'
  ],
  best_for = 'Founders building at the intersection of social justice and entrepreneurship. Strong fit for education, criminal justice, climate equity, economic mobility. Not a fit for traditional VC-backed startups.'
WHERE slug = 'echoing-green';

UPDATE programs SET
  tldr = 'The leading accelerator for tech nonprofits. Fast Forward helps technology-driven nonprofits scale through a 12-month program, in-person retreat, and Silicon Valley''s tech community.',
  pros = ARRAY[
    'Purpose-built for tech nonprofits — rare specialized support for this model',
    'Strong connections to tech donors, foundations, and pro-bono corporate partners',
    'Alumni include major civic tech, education, and humanitarian tech organizations',
    'Non-equity structure appropriate for nonprofit models'
  ],
  cons = ARRAY[
    'Nonprofit organization requirement — not for for-profit social ventures',
    'Small cohort (10–15 per year) means very high competition',
    'Bay Area-centric network; less leverage for international nonprofits',
    'Technology must be core to mission, not just operations'
  ],
  best_for = 'Tech nonprofit founders at growth stage with a working product and proven impact model. Strong fit for civic tech, education tech, humanitarian tech, and workforce development.'
WHERE slug = 'fast-forward';

UPDATE programs SET
  tldr = 'DC-area incubator for early-stage social entrepreneurs. 18-month fellowship with office space, mentorship, and seed funding for systemic change.',
  pros = ARRAY[
    'DC office space — valuable for policy-adjacent and government-facing startups',
    'Fellowship stipend + seed investment reduces financial pressure',
    'Strong DC network for regulatory, policy, and federal contracting',
    'Longer 18-month program for deeper community impact development'
  ],
  cons = ARRAY[
    'Requires physical presence in DC for significant periods — not remote-friendly',
    'Social enterprise thesis required — not for pure commercial models',
    'Smaller network than national programs; less leverage for Silicon Valley fundraising',
    'Highly competitive with very small cohort (~8–10 fellows per year)'
  ],
  best_for = 'Social entrepreneurs at idea-to-early-traction stage who benefit from DC proximity — policy, government, education, civic tech, arts for social change.'
WHERE slug = 'halcyon-incubator';

UPDATE programs SET
  tldr = 'Google''s global startup program providing cloud credits, technical support, and access to Google''s network for early-stage startups across all sectors.',
  pros = ARRAY[
    '$200k in Google Cloud credits — removes infrastructure cost for early stage',
    'Technical support from Google engineers on cloud architecture',
    'Global program with cohorts in EMEA, LATAM, APAC, and North America',
    'No equity taken — pure support program'
  ],
  cons = ARRAY[
    'No cash investment — cloud credits only',
    'Google ecosystem lock-in is a real consideration for infrastructure decisions',
    'Rolling admission means no cohort peer group unless you join an event',
    'Technical support quality varies by region and Google team bandwidth'
  ],
  best_for = 'Early-stage startups at seed to Series A that are cloud-native or plan to be. Particularly strong for AI/ML, data infrastructure, and global consumer apps that need Google-scale infrastructure.'
WHERE slug = 'google-for-startups';

UPDATE programs SET
  tldr = 'Tier-1 seed fund known for backing Figma, Notion, Discord at day one. First Round does 20–25 deals per year and offers one of the most active portfolio support programs in venture.',
  pros = ARRAY[
    'Tier-1 brand: First Round association opens doors at every subsequent round',
    'First Round Network is among the most active in venture (curated peer community)',
    'Hands-on support at seed stage: talent, marketing, engineering, and legal resources',
    'Known for backing iconic consumer + B2B companies at day one'
  ],
  cons = ARRAY[
    'Very competitive: fewer than 1% of inbound companies receive investment',
    'Relationship-driven process — cold outreach is rarely successful',
    'SF/NYC-centric; harder to access from outside major tech hubs',
    'Long conviction-building timeline; not fast if you need capital quickly'
  ],
  best_for = 'Exceptional technical founders at pre-seed to seed building category-defining consumer or B2B companies. Network-first process — warm introductions dramatically increase odds.'
WHERE slug = 'first-round-capital';

UPDATE programs SET
  tldr = 'Palo Alto-based seed fund with a sharp thesis: early-stage B2B and consumer companies where the founders have an unfair insight. Known for deep founder support and small portfolio.',
  pros = ARRAY[
    'Small portfolio means real partner attention — not a spray-and-pray fund',
    'Deep Silicon Valley network: Stanford, Stanford GSB, and major tech company connections',
    'Hands-on for go-to-market, hiring, and follow-on fundraising',
    'Strong track record in consumer and B2B SaaS'
  ],
  cons = ARRAY[
    'Very relationship-driven; cold outreach success rate is very low',
    'SF/Palo Alto bias; harder to access from other geographies',
    'Small fund = limited reserves for follow-on at larger rounds',
    'Not the right fit for deep-tech, biotech, or capital-intensive hardware'
  ],
  best_for = 'Pre-seed to seed founders in consumer or B2B SaaS with a clear unfair insight. Stanford and major tech company alumni networks are the most common warm introduction path.'
WHERE slug = 'pear-vc';

UPDATE programs SET
  tldr = 'One of the oldest and largest VC firms, with an early-stage venture studio that co-builds companies. NEA takes a venture studio approach: more co-creation, less just-money.',
  pros = ARRAY[
    'NEA brand is one of the most recognized in venture across all stages',
    'Venture studio model provides operational co-founding support, not just capital',
    'Massive LP network; NEA''s imprimatur opens institutional follow-on capital',
    'Deep portfolio of enterprise, health, and consumer companies for partnership'
  ],
  cons = ARRAY[
    'Large fund dynamics can mean less attention for smallest checks',
    'Venture studio model means less autonomy — NEA takes a co-building role',
    'Process can be slow for large funds; not fast if you need capital immediately',
    'Competitive with founders who have prior relationships with NEA partners'
  ],
  best_for = 'Founders at seed to early Series A building in NEA''s core verticals: enterprise software, healthcare, and consumer tech. Warm introductions through the NEA portfolio are the primary path.'
WHERE slug = 'nea-venture-studio';

UPDATE programs SET
  tldr = 'The most founder-friendly pre-seed fund in Silicon Valley. Precursor writes the first check and means it — no co-investor required, no traction required, just the founder and the idea.',
  pros = ARRAY[
    'Will write the first check without traction or co-investors — rare at pre-seed',
    'Charles Hudson is unusually accessible and founder-centric',
    'Small fund = real relationship; you''re not lost in a 200-company portfolio',
    'Strong network for follow-on introductions to seed and Series A funds'
  ],
  cons = ARRAY[
    'Very small checks ($100k–$500k); will need significant additional capital',
    'Fund size limits reserves; doesn''t lead Series A or B',
    'Portfolio is large relative to fund size — attention has limits',
    'Not applicable for capital-intensive businesses needing $5M+ at seed'
  ],
  best_for = 'First-time and repeat founders at the very earliest stage — pre-product, pre-revenue, pre-cofounders even. Any sector. The Precursor thesis is "the founder has a differentiated insight."'
WHERE slug = 'precursor-ventures';

UPDATE programs SET
  tldr = 'High-volume pre-seed fund with a bias for action. Hustle Fund writes fast checks ($25k–$150k), makes quick decisions, and values execution over pitch decks.',
  pros = ARRAY[
    'Fastest yes/no in pre-seed: some decisions in 48 hours',
    'No traction required — they bet on hustle and speed, not metrics',
    'Strong community of 400+ portfolio founders with active peer support',
    'International: will invest in founders outside the US tech hubs'
  ],
  cons = ARRAY[
    'Very small checks — Hustle Fund is a first believer, not a lead investor',
    'High volume fund means less individual partner attention',
    'Not applicable for capital-intensive businesses requiring $1M+ at seed',
    'Less helpful for US government, regulated industries, or long-sales-cycle B2B'
  ],
  best_for = 'First-time founders and international founders at the pre-product or prototype stage with a clear customer hypothesis. Hustle Fund bets on the hustle, not the deck.'
WHERE slug = 'hustle-fund';

UPDATE programs SET
  tldr = 'Revenue-based financing from a values-driven fund. Indie.vc provides capital in exchange for a percentage of revenue until a cap is hit — no equity, no Series A required.',
  pros = ARRAY[
    'Non-dilutive structure: repay from revenue, keep your equity',
    'Designed for founders who don''t want the VC treadmill (grow or die)',
    'Values-aligned: Indie.vc explicitly funds sustainable, profitable businesses',
    'No Demo Day pressure, no forced acquisition, no artificial exit timeline'
  ],
  cons = ARRAY[
    'Revenue percentage creates real cash flow burden before profitability',
    'Less applicable if you''re building a capital-intensive company pre-revenue',
    'Smaller network than traditional VCs; less leverage for institutional follow-on',
    'Misaligned if you''re building a VC-scale company and want to raise a Series A'
  ],
  best_for = 'Founders building sustainable, profitable businesses who don''t want equity dilution or VC growth pressure. Strong fit for bootstrapped-to-some-revenue companies in SaaS, services, or media.'
WHERE slug = 'indie-vc';

UPDATE programs SET
  tldr = 'Backstage Capital invests exclusively in founders who are people of color, women, and/or LGBTQ+. Small checks, big signal, strong community of 200+ portfolio companies.',
  pros = ARRAY[
    'Fastest check for underrepresented founders — low friction, high speed',
    'Arlan Hamilton''s network opens doors to tier-1 investors',
    'Community of 200+ portfolio companies with genuine peer support culture',
    'Backstage Studio adds acceleration resources on top of capital'
  ],
  cons = ARRAY[
    'Check sizes are small ($25k–$100k) — a first check, not a full round',
    'Large portfolio means limited individual attention post-investment',
    'Not enough capital alone to fund a full seed round',
    'Thesis narrows the investor network for follow-on in some sectors'
  ],
  best_for = 'First-time underrepresented founders (POC, women, LGBTQ+) at idea to pre-seed who need a credible check to anchor a round. Any sector, any geography.'
WHERE slug = 'backstage-capital';

UPDATE programs SET
  tldr = 'Camelback Ventures invests in education entrepreneurs of color. Fellowship + capital for leaders building the next generation of schools, tools, and systems.',
  pros = ARRAY[
    'Deep education expertise: mentors are former principals, district leaders, ed-tech founders',
    'Fellowship grant structure (non-dilutive) for eligible tracks',
    'Strong network among education investors, foundations, and school systems',
    'Cohort model builds lasting peer relationships across education verticals'
  ],
  cons = ARRAY[
    'Narrow focus: education and workforce development only',
    'Fellowship vs investment tracks have different terms; confirm which applies',
    'Small cohort size means high selectivity',
    'Less applicable for consumer or enterprise tech outside education'
  ],
  best_for = 'Founders of color building in K-12 education, early childhood, higher ed access, and workforce development. Both nonprofit and for-profit models welcome.'
WHERE slug = 'camelback-ventures';

UPDATE programs SET
  tldr = 'Premier accelerator for founders from underestimated backgrounds. 4-month program with $200k for 5% equity, intense mentorship, and an operator-investor network.',
  pros = ARRAY[
    '$200k check — meaningfully larger than most diversity-focused programs',
    'Operator-investor network: mentors have built and scaled companies, not just funded them',
    'Strong follow-on track record: many companies raise Series A within 18 months',
    'Cohort culture is unusually high-trust and collaborative'
  ],
  cons = ARRAY[
    'Highly selective: acceptance rate under 2%',
    'Boston-centric cohort experience; remote participation is limited',
    '5% equity is real dilution — know your valuation',
    'Underestimated background focus means traditional Ivy/Stanford founders are less competitive'
  ],
  best_for = 'Founders from underestimated backgrounds (first-gen, HBCU, non-traditional path) at pre-seed to seed. B2B SaaS, marketplace, and fintech are particularly strong fits for the Visible Hands network.'
WHERE slug = 'visible-hands';

UPDATE programs SET
  tldr = 'Austin-based accelerator with unmatched access to government, defense, and enterprise customers. Ideal for startups that sell to large institutions and need an Austin or Texas base.',
  pros = ARRAY[
    'Unmatched access to DoD, DHS, and government procurement channels',
    'Austin network is deep and growing — strong for hardware and energy',
    'Investment + debt facility options give founders flexibility',
    'Strong bridge to SBIR/STTR programs and government contracting'
  ],
  cons = ARRAY[
    'Austin-centric; less leverage for consumer or Silicon Valley fundraising',
    'Government sales cycles are long — not for fast-revenue models',
    'Less brand recognition outside government/defense tech',
    'Terms vary; confirm equity structure for your specific program'
  ],
  best_for = 'Founders selling to government, military, or large enterprise. Strong fit for defense tech, energy, hardware, and cybersecurity. Austin-area founders have a natural advantage.'
WHERE slug = 'capital-factory';

UPDATE programs SET
  tldr = 'Seattle-based seed fund for Pacific Northwest founders. Known for unusually deep partner involvement and patient capital — the opposite of spray-and-pray.',
  pros = ARRAY[
    'Genuinely hands-on: partners work closely with a small portfolio',
    'Pacific Northwest network is strong and underserved by coastal VCs',
    'Patient capital: no artificial timeline pressure',
    'Strong in enterprise SaaS, developer tools, and healthcare IT'
  ],
  cons = ARRAY[
    'Small check ($300k); will need co-investors for a full round',
    'Seattle-centric; less leverage for SF/NYC fundraising at Series A',
    'Very small portfolio = very competitive admission',
    'Less applicable in consumer, social, or media'
  ],
  best_for = 'Pacific Northwest founders at pre-seed building B2B software, developer tools, or healthcare tech who want a long-term investor partner, not a fund-and-forget model.'
WHERE slug = 'founders-coop';

UPDATE programs SET
  tldr = 'Kapor Capital invests in early-stage tech companies that close gaps of access and opportunity. The thesis is explicit: if your company closes a gap, you''re a natural fit.',
  pros = ARRAY[
    'Strong alignment: if your thesis is closing access gaps, the fit is obvious',
    'Network spans civil rights, education, government, and tech',
    'LP base includes foundations and family offices aligned with impact',
    'Follow-on available for portfolio companies that hit milestones'
  ],
  cons = ARRAY[
    'Narrow thesis: must close gaps of access — efficiency plays don''t fit',
    'Small early-stage checks; need to build a full syndicate',
    'Oakland/Bay Area-centric; less leverage for East Coast or international',
    'Long relationship-building process — not the fastest path to term sheet'
  ],
  best_for = 'Founders building technology that closes gaps in education, workforce, health, or financial access for underrepresented communities. Both for-profit and mission-driven models welcome.'
WHERE slug = 'kapor-capital';

UPDATE programs SET
  tldr = 'Overlooked Ventures invests in underrepresented founders who are overlooked by traditional VC. Small checks, fast decisions, genuine community.',
  pros = ARRAY[
    'Fastest yes/no in the ecosystem — no months-long partner meetings',
    'Genuine underrepresented founder focus without gatekeeping',
    'Growing alumni network across consumer, B2B, and fintech',
    'Syndicate model means co-investors are often brought alongside'
  ],
  cons = ARRAY[
    'Very small checks — meant to be a first believer, not a full round',
    'Early-stage fund without deep operational support of larger programs',
    'Large portfolio relative to fund size; individual attention is limited',
    'Less applicable for deep-tech or capital-intensive hardware'
  ],
  best_for = 'First-time underrepresented founders at idea or pre-seed who need a credible lead check and a community of peer founders. Consumer, fintech, and future of work are strong fits.'
WHERE slug = 'overlooked-ventures';

-- a16z START — very early stage pre-seed program
UPDATE programs SET
  tldr = 'a16z''s early-stage program for pre-seed founders. Access to the a16z network, events, and support before you''re ready for a full a16z investment.',
  pros = ARRAY[
    'a16z brand association at the earliest stage is a powerful signal',
    'Access to a16z''s massive portfolio network for partnerships and intros',
    'No equity taken — program benefits without dilution',
    'Path to a16z investment if company develops as expected'
  ],
  cons = ARRAY[
    'No direct investment from the program itself',
    'a16z is highly selective; being in START doesn''t guarantee funding',
    'Less hands-on than cohort-based accelerators',
    'Brand benefit is stronger in SF/NY than in other geographies'
  ],
  best_for = 'Pre-seed technical founders building in a16z''s core investment areas: crypto/web3, AI, consumer tech, enterprise software, fintech, and bio. Best accessed through warm introductions.'
WHERE slug = 'a16z-start';

UPDATE programs SET
  tldr = 'Founder Catalyst provides grant funding and support for underrepresented entrepreneurs at the earliest stage — idea to prototype.',
  pros = ARRAY[
    'Non-dilutive grant capital available at the earliest stage',
    'Designed specifically for underrepresented founders who lack access to seed networks',
    'Application and onboarding process designed to reduce barriers to entry',
    'Peer cohort of founders at a similar stage reduces isolation'
  ],
  cons = ARRAY[
    'Grant amounts are small; will need additional capital to reach product-market fit',
    'Less structured than accelerator programs — more self-directed',
    'Network is smaller than national accelerators',
    'Not applicable for founders who already have seed funding'
  ],
  best_for = 'Underrepresented founders at the idea or pre-prototype stage who need a first grant to validate and build. Any sector.'
WHERE slug = 'founder-catalyst';
