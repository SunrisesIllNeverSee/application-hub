// Self-contained aqua-local-client session adapter tests (no test runner).
// Run: node lib/aqua-local-client/run-session-tests.mjs
// (Node >=22.6 type-strips .ts imports; storage is injected memory —
//  getStorage()/IndexedDB is never touched here.)
import assert from 'node:assert/strict'
import { createMemoryStorage } from '../aqua-local/vault.ts'
import { readVersion } from '../aqua-local/repo.ts'
import { VaultDecryptError } from '../aqua-local/crypto.ts'
import {
  tryUnlock,
  loadBank,
  saveScopedVersion,
  loadScopeEntry,
  findAnswersForOccurrence,
  scopeForQuestion,
  PROFILE_BANK_APPLICATION_ID,
} from './session.ts'

const SECRET = 'correct-horse-battery-staple'
let passed = 0
async function t(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`) }
  catch (e) { console.error(`FAIL ${name}: ${e.message}`); process.exitCode = 1 }
}

await t('scopeForQuestion maps archived_question_id → occurrence', async () => {
  assert.deepEqual(scopeForQuestion('q-123'), {
    application_id: PROFILE_BANK_APPLICATION_ID,
    question_occurrence_id: 'q-123',
  })
  assert.deepEqual(scopeForQuestion('q-123', 'prog-9'), {
    application_id: 'prog-9',
    question_occurrence_id: 'q-123',
  })
})

await t('saveScopedVersion creates answer + first version', async () => {
  const s = createMemoryStorage()
  const v = await saveScopedVersion(s, SECRET, scopeForQuestion('q-1'), {
    title: 'T', body: 'first body',
  })
  assert.equal(v.parent_version_id, null)
  const answers = await findAnswersForOccurrence(s, 'q-1')
  assert.equal(answers.length, 1)
  assert.equal(answers[0].scope.question_occurrence_id, 'q-1')
  const { body } = await readVersion(s, SECRET, v.id)
  assert.equal(body, 'first body')
})

await t('re-save same scope → child version, dedup (one answer)', async () => {
  const s = createMemoryStorage()
  const v1 = await saveScopedVersion(s, SECRET, scopeForQuestion('q-2'), {
    title: 'T', body: 'v1 body',
  })
  const v2 = await saveScopedVersion(s, SECRET, scopeForQuestion('q-2'), {
    title: 'T', body: 'v2 body',
  })
  assert.equal(v2.parent_version_id, v1.id)
  const answers = await findAnswersForOccurrence(s, 'q-2')
  assert.equal(answers.length, 1) // no duplicate answer per occurrence
})

await t('same occurrence under a program scope reuses the bank answer', async () => {
  const s = createMemoryStorage()
  await saveScopedVersion(s, SECRET, scopeForQuestion('q-3'), {
    title: 'T', body: 'bank body',
  })
  // Same question answered inside an application workspace: exact
  // occurrence binding, one logical answer (no second answer row).
  const v2 = await saveScopedVersion(s, SECRET, scopeForQuestion('q-3', 'prog-7'), {
    title: 'T', body: 'workspace body',
  })
  const answers = await findAnswersForOccurrence(s, 'q-3')
  assert.equal(answers.length, 1)
  assert.equal(v2.answer_id, answers[0].id)
})

await t('loadScopeEntry returns latest version + decrypted body', async () => {
  const s = createMemoryStorage()
  await saveScopedVersion(s, SECRET, scopeForQuestion('q-4'), {
    title: 'T', body: 'old body',
  })
  const v2 = await saveScopedVersion(s, SECRET, scopeForQuestion('q-4'), {
    title: 'T', body: 'new body',
  })
  const scoped = await loadScopeEntry(s, SECRET, scopeForQuestion('q-4'))
  assert.equal(scoped.latest.version.record.id, v2.id)
  assert.equal(scoped.latest.body, 'new body')
  assert.equal(scoped.latest.version.approval, null)
})

await t('loadScopeEntry prefers exact application scope when present', async () => {
  const s = createMemoryStorage()
  const scope = scopeForQuestion('q-5')
  await saveScopedVersion(s, SECRET, scope, { title: 'T', body: 'bank v' })
  const scoped = await loadScopeEntry(s, SECRET, scope)
  assert.equal(scoped.entry.answer.scope.application_id, PROFILE_BANK_APPLICATION_ID)
})

await t('loadBank groups versions under their answer', async () => {
  const s = createMemoryStorage()
  await saveScopedVersion(s, SECRET, scopeForQuestion('qa'), { title: 'A', body: 'a' })
  await saveScopedVersion(s, SECRET, scopeForQuestion('qb'), { title: 'B', body: 'b' })
  await saveScopedVersion(s, SECRET, scopeForQuestion('qa'), { title: 'A', body: 'a2' })
  const bank = await loadBank(s)
  assert.equal(bank.length, 2)
  const qa = bank.find((e) => e.answer.scope.question_occurrence_id === 'qa')
  assert.equal(qa.versions.length, 2)
})

await t('tryUnlock: empty vault accepts any secret; wrong secret refused', async () => {
  const s = createMemoryStorage()
  assert.equal(await tryUnlock(s, 'anything'), 'empty')
  await saveScopedVersion(s, SECRET, scopeForQuestion('q-6'), { title: 'T', body: 'x' })
  assert.equal(await tryUnlock(s, SECRET), 'ok')
  await assert.rejects(() => tryUnlock(s, 'nope'), VaultDecryptError)
})

console.log(`\n${passed} passed`)
