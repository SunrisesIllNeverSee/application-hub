// aqua-local approval-concurrency + provider-egress test script (LF-18/19).
// Run: node lib/aqua-local/run-approval-tests.mjs   (Node >=22.6 type-strips .ts imports)
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createMemoryStorage } from './vault.ts'
import {
  createAnswer, createVersion, approveVersion, listApprovals, listEvents,
} from './repo.ts'
import {
  freezeApplicationPacket, exportPacket, getPacketState, PacketFreezeError,
} from './packets.ts'
import { attestPacket } from './signoff.ts'
import {
  storeProviderKey, generateVersion, createMockProvider,
  createHttpJsonProvider, listProviderConsents,
} from './providers.ts'
import { STORE_NAMES } from './schema.ts'

const SECRET = 'correct-horse-battery-staple'
const HERE = fileURLToPath(new URL('.', import.meta.url))

let passed = 0
async function t(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`) }
  catch (e) { console.error(`FAIL ${name}: ${e.message}`); process.exitCode = 1 }
}

async function seed(s, { occ = 'q1', body = 'answer-body' } = {}) {
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: occ })
  const v = await createVersion(s, SECRET, { answer_id: a.id, title: `v-${occ}`, body, method: 'manual' })
  return { answer: a, version: v }
}

// ---------------- LF-18(a): concurrent / multi-tab approvals ----------------

await t('concurrent approvals on one version → distinct seqs, deterministic latest', async () => {
  const s = createMemoryStorage()
  const { version } = await seed(s)
  // Two "tabs" firing at once — same wall-clock millisecond is possible;
  // seq (not `at`) must decide the order.
  const [r1, r2] = await Promise.all([
    approveVersion(s, { version_id: version.id, decision: 'rejected', actor_class: 'human' }),
    approveVersion(s, { version_id: version.id, decision: 'approved', actor_class: 'human' }),
  ])
  assert.notEqual(r1.seq, r2.seq)
  assert.equal(Math.min(r1.seq, r2.seq), 1)
  assert.equal(Math.max(r1.seq, r2.seq), 2)
  const ordered = await listApprovals(s, version.id)
  assert.deepEqual(ordered.map((a) => a.seq), [1, 2])
  // The higher-seq record is the authoritative latest decision regardless
  // of `at` ties.
  const latest = ordered[ordered.length - 1]
  const events = await listEvents(s, 'approval_decision')
  assert.equal(events.length, 2)
  assert.equal(events[1].payload.approval_id, latest.id)
  assert.equal(events[1].seq, latest.seq)
})

await t('two tabs approving different versions of one answer stay coherent', async () => {
  const s = createMemoryStorage()
  const { answer, version: v1 } = await seed(s)
  const v2 = await createVersion(s, SECRET, {
    answer_id: answer.id, parent_version_id: v1.id, title: 'v2', body: 'revised', method: 'manual',
  })
  // Tab A approves v1; Tab B approves v2 — per-version keys, shared ledger.
  const [a1, a2] = await Promise.all([
    approveVersion(s, { version_id: v1.id, decision: 'approved', actor_class: 'human' }),
    approveVersion(s, { version_id: v2.id, decision: 'approved', actor_class: 'human' }),
  ])
  assert.notEqual(a1.seq, a2.seq)
  // Each version sees exactly its own latest decision.
  assert.equal((await listApprovals(s, v1.id)).at(-1).decision, 'approved')
  assert.equal((await listApprovals(s, v2.id)).at(-1).decision, 'approved')
  // And the shared ledger has both receipts in seq order.
  assert.deepEqual((await listEvents(s)).map((e) => e.seq), [1, 2])
})

// ---------------- LF-18(b): supersession evidence ----------------

await t('approving v2 leaves the v1 approval pinned to the OLD sha256', async () => {
  const s = createMemoryStorage()
  const { answer, version: v1 } = await seed(s, { body: 'draft-one' })
  const a1 = await approveVersion(s, { version_id: v1.id, decision: 'approved', actor_class: 'human' })
  const v2 = await createVersion(s, SECRET, {
    answer_id: answer.id, parent_version_id: v1.id, title: 'v2', body: 'draft-two', method: 'manual',
  })
  const a2 = await approveVersion(s, { version_id: v2.id, decision: 'approved', actor_class: 'human' })
  // Supersession evidence: the v1 approval still pins v1's hash — it does
  // NOT silently roll forward to v2.
  assert.equal(a1.version_sha256, v1.sha256)
  assert.equal(a2.version_sha256, v2.sha256)
  assert.notEqual(v1.sha256, v2.sha256)
  const ev1 = (await listEvents(s)).find((e) => e.payload.approval_id === a1.id)
  assert.equal(ev1.payload.version_sha256, v1.sha256)
  // A freeze selecting v2 uses ONLY v2's approval; the stale v1 approval is
  // evidence of history, not coverage.
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: v2.id, question_text_snapshot: 'Q?' }],
  })
  assert.equal(packet.questions[0].answer_sha256, v2.sha256)
})

await t('swapped version content after approval → approval void, freeze refused', async () => {
  const s = createMemoryStorage()
  const { version } = await seed(s)
  await approveVersion(s, { version_id: version.id, decision: 'approved', actor_class: 'human' })
  // Simulate a stale-tab/storage swap: the version row's sha diverges from
  // what the approval pinned.
  await s.put('versions', { ...version, sha256: 'f'.repeat(64) })
  await assert.rejects(
    () => freezeApplicationPacket(s, SECRET, {
      application_id: 'app1',
      selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
    }),
    (e) => e instanceof PacketFreezeError && /unapproved selection/.test(e.message),
  )
})

// ---------------- LF-18(c): audit receipt per approval ----------------

await t('every approval writes exactly one events-ledger receipt, atomically', async () => {
  const s = createMemoryStorage()
  const { answer, version: v1 } = await seed(s)
  const v2 = await createVersion(s, SECRET, {
    answer_id: answer.id, parent_version_id: v1.id, title: 'v2', body: 'two', method: 'manual',
  })
  await approveVersion(s, { version_id: v1.id, decision: 'approved', actor_class: 'human' })
  await approveVersion(s, { version_id: v2.id, decision: 'rejected', actor_class: 'agent' })
  const events = await listEvents(s)
  assert.equal(events.length, 2)
  assert.equal(events[0].kind, 'approval_decision')
  assert.equal(events[0].entity, 'version')
  assert.equal(events[0].entity_id, v1.id)
  assert.equal(events[0].payload.decision, 'approved')
  assert.equal(events[1].entity_id, v2.id)
  assert.equal(events[1].payload.decision, 'rejected')
  assert.equal(events[1].payload.actor_class, 'agent')
  // No orphan approvals / orphan events: counts must match.
  assert.equal((await s.getAll('approvals')).length, events.length)
})

// ---------------- LF-18(d): revocation is a new event, never an overwrite ----------------

await t('revocation appends a NEW decision + event; prior record untouched', async () => {
  const s = createMemoryStorage()
  const { version } = await seed(s)
  const approve = await approveVersion(s, { version_id: version.id, decision: 'approved', actor_class: 'human' })
  const snapshot = JSON.stringify(approve)
  const revoke = await approveVersion(s, { version_id: version.id, decision: 'rejected', actor_class: 'human' })
  // The original approval row was NOT mutated in place.
  const all = await listApprovals(s, version.id)
  assert.equal(all.length, 2)
  assert.equal(JSON.stringify(all.find((a) => a.id === approve.id)), snapshot)
  assert.equal(all.at(-1).id, revoke.id)
  assert.equal(all.at(-1).decision, 'rejected')
  // And the ledger shows the full history — nothing rewritten.
  const events = await listEvents(s)
  assert.equal(events.length, 2)
  assert.deepEqual(events.map((e) => e.payload.decision), ['approved', 'rejected'])
  // Latest decision governs → freeze refused after revocation.
  await assert.rejects(
    () => freezeApplicationPacket(s, SECRET, {
      application_id: 'app1',
      selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
    }),
    /unapproved selection.*'rejected'/,
  )
})

// ---------------- LF-19(a): zero server egress for local approvals/drafts ----------------

await t('full approve→freeze→sign→export flow performs ZERO network fetches', async () => {
  const s = createMemoryStorage()
  let fetches = 0
  const realFetch = globalThis.fetch
  globalThis.fetch = async (...args) => { fetches++; return realFetch(...args) }
  try {
    const { version } = await seed(s)
    await approveVersion(s, { version_id: version.id, decision: 'approved', actor_class: 'human' })
    const { packet } = await freezeApplicationPacket(s, SECRET, {
      application_id: 'app1',
      selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
    })
    await attestPacket(s, {
      packet_id: packet.packet_id, signer_class: 'local-only',
      user_ack: true, manifest_sha256: packet.questions[0].answer_sha256,
    })
    const doc = await exportPacket(s, packet.packet_id)
    assert.ok(doc.includes('aqua-local-packet'))
    assert.equal((await getPacketState(s, packet.packet_id)).state, 'exported')
  } finally {
    globalThis.fetch = realFetch
  }
  assert.equal(fetches, 0)
})

await t('egress boundary: network calls exist ONLY at the EGRESS-DECLARED site in providers.ts', async () => {
  const files = readdirSync(HERE).filter((f) => f.endsWith('.ts'))
  // Live network primitives as CALLS (fetch( / XMLHttpRequest( / …) or
  // constructors (new WebSocket / new EventSource).
  const CALL_RE = /\b(fetch|XMLHttpRequest|sendBeacon)\s*\(|\bnew (WebSocket|EventSource)\b/
  // providers.ts allowlist: the declared egress site uses the injected
  // fetchImpl; globalThis.fetch appears only as the default binding inside
  // the consent-gated function; 'fetch implementation' is an error string.
  const PROVIDER_OK = /EGRESS-DECLARED|fetchImpl|typeof fetch|globalThis\.fetch|fetch implementation/
  for (const f of files) {
    const lines = readFileSync(join(HERE, f), 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (/^\s*(\*|\/\/)/.test(line)) return // comments exempt
      if (f === 'providers.ts') {
        // Any network WORD must sit on an allowlisted line.
        if (/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource)\b/.test(line)) {
          assert.ok(PROVIDER_OK.test(line), `providers.ts:${i + 1} undeclared: ${line.trim()}`)
        }
      } else {
        assert.ok(!CALL_RE.test(line), `${f}:${i + 1} network call outside egress boundary: ${line.trim()}`)
      }
    })
  }
})

await t('no reward/credit/billing store exists — nothing to mint into', async () => {
  for (const name of STORE_NAMES) {
    assert.ok(
      !/reward|credit|billing|ledger_balance|token_balance|point/i.test(name),
      `store '${name}' looks like a reward/credit ledger`,
    )
  }
})

// ---------------- LF-19(b): BYOK — user's own key, no platform cost ----------------

await t('BYOK generation: key stays vault-local; egress is provider-direct only', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  await storeProviderKey(s, SECRET, 'openai', 'sk-user-owned-key')
  let globalFetches = 0
  const realFetch = globalThis.fetch
  globalThis.fetch = async (...args) => { globalFetches++; return realFetch(...args) }
  const providerCalls = []
  const fetchImpl = async (url, init) => {
    providerCalls.push({ url, auth: init?.headers?.authorization })
    return new Response(JSON.stringify({ text: 'byok text', model: 'gpt-x' }), { status: 200 })
  }
  try {
    const http = createHttpJsonProvider({
      id: 'openai-byok', mode: 'byok', provider: 'openai',
      endpoint: 'https://api.openai.example/v1/generate',
    })
    const { version, consent } = await generateVersion(s, http, {
      secret: SECRET, answer_id: a.id, title: 'gen', userConsent: true,
      fetchImpl, request: { prompt: 'draft' },
    })
    // The ONLY egress was the declared provider call, bearing the USER's key.
    assert.equal(providerCalls.length, 1)
    assert.equal(providerCalls[0].auth, 'Bearer sk-user-owned-key')
    // Nothing went to an application server — global fetch untouched.
    assert.equal(globalFetches, 0)
    // Consent receipt + provenance exist; no reward/billing side effects.
    assert.equal(consent.granted_by, 'user')
    assert.equal((await listProviderConsents(s)).length, 1)
    assert.equal(version.method, 'byok')
  } finally {
    globalThis.fetch = realFetch
  }
})

await t('BYOK mock path: zero fetch of ANY kind (no adapter egress)', async () => {
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'app1', question_occurrence_id: 'q1' })
  await storeProviderKey(s, SECRET, 'mockco', 'k')
  let fetches = 0
  const realFetch = globalThis.fetch
  globalThis.fetch = async (...args) => { fetches++; return realFetch(...args) }
  try {
    const mock = createMockProvider({ id: 'm', mode: 'byok', provider: 'mockco' })
    await generateVersion(s, mock, {
      secret: SECRET, answer_id: a.id, title: 'gen', userConsent: true,
      request: { prompt: 'p' },
    })
  } finally {
    globalThis.fetch = realFetch
  }
  assert.equal(fetches, 0)
})

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`)
