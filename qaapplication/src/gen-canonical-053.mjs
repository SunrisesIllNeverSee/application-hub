// gen-canonical-053.mjs — emits supabase/migrations/053_canonical_promotion.sql
// Source: verbatim question sets transcribed from the QA archive
// (07-apply/<slug>.md, 05-questions/source/<slug>.md, raw captures under
// 07-apply/_shared/raw/). Owner-approved records only (m08:c1–c5).
// No FundingCake. No synthetic seed content. No answers — questions only.
//
// Run: node qaapplication/src/gen-canonical-053.mjs > supabase/migrations/053_canonical_promotion.sql

const PROGRAMS = [
  {
    slug: 'yc-summer-2026',
    kind: 'accelerator',
    name: 'Y Combinator — Summer 2026',
    organization: 'Y Combinator',
    type: 'accel', status: 'closed', isRolling: false,
    url: 'https://www.ycombinator.com/',
    description: 'Y Combinator Summer 2026 batch application (custom apply portal). Canonical record derived from the submitted application evidence in qaapplication/ (raw form DOM + portal export).',
    geo: ['Global'], tags: ['startups', 'pre-seed'],
    questions: [
      // [asked_as, section, required, response_type]
      ['Company / project name', 'Founder & company basics', true, 'text_short'],
      ['What batch do you want to apply for?', 'Founder & company basics', true, 'multiple_choice'],
      ['Are you looking for a cofounder?', 'Founder & company basics', true, 'yes_no'],
      ['Cofounder info', 'Founder & company basics', false, 'text_long'],
      ['Other co-founders / team', 'Founder & company basics', false, 'text_long'],
      ['Who writes code, or does other technical work on your product? Was any of it done by a non-founder? Please explain.', 'Founder & company basics', true, 'text_long'],
      ['Describe what your company does in 50 characters or less.', 'Product', true, 'text_short'],
      ['What is your company going to make? Please describe your product and what it does or will do.', 'Product', true, 'text_long'],
      ['What tech stack are you using, or planning to use, to build this product? Include AI models and AI coding tools you use.', 'Product', true, 'text_long'],
      ['Please provide a link to the product, if any.', 'Product', false, 'url'],
      ['If login credentials are required for the link above, enter them here.', 'Product', false, 'text_short'],
      ['Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you\'re making?', 'Idea', true, 'text_long'],
      ['If you are applying with the same idea as a previous batch, did anything change? If you applied with a different idea, why did you pivot and what did you learn from the last idea?', 'Idea', false, 'text_long'],
      ['How far along are you?', 'Progress', true, 'text_long'],
      ['How long have each of you been working on this? How much of that has been full-time? Please explain.', 'Progress', true, 'text_long'],
      ['Have you formed ANY legal entity yet?', 'Progress', true, 'yes_no'],
      ['Are people using your product?', 'Progress', true, 'yes_no'],
      ['Do you have revenue?', 'Progress', true, 'yes_no'],
      ['Worked together before?', 'Progress', true, 'yes_no'],
      ['How do or will you make money? How much could you make?', 'Money', true, 'text_long'],
      ['Have you taken any investment yet?', 'Money', true, 'yes_no'],
      ['Are you currently fundraising?', 'Money', true, 'yes_no'],
      ['Other ideas considered?', 'Idea', false, 'text_long'],
      ['Who are your competitors? What do you understand about your business that they don\'t?', 'Competition', true, 'text_long'],
      ['Where do you live now, and where would the company be based after YC?', 'Location', true, 'text_short'],
      ['Explain your decision regarding location.', 'Location', true, 'text_long'],
      ['How did you hear about Y Combinator?', 'YC fit', true, 'text_long'],
      ['What convinced you to apply to Y Combinator? Did someone encourage you to apply? Have you been to any YC events?', 'YC fit', true, 'text_long'],
      ['Please record a one minute video introducing the founder(s).', 'Video & demo', true, 'file_upload'],
      ['If you have a demo, attach it below.', 'Video & demo', false, 'file_upload'],
    ],
  },
  {
    slug: 'founding-500',
    kind: 'accelerator',
    name: 'The Founding 500',
    organization: 'Hyperagent',
    type: 'accel', status: 'open', isRolling: true,
    url: 'https://hyperagent.com/',
    description: 'Hyperagent-operated cohort program for agent-first founders (Airtable form). Canonical record derived from raw form DOM + submitted answers in qaapplication/.',
    geo: ['US', 'Global'], tags: ['agents', 'pre-seed', 'cohort'],
    questions: [
      ['Full name', 'Applicant', true, 'text_short'],
      ['Your title', 'Applicant', true, 'text_short'],
      ['LinkedIn URL', 'Applicant', true, 'url'],
      ['Company or project name', 'Company', true, 'text_short'],
      ['Company website', 'Company', true, 'url'],
      ['Team size', 'Company', true, 'number'],
      ['Company stage', 'Company', true, 'multiple_choice'],
      ['Which best describes you?', 'Company', true, 'multiple_choice'],
      ['What does agent-first look like for your business in 12 months?', 'Vision', true, 'text_long'],
      ['What have you built with agents in the last 6 months?', 'Traction', true, 'text_long'],
      ['Walk us through what you\'re showing', 'Demo', true, 'file_upload'],
      ['Why you\'re the right person to build this', 'Founder', true, 'text_long'],
    ],
  },
  {
    slug: 'redbud-vc',
    kind: 'vc',
    name: 'Redbud VC — Pitch Us',
    organization: 'Redbud VC',
    type: 'vc', status: 'open', isRolling: true,
    url: 'https://redbud.vc',
    description: 'Redbud VC "Pitch Us" intake (Tally). Canonical record derived from raw Tally DOM + submitted answers in qaapplication/. Q27–Q30 are asset/attribution fields.',
    geo: ['US'], tags: ['pre-seed', 'seed', 'middle-america'],
    questions: [
      ['First Name', 'Founder', true, 'text_short'],
      ['Last Name', 'Founder', true, 'text_short'],
      ['Email', 'Founder', true, 'text_short'],
      ['Your LinkedIn', 'Founder', true, 'url'],
      ['Where is home base? (State)', 'Founder', true, 'text_short'],
      ['Company Name', 'Company', true, 'text_short'],
      ['Website', 'Company', false, 'url'],
      ['Industry', 'Company', true, 'text_short'],
      ['# of Founders', 'Company', true, 'number'],
      ['Number of companies founded prior', 'Company', true, 'number'],
      ['Someone technical on the team?', 'Team', true, 'yes_no'],
      ['Co-founder profile links', 'Team', false, 'url'],
      ['How long have you known your co-founders, and how did you meet?', 'Team', true, 'text_long'],
      ['Idea/company elevator pitch (1-2 sentences)', 'Idea', true, 'text_short'],
      ['Product phase', 'Product', true, 'multiple_choice'],
      ['How long have you been tinkering with/working on your idea?', 'Idea', true, 'text_short'],
      ['Why you/your team?', 'Team', true, 'text_long'],
      ['Traction', 'Traction', true, 'text_long'],
      ['Ideal customer profile / what you\'ve learned from talking to them', 'Market', true, 'text_long'],
      ['Who are your main competitors, and what do you know they don\'t?', 'Competition', true, 'text_long'],
      ['Revenue opportunity and how does the opportunity expand with your vision?', 'Market', true, 'text_long'],
      ['Have you raised capital for your current company?', 'Funding', true, 'yes_no'],
      ['Have you raised venture capital before?', 'Funding', true, 'yes_no'],
      ['How much capital have you raised, and any significant investors?', 'Funding', true, 'text_long'],
      ['Deck or One Pager (file upload)', 'Materials', true, 'file_upload'],
      ['Deck link', 'Materials', false, 'url'],
      ['How did you find us?', 'Attribution', false, 'text_short'],
      ['Who referred you?', 'Attribution', false, 'text_short'],
    ],
  },
  {
    slug: 'cyberfund-monastery',
    kind: 'fellowship',
    name: 'cyber.fund — The Monastery',
    organization: 'cyber.fund',
    type: 'fellowship', status: 'open', isRolling: true,
    url: 'https://cyber.fund/content/monastery',
    description: 'cyber.fund Monastery residency for AI-native founders ($2M uncapped SAFE, 12 weeks hybrid). Conversational application via proprietary agent; canonical record derived from the verbatim interaction transcript.',
    geo: ['Global'], tags: ['ai-native', 'fellowship', 'residency'],
    questions: [
      ['What is your name? If you have co-founders, please include their names too.', 'Intake', true, 'text_short'],
      ['What\'s your email address?', 'Intake', true, 'text_short'],
      ['What\'s your LinkedIn profile URL?', 'Intake', true, 'url'],
      ['What\'s your X (Twitter) handle?', 'Intake', false, 'text_short'],
      ['Do you have a GitHub profile? If so, what\'s the URL?', 'Intake', false, 'url'],
      ['It looks like you\'re flying solo — but if you do have co-founders, how long have you known them and why did you decide to work together? If you\'re solo, just let me know and we\'ll move on.', 'Team', true, 'text_long'],
      ['What have you built or achieved in the past that you\'re most proud of?', 'Track record', true, 'text_long'],
      ['What\'s your project\'s name?', 'Project', true, 'text_short'],
      ['What problem are you solving?', 'Problem', true, 'text_long'],
      ['Why are you solving that problem?', 'Motivation', true, 'text_long'],
      ['Can you say more about the necessity part — what made this feel urgent or unavoidable for you specifically?', 'Motivation', true, 'text_long'],
      ['Why is your project better than competitors and what\'s your moat?', 'Competition', true, 'text_long'],
      ['What\'s your current traction — waitlist signups, MRR, users, anything like that?', 'Traction', true, 'text_long'],
      ['Upload deck (.md or .pdf, max 50 MB each, up to 3 files)', 'Materials', true, 'file_upload'],
    ],
  },
  {
    slug: '3xcapital',
    kind: 'vc',
    name: '3xCapital — Startup Submission',
    organization: '3xCapital',
    type: 'vc', status: 'open', isRolling: true,
    url: 'https://3xcapital.fund',
    description: '3xCapital startup submission (Tally). Canonical record derived from raw Tally page capture + submitted answers. Note: the sector select (DeFi/Infrastructure/Web2-to-Web3/Metaverse/GameFi/L1/L2/NFT/Other) was deliberately left unselected at submission — Web3-default taxonomy.',
    geo: ['Global'], tags: ['pre-seed', 'seed'],
    questions: [
      ['What is your name?', 'Founder', true, 'text_short'],
      ['What is your email?', 'Founder', true, 'text_short'],
      ['What is your X / Twitter URL?', 'Founder', false, 'url'],
      ['What is your LinkedIn URL?', 'Founder', true, 'url'],
      ['What is your relationship to the startup?', 'Founder', true, 'multiple_choice'],
      ['What is the startup name?', 'Startup', true, 'text_short'],
      ['One-line description of the startup', 'Startup', true, 'text_short'],
      ['Websites', 'Startup', true, 'url'],
      ['Architecture link', 'Startup', false, 'url'],
      ['Legal entity', 'Startup', true, 'text_short'],
      ['What sector does the startup belong to? (options: DeFi / Infrastructure / Web2-to-Web3 / Metaverse / GameFi / L1 / L2 / NFT / Other)', 'Startup', false, 'multiple_choice'],
      ['What is the stage of the product?', 'Product', true, 'multiple_choice'],
      ['How does the startup raise?', 'Funding', true, 'multiple_choice'],
      ['What round?', 'Funding', true, 'multiple_choice'],
      ['What is the round / valuation type?', 'Funding', true, 'multiple_choice'],
      ['What is the range?', 'Funding', true, 'text_short'],
      ['What is the valuation for equity/token, and how did you develop it?', 'Funding', true, 'text_long'],
      ['What are the terms?', 'Funding', true, 'text_long'],
      ['Any other comments?', 'Other', false, 'text_long'],
    ],
  },
]

