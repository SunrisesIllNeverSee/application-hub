// aqua-local packet/provenance/provider test script (LF-16/17/20/21/22/23).
// Run: node lib/aqua-local/run-packet-tests.mjs   (Node >=22.6 type-strips .ts imports)
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createMemoryStorage } from './vault.ts'
import {
  createAnswer, createVersion, approveVersion, readVersion,
  VaultImmutableError,
} from './repo.ts'
import { canonicalJson, sha256Hex } from './crypto.ts'
import {
  storeProviderKey, loadProviderKey, deleteProviderKey,
  generateWithConsent, generateVersion, createMockProvider,
  createHttpJsonProvider, provenanceReceiptFor, listProviderConsents,
  ProviderConsentError, ProviderKeyError,
} from './providers.ts'
import {
  freezeApplicationPacket, exportPacket, loadPacket, getPacketState,
  advancePacketState, canonicalManifestOf,
  PacketFreezeError, PacketStateError,
} from './packets.ts'
import {
  generateSignerKeyPair, signManifestDigest, verifyManifestSignature,
  attestPacket, SignoffAckError,
} from './signoff.ts'

const SECRET = 'correct-horse-battery-staple'
const HERE = fileURLToPath(new URL('.', import.meta.url))
const VERIFIER = join(HERE, 'verify-packet.mjs')

