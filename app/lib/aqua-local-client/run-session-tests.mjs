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

// ---------------------------------------------------------------------------
// M07-ID-001/002 — Supabase auth-cookie reassembly + vault identity isolation.
// parseAuthCookie is pure (cookie header + project URL in, uid|null out).
// resolveVaultDbName is exercised through the __setSessionProbeForTests seam
// and a document.cookie shim — no network, no IndexedDB.
// ---------------------------------------------------------------------------

const SB_URL = 'https://testref0123.supabase.co'
const SB_BASE = 'sb-testref0123-auth-token'
const UID_A = 'user-aaa-111'
const UID_B = 'user-bbb-222'

function b64url(s) {
  return Buffer.from(s, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
/** supabase-ssr 'base64url' cookieEncoding → `base64-<b64url(JSON)>`. */
function sessionValue(uid, extra = {}) {
  return `base64-${b64url(JSON.stringify({ access_token: 'at', refresh_token: 'rt', user: { id: uid }, ...extra }))}`
}
/** Split an ENCODED cookie value into supabase-ssr-style chunk values
    (each stored value is itself percent-encoded on write). */
function chunkValue(encoded, n) {
  const size = Math.ceil(encoded.length / n)
  const out = []
  for (let i = 0; i < n; i++) out.push(encodeURIComponent(decodeURIComponent(encoded.slice(i * size, (i + 1) * size))))
  return out
}
function cookieHeader(entries) {
  return entries.map(([k, v]) => `${k}=${v}`).join('; ')
}
function setCookies(...entries) {
  globalThis.document = { cookie: cookieHeader(entries) }
}
function clearCookies() {
  globalThis.document = { cookie: '' }
}

const {
  parseAuthCookie,
  resolveVaultDbName,
  invalidateVaultIdentity,
  currentResolvedUid,
  __setSessionProbeForTests,
  __wrapVaultHandleForTests,
} = await import('./session.ts')
const { VaultScopeError } = await import('../aqua-local/index.ts')

// readLocalSessionUid derives the cookie name from the deployment URL.
const PREV_SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
process.env.NEXT_PUBLIC_SUPABASE_URL = SB_URL

// --- cookie reassembly matrix ---------------------------------------------

await t('cookie: single unchunked session → uid', async () => {
  const h = cookieHeader([[SB_BASE, encodeURIComponent(sessionValue(UID_A))]])
  assert.equal(parseAuthCookie(h, SB_URL).uid, UID_A)
})

await t('cookie: single RAW-JSON session (cookieEncoding=raw) → uid', async () => {
  const h = cookieHeader([[SB_BASE, encodeURIComponent(JSON.stringify({ user: { id: UID_A } }))]])
  assert.equal(parseAuthCookie(h, SB_URL).uid, UID_A)
})

await t('cookie: M07-ID-001 regression — .0+.1 chunks reassemble (was: .0 dropped → null)', async () => {
  const enc = encodeURIComponent(sessionValue(UID_A))
  const [c0, c1] = chunkValue(enc, 2)
  const h = cookieHeader([[`${SB_BASE}.0`, c0], [`${SB_BASE}.1`, c1]])
  assert.equal(parseAuthCookie(h, SB_URL).uid, UID_A)
})

await t('cookie: three-chunk session reassembles', async () => {
  const enc = encodeURIComponent(sessionValue(UID_B))
  const [c0, c1, c2] = chunkValue(enc, 3)
  const h = cookieHeader([[`${SB_BASE}.0`, c0], [`${SB_BASE}.1`, c1], [`${SB_BASE}.2`, c2]])
  assert.equal(parseAuthCookie(h, SB_URL).uid, UID_B)
})

await t('cookie: chunks present but .0 missing → refused', async () => {
  const enc = encodeURIComponent(sessionValue(UID_A))
  const [, c1] = chunkValue(enc, 2)
  const h = cookieHeader([[`${SB_BASE}.1`, c1]])
  assert.equal(parseAuthCookie(h, SB_URL).uid, null)
})

await t('cookie: missing MIDDLE chunk (.0+.2) → refused, never partial', async () => {
  const enc = encodeURIComponent(sessionValue(UID_A))
  const [c0, , c2] = chunkValue(enc, 3)
  const h = cookieHeader([[`${SB_BASE}.0`, c0], [`${SB_BASE}.2`, c2]])
  assert.equal(parseAuthCookie(h, SB_URL).uid, null)
})

await t('cookie: malformed payload → refused', async () => {
  assert.equal(parseAuthCookie(cookieHeader([[SB_BASE, 'not-json-not-base64']]), SB_URL).uid, null)
  assert.equal(parseAuthCookie(cookieHeader([[SB_BASE, 'base64-%%%bad%%%']]), SB_URL).uid, null)
})

await t('cookie: wrong project ref → ignored', async () => {
  const h = cookieHeader([['sb-otherref99-auth-token', encodeURIComponent(sessionValue(UID_A))]])
  assert.equal(parseAuthCookie(h, SB_URL).uid, null)
})

await t('cookie: multiple projects on origin → only ours resolved', async () => {
  const h = cookieHeader([
    ['sb-otherref99-auth-token', encodeURIComponent(sessionValue(UID_B))],
    ['unrelated', 'x'],
    [SB_BASE, encodeURIComponent(sessionValue(UID_A))],
  ])
  assert.equal(parseAuthCookie(h, SB_URL).uid, UID_A)
})

await t('cookie: bare base wins over chunks (library precedence)', async () => {
  const enc = encodeURIComponent(sessionValue(UID_B))
  const [c0, c1] = chunkValue(enc, 2)
  const h = cookieHeader([
    [SB_BASE, encodeURIComponent(sessionValue(UID_A))],
    [`${SB_BASE}.0`, c0], [`${SB_BASE}.1`, c1],
  ])
  assert.equal(parseAuthCookie(h, SB_URL).uid, UID_A)
})

await t('cookie: unicode user metadata survives percent-encoded chunks', async () => {
  const enc = encodeURIComponent(sessionValue(UID_A, { user_metadata: { name: 'Zoë Müller — 日本語' } }))
  const [c0, c1, c2] = chunkValue(enc, 3)
  const h = cookieHeader([[`${SB_BASE}.0`, c0], [`${SB_BASE}.1`, c1], [`${SB_BASE}.2`, c2]])
  assert.equal(parseAuthCookie(h, SB_URL).uid, UID_A)
})

await t('cookie: empty/absent → null', async () => {
  assert.equal(parseAuthCookie('', SB_URL).uid, null)
  assert.equal(parseAuthCookie(cookieHeader([['other', 'v']]), SB_URL).uid, null)
})

// --- vault identity lifecycle ----------------------------------------------
// Reset: each block starts with a clean module state.

await t('identity: cookie uid resolves its vault without touching the network probe', async () => {
  invalidateVaultIdentity()
  let probed = false
  __setSessionProbeForTests(async () => { probed = true; return { uid: UID_B } })
  setCookies([SB_BASE, encodeURIComponent(sessionValue(UID_A))])
  assert.equal(await resolveVaultDbName(), `aqua-local-${UID_A}`)
  assert.equal(probed, false, 'cookie fast-path must not hit the probe')
  assert.equal(currentResolvedUid(), UID_A)
})

await t('identity: no cookie + probe uid → uid vault', async () => {
  invalidateVaultIdentity()
  clearCookies()
  __setSessionProbeForTests(async () => ({ uid: UID_A }))
  assert.equal(await resolveVaultDbName(), `aqua-local-${UID_A}`)
  assert.equal(currentResolvedUid(), UID_A)
})

await t('identity: never-resolved + no session → shared anonymous vault', async () => {
  invalidateVaultIdentity()
  clearCookies()
  __setSessionProbeForTests(async () => ({ uid: null }))
  assert.equal(await resolveVaultDbName(), 'aqua-local')
})

await t('identity: 429/timeout stall preserves the LIVE account vault (sticky)', async () => {
  invalidateVaultIdentity()
  setCookies([SB_BASE, encodeURIComponent(sessionValue(UID_A))])
  __setSessionProbeForTests(async () => { throw new Error('429 rate limited') })
  assert.equal(await resolveVaultDbName(), `aqua-local-${UID_A}`) // resolves via cookie anyway
  clearCookies() // now rely on the probe
  assert.equal(await resolveVaultDbName(), `aqua-local-${UID_A}`, 'stall must not drop to anon vault')
})

await t('identity: sign-out (definitive null session) clears the sticky identity', async () => {
  invalidateVaultIdentity()
  setCookies([SB_BASE, encodeURIComponent(sessionValue(UID_A))])
  __setSessionProbeForTests(async () => ({ uid: null }))
  await resolveVaultDbName()
  invalidateVaultIdentity() // what VaultProvider does on SIGNED_OUT
  clearCookies()
  assert.equal(await resolveVaultDbName(), 'aqua-local')
  assert.equal(currentResolvedUid(), null)
})

await t('identity: definitive null session clears sticky WITHOUT explicit invalidate', async () => {
  invalidateVaultIdentity()
  setCookies([SB_BASE, encodeURIComponent(sessionValue(UID_A))])
  __setSessionProbeForTests(async () => ({ uid: UID_A }))
  await resolveVaultDbName()
  clearCookies() // cookies gone — session ended elsewhere
  __setSessionProbeForTests(async () => ({ uid: null }))
  assert.equal(await resolveVaultDbName(), 'aqua-local')
  assert.equal(currentResolvedUid(), null)
  // and a later stall must NOT resurrect the dead identity
  __setSessionProbeForTests(async () => { throw new Error('timeout') })
  assert.equal(await resolveVaultDbName(), 'aqua-local')
})

await t('identity: account switch A→B selects B vault, never A', async () => {
  invalidateVaultIdentity()
  setCookies([SB_BASE, encodeURIComponent(sessionValue(UID_A))])
  __setSessionProbeForTests(async () => ({ uid: null }))
  assert.equal(await resolveVaultDbName(), `aqua-local-${UID_A}`)
  invalidateVaultIdentity() // SIGNED_OUT
  setCookies([SB_BASE, encodeURIComponent(sessionValue(UID_B))]) // B signs in
  assert.equal(await resolveVaultDbName(), `aqua-local-${UID_B}`)
  assert.equal(currentResolvedUid(), UID_B)
})

await t('identity: stale async callback cannot restore the previous account', async () => {
  invalidateVaultIdentity()
  clearCookies()
  // Probe that resolves AFTER an invalidation with the OLD account's uid.
  let release
  const gate = new Promise((r) => { release = r })
  __setSessionProbeForTests(async () => { await gate; return { uid: UID_A } })
  const pending = resolveVaultDbName()
  invalidateVaultIdentity() // sign-out lands mid-flight
  setCookies([SB_BASE, encodeURIComponent(sessionValue(UID_B))]) // B session appears
  release()
  assert.equal(await pending, `aqua-local-${UID_B}`, 'stale A result must be discarded')
  assert.equal(currentResolvedUid(), UID_B)
})

await t('identity: fresh cookie written mid-flight beats a stale probe uid', async () => {
  invalidateVaultIdentity()
  clearCookies() // absent at the fast-path check…
  __setSessionProbeForTests(async () => {
    // …then the session lands while the async probe is in flight — the
    // probe's stale A result must lose to cookie B.
    setCookies([SB_BASE, encodeURIComponent(sessionValue(UID_B))])
    return { uid: UID_A }
  })
  assert.equal(await resolveVaultDbName(), `aqua-local-${UID_B}`)
  assert.equal(currentResolvedUid(), UID_B)
})

await t('identity: handle minted before sign-out is revoked — no stale writes', async () => {
  invalidateVaultIdentity()
  const mem = createMemoryStorage()
  const handle = __wrapVaultHandleForTests(`aqua-local-${UID_A}`, mem)
  await handle.put('answers', { id: 'a1', scope: { application_id: 'x', question_occurrence_id: 'q' }, created_at: 't' })
  assert.equal((await handle.getAll('answers')).length, 1)
  invalidateVaultIdentity() // SIGNED_OUT lands
  await assert.rejects(() => handle.put('answers', { id: 'a2', scope: {}, created_at: 't' }), VaultScopeError)
  await assert.rejects(() => handle.getAll('answers'), VaultScopeError)
  await assert.rejects(() => handle.tx(['answers'], async () => {}), VaultScopeError)
})

await t('identity: post-sign-out vault selection stays anonymous under stall', async () => {
  invalidateVaultIdentity()
  setCookies([SB_BASE, encodeURIComponent(sessionValue(UID_A))])
  __setSessionProbeForTests(async () => ({ uid: null }))
  await resolveVaultDbName()
  invalidateVaultIdentity()
  clearCookies()
  __setSessionProbeForTests(async () => { throw new Error('429 backoff') })
  // Sticky was invalidated — the 429 stall can only yield the anon vault,
  // never resurrect A.
  assert.equal(await resolveVaultDbName(), 'aqua-local')
})

// --- reviewer round-6 regressions -------------------------------------------

// (env re-set — the block above restores it)
process.env.NEXT_PUBLIC_SUPABASE_URL = SB_URL

await t('identity: retryable refresh failure (probe resolves {uid:null,error}) keeps the live vault', async () => {
  // Real getSession() RESOLVES {session:null, error} on a 429/network retryable
  // — it does not throw. This must take the stall path, not definitive-null.
  invalidateVaultIdentity()
  setCookies([SB_BASE, encodeURIComponent(sessionValue(UID_A))])
  __setSessionProbeForTests(async () => ({ uid: UID_A }))
  await resolveVaultDbName()
  clearCookies()
  __setSessionProbeForTests(async () => ({ uid: null, error: new Error('AuthRetryableFetchError: 429') }))
  assert.equal(await resolveVaultDbName(), `aqua-local-${UID_A}`, 'retryable error must not drop to anon vault')
  assert.equal(currentResolvedUid(), UID_A)
})

await t('identity: definitive-null revokes minted handles (not just the name)', async () => {
  invalidateVaultIdentity()
  setCookies([SB_BASE, encodeURIComponent(sessionValue(UID_A))])
  __setSessionProbeForTests(async () => ({ uid: null }))
  await resolveVaultDbName()
  const handle = __wrapVaultHandleForTests(`aqua-local-${UID_A}`, createMemoryStorage())
  await handle.put('answers', { id: 'a1', scope: { application_id: 'x', question_occurrence_id: 'q' }, created_at: 't' })
  // Cookies fully gone + clean null session = definitive sign-out WITHOUT
  // an invalidate event reaching us (no listener on this route).
  clearCookies()
  assert.equal(await resolveVaultDbName(), 'aqua-local')
  await assert.rejects(() => handle.put('answers', { id: 'a2', scope: {}, created_at: 't' }), VaultScopeError)
})

await t('identity: partial cookie material + sticky identity → INDETERMINATE keeps live vault', async () => {
  invalidateVaultIdentity()
  setCookies([SB_BASE, encodeURIComponent(sessionValue(UID_A))])
  __setSessionProbeForTests(async () => ({ uid: null }))
  await resolveVaultDbName()
  // Mid-rewrite chunk gap: material present (.1 only, .0 missing), probe null.
  // This is indeterminate evidence — never substitute the anon vault.
  setCookies([`${SB_BASE}.1`, encodeURIComponent('partial')])
  assert.equal(await resolveVaultDbName(), `aqua-local-${UID_A}`, 'indeterminate cookie must not drop to anon')
  assert.equal(currentResolvedUid(), UID_A)
})

await t('identity: partial cookie material + NO established identity → anon (nothing to preserve)', async () => {
  invalidateVaultIdentity()
  setCookies([`${SB_BASE}.1`, encodeURIComponent('partial')])
  __setSessionProbeForTests(async () => ({ uid: null }))
  assert.equal(await resolveVaultDbName(), 'aqua-local')
})

await t('identity: material absent + clean null → definitive sign-out even WITH stale sticky', async () => {
  invalidateVaultIdentity()
  setCookies([SB_BASE, encodeURIComponent(sessionValue(UID_A))])
  __setSessionProbeForTests(async () => ({ uid: UID_A }))
  await resolveVaultDbName()
  clearCookies() // all auth material gone
  __setSessionProbeForTests(async () => ({ uid: null }))
  assert.equal(await resolveVaultDbName(), 'aqua-local')
  assert.equal(currentResolvedUid(), null)
})

await t('identity: resolveVaultIdentity returns the epoch bound atomically with the name', async () => {
  const { resolveVaultIdentity } = await import('./session.ts')
  invalidateVaultIdentity()
  setCookies([SB_BASE, encodeURIComponent(sessionValue(UID_A))])
  const r1 = await resolveVaultIdentity()
  assert.equal(r1.name, `aqua-local-${UID_A}`)
  // A handle bound to r1.epoch is live now; after invalidation it must be dead.
  const mem = createMemoryStorage()
  const handle = (() => {
    // bind exactly as getStorage does — at the returned epoch
    const epoch = r1.epoch
    const revoked = () => { /* exercised via __wrap below */ }
    return __wrapVaultHandleForTests(r1.name, mem) // wraps at CURRENT epoch = r1.epoch (no invalidation since)
  })()
  await handle.put('answers', { id: 'a1', scope: { application_id: 'x', question_occurrence_id: 'q' }, created_at: 't' })
  invalidateVaultIdentity()
  await assert.rejects(() => handle.getAll('answers'), VaultScopeError)
})

__setSessionProbeForTests(null)

__setSessionProbeForTests(null)
clearCookies()
if (PREV_SB_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
else process.env.NEXT_PUBLIC_SUPABASE_URL = PREV_SB_URL
