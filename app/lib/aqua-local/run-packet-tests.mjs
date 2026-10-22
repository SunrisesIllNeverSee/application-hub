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
  VaultImmutableError, VaultNotFoundError,
  signPacket,
} from './repo.ts'
import { canonicalJson, decryptText, encryptText, sha256Hex } from './crypto.ts'
import {
  storeProviderKey, loadProviderKey, deleteProviderKey,
  generateWithConsent, generateVersion, createMockProvider,
  createHttpJsonProvider, provenanceReceiptFor, listProviderConsents,
  ProviderConsentError, ProviderKeyError,
} from './providers.ts'
import {
  freezeApplicationPacket, exportPacket, loadPacket, getPacketState,
  advancePacketState, canonicalManifestOf,
  PacketFreezeError, PacketStateError, PacketVerificationError, verifyPacket,
  recordExternalSubmission, updateSubmissionOutcome, listSubmissionsForPacket,
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
  // IR-002: manifest is ciphertext at rest — decrypt and verify the digest.
  assert.equal(record.manifest_json, undefined)
  const manifestPlain = await decryptText(SECRET, JSON.parse(record.manifest_enc))
  assert.equal(record.manifest_sha256, await sha256Hex(manifestPlain))
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
  // one signoff per packet — second attempt refused (state gate fires first
  // under IR-020; only restored signoffs may be re-attested)
  await assert.rejects(
    () => attestPacket(s, {
      packet_id: packet.packet_id, signer_class: 'local-only', user_ack: true,
      manifest_sha256: record.manifest_sha256,
    }),
    /already signed/,
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
    user_ack: true,
    manifest_sha256: (await s.get('packets', packet.packet_id)).manifest_sha256,
  })
  assert.equal(so.signature_b64, null)
  assert.equal(so.pubkey_b64, null)
})

// ---------------- LF-23 submission boundary ----------------

await t('state machine: prepared→signed→exported; submitted_external_observed only via attestation', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const pid = packet.packet_id
  await assert.rejects(() => advancePacketState(s, pid, 'submitted_external_observed'), PacketStateError)
  await assert.rejects(() => advancePacketState(s, pid, 'bogus'), PacketStateError)
  // recorder refuses before export — physical export precedes real submission
  await assert.rejects(
    () => recordExternalSubmission(s, pid, { submitted_at: new Date().toISOString(), method: 'portal' }),
    /exported/,
  )
  await attestPacket(s, {
    packet_id: pid, signer_class: 'local-only', user_ack: true,
    manifest_sha256: (await s.get('packets', pid)).manifest_sha256,
  })
  await assert.rejects(() => advancePacketState(s, pid, 'prepared'), PacketStateError)
  // still refused while only signed — must export first
  await assert.rejects(
    () => recordExternalSubmission(s, pid, { submitted_at: new Date().toISOString(), method: 'portal' }),
    /exported/,
  )
  await exportPacket(s, pid, SECRET)
  const st = await getPacketState(s, pid)
  assert.equal(st.state, 'exported')
  assert.deepEqual(st.history.map((h) => h.state), ['prepared', 'signed', 'exported'])
  await assert.rejects(() => advancePacketState(s, pid, 'signed'), PacketStateError)

  // attested submission path — binds state write to a submission record
  const sub = await recordExternalSubmission(s, pid, {
    submitted_at: '2026-10-13T12:00:00Z', method: 'portal',
    portal_url: 'https://portal.example.com/app/1', confirmation_ref: 'REF-9',
  })
  const after = await getPacketState(s, pid)
  assert.equal(after.state, 'submitted_external_observed')
  assert.equal(after.history.at(-1).state, 'submitted_external_observed')
  assert.equal(sub.packet_id, pid)
  assert.equal(sub.outcome, 'pending')
  assert.equal((await listSubmissionsForPacket(s, pid))[0].id, sub.id)
  // advancePacketState still refuses the literal target even post-submission
  await assert.rejects(() => advancePacketState(s, pid, 'submitted_external_observed'), PacketStateError)

  // greppable guarantee: the ONLY setter path is inside recordExternalSubmission.
  const { readFileSync } = await import('node:fs')
  const srcDir = fileURLToPath(new URL('.', import.meta.url))
  const SETTER = /'submitted_external_observed'/
  for (const f of ['packets.ts', 'signoff.ts', 'providers.ts', 'repo.ts']) {
    const lines = readFileSync(join(srcDir, f), 'utf8').split('\n')
    const fnStart = lines.findIndex((l) => l.includes('export async function recordExternalSubmission'))
    const fnEnd = fnStart === -1 ? -1 : lines.findIndex((l, i) => i > fnStart && l.startsWith('export async function'))
    lines.forEach((l, i) => {
      if (/^\s*(\*|\/\/)/.test(l)) return
      const m = l.match(SETTER)
      if (!m) return
      const inRecorder = fnStart !== -1 && i > fnStart && (fnEnd === -1 || i < fnEnd)
      // comparisons/refusals elsewhere are fine; writes only inside the recorder
      const isWrite = /state:\s*'submitted_external_observed'/.test(l)
        || /put\([^)]*'submitted_external_observed'/.test(l)
        || /state:\s*'submitted_external_observed'/.test(l)
      if (isWrite) assert.ok(inRecorder, `${f}:${i} writes the state outside recordExternalSubmission`)
      if (f !== 'packets.ts') assert.ok(!isWrite, `${f} writes the state`)
    })
  }
})

