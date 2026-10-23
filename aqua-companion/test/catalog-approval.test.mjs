// The companion keeps a catalog program on the same approval rule as the
// site (app/lib/canonical-catalog.ts approvedProgramsFilter): slug in the
// approval registry OR source = 'canonical' (curator-published via 058).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeCatalog } from '../src/catalog.mjs'
import { CANONICAL_PROGRAM_SLUGS, approvedProgramsFilter } from '../vendor/lib/canonical-catalog.mjs'

const REG = CANONICAL_PROGRAM_SLUGS[0]
const row = (id, slug, source) => ({ id, slug, name: `Synthetic ${id}`, ...(source === undefined ? {} : { source }) })

test('curator-published (source canonical) program outside the registry is kept', () => {
  assert.equal(CANONICAL_PROGRAM_SLUGS.includes('curator-published-synth'), false)
  const { programs } = sanitizeCatalog({ programs: [row('p-cur', 'curator-published-synth', 'canonical')] })
  assert.deepEqual(programs.map((p) => p.id), ['p-cur'])
  assert.equal(programs[0].source, 'canonical')
})

test('non-canonical program outside the registry is dropped, with its questions', () => {
  const r = sanitizeCatalog({
    programs: [row('p-com', 'some-community-row', 'community'), row('p-none', 'no-source-row')],
    questions: [{ id: 'q-1', program_id: 'p-com', asked_as: 'Hidden?' }],
  })
  assert.deepEqual(r.programs, [])
  assert.deepEqual(r.questions, [])
})

test('registry slug is kept whatever its source (registry floor), and keeps its real source', () => {
  const { programs } = sanitizeCatalog({ programs: [row('p-reg', REG, 'scraped'), row('p-reg2', REG)] })
  assert.deepEqual(programs.map((p) => [p.id, p.source]), [['p-reg', 'scraped'], ['p-reg2', null]])
})

test('allowAnySlug keeps source-less rows outside the registry, never an explicit non-canonical source', () => {
  const { programs } = sanitizeCatalog({ programs: [row('p-none', 'no-source-row'), row('p-com', 'some-community-row', 'community')] }, { allowAnySlug: true })
  assert.deepEqual(programs.map((p) => p.id), ['p-none'])
})

test('the sync request uses the same PostgREST or-filter as the site', () => {
  assert.match(approvedProgramsFilter(), /^slug\.in\.\(.*\),source\.eq\.canonical$/)
})
