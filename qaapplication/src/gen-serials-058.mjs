// gen-serials-058.mjs — emits the serial/entity backfill block embedded in
// supabase/migrations/<ts>_058_catalog_provenance_promotion.sql.
//
// Derivation (questions and refs only; answer bodies are never read or
// emitted):
//   EN-/AP-  existing refs, preserved verbatim, read from the YAML
//            frontmatter (`entity_ref:` / `application_ref:` lines only) of
//            the QA archive lanes for each 053 program:
//              03-programs/<qa>.md, 04-applications/<qa>.md,
//              08-submitted/archived_applications/<qa>.md
//   QU-      existing numbered refs from the answer-bank "Question legend"
//            tables (06-answers/index/*.md, rows `| QU-NNNN | text | theme |`).
//            A 053 canonical question keeps a legend QU only when the legend
//            text is the SAME question after norm() (exact/normalized match —
//            no semantic guessing). Every other 053 canonical question gets a
//            new QU numbered after the highest legend ref (the legend marks
//            QU-0045 as the next unassigned ref), in 053 dedupe order.
//   AQ-      no AQ refs exist yet; one per 053 occurrence, numbered from
//            AQ-0001 in 053 program order then order_index.
//   Entity rows (catalog_entities) get deterministic UUIDs so reruns are
//   idempotent.
//
// Run (prints the block):  node qaapplication/src/gen-serials-058.mjs
// Splice into migration:   node qaapplication/src/gen-serials-058.mjs --write <migration.sql>
//   (replaces the text between the BEGIN/END GENERATED markers)

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROGRAMS, norm, canonicalUuid } from './canonical-053-data.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const QA = path.resolve(here, '..')

// 053 slug -> QA archive slug + entity kind (catalog_entities.kind)
const QA_SLUG = {
  'yc-summer-2026': { qa: 'yc', entityKind: 'accelerator' },
  'founding-500': { qa: 'founding500', entityKind: 'company' },
  'redbud-vc': { qa: 'redbud', entityKind: 'investor' },
  'cyberfund-monastery': { qa: 'cyberfund', entityKind: 'investor' },
  '3xcapital': { qa: '3xcapital', entityKind: 'investor' },
}

const LANES = ['03-programs', '04-applications', '08-submitted/archived_applications']