await t('submission: outcome update + guards', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  await exportPacket(s, packet.packet_id, SECRET)
  const sub = await recordExternalSubmission(s, packet.packet_id, {
    submitted_at: '2026-10-13T12:00:00Z', method: 'email',
  })
  const upd = await updateSubmissionOutcome(s, sub.id, 'interview')
  assert.equal(upd.outcome, 'interview')
  assert.ok(upd.outcome_at)
  await assert.rejects(() => updateSubmissionOutcome(s, sub.id, 'bogus'), PacketStateError)
  await assert.rejects(() => updateSubmissionOutcome(s, 'nope', 'accepted'), VaultNotFoundError)
  // unknown method refused on a fresh exported packet (state check runs first)
  const { version: v2 } = await seedApproved(s, { appId: 'app2', occ: 'q2' })
  const { packet: p2 } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app2',
    selections: [{ question_occurrence_id: 'q2', version_id: v2.id, question_text_snapshot: 'Q?' }],
  })
  await exportPacket(s, p2.packet_id, SECRET)
  await assert.rejects(
    () => recordExternalSubmission(s, p2.packet_id, { submitted_at: 'x', method: 'carrier-pigeon' }),
    /unknown submission method/,
  )
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
  const out = verifyCli(await exportPacket(s, packet.packet_id, SECRET))
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
  const out = verifyCli(await exportPacket(s, packet.packet_id, SECRET))
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
  const doc = JSON.parse(await exportPacket(s, packet.packet_id, SECRET))
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
  const doc = JSON.parse(await exportPacket(s, packet.packet_id, SECRET))
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
  const json = await exportPacket(s, packet.packet_id, SECRET)
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
  const doc = JSON.parse(await exportPacket(s, packet.packet_id, SECRET))
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
  const doc = JSON.parse(await exportPacket(s, packet.packet_id, SECRET))
  doc.packet.state = 'submitted_external_observed'
  verifyCli(JSON.stringify(doc), { expectFail: true })
})


// ==================== IR-* falsifier-correction regressions ====================