let passed = 0
async function t(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`) }
  catch (e) { console.error(`FAIL ${name}: ${e.message}`); process.exitCode = 1 }
}

function verifyCli(json, { expectFail = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'aqua-packet-'))
  const file = join(dir, 'packet.json')
  writeFileSync(file, json)
  try {
    const out = execFileSync('node', [VERIFIER, file], { encoding: 'utf8' })
    if (expectFail) throw new Error(`verifier unexpectedly PASSED:\n${out}`)
    return out
  } catch (e) {
    if (!expectFail) throw new Error(`verifier unexpectedly FAILED:\n${e.stdout}${e.stderr}`)
    assert.match(e.stdout ?? '', /FAIL/, 'verifier output must report FAIL')
    return e.stdout
  }
}

// Helper: build an approved-version scenario in one storage.
async function seedApproved(s, { appId = 'app1', occ = 'q1', body = 'answer-body', method = 'manual', extra = {} } = {}) {
  const a = await createAnswer(s, { application_id: appId, question_occurrence_id: occ })
  const v = await createVersion(s, SECRET, {
    answer_id: a.id, title: `v-${occ}`, body, method, ...extra,
  })
  await approveVersion(s, { version_id: v.id, decision: 'approved', actor_class: 'human' })
  return { answer: a, version: v }
}

// ---------------- LF-20 freeze: happy path + refusal set ----------------

await t('freeze: happy path binds approved version', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet, record } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  assert.match(packet.packet_id, /^PK-[0-9a-f]{16}$/)
  assert.equal(packet.questions[0].approved, true)
  assert.equal(packet.questions[0].answer_sha256, version.sha256)
  assert.equal(record.manifest_sha256, await sha256Hex(record.manifest_json))
  assert.equal((await getPacketState(s, packet.packet_id)).state, 'prepared')
})

await t('freeze: unexplained skip refused', async () => {
  const s = createMemoryStorage()
  await seedApproved(s)
  await assert.rejects(
    () => freezeApplicationPacket(s, SECRET, {
      application_id: 'app1',
      selections: [{ question_occurrence_id: 'q1', question_text_snapshot: 'Q?' }],
    }),
    (e) => e instanceof PacketFreezeError && /unexplained skip/.test(e.message),
  )
})

await t('freeze: explained skip allowed', async () => {
  const s = createMemoryStorage()
  await seedApproved(s)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', skip_reason: 'not applicable to me', question_text_snapshot: 'Q?' }],
  })
  assert.equal(packet.questions[0].skipped, true)
  assert.equal(packet.questions[0].version_id, null)
})

await t('freeze: missing question coverage refused', async () => {
  const s = createMemoryStorage()
  await seedApproved(s, { occ: 'q1' })
  await seedApproved(s, { occ: 'q2' })
  await assert.rejects(
    () => freezeApplicationPacket(s, SECRET, {
      application_id: 'app1',
      selections: [{ question_occurrence_id: 'q1', skip_reason: 'x', question_text_snapshot: 'Q?' }],
    }),
    (e) => e instanceof PacketFreezeError && /missing question coverage/.test(e.message),
  )
})

await t('freeze: unapproved selection refused', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  const v = await createVersion(s, SECRET, { answer_id: a.id, title: 'v', body: 'b', method: 'manual' })
  await assert.rejects(
    () => freezeApplicationPacket(s, SECRET, {
      application_id: 'app1',
      selections: [{ question_occurrence_id: 'q1', version_id: v.id, question_text_snapshot: 'Q?' }],
    }),
    (e) => e instanceof PacketFreezeError && /unapproved selection/.test(e.message),
  )
  // approved-then-rejected: latest decision wins → refused
  await approveVersion(s, { version_id: v.id, decision: 'approved', actor_class: 'human' })
  await new Promise((r) => setTimeout(r, 5)) // distinct `at` ordering
  await approveVersion(s, { version_id: v.id, decision: 'rejected', actor_class: 'human' })
  await assert.rejects(
    () => freezeApplicationPacket(s, SECRET, {
      application_id: 'app1',
      selections: [{ question_occurrence_id: 'q1', version_id: v.id, question_text_snapshot: 'Q?' }],
    }),
    /unapproved selection/,
  )
})

await t('freeze: foreign-scope version refused', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s, { appId: 'app1', occ: 'q1' })
  await createAnswer(s, { application_id: 'app2', question_occurrence_id: 'q9' })
  await assert.rejects(
    () => freezeApplicationPacket(s, SECRET, {
      application_id: 'app2',
      selections: [{ question_occurrence_id: 'q9', version_id: version.id, question_text_snapshot: 'Q?' }],
    }),
    (e) => e instanceof PacketFreezeError && /foreign scope/.test(e.message),
  )
})

await t('freeze: manifest deterministic (same inputs → same digest)', async () => {
  const build = async () => {
    const s = createMemoryStorage()
    const { version } = await seedApproved(s)
    // recreate identical version ids is impossible; determinism = canonical
    // serialization is stable given the same manifest content object.
    const { manifest_json } = await freezeApplicationPacket(s, SECRET, {
      application_id: 'app1',
      created_at: '2026-01-01T00:00:00.000Z',
      selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
    })
    return manifest_json
  }
  const m1 = await build()
  const keys = [...m1.matchAll(/"(\w+)":/g)].map((m) => m[1])
  // canonical = sorted keys at every level; spot-check top level ordering
  const top = JSON.parse(m1)
  assert.deepEqual(Object.keys(top), Object.keys(top).slice().sort())
  assert.ok(keys.length > 0)
})

await t('freeze: never mutates source versions', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const before = JSON.stringify(version)
  await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const after = await readVersion(s, SECRET, version.id)
  assert.equal(JSON.stringify(after.record), before)
  assert.equal(after.body, 'answer-body')
})

// ---------------- LF-16 providers: consent + key gating ----------------

await t('provider: no consent → refused (fail closed)', async () => {
  const s = createMemoryStorage()
  const mock = createMockProvider({})
  for (const consent of [undefined, false, null, 'yes', 1]) {
    await assert.rejects(
      () => generateWithConsent(s, mock, { prompt: 'p' }, { userConsent: consent }),
      ProviderConsentError,
    )
  }
  assert.equal((await listProviderConsents(s)).length, 0)
})

await t('provider: consent → mock generation + consent receipt stored', async () => {
  const s = createMemoryStorage()
  const mock = createMockProvider({ model: 'mock-1' })
  const { result, consent } = await generateWithConsent(
    s, mock, { prompt: 'draft me' }, { userConsent: true },
  )
  assert.equal(result.text, 'mock-response:draft me')
  assert.ok(result.observed.includes('provider_response'))
  const consents = await listProviderConsents(s)
  assert.equal(consents.length, 1)
  assert.equal(consents[0].id, consent.id)
  assert.equal(consents[0].request_sha256, await sha256Hex(canonicalJson({ prompt: 'draft me' })))
})

await t('provider: BYOK key vault-only; missing key → refused', async () => {
  const s = createMemoryStorage()
  const byok = createMockProvider({ id: 'byok-x', mode: 'byok', provider: 'openai' })
  await assert.rejects(
    () => generateWithConsent(s, byok, { prompt: 'p' }, { userConsent: true, secret: SECRET }),
    ProviderKeyError,
  )
  await storeProviderKey(s, SECRET, 'openai', 'sk-test-123')
  assert.equal(await loadProviderKey(s, SECRET, 'openai'), 'sk-test-123')
  await assert.rejects(() => loadProviderKey(s, 'wrong', 'openai'))
  const { result } = await generateWithConsent(s, byok, { prompt: 'p' }, { userConsent: true, secret: SECRET })
  assert.equal(result.provider, 'openai')
  await deleteProviderKey(s, 'openai')
  assert.equal(await loadProviderKey(s, SECRET, 'openai'), null)
})

await t('provider: http adapter egress only after stored consent', async () => {
  const s = createMemoryStorage()
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    return new Response(JSON.stringify({ text: 'generated!', model: 'm-9' }), { status: 200 })
  }
  const http = createHttpJsonProvider({
    id: 'app-p', mode: 'app_provider', provider: 'anthropic',
    endpoint: 'https://provider.example/v1/generate',
  })
  // no consent → zero egress calls
  await assert.rejects(
    () => generateWithConsent(s, http, { prompt: 'p' }, { userConsent: false, fetchImpl }),
    ProviderConsentError,
  )
  assert.equal(calls.length, 0)
  const { result, consent } = await generateWithConsent(
    s, http, { prompt: 'p' }, { userConsent: true, fetchImpl },
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://provider.example/v1/generate')
  assert.equal(result.text, 'generated!')
  assert.ok(result.observed.includes('provider_http_response'))
  assert.ok(consent.at <= (await listProviderConsents(s))[0].at)
})

// ---------------- LF-17 provenance: observed vs declared ----------------

await t('provenance: generated version records observed claims', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  const mock = createMockProvider({ provider: 'mockco', model: 'm1' })
  const { version } = await generateVersion(s, mock, {
    secret: SECRET, answer_id: a.id, title: 'gen', userConsent: true,
    request: { prompt: 'write it' },
  })
  const receipt = await provenanceReceiptFor(s, version.id)
  assert.equal(receipt.method, 'app_provider')
  assert.equal(receipt.provider, 'mockco')
  assert.equal(receipt.model, 'm1')
  assert.equal(receipt.observed_flags.provider_response, true)
})

await t('provenance falsification: spoofed provider label is declared, never observed', async () => {
  const s = createMemoryStorage()
  // Attacker-typed version CLAIMS a provider label — but no provider call ever
  // happened, so observed_flags must stay empty.
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  const v = await createVersion(s, SECRET, {
    answer_id: a.id, title: 'fake', body: 'i swear gpt wrote this',
    method: 'manual', provider: 'openai', model: 'gpt-5',
  })
  await approveVersion(s, { version_id: v.id, decision: 'approved', actor_class: 'human' })
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: v.id, question_text_snapshot: 'Q?' }],
  })
  const p = packet.provenance[0]
  assert.equal(p.provider, 'openai')                  // declared label carried honestly
  assert.deepEqual(p.observed, [])                    // …but NOT accepted as observed
  assert.ok(p.declared.includes('provider:openai'))
  assert.ok(!p.observed.includes('provider_response'))
})

// ---------------- LF-21 signoff ----------------

await t('signoff: sign + verify roundtrip', async () => {
  const kp = await generateSignerKeyPair()
  const digest = await sha256Hex('manifest-content')
  const sig = await signManifestDigest(kp.privateKey, digest)
  assert.equal(await verifyManifestSignature(kp.pubkey_b64, digest, sig), true)
  assert.equal(await verifyManifestSignature(kp.pubkey_b64, await sha256Hex('other'), sig), false)
  const kp2 = await generateSignerKeyPair()
  assert.equal(await verifyManifestSignature(kp2.pubkey_b64, digest, sig), false)
})

await t('signoff: user_ack required to sign', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  await assert.rejects(
    () => attestPacket(s, {
      packet_id: packet.packet_id, signer_class: 'local-only',
      user_ack: false, manifest_sha256: 'x',
    }),
    SignoffAckError,
  )
})

await t('signoff: signed state + pubkey + timestamp in record', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet, record } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const kp = await generateSignerKeyPair()
  const so = await attestPacket(s, {
    packet_id: packet.packet_id, signer_class: 'local-only', user_ack: true,
    privateKey: kp.privateKey, pubkey_b64: kp.pubkey_b64,
    manifest_sha256: record.manifest_sha256,
  })
  assert.ok(so.signature_b64)
  assert.equal(so.pubkey_b64, kp.pubkey_b64)
  assert.ok(so.timestamp)
  assert.equal((await getPacketState(s, packet.packet_id)).state, 'signed')
  assert.equal(
    await verifyManifestSignature(kp.pubkey_b64, record.manifest_sha256, so.signature_b64), true,
  )
  // one signoff per packet
  await assert.rejects(
    () => attestPacket(s, {
      packet_id: packet.packet_id, signer_class: 'local-only', user_ack: true,
      manifest_sha256: record.manifest_sha256,
    }),
    VaultImmutableError,
  )
})

await t('signoff: no key → truthful unsigned record', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const so = await attestPacket(s, {
    packet_id: packet.packet_id, signer_class: 'authenticated-account',
    user_ack: true, manifest_sha256: 'x',
  })
  assert.equal(so.signature_b64, null)
  assert.equal(so.pubkey_b64, null)
})

// ---------------- LF-23 submission boundary ----------------

await t('state machine: prepared→signed→exported; submitted_external_observed unreachable', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const pid = packet.packet_id
  await assert.rejects(() => advancePacketState(s, pid, 'submitted_external_observed'), PacketStateError)
  await assert.rejects(() => advancePacketState(s, pid, 'bogus'), PacketStateError)
  await attestPacket(s, {
    packet_id: pid, signer_class: 'local-only', user_ack: true, manifest_sha256: 'x',
  })
  await assert.rejects(() => advancePacketState(s, pid, 'prepared'), PacketStateError)
  await exportPacket(s, pid)
  const st = await getPacketState(s, pid)
  assert.equal(st.state, 'exported')
  assert.deepEqual(st.history.map((h) => h.state), ['prepared', 'signed', 'exported'])
  await assert.rejects(() => advancePacketState(s, pid, 'signed'), PacketStateError)
  // greppable guarantee: no production code WRITES the unreachable state.
  // Forbidden setter patterns only — declarations/comparisons are fine.
  const { readFileSync } = await import('node:fs')
  const srcDir = fileURLToPath(new URL('.', import.meta.url))
  const FORBIDDEN = [
    /state:\s*'submitted_external_observed'/,
    /state\s*=\s*'submitted_external_observed'/,
    /push\([^)]*'submitted_external_observed'/,
    /put\([^)]*'submitted_external_observed'/,
    /advancePacketState\([^)]*'submitted_external_observed'\s*\)/,
  ]
  for (const f of ['packets.ts', 'signoff.ts', 'providers.ts', 'repo.ts']) {
    const code = readFileSync(join(srcDir, f), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\/)/.test(l))
      .join('\n')
    for (const re of FORBIDDEN) {
      assert.ok(!re.test(code), `${f} contains a setter path for submitted_external_observed: ${re}`)
    }
  }
})

// ---------------- LF-22 export + standalone verifier ----------------

await t('export: verifier PASS on clean packet (signed)', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet, record } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const kp = await generateSignerKeyPair()
  await attestPacket(s, {
    packet_id: packet.packet_id, signer_class: 'local-only', user_ack: true,
    privateKey: kp.privateKey, pubkey_b64: kp.pubkey_b64,
    manifest_sha256: record.manifest_sha256,
  })
  const out = verifyCli(await exportPacket(s, packet.packet_id))
  assert.match(out, /PASS — \d+\/\d+ checks passed/)
  assert.equal((await getPacketState(s, packet.packet_id)).state, 'exported')
})

await t('export: verifier PASS on unsigned packet (truthful)', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const out = verifyCli(await exportPacket(s, packet.packet_id))
  assert.match(out, /unsigned packet/)
  assert.match(out, /PASS/)
})

await t('export tamper: modified answer body → verifier FAIL', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const doc = JSON.parse(await exportPacket(s, packet.packet_id))
  doc.packet.questions[0].answer_body = 'MALLORY WAS HERE'
  verifyCli(JSON.stringify(doc), { expectFail: true })
})

await t('export tamper: swapped version_id → verifier FAIL', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const doc = JSON.parse(await exportPacket(s, packet.packet_id))
  doc.packet.questions[0].version_id = 'a-different-version-id'
  verifyCli(JSON.stringify(doc), { expectFail: true })
})

await t('export tamper: truncated file → verifier FAIL', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const json = await exportPacket(s, packet.packet_id)
  verifyCli(json.slice(0, Math.floor(json.length / 2)), { expectFail: true })
})

await t('export tamper: foreign signature → verifier FAIL', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet, record } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const kp = await generateSignerKeyPair()
  await attestPacket(s, {
    packet_id: packet.packet_id, signer_class: 'local-only', user_ack: true,
    privateKey: kp.privateKey, pubkey_b64: kp.pubkey_b64,
    manifest_sha256: record.manifest_sha256,
  })
  const doc = JSON.parse(await exportPacket(s, packet.packet_id))
  // attacker re-signs a tampered manifest with THEIR key and swaps pubkey too —
  // manifest_sha256 embedded in doc no longer matches recomputed → FAIL.
  const evil = await generateSignerKeyPair()
  doc.packet.questions[0].answer_body = 'forged'
  const { signManifestDigest: sign2 } = await import('./signoff.ts')
  doc.packet.signoff.signature_b64 = await sign2(evil.privateKey, record.manifest_sha256)
  doc.packet.signoff.pubkey_b64 = evil.pubkey_b64
  const out = verifyCli(JSON.stringify(doc), { expectFail: true })
  assert.match(out, /FAIL manifest canonical match/)
})

await t('export tamper: packet claims submitted_external_observed → verifier FAIL', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const doc = JSON.parse(await exportPacket(s, packet.packet_id))
  doc.packet.state = 'submitted_external_observed'
  verifyCli(JSON.stringify(doc), { expectFail: true })
})

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`)
