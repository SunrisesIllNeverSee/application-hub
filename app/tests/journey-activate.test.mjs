// M09 W6 — Step C activation + failure safety: one write, refusal before
// any write, catalog-backed instances carry ids only, local templates keep
// originals of corrected wording, URL import failures create nothing.
// Synthetic data only. Run: node --test tests/journey-activate.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStorage } from '../lib/aqua-local/vault.ts'
import { createAppInstance, readAppInstance } from '../lib/aqua-local/instances.ts'
import { extractApplication } from '../lib/catalog/extract.ts'
import {
  correctWording, mergeDuplicate, modelFromCatalogProgram, modelFromLocalExtraction, modelFromUrlProposal, removeQuestion, setUseCatalogTemplate,
} from '../lib/journey/review-model.ts'
import { activateInstance, buildInstanceInput, findCatalogInstance, JourneyActivationError } from '../lib/journey/activate.ts'
import { importFromUrl, loadInstanceSummaries, deriveInstanceLifecycle, urlPrefill } from '../lib/journey/lifecycle.ts'
import { DEV_JOURNEY_CATALOG, DEV_PASTE_TEXT, DEV_URL } from '../lib/journey/dev-fixture.ts'
import { extractUrlResponse } from './fixtures/journey-fixtures.mjs'

const SECRET = 'synthetic-test-secret-1'
const T = '2026-10-22T12:00:00.000Z'
const count = async (s) => (await s.getAll('app_instances')).length

test('catalog path: AI- instance with ids only, W5 workspace convention (application_id = program_id, occurrence = archived_question_id)', async () => {
  const s = createMemoryStorage()
  const rec = await activateInstance(s, SECRET, modelFromCatalogProgram(DEV_JOURNEY_CATALOG.programs[0], T), DEV_JOURNEY_CATALOG)
  assert.match(rec.instance_id, /^AI-/)
  assert.equal(rec.program_id, 'prog-example-accel')
  assert.equal(rec.application_id, 'prog-example-accel', 'answers scope like the workspace editor')
  assert.equal(rec.cycle_id, 'cyc-example-w27')
  assert.match(rec.template_revision_sha, /^[0-9a-f]{64}$/)
  assert.deepEqual(rec.question_refs.map((r) => r.question_occurrence_id), ['aq-problem', 'aq-team', 'aq-why-now'])
  assert.equal(rec.local_template_enc, undefined, 'public template is referenced, not duplicated')
  assert.ok(!JSON.stringify(rec).includes('What problem'), 'no question wording in the record')
  assert.equal(await count(s), 1)
})

test('one instance per program: a second catalog start (or one made by the W5 workspace link) is reused, nothing written', async () => {
  const s = createMemoryStorage()
  // what WorkspaceReviewLink (W5) creates for the program
  const w5 = await createAppInstance(s, SECRET, {
    program_id: 'prog-example-accel', application_id: 'prog-example-accel', source: { kind: 'catalog' },
    question_refs: [{ question_occurrence_id: 'aq-problem', canonical_question_id: 'aq-problem', order: 0 }],
  })
  const again = await activateInstance(s, SECRET, modelFromCatalogProgram(DEV_JOURNEY_CATALOG.programs[0], T), DEV_JOURNEY_CATALOG)
  assert.equal(again.instance_id, w5.instance_id)
  assert.equal(again.reused, true)
  const viaUrl = await activateInstance(s, SECRET, setUseCatalogTemplate(modelFromUrlProposal(extractUrlResponse(), DEV_URL, T), true, T), DEV_JOURNEY_CATALOG)
  assert.equal(viaUrl.instance_id, w5.instance_id, 'URL import choosing the catalog template opens the same instance')
  assert.equal(await count(s), 1)
  assert.equal((await findCatalogInstance(s, 'prog-example-accel')).instance_id, w5.instance_id)
})

test('paste path: LA- instance; template keeps exact wording, corrections + originals, merge/remove applied', async () => {
  const s = createMemoryStorage()
  let m = modelFromLocalExtraction(extractApplication({ content: DEV_PASTE_TEXT }), { kind: 'paste', catalog: DEV_JOURNEY_CATALOG, now: T })
  m = correctWording(m, 'q1', 'Describe a project you led in the last two years.', T)
  m = removeQuestion(m, 'q2', T)
  const rec = await activateInstance(s, SECRET, m, DEV_JOURNEY_CATALOG)
  assert.match(rec.instance_id, /^LA-/)
  assert.equal(rec.program_id, null)
  assert.ok(rec.local_template_enc && !rec.local_template_enc.includes('Describe'), 'template encrypted at rest')
  const { template } = await readAppInstance(s, SECRET, rec.instance_id)
  assert.equal(template.title, 'Northwind Civic Fellowship 2027')
  assert.equal(template.deadline, '2027-04-15 17:00 ET', 'deadline keeps its time zone')
  assert.equal(template.cycle_year, 2027)
  assert.equal(template.questions.length, 2)
  assert.ok(template.questions.every((q) => q.question_occurrence_id.startsWith('LQ-')), 'stable local ids')
  assert.equal(template.questions[0].text, 'What problem are you solving? (Maximum 150 words)')
  assert.equal(template.questions[0].original_text, undefined, 'uncorrected → no original copy')
  assert.equal(template.questions[0].canonical_question_id, 'aq-problem')
  assert.equal(template.questions[1].text, 'Describe a project you led in the last two years.')
  assert.equal(template.questions[1].original_text, 'Describe a project you led in the last two years. (300 words max) *')
  assert.equal(template.questions[1].word_limit, 300)
  assert.equal(template.questions[1].required, true)
  assert.deepEqual(template.corrections.map((c) => [c.question_index, c.field]), [[1, 'wording'], [2, 'removed']])
  assert.equal(template.import_meta.method, 'paste')
  assert.equal(template.import_meta.question_count_extracted, 3)
})