// Read ONLY the leading YAML frontmatter block of a lane file.
function frontmatter(file) {
  if (!existsSync(file)) return {}
  const lines = readFileSync(file, 'utf8').split('\n')
  if (lines[0].trim() !== '---') return {}
  const out = {}
  for (let i = 1; i < lines.length && i < 40; i++) {
    if (lines[i].trim() === '---') break
    const m = lines[i].match(/^(entity_ref|application_ref):\s*(\S+)\s*$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

function refsFor(qa) {
  const refs = {}
  for (const lane of LANES) {
    const fm = frontmatter(path.join(QA, lane, `${qa}.md`))
    for (const k of ['entity_ref', 'application_ref']) {
      if (!fm[k]) continue
      if (refs[k] && refs[k] !== fm[k]) throw new Error(`conflicting ${k} for ${qa}: ${refs[k]} vs ${fm[k]}`)
      refs[k] = fm[k]
    }
  }
  if (!refs.entity_ref || !refs.application_ref) throw new Error(`missing EN/AP ref for ${qa}`)
  return refs
}

// Legend rows only: `| QU-0030 | What problem are you solving? | problem · statement |`
function legend() {
  const dir = path.join(QA, '06-answers/index')
  const rows = new Map() // QU -> text
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    for (const line of readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      const m = line.match(/^\|\s*(QU-\d{4})\s*\|\s*([^|]+?)\s*\|\s*[^|]+\|\s*$/)
      if (m && !rows.has(m[1])) rows.set(m[1], m[2])
    }
  }
  return rows
}

const esc = (s) => s.replace(/'/g, "''")
const q = (s) => `'${esc(s)}'`
const entityUuid = (slug) => {
  const h = createHash('sha256').update(`aqua-entity:${slug}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}
const pad = (n) => String(n).padStart(4, '0')

export function build() {
  const out = []
  // ---- EN / AP ---------------------------------------------------------
  const ents = PROGRAMS.map((p) => {
    const map = QA_SLUG[p.slug]
    if (!map) throw new Error(`no QA slug mapping for ${p.slug}`)
    return { p, ...map, ...refsFor(map.qa), id: entityUuid(map.qa) }
  })

  out.push(`-- EN: entities for the 5 canonical programs (existing refs preserved)`)
  for (const e of ents) {
    out.push(`INSERT INTO public.catalog_entities (id, name, website, kind) VALUES ('${e.id}', ${q(e.p.organization)}, ${q(e.p.url)}, '${e.entityKind}') ON CONFLICT (id) DO NOTHING;`)
    out.push(`UPDATE public.programs SET entity_id = '${e.id}' WHERE slug = ${q(e.p.slug)} AND source::text = 'canonical' AND entity_id IS NULL;`)
    out.push(`INSERT INTO public.catalog_serials (serial, kind, target_table, target_id, origin) SELECT ${q(e.entity_ref)}, 'EN', 'catalog_entities', id, 'qa_archive' FROM public.catalog_entities WHERE id = '${e.id}' ON CONFLICT DO NOTHING;`)
  }
  out.push(`-- AP: application refs -> canonical programs rows (existing refs preserved)`)
  for (const e of ents) {
    out.push(`INSERT INTO public.catalog_serials (serial, kind, target_table, target_id, origin) SELECT ${q(e.application_ref)}, 'AP', 'programs', id, 'qa_archive' FROM public.programs WHERE slug = ${q(e.p.slug)} AND source::text = 'canonical' ON CONFLICT DO NOTHING;`)
  }

  // ---- QU ----------------------------------------------------------------
  const leg = legend()
  const legByNorm = new Map()
  let maxLegend = 0
  for (const [ref, text] of leg) {
    maxLegend = Math.max(maxLegend, Number(ref.slice(3)))
    const k = norm(text)
    if (!legByNorm.has(k)) legByNorm.set(k, ref)
  }
  const canonical = new Map() // norm -> text (053 dedupe order)
  for (const p of PROGRAMS) for (const [text] of p.questions) if (!canonical.has(norm(text))) canonical.set(norm(text), text)

  let nextQu = maxLegend + 1
  let preserved = 0
  out.push(`-- QU: 053 canonical questions. Legend refs kept on exact/normalized match (${leg.size} legend refs, max QU-${pad(maxLegend)}); others numbered from QU-${pad(nextQu)}`)
  for (const [k, text] of canonical) {
    let ref = legByNorm.get(k)
    let origin = 'qa_archive'
    if (ref) preserved++
    else { ref = `QU-${pad(nextQu++)}`; origin = 'backfill_058' }
    out.push(`INSERT INTO public.catalog_serials (serial, kind, target_table, target_id, origin) SELECT '${ref}', 'QU', 'archived_questions', id, '${origin}' FROM public.archived_questions WHERE id = '${canonicalUuid(k)}' ON CONFLICT DO NOTHING; -- ${text.slice(0, 60).replace(/\n/g, ' ')}`)
  }

  // ---- AQ ----------------------------------------------------------------
  let aq = 1
  out.push(`-- AQ: one per 053 occurrence, AQ-0001.. in program order then order_index`)
  for (const p of PROGRAMS) {
    p.questions.forEach(([text]) => {
      out.push(`INSERT INTO public.catalog_serials (serial, kind, target_table, target_id, origin) SELECT 'AQ-${pad(aq++)}', 'AQ', 'program_questions', pq.id, 'backfill_058' FROM public.program_questions pq JOIN public.programs p ON p.id = pq.program_id WHERE p.slug = ${q(p.slug)} AND pq.archived_question_id = '${canonicalUuid(norm(text))}' AND pq.asked_as = ${q(text)} ON CONFLICT DO NOTHING;`)
    })
  }
  const summary = { entities: ents.length, applications: ents.length, questions: canonical.size, qu_preserved: preserved, occurrences: aq - 1, qu_floor: maxLegend }
  out.unshift(`-- generated by qaapplication/src/gen-serials-058.mjs: ${JSON.stringify(summary)}`)
  return { sql: out.join('\n'), summary }
}

const BEGIN = '-- BEGIN GENERATED (gen-serials-058.mjs)'
const END = '-- END GENERATED (gen-serials-058.mjs)'

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { sql } = build()
  const i = process.argv.indexOf('--write')
  if (i === -1) {
    console.log(sql)
  } else {
    const file = process.argv[i + 1]
    const src = readFileSync(file, 'utf8')
    const a = src.indexOf(BEGIN)
    const b = src.indexOf(END)
    if (a === -1 || b === -1 || b < a) throw new Error('generated markers not found')
    writeFileSync(file, src.slice(0, a + BEGIN.length) + '\n' + sql + '\n' + src.slice(b))
    console.error(`spliced into ${file}`)
  }
}
