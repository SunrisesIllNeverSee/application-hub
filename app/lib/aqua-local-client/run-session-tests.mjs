// Self-contained aqua-local-client session adapter tests (no test runner).
// Run: node --import "$AQUARND/aqua-canon/Planning/Execution/m06/integration-recovery/reviews/ir-node-alias.mjs" lib/aqua-local-client/run-session-tests.mjs
//   (AQUARND = governance repo root; the shim resolves '@/lib' imports.)
// (Node >=22.6 type-strips .ts imports; storage is injected memory —
//  getStorage()/IndexedDB is never touched here.)
import assert from 'node:assert/strict'
import { createMemoryStorage } from '../aqua-local/vault.ts'
import { createAnswer, createVersion, approveVersion } from '../aqua-local/repo.ts'
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

await t('IR-001 strict scope: program-scoped save NEVER rebinds the bank answer', async () => {
  const s = createMemoryStorage()
  const vBank = await saveScopedVersion(s, SECRET, scopeForQuestion('q-3'), {
    title: 'T', body: 'bank body',
  })
  // Same question answered inside an application workspace gets its own
  // scoped answer — silent reuse of the bank slot was revoked at 80e8336
  // (a program save must not rewrite bank scope or block packet binding).
  const v2 = await saveScopedVersion(s, SECRET, scopeForQuestion('q-3', 'prog-7'), {
    title: 'T', body: 'workspace body',
  })
  const answers = await findAnswersForOccurrence(s, 'q-3')
  assert.equal(answers.length, 2)
  assert.notEqual(v2.answer_id, vBank.answer_id)
  const programAnswer = answers.find((a) => a.scope.application_id === 'prog-7')
  assert.ok(programAnswer, 'program-scoped answer exists')
  assert.equal(v2.answer_id, programAnswer.id)
  // bank answer untouched — still holds exactly the bank version
  const versions = (await s.getAll('versions')).filter((v) => v.answer_id === vBank.answer_id)
  assert.equal(versions.length, 1)
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

await t('loadBank: intake-scoped slots carry question text + entity label', async () => {
  const s = createMemoryStorage()
  const appId = 'local-intake-acme-abc123'
  await s.put('catalog_cache', {
    key: `intake:${appId}`,
    fetched_at: new Date().toISOString(),
    blob: {
      application_id: appId,
      entity: { name: 'Acme Incubator' },
      questions: [{ occurrence_id: `${appId}-q1`, text: 'What is your unfair advantage?', order_index: 1 }],
    },
  })
  await createAnswer(s, { application_id: appId, question_occurrence_id: `${appId}-q1` })
  const bank = await loadBank(s)
  const entry = bank.find((e) => e.answer.scope.application_id === appId)
  assert.equal(entry?.question_text, 'What is your unfair advantage?')
  assert.equal(entry?.intake_label, 'Acme Incubator')
})

await t('loadBank: encrypted intake blob decrypts + joins question text', async () => {
  const s = createMemoryStorage()
  const { encryptText } = await import('../aqua-local/crypto.ts')
  const appId = 'local-intake-acme-abc123'
  await s.put('catalog_cache', {
    key: `intake:${appId}`,
    fetched_at: new Date().toISOString(),
    blob_enc: JSON.stringify(await encryptText(SECRET, JSON.stringify({
      application_id: appId,
      entity: { name: 'Acme Incubator' },
      questions: [{ occurrence_id: `${appId}-q1`, text: 'What is your unfair advantage?', order_index: 1 }],
    }))),
  })
  await createAnswer(s, { application_id: appId, question_occurrence_id: `${appId}-q1` })
  const bank = await loadBank(s, SECRET)
  const entry = bank.find((e) => e.answer.scope.application_id === appId)
  assert.equal(entry?.question_text, 'What is your unfair advantage?')
  assert.equal(entry?.intake_label, 'Acme Incubator')
  // no secret → encrypted record skipped, slot still lists without the join
  const locked = await loadBank(s)
  const lockedEntry = locked.find((e) => e.answer.scope.application_id === appId)
  assert.ok(lockedEntry)
  assert.equal(lockedEntry.question_text, undefined)
})

await t('assertVaultSecretCompatible: intake-only vault refuses wrong secret', async () => {
  const s = createMemoryStorage()
  const { encryptText } = await import('../aqua-local/crypto.ts')
  const { assertVaultSecretCompatible } = await import('./session.ts')
  // vault holds ONLY an encrypted intake blob — no versions, no keys
  await s.put('catalog_cache', {
    key: 'intake:local-intake-x',
    fetched_at: new Date().toISOString(),
    blob_enc: JSON.stringify(await encryptText(SECRET, JSON.stringify({ application_id: 'local-intake-x', questions: [] }))),
  })
  await assertVaultSecretCompatible(s, SECRET) // passes
  await assert.rejects(() => assertVaultSecretCompatible(s, 'wrong-secret'), VaultDecryptError)
})

await t('IR-026: cross-scope derivation — derived_from preserved, approval not inherited', async () => {
  const s = createMemoryStorage()
  const SECRET = 's2'
  const a1 = await createAnswer(s, { application_id: 'app-bank', question_occurrence_id: 'q-why' })
  const v1 = await createVersion(s, SECRET, {
    answer_id: a1.id, title: 'Why us', body: 'bank answer body text',
    method: 'manual', provenance: 'seed',
  })
  await approveVersion(s, { version_id: v1.id, version_sha256: v1.sha256, decision: 'approved', actor_class: 'human' })
  // reuse the bank body into a DIFFERENT application scope — root version
  // (no same-answer parent) but provenance is preserved via derived_from
  const v2 = await saveScopedVersion(s, SECRET,
    { application_id: 'app-target', question_occurrence_id: 'q1' },
    {
      title: 'Why us', body: 'bank answer body text',
      method: 'manual', provenance: 'reused',
      derived_from: { version_id: v1.id, version_sha256: v1.sha256 },
    })
  assert.equal(v2.parent_version_id, null, 'scope crossing stays a root version')
  assert.equal(v2.derived_from?.version_id, v1.id, 'derivation link preserved')
  assert.equal(v2.derived_from?.version_sha256, v1.sha256, 'source sha pinned')
  // source approval does NOT transfer — the derived version is unapproved
  const approvals = await s.getAll('approvals')
  assert.equal(approvals.filter((a) => a.version_id === v2.id).length, 0, 'no approval inheritance')
  // backup roundtrip keeps the derivation metadata
  const { exportVault, importVault } = await import('../aqua-local/backup.ts')
  const exported = await exportVault(s, SECRET)
  const s3 = createMemoryStorage()
  await importVault(s3, SECRET, exported)
  const restored = (await s3.getAll('versions')).find((v) => v.id === v2.id)
  assert.equal(restored?.derived_from?.version_id, v1.id, 'derivation survives restore')
})

console.log(`\n${passed} passed`)
