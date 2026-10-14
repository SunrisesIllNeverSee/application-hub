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
import { exportVault, importVault, previewVaultImport, VaultTamperError } from './backup.ts'
import {
  storeProviderKey, generateWithConsent,
  createAnthropicAdapter, createOpenAiAdapter, createGoogleAdapter, createOllamaAdapter,
  ProviderConsentError, ProviderKeyError, ProviderEgressError,
} from './providers.ts'
import { findRelatedVaultAnswers } from './match.ts'
import { runVaultPrivacyMigration, decryptVersionTitle } from './repo.ts'

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

await t('preview: counts insert vs skip, writes nothing', async () => {
  const s1 = createMemoryStorage()
  const a = await createAnswer(s1, { application_id: 'app1', question_occurrence_id: 'q1' })
  await createVersion(s1, SECRET, { answer_id: a.id, title: 't-one', body: 'b1', method: 'manual' })
  const dump = await exportVault(s1, SECRET)

  // fresh vault: everything would insert
  const s2 = createMemoryStorage()
  const p1 = await previewVaultImport(s2, SECRET, dump)
  assert.equal(p1.stores.versions.insert, 1)
  assert.equal(p1.stores.versions.skip, 0)
  assert.equal(p1.stores.answers.insert, 1)
  assert.ok(p1.total_insert >= 2) // answer + version (+ receipts)
  assert.deepEqual(p1.version_titles, ['t-one'])
  // dry-run wrote nothing
  assert.equal((await s2.getAll('versions')).length, 0)
  assert.equal((await s2.getAll('imports')).length, 0)

  // after a real restore, a second preview reports all-skip
  await importVault(s2, SECRET, dump)
  const p2 = await previewVaultImport(s2, SECRET, dump)
  assert.equal(p2.stores.versions.insert, 0)
  assert.equal(p2.stores.versions.skip, 1)
  assert.equal(p2.total_insert, 0)
})

await t('malformed backup → wholesale refusal, zero partial writes (FB7R-07)', async () => {
  const s1 = createMemoryStorage()
  const a = await createAnswer(s1, { application_id: 'app1', question_occurrence_id: 'q1' })
  await createVersion(s1, SECRET, { answer_id: a.id, title: 't', body: 'real', method: 'manual' })
  const dump = await exportVault(s1, SECRET)
  const { decryptText, encryptText } = await import('./crypto.ts')
  const env = JSON.parse(dump)
  const payload = JSON.parse(await decryptText(SECRET, env))

  // object body_plaintext (was: "[object Object]" sha garbage)
  const bad1 = { ...payload, versions: [{ ...payload.versions[0], body_plaintext: { x: 1 } }] }
  const s2 = createMemoryStorage()
  const forged1 = JSON.stringify({ format: 'aqua-local-backup', ...(await encryptText(SECRET, canonicalJson(bad1))) })
  await assert.rejects(() => importVault(s2, SECRET, forged1), VaultTamperError)
  await assert.rejects(() => previewVaultImport(s2, SECRET, forged1), VaultTamperError)
  assert.equal((await s2.getAll('versions')).length, 0)

  // version missing dedupe id — previously a mid-loop partial import
  const bad2 = { ...payload, versions: [{ ...payload.versions[0], id: undefined }] }
  const forged2 = JSON.stringify({ format: 'aqua-local-backup', ...(await encryptText(SECRET, canonicalJson(bad2))) })
  await assert.rejects(() => importVault(s2, SECRET, forged2), VaultTamperError)
  assert.equal((await s2.getAll('versions')).length, 0)
  assert.equal((await s2.getAll('imports')).length, 0)

  // non-array store
  const bad3 = { ...payload, answers: { id: a.id } }
  const forged3 = JSON.stringify({ format: 'aqua-local-backup', ...(await encryptText(SECRET, canonicalJson(bad3))) })
  await assert.rejects(() => importVault(s2, SECRET, forged3), VaultTamperError)
})