test('URL path linked to a program keeps the imported list as a LOCAL instance (link kept encrypted); catalog template = ids-only', async () => {
  const s = createMemoryStorage()
  let m = modelFromUrlProposal(extractUrlResponse(), DEV_URL, T)
  m = mergeDuplicate(m, 'q2', 'q1', T)
  m = removeQuestion(m, 'q4', T)
  const linked = await activateInstance(s, SECRET, m, DEV_JOURNEY_CATALOG)
  assert.match(linked.instance_id, /^LA-/)
  assert.equal(linked.program_id, null, 'never competes with the program\'s catalog-backed instance')
  const { template, source_ref } = await readAppInstance(s, SECRET, linked.instance_id)
  assert.equal(template.questions.length, 3)
  assert.equal(template.import_meta.linked_program_id, 'prog-example-accel')
  assert.equal(template.import_meta.linked_cycle_id, 'cyc-example-w27')
  assert.equal(source_ref, DEV_URL, 'source URL stored encrypted')
  assert.equal(template.import_meta.content_sha256, 'c'.repeat(64))
  assert.equal(await findCatalogInstance(s, 'prog-example-accel'), null)
  const input = await buildInstanceInput(setUseCatalogTemplate(m, true, T), DEV_JOURNEY_CATALOG)
  assert.equal(input.local_template, undefined)
  assert.equal(input.question_refs.length, 3)
})

test('failure safety: a blocked model writes nothing; one call → one instance', async () => {
  const s = createMemoryStorage()
  let m = modelFromLocalExtraction(extractApplication({ content: DEV_PASTE_TEXT }), { kind: 'paste', now: T })
  for (const q of m.questions) m = removeQuestion(m, q.key, T)
  await assert.rejects(activateInstance(s, SECRET, m), JourneyActivationError)
  assert.equal(await count(s), 0, 'no partial instance')
  const w = modelFromUrlProposal(extractUrlResponse(), DEV_URL, T)
  await assert.rejects(activateInstance(s, SECRET, setUseCatalogTemplate(w, true, T), { programs: [] }), JourneyActivationError)
  assert.equal(await count(s), 0)
})

test('URL import failures (network, 422, private link, bad body) return errors and create no instance', async () => {
  const s = createMemoryStorage()
  const calls = []
  const failing = async () => { throw new TypeError('network down') }
  const r1 = await importFromUrl(DEV_URL, failing)
  assert.equal(r1.ok, false); assert.equal(r1.code, 'network_error')
  const r2 = await importFromUrl(DEV_URL, async () => new Response(JSON.stringify({ error: 'Fetch failed', code: 'timeout' }), { status: 422 }))
  assert.equal(r2.ok, false); assert.equal(r2.code, 'timeout')
  const spy = async (u, init) => { calls.push([u, init]); return new Response('{}') }
  const r3 = await importFromUrl('https://docs.google.com/document/d/abc123/edit', spy)
  assert.equal(r3.code, 'url_not_public')
  const r4 = await importFromUrl('https://example.org/apply?token=s3cr3tvalue', spy)
  assert.equal(r4.code, 'url_not_public')
  assert.equal(calls.length, 0, 'private-looking links are never sent')
  const r5 = await importFromUrl(DEV_URL, spy)
  assert.equal(r5.code, 'bad_response')
  assert.deepEqual(JSON.parse(calls[0][1].body), { url: DEV_URL }, 'the request carries the URL only')
  const ok = await importFromUrl(DEV_URL, async () => new Response(JSON.stringify(extractUrlResponse())))
  assert.equal(ok.ok, true)
  assert.equal(await count(s), 0, 'the import itself never writes')
})

test('instance list: lifecycle derivation + summaries decrypt local titles', async () => {
  assert.equal(deriveInstanceLifecycle([]), 'active')
  assert.equal(deriveInstanceLifecycle(['discarded']), 'active')
  assert.equal(deriveInstanceLifecycle(['discarded', 'exported']), 'queued')
  assert.equal(deriveInstanceLifecycle(['prepared', 'submitted_external_observed']), 'submitted')
  const s = createMemoryStorage()
  await activateInstance(s, SECRET, modelFromCatalogProgram(DEV_JOURNEY_CATALOG.programs[0], T), DEV_JOURNEY_CATALOG)
  await activateInstance(s, SECRET, modelFromLocalExtraction(extractApplication({ content: DEV_PASTE_TEXT }), { kind: 'paste', now: T }))
  const list = await loadInstanceSummaries(s, SECRET, DEV_JOURNEY_CATALOG)
  assert.deepEqual(list.map((x) => x.title).sort(), ['Example Accelerator', 'Northwind Civic Fellowship 2027'])
  assert.ok(list.every((x) => x.lifecycle === 'active'))
})

test('?url= deep link prefill: public http(s) only, private-looking links refused, never fetches', () => {
  assert.deepEqual(urlPrefill(DEV_URL), { url: DEV_URL, refused: null })
  assert.deepEqual(urlPrefill(null), { url: null, refused: null })
  assert.match(urlPrefill('https://docs.google.com/document/d/abc123/edit').refused, /looks private/)
  assert.match(urlPrefill('https://example.org/apply?token=s3cr3tvalue').refused, /looks private/)
  assert.match(urlPrefill('javascript:alert(1)').refused, /http/)
  assert.match(urlPrefill('not a url').refused, /valid web address/)
})
