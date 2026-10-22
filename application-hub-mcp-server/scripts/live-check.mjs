// Read-only live check of the public catalog with the PUBLIC key.
// Prints counts, HTTP statuses and PostgREST codes per table, never row
// content. Uses the same config sources as the server (AQUA_SUPABASE_URL +
// AQUA_PUBLISHABLE_KEY, AQUA_CATALOG_CONFIG_URL, AQUA_CATALOG_CONFIG, or the
// default https://aquaidp.xyz/.well-known/aqua-catalog.json); any non-public
// key is refused before a request is made.
//   node scripts/live-check.mjs [--json]
import { CANONICAL_PROGRAM_SLUGS } from 'aqua-companion/vendor/lib/canonical-catalog.mjs'
import { resolveCatalogConfig } from '../src/node/config.mjs'
import { CatalogClient, CatalogError, inList } from '../src/catalog/rest.mjs'
import { CatalogData } from '../src/catalog/data.mjs'
import { KeyRefusal } from '../src/catalog/key.mjs'

const asJson = process.argv.includes('--json')

async function probe(fn) {
  try {
    const rows = await fn()
    return { readable: true, rows: Array.isArray(rows) ? rows.length : rows instanceof Map ? rows.size : rows ? 1 : 0 }
  } catch (e) {
    if (e instanceof CatalogError) return { readable: false, classification: e.kind, http_status: e.http_status, code: e.code }
    throw e
  }
}

let conf
try {
  conf = await resolveCatalogConfig({ env: process.env })
} catch (e) {
  if (e instanceof KeyRefusal) {
    process.stderr.write(`live-check: ${e.message}\n`)
    process.exit(2)
  }
  throw e
}
if (!conf.configured) {
  process.stderr.write(`live-check: catalog not configured (${conf.reason}). Set AQUA_SUPABASE_URL and AQUA_PUBLISHABLE_KEY (public key only).\n`)
  process.exit(2)
}

const client = new CatalogClient(conf.cfg)
const data = new CatalogData(client, { allowSlugs: [...CANONICAL_PROGRAM_SLUGS] })
const report = { checked_at: new Date().toISOString(), origin_host: new URL(conf.cfg.origin).host, key_kind: conf.cfg.key_kind, source: conf.source.split(':')[0], tables: {} }

report.tables.programs_approved = await probe(() => data.programs())
const ids = report.tables.programs_approved.readable ? await data.programIds() : []
report.registry_slugs = CANONICAL_PROGRAM_SLUGS.length
report.tables.programs_scores = await probe(() => data.scores())
report.tables.program_cycles = await probe(() => data.cycles())
report.tables.program_questions = await probe(() => data.occurrences())
report.tables.archived_questions = await probe(() => data.canonicalQuestions())
const scoped = (logical, extra = {}) => probe(() => (ids.length ? client.get(logical, { select: 'program_id', program_id: inList(ids), ...extra }) : []))
report.tables.program_dna = await scoped('program_dna')
report.tables.program_stats = await scoped('program_stats')
report.tables.acceptance_reports_verified = await scoped('acceptance_reports', { verified: 'eq.true' })
// boundary check (migration 052): can the public key see ANY unapproved program row? (count of at most 1, ids only)
report.unapproved_programs_visible = await probe(() => client.getOnce('programs', { select: 'id', source: 'neq.canonical', slug: `not.${inList([...CANONICAL_PROGRAM_SLUGS])}`, limit: '1' }))
report.requests = client.evidence.map(({ table, status, rows, code }) => ({ table, status, rows, code }))

if (asJson) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
else {
  process.stdout.write(`live check ${report.checked_at} against ${report.origin_host} (${report.key_kind} key, from ${report.source})\n`)
  for (const [t, r] of Object.entries(report.tables)) {
    process.stdout.write(`  ${t.padEnd(28)} ${r.readable ? `readable, ${r.rows} row(s)` : `NOT READABLE (${r.classification}; HTTP ${r.http_status}${r.code ? `, ${r.code}` : ''})`}\n`)
  }
  const u = report.unapproved_programs_visible
  process.stdout.write(`  unapproved program rows visible to the public key: ${u.readable ? (u.rows ? 'YES (052 not in effect)' : 'none') : `query refused (HTTP ${u.http_status})`}\n`)
}