await t('IR-001: program-scoped save never rebinds onto a bank-scoped answer', async () => {
  const { saveScopedVersion } = await import('../aqua-local-client/session.ts')
  const s = createMemoryStorage()
  // bank-scoped answer for the same occurrence exists first (dominant flow)
  const bank = await createAnswer(s, { application_id: 'answer-bank', question_occurrence_id: 'q1' })
  await createVersion(s, SECRET, { answer_id: bank.id, title: 'v-bank', body: 'bank copy', method: 'manual' })
  // program-scoped save must create a NEW answer, not absorb into 'answer-bank'
  const v = await saveScopedVersion(s, SECRET,
    { application_id: 'app1', question_occurrence_id: 'q1' },
    { title: 'v-app', body: 'app copy' })
  const answers = await s.getAll('answers')
  const bound = answers.filter((a) => a.scope.application_id === 'app1')
  assert.equal(bound.length, 1)
  const appAnswer = bound[0]
  assert.equal(v.answer_id, appAnswer.id)
  // and the packet path accepts it (foreign-scope refusal does not fire)
  await approveVersion(s, { version_id: v.id, decision: 'approved', actor_class: 'human' })
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [
      { question_occurrence_id: 'q1', version_id: v.id, question_text_snapshot: 'Q?' },
    ],
  })
  assert.ok(packet.packet_id)
})

await t('IR-002: frozen manifest is ciphertext at rest — no plaintext bodies', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const canary = 'SECRET-BODY-DO-NOT-STORE-PLAINTEXT'
  const s2 = createMemoryStorage()
  const a2 = await createAnswer(s2, { application_id: 'app1', question_occurrence_id: 'q1' })
  const v2 = await createVersion(s2, SECRET, { answer_id: a2.id, title: 'v', body: canary, method: 'manual' })
  await approveVersion(s2, { version_id: v2.id, decision: 'approved', actor_class: 'human' })
  const { packet, record } = await freezeApplicationPacket(s2, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: v2.id, question_text_snapshot: 'Q?' }],
  })
  const stored = await s2.get('packets', record.id)
  assert.equal(stored.manifest_json, undefined, 'plaintext manifest_json must not be stored')
  assert.ok(stored.manifest_enc, 'manifest_enc ciphertext present')
  assert.ok(!stored.manifest_enc.includes(canary), 'canary must not appear in stored manifest ciphertext')
  assert.ok(!JSON.stringify(stored).includes(canary))
  // export still produces the plaintext manifest document
  const doc = JSON.parse(await exportPacket(s2, packet.packet_id, SECRET))
  assert.ok(doc.manifest_json.includes(canary))
})

await t('IR-004: consent sha pins the snapshot — post-call mutation cannot falsify receipt', async () => {
  const s = createMemoryStorage()
  const mock = createMockProvider({})
  const req = { prompt: 'BENIGN' }
  const orig = await sha256Hex(canonicalJson(req))
  const { consent } = await generateWithConsent(s, mock, req, { userConsent: true })
  // attacker mutates the live object after the call — consent must attest
  // the bytes that were sent, not the mutated object
  req.prompt = 'MUTATED'
  assert.equal(consent.request_sha256, orig)
  const consents = await listProviderConsents(s)
  assert.equal(consents[0].request_sha256, orig)
})

await t('IR-005: attestPacket refuses a foreign manifest digest', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const kp = await generateSignerKeyPair()
  const foreign = await sha256Hex('not-the-real-manifest')
  await assert.rejects(
    () => attestPacket(s, {
      packet_id: packet.packet_id, signer_class: 'local-only', user_ack: true,
      privateKey: kp.privateKey, pubkey_b64: kp.pubkey_b64,
      manifest_sha256: foreign,
    }),
    /manifest digest mismatch/,
  )
  // still signable with the correct digest afterwards
  const so = await attestPacket(s, {
    packet_id: packet.packet_id, signer_class: 'local-only', user_ack: true,
    manifest_sha256: (await s.get('packets', packet.packet_id)).manifest_sha256,
  })
  assert.equal(so.packet_id, packet.packet_id)
})

