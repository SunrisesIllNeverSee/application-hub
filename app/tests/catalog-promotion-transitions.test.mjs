// M09 W3: candidate lifecycle mirror + parity with migration 058, request validation.
// Run: node --test tests/catalog-promotion-transitions.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CANDIDATE_STATES, canTransition, curatorNextSteps, actorRolesFor, verifiedAllowed,
} from '../lib/catalog-promotion/transitions.ts'
import { validateTransitionRequest, applyMappingOverrides } from '../lib/catalog-promotion/requests.ts'
import { isCatalogSchemaMissing, mapCatalogDbError } from '../lib/catalog-promotion/errors.ts'
import { currentOccurrences } from '../lib/catalog-promotion/occurrences.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const migDir = path.resolve(here, '../../supabase/migrations')
const m058 = readFileSync(path.join(migDir, readdirSync(migDir).find((f) => f.endsWith('_058_catalog_provenance_promotion.sql'))), 'utf8')

const EXPECTED = new Set([
  'candidate>extracted', 'extracted>matched', 'matched>verified', 'verified>approved', 'approved>published',
  ...['candidate', 'extracted', 'matched', 'verified', 'approved'].flatMap((s) => [`${s}>rejected`, `${s}>withdrawn`]),
])

test('full 8x8 matrix: forward chain, reject/withdraw from any pre-published state, nothing else', () => {
  for (const from of CANDIDATE_STATES) for (const to of CANDIDATE_STATES) {
    assert.equal(canTransition(from, to), EXPECTED.has(`${from}>${to}`), `${from} -> ${to}`)
  }
})

test('TS mirror matches catalog_transition_allowed() in migration 058', () => {
  const fn = m058.slice(m058.indexOf('FUNCTION public.catalog_transition_allowed'), m058.indexOf('CREATE OR REPLACE FUNCTION public.guard_catalog_candidates'))
  const forward = fn.slice(0, fn.indexOf('OR (p_to IN'))
  const pairs = [...forward.matchAll(/\('(\w+)'(?:::public\.catalog_candidate_state)?,\s*'(\w+)'(?:::public\.catalog_candidate_state)?\)/g)].map((m) => `${m[1]}>${m[2]}`)
  assert.deepEqual(pairs.sort(), [...EXPECTED].filter((p) => !/rejected|withdrawn/.test(p)).sort())
  assert.match(fn, /p_to IN \('rejected', 'withdrawn'\)\s*AND p_from IN \('candidate', 'extracted', 'matched', 'verified', 'approved'\)/)
})

test('actor rules and curator steps', () => {
  assert.deepEqual(actorRolesFor('withdrawn'), ['submitter'])
  assert.deepEqual(actorRolesFor('approved'), ['curator'])
  assert.deepEqual(actorRolesFor('published'), ['curator'])
  assert.deepEqual(curatorNextSteps('extracted'), ['matched', 'rejected'])
  assert.deepEqual(curatorNextSteps('verified'), ['approved', 'rejected'])
  assert.deepEqual(curatorNextSteps('published'), [])
  assert.deepEqual(curatorNextSteps('candidate'), ['rejected'])
  assert.equal(verifiedAllowed(true, false, undefined), true)
  assert.equal(verifiedAllowed(false, true, 'short'), false)
  assert.equal(verifiedAllowed(false, true, 'reuse confirmed by program staff'), true)
  assert.equal(verifiedAllowed(false, false, 'reuse confirmed by program staff'), false)
})

test('transition request: strict keys, enums, uuid, reject needs a note, notes scanned', () => {
  assert.equal(validateTransitionRequest({ to: 'matched' }).ok, true)
  assert.equal(validateTransitionRequest({ to: 'published' }).ok, false, 'publish has its own route')
  assert.equal(validateTransitionRequest({ to: 'withdrawn' }).ok, false, 'curators do not withdraw')
  assert.equal(validateTransitionRequest({ to: 'rejected' }).ok, false)
  assert.equal(validateTransitionRequest({ to: 'rejected', note: 'not a public form' }).ok, true)
  assert.equal(validateTransitionRequest({ to: 'matched', state: 'approved' }).ok, false)
  assert.equal(validateTransitionRequest({ to: 'matched', program_match_id: 'x' }).ok, false)
  assert.equal(validateTransitionRequest({ to: 'verified', source_review: { reuse: 'maybe' } }).ok, false)
  const leak = validateTransitionRequest({ to: 'approved', note: 'ok, ping jane@gmail.com' })
  assert.ok(!leak.ok && leak.errors.some((e) => e.code === 'private_data:email'))
  const ok = validateTransitionRequest({ to: 'verified', override: true, note: 'reuse confirmed by program staff', source_review: { reuse: 'allowed', robots_disallow: false, verification_status: 'verified' }, mappings: [{ index: 0, canonical_question_id: null }] })
  assert.equal(ok.ok, true)
})

test('mapping overrides: index-addressed, clear with null, duplicates refused', () => {
  const payload = { program: {}, questions: [{ asked_as: 'A', order_index: 1 }, { asked_as: 'B', order_index: 2, mapping: { canonical_question_id: '11111111-1111-4111-8111-111111111111', tier: 'exact' } }], source_refs: [] }
  const a = applyMappingOverrides(payload, [{ index: 0, canonical_question_id: '22222222-2222-4222-8222-222222222222', tier: 'semantic' }, { index: 1, canonical_question_id: null }])
  assert.equal(a.ok, true)
  assert.equal(a.payload.questions[0].mapping.tier, 'semantic')
  assert.equal(a.payload.questions[1].mapping, undefined)
  const dup = applyMappingOverrides(payload, [{ index: 0, canonical_question_id: '11111111-1111-4111-8111-111111111111' }])
  assert.equal(dup.ok, false)
  assert.equal(applyMappingOverrides(payload, [{ index: 9, canonical_question_id: null }]).ok, false)
})

test('schema-missing detection drives the 503 catalog_promotion_unavailable contract', () => {
  assert.equal(isCatalogSchemaMissing({ code: 'PGRST205', message: "Could not find the table 'public.catalog_curators' in the schema cache" }), true)
  assert.equal(isCatalogSchemaMissing({ code: '42P01', message: 'relation "catalog_candidates" does not exist' }), true)
  assert.equal(isCatalogSchemaMissing({ code: 'PGRST202', message: 'Could not find the function public.catalog_publish_candidate' }), true)
  assert.equal(isCatalogSchemaMissing({ code: '42501', message: 'permission denied' }), false)
  assert.deepEqual(mapCatalogDbError({ code: '42P01' }), { status: 503, error: 'catalog_promotion_unavailable' })
  assert.deepEqual(mapCatalogDbError({ code: '55000' }), { status: 409, error: 'not_approved' })
  assert.deepEqual(mapCatalogDbError({ code: '42501' }), { status: 403, error: 'forbidden' })
  assert.deepEqual(mapCatalogDbError({ code: '40001' }), { status: 409, error: 'stale_state' })
})

test('superseded occurrences are hidden from catalog surfaces (and pre-058 rows pass through)', () => {
  const rows = [{ id: 1 }, { id: 2, superseded_by_revision_id: null }, { id: 3, superseded_by_revision_id: 'r2' }]
  assert.deepEqual(currentOccurrences(rows).map((r) => r.id), [1, 2])
  assert.deepEqual(currentOccurrences(null), [])
})