// Canonical question identity = deduped by normalized verbatim text.
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const esc = (s) => s.replace(/'/g, "''")
const sqlStr = (s) => `'${esc(s)}'`
const sqlArr = (a) => `'{${a.map((x) => `"${esc(x)}"`).join(',')}}'`

// theme inference (broad buckets only — no synthetic scoring)
const THEME_RULES = [
  [/name|email|linkedin|twitter|x \/ twitter|github|title|home base|where do you live/i, 'applicant'],
  [/co-?founder|team|technical on the team|worked together|who writes code/i, 'team'],
  [/elevator|one-line|describe what|going to make|idea|why did you pick|other ideas/i, 'idea'],
  [/product|tech stack|stage|phase|demo|link to the product|credentials/i, 'product'],
  [/traction|how far along|progress|revenue|users|how long have each|working on/i, 'traction'],
  [/fund|invest|capital|round|valuation|terms|raise/i, 'funding'],
  [/competitor|moat|understand about your business/i, 'competition'],
  [/customer|market|money/i, 'market'],
  [/deck|upload|video|file/i, 'materials'],
  [/hear about|find us|referred|apply|batch/i, 'attribution'],
  [/location|legal entity|incorporat|sector|industry|websites|architecture/i, 'company'],
  [/proud|built|achiev|right person|why you/i, 'founder_story'],
  [/problem|solving|urgent|necessity|vision|agent-first|describe you|relationship/i, 'motivation'],
]
const themeOf = (t) => THEME_RULES.find(([re]) => re.test(t))?.[1] ?? 'general'

// Build canonical questions: dedupe identical verbatim text across programs
const canonical = new Map() // norm -> {text, theme, asked_by, rt}
for (const p of PROGRAMS) {
  for (const [q, , , rt] of p.questions) {
    const k = norm(q)
    if (!canonical.has(k)) canonical.set(k, { text: q, theme: themeOf(q), asked_by: new Set(), rt })
    const c = canonical.get(k)
    c.asked_by.add(p.name)
    if (c.rt !== 'text_long' && rt === 'text_long') c.rt = 'text_long' // prefer wider type
  }
}

const out = []
out.push(`-- ============================================================`)
out.push(`-- 053 — Canonical catalog promotion (M08)`)
out.push(`-- ============================================================`)
out.push(`-- STATUS: PREPARED — DO NOT APPLY without separate owner`)
out.push(`-- prod-exec-auth. Requires 052 applied first ('canonical' enum).`)
out.push(`--`)
out.push(`-- Owner-approved records only (decisions m08:c1–c5, 2026-10-15):`)
out.push(PROGRAMS.map((p) => `--   * ${p.slug} — ${p.name}`).join('\n'))
out.push(`--`)
out.push(`-- Verbatim questions transcribed from qaapplication/ evidence`)
out.push(`-- (generator: qaapplication/src/gen-canonical-053.mjs).`)
out.push(`-- NO answers are promoted — answers stay in private custody.`)
out.push(`-- NO FundingCake, NO synthetic seed content, NO inherited`)
out.push(`-- scores/stats: asked_by_count reflects real records only,`)
out.push(`-- significance/score columns are left at neutral defaults.`)
out.push(`-- Idempotent: ON CONFLICT on slugs/text makes reruns safe.`)
out.push(`-- ============================================================`)
out.push(``)
out.push(`BEGIN;`)
out.push(``)
out.push(`-- 1. Programs (canonical)`)
for (const p of PROGRAMS) {
  out.push(`INSERT INTO programs (slug, name, organization, type, kind, status, round, url, description, source, is_rolling, geo_focus, industry_tags, domain)`)
  out.push(`VALUES (${sqlStr(p.slug)}, ${sqlStr(p.name)}, ${sqlStr(p.organization)}, '${p.type}', '${p.kind}', '${p.status}', NULL, ${sqlStr(p.url)}, ${sqlStr(p.description)}, 'canonical', ${p.isRolling}, ${sqlArr(p.geo)}, ${sqlArr(p.tags)}, 'founder')`)
  out.push(`ON CONFLICT (slug) DO NOTHING;`)
  out.push(``)
}
out.push(`-- 2. Canonical questions (real verbatim only; deduped across programs)`)
let i = 0
const qIds = new Map()
for (const [k, c] of canonical) {
  const id = `canonical_q_${String(i++).padStart(3, '0')}`
  qIds.set(k, id)
  out.push(`-- ${id}`)
  out.push(`INSERT INTO archived_questions (id, text, theme, response_type, asked_by_count, is_universal, example_programs, domain)`)
  out.push(`VALUES ('${id}'::uuid, ${sqlStr(c.text)}, ${sqlStr(c.theme)}, '${c.rt}', ${c.asked_by.size}, FALSE, ${sqlArr([...c.asked_by])}, 'founder')`)
  out.push(`ON CONFLICT (id) DO NOTHING;`)
}
out.push(``)
out.push(`-- 3. Program questions (verbatim asked_as per program)`)
for (const p of PROGRAMS) {
  p.questions.forEach(([q, section, req, rt], idx) => {
    const k = norm(q)
    const id = qIds.get(k)
    out.push(`INSERT INTO program_questions (program_id, archived_question_id, asked_as, is_required, section, order_index)`)
    out.push(`SELECT p.id, '${id}'::uuid, ${sqlStr(q)}, ${req}, ${sqlStr(section)}, ${idx + 1} FROM programs p`)
    out.push(`WHERE p.slug = ${sqlStr(p.slug)} AND NOT EXISTS (`)
    out.push(`  SELECT 1 FROM program_questions pq WHERE pq.program_id = p.id AND pq.asked_as = ${sqlStr(q)}`)
    out.push(`);`)
  })
}
out.push(``)
out.push(`COMMIT;`)
out.push(``)
out.push(`-- Post-apply verification:`)
out.push(`--   SELECT slug, source FROM programs WHERE source='canonical';  -- expect 5`)
out.push(`--   SELECT count(*) FROM program_questions pq JOIN programs p ON p.id=pq.program_id WHERE p.source='canonical';`)
out.push(`-- Registry slugs that must exist for the catalog to render these:`)
out.push(`--   ${PROGRAMS.map((p) => p.slug).join(', ')}`)

// UUIDs must be real — generate deterministic v5-ish ids from slug+text
// so reruns produce identical rows (idempotent by design, not chance).
import { createHash } from 'node:crypto'
const uuid = (seed) => {
  const h = createHash('sha256').update(`aqua-canonical:${seed}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}
const finalOut = out.join('\n')
let rendered = finalOut
for (const [k, id] of qIds) rendered = rendered.replaceAll(`'${id}'::uuid`, `'${uuid(k)}'`)
rendered = rendered.replaceAll(`-- canonical_q_`, `-- `)
console.log(rendered)