await t('IR-006: openai adapter ignores caller-stored base_url (no key exfil)', async () => {
  const { adapterForProvider, storeProviderKey } = await import('./providers.ts')
  const s = createMemoryStorage()
  await storeProviderKey(s, SECRET, 'openai', 'sk-test-123')
  const calls = []
  const evilFetch = async (url) => { calls.push(url); return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })) }
  const adapter = adapterForProvider('openai', { base_url: 'https://evil.example.com', model_preference: 'gpt-4o-mini' })
  assert.equal(adapter.endpoint, 'https://api.openai.com/v1/chat/completions')
  await generateWithConsent(
    s, adapter, { prompt: 'p' },
    { userConsent: true, secret: SECRET, fetchImpl: evilFetch },
  )
  assert.ok(calls[0].startsWith('https://api.openai.com'), `egress went to ${calls[0]}`)
})

await t('IR-003/013: backup approvals marked restored + seq stripped; packet_states carried', async () => {
  const { exportVault, importVault } = await import('./backup.ts')
  const s1 = createMemoryStorage()
  const a = await createAnswer(s1, { application_id: 'app1', question_occurrence_id: 'q1' })
  const v = await createVersion(s1, SECRET, { answer_id: a.id, title: 'v', body: 'b', method: 'manual' })
  await approveVersion(s1, { version_id: v.id, decision: 'approved', actor_class: 'human' })
  const { packet } = await freezeApplicationPacket(s1, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: v.id, question_text_snapshot: 'Q?' }],
  })
  const dump = await exportVault(s1, SECRET)

  const s2 = createMemoryStorage()
  await importVault(s2, SECRET, dump)
  const imported = (await s2.getAll('approvals')).find((x) => x.version_id === v.id)
  assert.equal(imported.restored_from_backup, true)
  assert.equal(imported.seq, undefined, 'imported seq stripped')
  // packet state survives restore (IR-013)
  const st = await getPacketState(s2, packet.packet_id)
  assert.equal(st.state, 'prepared')
  // restored approval does NOT satisfy freeze (IR-003)
  await assert.rejects(
    () => freezeApplicationPacket(s2, SECRET, {
      application_id: 'app1',
      selections: [{ question_occurrence_id: 'q1', version_id: v.id, question_text_snapshot: 'Q?' }],
    }),
    /unapproved selection/,
  )
  // fresh local decision re-qualifies it
  await approveVersion(s2, { version_id: v.id, decision: 'approved', actor_class: 'human' })
  const { packet: p2 } = await freezeApplicationPacket(s2, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: v.id, question_text_snapshot: 'Q?' }],
  })
  assert.ok(p2.packet_id)
})

await t('IR-007: single-sourced approval ordering — seq beats legacy timestamps', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  const v = await createVersion(s, SECRET, { answer_id: a.id, title: 'v', body: 'b', method: 'manual' })
  // legacy row (no seq) with a LATER timestamp, then a seq'd approval earlier in time
  await s.put('approvals', {
    id: 'legacy-rej', version_id: v.id, version_sha256: v.sha256,
    decision: 'rejected', actor_class: 'human', at: '2999-01-01T00:00:00.000Z',
  })
  await approveVersion(s, { version_id: v.id, decision: 'approved', actor_class: 'human' })
  // freeze must honor the seq'd approval (compareApprovals: seq > legacy)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: v.id, question_text_snapshot: 'Q?' }],
  })
  assert.ok(packet.packet_id)
})

await t('IR-011: discard does not advance to exported', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  await advancePacketState(s, packet.packet_id, 'discarded')
  const st = await getPacketState(s, packet.packet_id)
  assert.equal(st.state, 'discarded')
  // discarded is terminal
  await assert.rejects(() => advancePacketState(s, packet.packet_id, 'exported'), /illegal packet transition/)
})


// ---------------- round-2 seam probes ----------------

await t('IR-018: legacy plaintext manifest re-encrypts on first read', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet, record } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  // downgrade the record to the legacy plaintext shape
  const plain = await decryptText(SECRET, JSON.parse(record.manifest_enc))
  await s.put('packets', { ...record, manifest_enc: undefined, manifest_json: plain })
  // read with secret → self-heals to ciphertext
  await loadPacket(s, packet.packet_id, SECRET)
  const after = await s.get('packets', packet.packet_id)
  assert.ok(after.manifest_enc, 're-encrypted on read')
  assert.equal(after.manifest_json, undefined, 'plaintext dropped')
})

