// M09 W9 (AT22) regression: saving the FIRST draft for a question creates
// the answer record and its first version in ONE transaction. Before the
// fix, the answer was written first and the version second, so a refused
// version (e.g. a body of invisible characters only, which passes the UI's
// trim() check) or a failed version write left an empty answer shell behind.
// Found by tests/acceptance/acceptance.browser.mjs (real IndexedDB).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStorage } from '../lib/aqua-local/vault.ts'
import { createAnswerWithVersion, VaultBlankBodyError } from '../lib/aqua-local/repo.ts'
import { activateInstance } from '../lib/journey/activate.ts'
import { modelFromCatalogProgram } from '../lib/journey/review-model.ts'
import { saveInstanceDraft } from '../lib/aqua-local-client/review.ts'
import { saveVersion } from '../lib/aqua-local-client/session.ts'
import { DEV_JOURNEY_CATALOG } from '../lib/journey/dev-fixture.ts'

const SECRET = 'synthetic-atomicity-secret-1'
const ZWSP = '​​​'
const counts = async (s) => ({ answers: (await s.getAll('answers')).length, versions: (await s.getAll('versions')).length, provenance: (await s.getAll('provenance')).length })

test('journey draft: a refused first version leaves no answer record behind', async () => {
  const s = createMemoryStorage()
  const inst = await activateInstance(s, SECRET, modelFromCatalogProgram(DEV_JOURNEY_CATALOG.programs[0]), DEV_JOURNEY_CATALOG)
  await assert.rejects(saveInstanceDraft(s, SECRET, inst.instance_id, 'aq-problem', { title: 'Problem', body: ZWSP }), VaultBlankBodyError)
  assert.deepEqual(await counts(s), { answers: 0, versions: 0, provenance: 0 })
  const v = await saveInstanceDraft(s, SECRET, inst.instance_id, 'aq-problem', { title: 'Problem', body: 'A synthetic draft.' })
  assert.deepEqual(await counts(s), { answers: 1, versions: 1, provenance: 1 })
  const v2 = await saveInstanceDraft(s, SECRET, inst.instance_id, 'aq-problem', { title: 'Problem', body: 'A second synthetic draft.' })
  assert.equal(v2.parent_version_id, v.id, 'later drafts still chain onto the same answer')
  assert.deepEqual(await counts(s), { answers: 1, versions: 2, provenance: 2 })
})

test('bank draft (session.saveVersion): a refused first version leaves no answer record behind', async () => {
  const s = createMemoryStorage()
  const scope = { application_id: 'answer-bank', question_occurrence_id: 'aq-team' }
  await assert.rejects(saveVersion(s, SECRET, { answer_id: null, scope, title: 'Team', body: ZWSP }), VaultBlankBodyError)
  assert.deepEqual(await counts(s), { answers: 0, versions: 0, provenance: 0 })
  await saveVersion(s, SECRET, { answer_id: null, scope, title: 'Team', body: 'Two synthetic founders.' })
  assert.deepEqual(await counts(s), { answers: 1, versions: 1, provenance: 1 })
})

test('createAnswerWithVersion: answer + first version + provenance in one tx call; blank refused before any write', async () => {
  // Rollback of a failed write inside the transaction is an IndexedDB
  // property; it is exercised for real in tests/acceptance/acceptance.browser.mjs.
  const s = createMemoryStorage()
  const scope = { application_id: 'answer-bank', question_occurrence_id: 'aq-x' }
  const txStores = []
  const spy = Object.assign(Object.create(Object.getPrototypeOf(s)), s)
  for (const k of ['get', 'put', 'putIfAbsent', 'getAll', 'delete', 'keys']) spy[k] = s[k].bind(s)
  spy.tx = (stores, fn) => { txStores.push([...stores].sort().join(',')); return s.tx(stores, fn) }
  await assert.rejects(createAnswerWithVersion(spy, SECRET, scope, { title: 'X', body: ZWSP, method: 'manual' }), VaultBlankBodyError)
  assert.equal(txStores.length, 0, 'refused before opening a transaction')
  const { answer, version } = await createAnswerWithVersion(spy, SECRET, scope, { title: 'X', body: 'A synthetic body.', method: 'manual' })
  assert.deepEqual(txStores, ['answers,provenance,versions'])
  assert.equal(version.answer_id, answer.id)
  assert.equal(version.parent_version_id, null)
  assert.deepEqual(await counts(s), { answers: 1, versions: 1, provenance: 1 })
})