await t('preview: same refusals as import (wrong secret + tamper)', async () => {
  const s1 = createMemoryStorage()
  const a = await createAnswer(s1, { application_id: 'app1', question_occurrence_id: 'q1' })
  await createVersion(s1, SECRET, { answer_id: a.id, title: 't', body: 'x', method: 'manual' })
  const dump = await exportVault(s1, SECRET)
  const s2 = createMemoryStorage()
  await assert.rejects(() => previewVaultImport(s2, 'nope', dump), VaultDecryptError)
  await assert.rejects(() => previewVaultImport(s2, SECRET, '{"format":"other"}'), VaultTamperError)
  assert.equal((await s2.getAll('versions')).length, 0)
})

await t('approval records decision', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  const v = await createVersion(s, SECRET, { answer_id: a.id, title: 'v1', body: 'x', method: 'imported' })
  const ap = await approveVersion(s, { version_id: v.id, decision: 'approved', actor_class: 'human' })
  assert.equal(ap.decision, 'approved')
})

// --- typed BYOK adapters (SP021): request shape + auth header per provider ---
await t('anthropic adapter: native messages shape + browser-access header', async () => {
  const s = createMemoryStorage()
  await storeProviderKey(s, SECRET, 'anthropic', 'sk-ant-test')
  const adapter = createAnthropicAdapter({ model: 'claude-test' })
  let seen = null
  const fetchImpl = async (url, init) => {
    seen = { url, init, body: JSON.parse(init.body) }
    return new Response(JSON.stringify({
      content: [{ type: 'text', text: 'draft text' }],
      model: 'claude-test-1',
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const { result, consent } = await generateWithConsent(
    s, adapter, { prompt: 'Q?', system: 'sys' }, { userConsent: true, secret: SECRET, fetchImpl })
  assert.equal(result.text, 'draft text')
  assert.equal(seen.url, 'https://api.anthropic.com/v1/messages')
  assert.equal(seen.init.headers['x-api-key'], 'sk-ant-test')
  assert.equal(seen.init.headers['anthropic-dangerous-direct-browser-access'], 'true')
  assert.equal(seen.body.messages[0].content, 'Q?')
  assert.equal(seen.body.system, 'sys')
  assert.equal(result.provider, 'anthropic')
  assert.ok(result.observed.includes('model_reported'))
  assert.ok(consent.id)
})

await t('openai adapter: chat/completions shape + bearer', async () => {
  const s = createMemoryStorage()
  await storeProviderKey(s, SECRET, 'openai', 'sk-test')
  const adapter = createOpenAiAdapter({ model: 'gpt-x' })
  let seen = null
  const fetchImpl = async (url, init) => {
    seen = { url, init, body: JSON.parse(init.body) }
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'hi' } }], model: 'gpt-x',
    }), { status: 200 })
  }
  const { result } = await generateWithConsent(
    s, adapter, { prompt: 'Q?', system: 'S' }, { userConsent: true, secret: SECRET, fetchImpl })
  assert.equal(seen.url, 'https://api.openai.com/v1/chat/completions')
  assert.equal(seen.init.headers.authorization, 'Bearer sk-test')
  assert.equal(seen.body.messages.length, 2)
  assert.equal(result.model, 'gpt-x')
})

await t('google adapter: generateContent + model echo', async () => {
  const s = createMemoryStorage()
  await storeProviderKey(s, SECRET, 'google', 'gkey')
  const adapter = createGoogleAdapter({ model: 'gemini-x' })
  let seen = null
  const fetchImpl = async (url, init) => {
    seen = { url, init, body: JSON.parse(init.body) }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'gemini out' }] } }],
      modelVersion: 'gemini-x-001',
    }), { status: 200 })
  }
  const { result } = await generateWithConsent(
    s, adapter, { prompt: 'Q?' }, { userConsent: true, secret: SECRET, fetchImpl })
  assert.ok(seen.url.includes(':generateContent'))
  assert.equal(seen.init.headers['x-goog-api-key'], 'gkey')
  assert.equal(result.text, 'gemini out')
  assert.equal(result.model, 'gemini-x-001')
})

await t('ollama adapter: endpoint-only (no key required) + native /api/chat', async () => {
  const s = createMemoryStorage()
  await storeProviderKey(s, SECRET, 'ollama', '', { base_url: 'http://localhost:11434' })
  const adapter = createOllamaAdapter({ base_url: 'http://localhost:11434', model: 'llama3.2' })
  let seen = null
  const fetchImpl = async (url, init) => {
    seen = { url, init, body: JSON.parse(init.body) }
    return new Response(JSON.stringify({
      message: { content: 'local out' }, model: 'llama3.2',
    }), { status: 200 })
  }
  const { result } = await generateWithConsent(
    s, adapter, { prompt: 'Q?' }, { userConsent: true, secret: SECRET, fetchImpl })
  assert.equal(seen.url, 'http://localhost:11434/api/chat')
  assert.equal(seen.body.stream, false)
  assert.equal(result.text, 'local out')
})