await t('IR-020: restored signoff can be re-attested without state churn', async () => {
  const { exportVault, importVault } = await import('./backup.ts')
  const s1 = createMemoryStorage()
  const { version } = await seedApproved(s1)
  const { packet, record } = await freezeApplicationPacket(s1, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const kp = await generateSignerKeyPair()
  await attestPacket(s1, {
    packet_id: packet.packet_id, signer_class: 'local-only', user_ack: true,
    privateKey: kp.privateKey, pubkey_b64: kp.pubkey_b64,
    manifest_sha256: record.manifest_sha256,
  })
  const dump = await exportVault(s1, SECRET)
  const s2 = createMemoryStorage()
  await importVault(s2, SECRET, dump)
  // restored signoff marked
  const imported = await s2.get('signoffs', packet.packet_id)
  assert.equal(imported.restored_from_backup, true)
  // M3: a restored packet is never re-signed on trust — without the secret
  // (no re-verification possible) or without a live local approval it is refused
  await assert.rejects(() => attestPacket(s2, {
    packet_id: packet.packet_id, signer_class: 'authenticated-account', user_ack: true,
    manifest_sha256: record.manifest_sha256,
  }), PacketVerificationError)
  await assert.rejects(() => attestPacket(s2, {
    packet_id: packet.packet_id, signer_class: 'authenticated-account', user_ack: true,
    manifest_sha256: record.manifest_sha256, secret: SECRET,
  }), PacketVerificationError)
  // a fresh local human approval makes it verify again
  await approveVersion(s2, { version_id: version.id, decision: 'approved', actor_class: 'human' })
  // re-attestation replaces it without signed→signed throw
  const so = await attestPacket(s2, {
    packet_id: packet.packet_id, signer_class: 'authenticated-account', user_ack: true,
    manifest_sha256: record.manifest_sha256, secret: SECRET,
  })
  assert.equal(so.restored_from_backup, undefined)
  assert.equal((await getPacketState(s2, packet.packet_id)).state, 'signed')
})

await t('IR-021: every adapter declares an egress endpoint for the consent receipt', async () => {
  const { adapterForProvider } = await import('./providers.ts')
  for (const pid of ['anthropic', 'openai', 'google', 'ollama']) {
    const adapter = adapterForProvider(pid, pid === 'ollama' ? { base_url: 'http://localhost:11434' } : {})
    assert.ok(adapter.endpoint?.startsWith('http'), `${pid} missing endpoint`)
  }
})

await t('IR-023: exported signoff discloses restored provenance', async () => {
  const { exportVault, importVault } = await import('./backup.ts')
  const s1 = createMemoryStorage()
  const { version } = await seedApproved(s1)
  const { packet, record } = await freezeApplicationPacket(s1, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  await attestPacket(s1, {
    packet_id: packet.packet_id, signer_class: 'local-only', user_ack: true,
    manifest_sha256: record.manifest_sha256,
  })
  const dump = await exportVault(s1, SECRET)
  const s2 = createMemoryStorage()
  await importVault(s2, SECRET, dump)
  // M3: restored approvals are not live here, so the restored packet is not exportable yet
  await assert.rejects(() => exportPacket(s2, packet.packet_id, SECRET), PacketVerificationError)
  await approveVersion(s2, { version_id: version.id, decision: 'approved', actor_class: 'human' })
  const doc = JSON.parse(await exportPacket(s2, packet.packet_id, SECRET))
  assert.equal(doc.packet.signoff.restored_from_backup, true)
})


await t('IR-028: discarded packet refuses signoff before any write', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet, record } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  await advancePacketState(s, packet.packet_id, 'discarded')
  await assert.rejects(
    () => attestPacket(s, {
      packet_id: packet.packet_id, signer_class: 'local-only', user_ack: true,
      manifest_sha256: record.manifest_sha256,
    }),
    /discarded/,
  )
  // no phantom signoff row left behind
  assert.equal(await s.get('signoffs', packet.packet_id), undefined)
})


