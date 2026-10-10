// Self-contained aqua-local test script (no test runner in repo).
// Run: node lib/aqua-local/run-tests.mjs   (Node >=22.6 type-strips .ts imports)
import assert from 'node:assert/strict'
import { createMemoryStorage } from './vault.ts'
import {
  createAnswer, createVersion, readVersion, listVersions,
  approveVersion, freezePacket, signPacket,
  VaultScopeError, VaultBlankBodyError, VaultImmutableError,
} from './repo.ts'
import { VaultDecryptError, canonicalJson, sha256Hex } from './crypto.ts'
import { putCatalog, getCatalog, getCatalogOffline } from './catalog.ts'
import { exportVault, importVault, VaultTamperError } from './backup.ts'

const SECRET = 'correct-horse-battery-staple'
let passed = 0
async function t(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`) }
  catch (e) { console.error(`FAIL ${name}: ${e.message}`); process.exitCode = 1 }
}

// --- crypto: encrypt/decrypt roundtrip + wrong secret ---
await t('encrypt/decrypt roundtrip', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  const v = await createVersion(s, SECRET, { answer_id: a.id, title: 'v1', body: 'hello', method: 'manual' })
  const r = await readVersion(s, SECRET, v.id)
  assert.equal(r.body, 'hello')
})

await t('wrong secret → clean refusal', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  const v = await createVersion(s, SECRET, { answer_id: a.id, title: 'v1', body: 'hello', method: 'manual' })
  await assert.rejects(() => readVersion(s, 'wrong-secret', v.id), VaultDecryptError)
})

await t('tampered ciphertext → refusal', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  const v = await createVersion(s, SECRET, { answer_id: a.id, title: 'v1', body: 'hello', method: 'manual' })
  const blob = JSON.parse(v.body)
  blob.ct_b64 = blob.ct_b64.slice(0, -4) + 'AAAA'
  await s.put('versions', { ...v, body: JSON.stringify(blob) })
  await assert.rejects(() => readVersion(s, SECRET, v.id), VaultDecryptError)
})

// --- repo: immutable parent chain ---
await t('immutable versions + parent chain', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  const v1 = await createVersion(s, SECRET, { answer_id: a.id, title: 'v1', body: 'first', method: 'manual' })
  const v2 = await createVersion(s, SECRET, { answer_id: a.id, parent_version_id: v1.id, title: 'v2', body: 'second', method: 'byok', provider: 'openai', model: 'gpt-5' })
  assert.equal(v2.parent_version_id, v1.id)
  const vs = await listVersions(s, a.id)
  assert.equal(vs.length, 2)
  assert.equal((await readVersion(s, SECRET, v1.id)).body, 'first') // v1 unchanged
  assert.equal(v1.sha256, await sha256Hex(canonicalJson({ title: 'v1', body: 'first' })))
})

await t('cross-scope parent refused', async () => {
  const s = createMemoryStorage()
  const a1 = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  const a2 = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q2' })
  const v1 = await createVersion(s, SECRET, { answer_id: a1.id, title: 'v1', body: 'first', method: 'manual' })
  await assert.rejects(
    () => createVersion(s, SECRET, { answer_id: a2.id, parent_version_id: v1.id, title: 'x', body: 'y', method: 'manual' }),
    VaultScopeError,
  )
})

await t('blank/invisible bodies refused', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  for (const bad of ['', '   ', '​', '﻿  ​', '\t\n ']) {
    await assert.rejects(
      () => createVersion(s, SECRET, { answer_id: a.id, title: 'x', body: bad, method: 'manual' }),
      VaultBlankBodyError,
      `body ${JSON.stringify(bad)}`,
    )
  }
})

await t('packet freeze + signoff (single sign per packet)', async () => {
  const s = createMemoryStorage()
  const p = await freezePacket(s, { application_id: 'app1', manifest: { files: ['a.pdf'], n: 1 } })
  assert.equal(p.manifest_sha256, await sha256Hex(canonicalJson({ files: ['a.pdf'], n: 1 })))
  await assert.rejects(() => signPacket(s, { packet_id: p.id, signer_class: 'human' }), /user acknowledgement/)
  const so = await signPacket(s, { packet_id: p.id, signer_class: 'human', user_ack: true })
  assert.equal(so.signature_b64, null)
  await assert.rejects(
    () => signPacket(s, { packet_id: p.id, signer_class: 'human', user_ack: true }),
    VaultImmutableError,
  )
})

// --- catalog: TTL + offline ---
await t('catalog cache: TTL + offline cached flag', async () => {
  const s = createMemoryStorage()
  await putCatalog(s, 'opps', [{ id: 'o1' }])
  const hit = await getCatalog(s, 'opps', 1000)
  assert.equal(hit.flag, 'cached'); assert.equal(hit.stale, false)
  const staleHit = await getCatalog(s, 'opps', -1)
  assert.equal(staleHit.stale, true)
  const off = await getCatalogOffline(s, 'opps')
  assert.equal(off.flag, 'cached')
  assert.equal(await getCatalog(s, 'missing'), null)
})

// --- backup: roundtrip, dedup, tamper, wrong secret, version guard ---
await t('backup roundtrip into fresh vault', async () => {
  const s1 = createMemoryStorage()
  const a = await createAnswer(s1, { application_id: 'app1', question_occurrence_id: 'q1' })
  await createVersion(s1, SECRET, { answer_id: a.id, title: 'v1', body: 'body-one', method: 'manual' })
  const dump = await exportVault(s1, SECRET)

  const s2 = createMemoryStorage()
  const res = await importVault(s2, SECRET, dump)
  assert.equal(res.counts.versions, 1)
  const vs2 = await listVersions(s2, a.id)
  assert.equal((await readVersion(s2, SECRET, vs2[0].id)).body, 'body-one')

  // dedup: second import inserts nothing
  const res2 = await importVault(s2, SECRET, dump)
  assert.equal(res2.counts.versions ?? 0, 0)
  assert.ok(res2.skipped_duplicates >= 1)
})

await t('backup wrong secret refused', async () => {
  const s1 = createMemoryStorage()
  const a = await createAnswer(s1, { application_id: 'app1', question_occurrence_id: 'q1' })
  await createVersion(s1, SECRET, { answer_id: a.id, title: 'v1', body: 'x', method: 'manual' })
  const dump = await exportVault(s1, SECRET)
  await assert.rejects(() => importVault(createMemoryStorage(), 'nope', dump), VaultDecryptError)
})

await t('backup tamper refused', async () => {
  const s1 = createMemoryStorage()
  const a = await createAnswer(s1, { application_id: 'app1', question_occurrence_id: 'q1' })
  await createVersion(s1, SECRET, { answer_id: a.id, title: 'v1', body: 'x', method: 'manual' })
  const dump = JSON.parse(await exportVault(s1, SECRET))
  dump.ct_b64 = dump.ct_b64.slice(0, -4) + 'BBBB'
  await assert.rejects(() => importVault(createMemoryStorage(), SECRET, JSON.stringify(dump)), VaultDecryptError)
})

await t('backup inner sha tamper → VaultTamperError', async () => {
  const s1 = createMemoryStorage()
  const a = await createAnswer(s1, { application_id: 'app1', question_occurrence_id: 'q1' })
  await createVersion(s1, SECRET, { answer_id: a.id, title: 'v1', body: 'real', method: 'manual' })
  const dump = await exportVault(s1, SECRET)
  // craft a backup whose inner sha256 is forged: decrypt→edit→re-encrypt under same secret
  const { decryptText, encryptText } = await import('./crypto.ts')
  const env = JSON.parse(dump)
  const payload = JSON.parse(await decryptText(SECRET, env))
  payload.versions[0].sha256 = '0'.repeat(64)
  const forged = JSON.stringify({ format: 'aqua-local-backup', ...(await encryptText(SECRET, canonicalJson(payload))) })
  await assert.rejects(() => importVault(createMemoryStorage(), SECRET, forged), VaultTamperError)
})

await t('approval records decision', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  const v = await createVersion(s, SECRET, { answer_id: a.id, title: 'v1', body: 'x', method: 'imported' })
  const ap = await approveVersion(s, { version_id: v.id, decision: 'approved', actor_class: 'human' })
  assert.equal(ap.decision, 'approved')
})

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`)
