// gen-canonical-053.mjs — emits supabase/migrations/053_canonical_promotion.sql
// Source: verbatim question sets transcribed from the QA archive
// (07-apply/<slug>.md, 05-questions/source/<slug>.md, raw captures under
// 07-apply/_shared/raw/). Owner-approved records only (m08:c1–c5).
// No FundingCake. No synthetic seed content. No answers — questions only.
//
// Run: node qaapplication/src/gen-canonical-053.mjs > supabase/migrations/053_canonical_promotion.sql

import { PROGRAMS, norm, canonicalUuid as uuid } from './canonical-053-data.mjs'

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

// UUIDs must be real — deterministic ids from normalized text (canonicalUuid)
// so reruns produce identical rows (idempotent by design, not chance).
const finalOut = out.join('\n')
let rendered = finalOut
for (const [k, id] of qIds) rendered = rendered.replaceAll(`'${id}'::uuid`, `'${uuid(k)}'`)
rendered = rendered.replaceAll(`-- canonical_q_`, `-- `)
console.log(rendered)