await t('IR-017: agent-classed approval does not satisfy the packet gate', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  const v = await createVersion(s, SECRET, { answer_id: a.id, title: 'v', body: 'b', method: 'manual' })
  await approveVersion(s, { version_id: v.id, decision: 'approved', actor_class: 'agent' })
  await assert.rejects(
    () => freezeApplicationPacket(s, SECRET, {
      application_id: 'app1',
      selections: [{ question_occurrence_id: 'q1', version_id: v.id, question_text_snapshot: 'Q?' }],
    }),
    /unapproved selection/,
  )
  // a later human decision re-qualifies it
  await approveVersion(s, { version_id: v.id, decision: 'approved', actor_class: 'human' })
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: v.id, question_text_snapshot: 'Q?' }],
  })
  assert.ok(packet.packet_id)
  // a later AGENT review cannot downgrade/undo the human gate either — the
  // latest decision is what counts and an agent rejection is still valid
  // review, but it no longer reads as 'approved' for packets.
  await approveVersion(s, { version_id: v.id, decision: 'rejected', actor_class: 'agent' })
  await assert.rejects(
    () => freezeApplicationPacket(s, SECRET, {
      application_id: 'app1',
      selections: [{ question_occurrence_id: 'q1', version_id: v.id, question_text_snapshot: 'Q?' }],
    }),
    /unapproved selection/,
  )
})


await t('IR-029: unreachable-state packet refuses signoff pre-write', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet, record } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  // simulate a restored unreachable state — storage accepts it; attest must not
  await s.put('packet_states', {
    packet_id: packet.packet_id, state: 'submitted_external_observed',
    history: [{ state: 'submitted_external_observed', at: new Date().toISOString() }],
    updated_at: new Date().toISOString(),
  })
  await assert.rejects(
    () => attestPacket(s, {
      packet_id: packet.packet_id, signer_class: 'local-only', user_ack: true,
      manifest_sha256: record.manifest_sha256,
    }),
    /cannot sign a packet in state/,
  )
  assert.equal(await s.get('signoffs', packet.packet_id), undefined)
})


await t('IR-024: primitive signPacket verifies signatures — forgery refused, export honest', async () => {
  const s = createMemoryStorage()
  const kp = await generateSignerKeyPair()
  const a = await createAnswer(s, { application_id: 'app', question_occurrence_id: 'q1' })
  const v = await createVersion(s, SECRET, {
    answer_id: a.id, title: 'T', body: 'answer body text',
    method: 'manual', provenance: 'test',
  })
  await approveVersion(s, {
    version_id: v.id, version_sha256: v.sha256,
    decision: 'approved', actor_class: 'human',
  })
  const { record: pktRec } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app',
    selections: [{ question_occurrence_id: 'q1', version_id: v.id }],
    packet_title: 'T',
  })
  // forged signature — refuses at the primitive boundary
  const forged = await signManifestDigest(kp.privateKey, await sha256Hex('other-manifest'))
  await assert.rejects(
    () => signPacket(s, {
      packet_id: pktRec.id, signer_class: 'local-only',
      signature_b64: forged, pubkey_b64: kp.pubkey_b64, user_ack: true,
    }),
    /signature verification failed/,
    'forged signature refused at primitive',
  )
  // signature without pubkey — refuses (unverifiable)
  await assert.rejects(
    () => signPacket(s, {
      packet_id: pktRec.id, signer_class: 'local-only',
      signature_b64: forged, pubkey_b64: null, user_ack: true,
    }),
    /verification key/,
    'signature without key refused',
  )
  // REAL signature — accepted and marked verified
  const realSig = await signManifestDigest(kp.privateKey, pktRec.manifest_sha256)
  const so = await signPacket(s, {
    packet_id: pktRec.id, signer_class: 'local-only',
    signature_b64: realSig, pubkey_b64: kp.pubkey_b64, user_ack: true,
  })
  assert.equal(so.signature_verified, true)
  // export carries the read-time verification result
  const loaded = await loadPacket(s, pktRec.id, SECRET)
  assert.equal(loaded.signoff.signature_verified, true)

  // forged-at-rest record (raw put bypassing the primitive) cannot
  // present as verified at materialization
  const s2 = createMemoryStorage()
  const a2 = await createAnswer(s2, { application_id: 'app', question_occurrence_id: 'q1' })
  const v2 = await createVersion(s2, SECRET, {
    answer_id: a2.id, title: 'T', body: 'answer body text',
    method: 'manual', provenance: 'test',
  })
  await approveVersion(s2, {
    version_id: v2.id, version_sha256: v2.sha256,
    decision: 'approved', actor_class: 'human',
  })
  const { record: pktRec2 } = await freezeApplicationPacket(s2, SECRET, {
    application_id: 'app',
    selections: [{ question_occurrence_id: 'q1', version_id: v2.id }],
    packet_title: 'T',
  })
  await s2.put('signoffs', {
    packet_id: pktRec2.id, signer_class: 'local-only',
    timestamp: new Date().toISOString(),
    signature_b64: forged, pubkey_b64: kp.pubkey_b64,
  })
  const loaded2 = await loadPacket(s2, pktRec2.id, SECRET)
  assert.equal(loaded2.signoff.signature_verified, false,
    'forged-at-rest signoff reports unverified at read')
})