await t('missing consent → ProviderConsentError, no egress', async () => {
  const s = createMemoryStorage()
  await storeProviderKey(s, SECRET, 'anthropic', 'sk-ant-test')
  let calls = 0
  const fetchImpl = async () => { calls++; return new Response('{}') }
  await assert.rejects(
    () => generateWithConsent(
      s, createAnthropicAdapter(), { prompt: 'x' },
      { userConsent: false, secret: SECRET, fetchImpl }),
    ProviderConsentError)
  assert.equal(calls, 0)
  assert.equal((await s.getAll('provider_consents')).length, 0)
})

await t('no stored key → ProviderKeyError, consent receipt still written first', async () => {
  const s = createMemoryStorage()
  const fetchImpl = async () => new Response('{}')
  await assert.rejects(
    () => generateWithConsent(
      s, createAnthropicAdapter(), { prompt: 'x' },
      { userConsent: true, secret: SECRET, fetchImpl }),
    ProviderKeyError)
  // Consent was recorded before the key check — the audit trail exists even
  // though the call failed.
  assert.equal((await s.getAll('provider_consents')).length, 1)
})

await t('provider error propagates honestly (401)', async () => {
  const s = createMemoryStorage()
  await storeProviderKey(s, SECRET, 'openai', 'bad-key')
  const fetchImpl = async () => new Response('{"error":"invalid"}', { status: 401 })
  await assert.rejects(
    () => generateWithConsent(
      s, createOpenAiAdapter(), { prompt: 'x' },
      { userConsent: true, secret: SECRET, fetchImpl }),
    ProviderEgressError)
})

// --- SP024 local matcher ---
await t('match: overlap score + related vault answers are local-only', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'answer-bank', question_occurrence_id: 'qa' })
  await createVersion(s, SECRET, {
    answer_id: a.id, title: 'leadership',
    body: 'I led a cross-functional team through a product launch.',
    method: 'manual',
  })
  const hits = await findRelatedVaultAnswers(s, SECRET, 'Describe a time you led a team')
  assert.equal(hits.length, 1)
  assert.ok(hits[0].similarity > 0)
  assert.equal(hits[0].preview.slice(0, 10), 'I led a cr')
  const misses = await findRelatedVaultAnswers(s, SECRET, 'zzzzqqq unrelated tokens xyz')
  assert.equal(misses.length, 0)
})

// --- IR-014/035: unlock-time privacy migration over legacy plaintext ---
await t('privacy migration encrypts legacy titles + intake blobs', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  // simulate a legacy record: plaintext title, no title_enc flag
  const legacy = await createVersion(s, SECRET, { answer_id: a.id, title: 'legacy title', body: 'body', method: 'manual' })
  const stored = await s.get('versions', legacy.id)
  const { title_enc: _te, ...rest } = stored
  await s.put('versions', { ...rest, title: 'legacy title' }) // strip flag → legacy plaintext record
  // legacy intake catalog row: plaintext blob
  await s.put('catalog_cache', {
    key: 'intake:local-intake-x',
    blob: { application_id: 'local-intake-x', entity: { name: 'Acme' }, questions: [{ occurrence_id: 'q1', text: 'Why Acme?' }] },
    fetched_at: new Date().toISOString(),
  })
  const res = await runVaultPrivacyMigration(s, SECRET)
  assert.equal(res.titles_migrated, 1)
  assert.equal(res.catalog_migrated, 1)
  const afterV = await s.get('versions', legacy.id)
  assert.equal(afterV.title_enc, true)
  assert.notEqual(afterV.title, 'legacy title') // ciphertext now
  assert.equal(await decryptVersionTitle(SECRET, afterV), 'legacy title') // still readable
  const afterC = await s.get('catalog_cache', 'intake:local-intake-x')
  assert.equal(afterC.blob, undefined)
  assert.ok(afterC.blob_enc)
})

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`)