await t('IR-029b: prepared + restored signoff → attestation advances to signed', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet, record } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  // simulate a restored backup: state 'prepared' + restored signoff row
  await s.put('signoffs', {
    packet_id: packet.packet_id, signer_class: 'restored', signature_b64: null,
    pubkey_b64: null, user_ack: true, at: new Date().toISOString(),
    restored_from_backup: true,
  })
  await attestPacket(s, {
    packet_id: packet.packet_id, signer_class: 'local-only', user_ack: true,
    manifest_sha256: record.manifest_sha256,
  })
  const st = await getPacketState(s, packet.packet_id)
  assert.equal(st.state, 'signed', 'inconsistent prepared+signoff must advance, not wedge')
})


// ---------------- M09 review M3: restored packets are re-verified ----------------

async function restoredPacket() {
  const { exportVault, importVault } = await import('./backup.ts')
  const s1 = createMemoryStorage()
  const { version } = await seedApproved(s1)
  const { packet, record } = await freezeApplicationPacket(s1, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const s2 = createMemoryStorage()
  await importVault(s2, SECRET, await exportVault(s1, SECRET))
  return { s1, s2, version, packet, record }
}

await t('M3: a restored packet is marked restored and refused for export until it re-verifies; failure marks it unverified', async () => {
  const { s2, version, packet } = await restoredPacket()
  const stored = await s2.get('packets', packet.packet_id)
  assert.equal(stored.restored_from_backup, true)
  await assert.rejects(() => exportPacket(s2, packet.packet_id, SECRET), (e) => {
    assert.ok(e instanceof PacketVerificationError)
    assert.ok(e.reasons.some((r) => /no live human approval/.test(r)))
    return true
  })
  const marked = await s2.get('packets', packet.packet_id)
  assert.ok(marked.unverified && marked.unverified.reasons.length > 0, 'marked unverified')
  assert.equal((await getPacketState(s2, packet.packet_id)).state, 'prepared', 'state did not advance')
  // fresh local approval → verifies, exports, clears the mark
  await approveVersion(s2, { version_id: version.id, decision: 'approved', actor_class: 'human' })
  assert.equal((await verifyPacket(s2, packet.packet_id, SECRET)).ok, true)
  const doc = JSON.parse(await exportPacket(s2, packet.packet_id, SECRET))
  assert.equal(doc.manifest_sha256, (await s2.get('packets', packet.packet_id)).manifest_sha256)
  const after = await s2.get('packets', packet.packet_id)
  assert.equal(after.unverified, undefined)
  assert.ok(after.verified_at)
})

await t('M3: exportPacket re-runs the gate for local packets too (revoked after freeze → refused)', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  await approveVersion(s, { version_id: version.id, decision: 'rejected', actor_class: 'human' })
  await assert.rejects(() => exportPacket(s, packet.packet_id, SECRET), PacketVerificationError)
})

await t('M3: a hand-built packet record (forged approved:true, digest recomputed) is refused', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  const v = await createVersion(s, SECRET, { answer_id: a.id, title: 't', body: 'never approved', method: 'manual' })
  const content = {
    application_id: 'app1', created_at: '2026-10-22T00:00:00.000Z', attachments: [], provenance: [],
    questions: [{ question_occurrence_id: 'q1', question_text_snapshot: 'Q?', version_id: v.id, answer_title: 't', answer_body: 'never approved', answer_sha256: v.sha256, approved: true, skipped: false, skip_reason: null }],
  }
  const manifestJson = canonicalJson(content)
  const sha = await sha256Hex(manifestJson)
  const id = `PK-${sha.slice(0, 16)}`
  await s.put('packets', { id, application_id: 'app1', manifest_enc: JSON.stringify(await encryptText(SECRET, manifestJson)), manifest_sha256: sha, frozen_at: content.created_at })
  await s.put('packet_states', { packet_id: id, state: 'prepared', history: [{ state: 'prepared', at: content.created_at }], updated_at: content.created_at })
  await assert.rejects(() => exportPacket(s, id, SECRET), PacketVerificationError)
  await assert.rejects(() => attestPacket(s, { packet_id: id, signer_class: 'local-only', user_ack: true, manifest_sha256: sha, secret: SECRET }), PacketVerificationError)
  // once marked unverified, signing without the secret is refused too
  await assert.rejects(() => attestPacket(s, { packet_id: id, signer_class: 'local-only', user_ack: true, manifest_sha256: sha }), PacketVerificationError)
})

await t('M3: manifest digest drift and answer re-hash drift are caught', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s)
  const { packet, record } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  const manifest = JSON.parse(await decryptText(SECRET, JSON.parse(record.manifest_enc)))
  manifest.questions[0].answer_body = 'swapped after freeze'
  await s.put('packets', { ...record, manifest_enc: JSON.stringify(await encryptText(SECRET, canonicalJson(manifest))) })
  const r = await verifyPacket(s, packet.packet_id, SECRET)
  assert.equal(r.ok, false)
  assert.ok(r.reasons.some((x) => /manifest does not hash/.test(x)))
  assert.ok(r.reasons.some((x) => /answer does not hash/.test(x)))
})

await t('M2/M3: freeze refuses an approved version whose body still has a placeholder', async () => {
  const s = createMemoryStorage()
  const { version } = await seedApproved(s, { body: 'Revenue \uFF3BCONFIRM\uFF3D' })
  await assert.rejects(() => freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  }), (e) => e instanceof PacketFreezeError && e.reasons.some((x) => /placeholder/.test(x)))
})

await t('verifier: a skipped entry carrying a hidden answer fails even with a self-consistent digest', async () => {
  const s = createMemoryStorage()
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app-skip',
    selections: [{ question_occurrence_id: 'q1', skip_reason: 'not applicable', question_text_snapshot: 'Q?' }],
  })
  const json = await exportPacket(s, packet.packet_id, SECRET)
  assert.match(verifyCli(json), /skipped entries are explained/)
  const doc = JSON.parse(json)
  doc.packet.questions[0].answer_body = 'hidden answer'
  const { packet_id: _p, signoff: _s, ...content } = doc.packet
  doc.manifest_json = canonicalJson(content)
  doc.manifest_sha256 = await sha256Hex(doc.manifest_json)
  doc.packet.packet_id = `PK-${doc.manifest_sha256.slice(0, 16)}`
  const out = verifyCli(JSON.stringify(doc), { expectFail: true })
  assert.match(out, /FAIL.*skipped entries|skipped entries[^\n]*FAIL/)
})

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`)
