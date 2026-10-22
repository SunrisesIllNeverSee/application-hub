// aqua-local vault v5 (M09 W4) test script — migration, new stores,
// classifier, status derivation, hash-bound human approval, freeze
// compatibility, backup v2, and per-uid isolation.
// Run: node lib/aqua-local/run-v5-tests.mjs   (Node >=22.6 type-strips .ts imports)
// All fixtures are synthetic — no real application or answer content.
import assert from 'node:assert/strict'

import { createMemoryStorage } from './vault.ts'
import {
  DB_VERSION, MIGRATIONS, STORE_NAMES, STORE_SPECS, REVIEW_DECISIONS,
} from './schema.ts'
import {
  createAnswer, createVersion, approveVersion, readVersion, listApprovals, listEvents,
  recordHumanApproval, recordHumanRevocation, createChildVersion,
  VaultApprovalMismatchError, VaultScopeError, VaultNotFoundError,
} from './repo.ts'
import { freezeApplicationPacket, PacketFreezeError } from './packets.ts'
import { exportVault, importVault, previewVaultImport, BACKUP_FORMAT_VERSION, backupAccountFingerprint, backupAccountStatus, BACKUP_ACCOUNT_FP_SCHEME } from './backup.ts'
import { decryptText } from './crypto.ts'
import { canonicalJson, encryptText, sha256Hex } from './crypto.ts'
import { deriveQuestionStatus, approvalGate } from './status.ts'
import { classifyReuse, wordCount } from './classify.ts'
import { createAppInstance, readAppInstance, listAppInstances } from './instances.ts'
import {
  createFact, reviseFact, retractFact, listFacts, factHistory, VaultFactConflictError,
  addEvidence, linkEvidence, setEvidenceVerification, readEvidence, listEvidenceFor,
} from './knowledge.ts'
import {
  recordReviewDecision, listReviews, readReviewRationale, addComment, listComments,
  recordSuggestion, listSuggestions, readSuggestion, suggestionFromClassification,
} from './review-ledger.ts'
import {
  listInstanceQuestions, saveInstanceDraft, approveAsHuman, editAsChildVersion,
  requestEvidenceOrHelp, recordClassificationSuggestion, getQuestionStatus,
  createInstance, listInstances, addFact,
} from '../aqua-local-client/review.ts'

const SECRET = 'correct-horse-battery-staple'
const MARK = 'ZQX-PRIVATE-MARKER' // must never appear in stored plaintext
let passed = 0
async function t(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`) }
  catch (e) { console.error(`FAIL ${name}: ${e.stack ?? e.message}`); process.exitCode = 1 }
}

async function seed(s, { app = 'app1', occ = 'q1', title = 't', body = 'answer body' } = {}) {
  const a = await createAnswer(s, { application_id: app, question_occurrence_id: occ })
  const v = await createVersion(s, SECRET, { answer_id: a.id, title, body, method: 'manual' })
  return { answer: a, version: v }
}
const approve = (s, v) =>
  recordHumanApproval(s, { version_id: v.id, expected_sha256: v.sha256, actor_id: 'u-test', via: 'review_ui', secret: SECRET })

const V5_STORES = ['app_instances', 'facts', 'evidence', 'reviews', 'comments', 'suggestions']

function fakeIdb(names) {
  const stores = new Map()
  for (const n of names) stores.set(n, { indexes: new Map(), rows: [`row-of-${n}`] })
  const created = []
  return {
    stores, created,
    objectStoreNames: { contains: (n) => stores.has(n) },
    createObjectStore(name, { keyPath }) {
      if (stores.has(name)) throw new Error(`ConstraintError: ${name} exists`)
      const st = { keyPath, indexes: new Map(), rows: [] }
      stores.set(name, st)
      created.push(name)
      return { createIndex: (iname, kp) => st.indexes.set(iname, kp) }
    },
  }
}

// =========================================================================
// Migration v4 → v5
// =========================================================================

await t('schema: DB_VERSION 5, six additive v5 stores declared with key paths', async () => {
  assert.equal(DB_VERSION, 5)
  assert.equal(MIGRATIONS.length, 5)
  for (const n of V5_STORES) assert.ok(STORE_NAMES.includes(n), n)
  const keyPaths = Object.fromEntries(STORE_SPECS.map((s) => [s.name, s.keyPath]))
  assert.equal(keyPaths.app_instances, 'instance_id')
  assert.equal(keyPaths.facts, 'fact_version_id')
  assert.equal(keyPaths.evidence, 'evidence_id')
  assert.equal(keyPaths.reviews, 'review_id')
  assert.equal(keyPaths.comments, 'comment_id')
  assert.equal(keyPaths.suggestions, 'suggestion_id')
  assert.ok(!STORE_NAMES.slice(0, 13).some((n) => V5_STORES.includes(n)), 'v4 store order unchanged')
})

await t('migration v4→v5: creates ONLY the new stores, leaves v4 stores + rows untouched, idempotent', async () => {
  const v4Names = STORE_NAMES.filter((n) => !V5_STORES.includes(n))
  assert.equal(v4Names.length, 13)
  const db = fakeIdb(v4Names)
  const before = JSON.stringify([...db.stores.entries()].map(([k, v]) => [k, v.rows]))
  for (let v = 4; v < DB_VERSION; v++) MIGRATIONS[v](db) // exactly openVaultDb's loop from oldVersion 4
  assert.deepEqual(db.created.sort(), [...V5_STORES].sort())
  for (const n of v4Names) assert.deepEqual(db.stores.get(n).rows, [`row-of-${n}`])
  assert.equal(JSON.stringify([...db.stores.entries()].filter(([k]) => v4Names.includes(k)).map(([k, v]) => [k, v.rows])), before)
  assert.equal(db.stores.get('reviews').indexes.get('by_version'), 'version_id')
  assert.equal(db.stores.get('facts').indexes.get('by_fact'), 'fact_id')
  // re-running (partial prior upgrade) never throws / never recreates
  MIGRATIONS[4](db)
  assert.equal(db.created.length, V5_STORES.length)
})

await t('migration fresh install v0→v5: every store created exactly once', async () => {
  const db = fakeIdb([])
  for (let v = 0; v < DB_VERSION; v++) MIGRATIONS[v](db)
  assert.deepEqual([...db.created].sort(), [...STORE_NAMES].sort())
})

await t('v4 data under v5: legacy rows stay byte-identical and keep their meaning', async () => {
  const s = createMemoryStorage()
  const { answer, version } = await seed(s)
  // v4-shaped approval: no seq, no actor_id, no via
  const legacy = {
    id: 'legacy-ap-1', version_id: version.id, version_sha256: version.sha256,
    decision: 'approved', actor_class: 'human', at: '2026-01-01T00:00:00.000Z',
  }
  await s.put('approvals', legacy)
  const snapVersion = JSON.stringify(await s.get('versions', version.id))
  const snapApproval = JSON.stringify(await s.get('approvals', legacy.id))
  assert.equal((await s.get('versions', version.id)).evidence_ids, undefined)

  const st = deriveQuestionStatus({ versions: [version], approvals: [legacy], reviews: [], suggestions: [] })
  assert.equal(st.status, 'approved')
  assert.equal(st.freeze_eligible, true)
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  })
  assert.ok(packet.packet_id.startsWith('PK-'))
  // v5 operations on the same vault
  await addComment(s, SECRET, { version_id: version.id, body: 'note', actor_class: 'human', actor_id: 'u' })
  await recordReviewDecision(s, SECRET, {
    version_id: version.id, expected_sha256: version.sha256, decision: 'help_requested', actor_class: 'human', actor_id: 'u',
  })
  assert.equal(JSON.stringify(await s.get('versions', version.id)), snapVersion)
  assert.equal(JSON.stringify(await s.get('approvals', legacy.id)), snapApproval)
  assert.equal(answer.scope.application_id, 'app1')
})

// =========================================================================
// Stores
// =========================================================================

function assertNoPlaintext(records, label) {
  const dump = JSON.stringify(records)
  assert.ok(!dump.includes(MARK), `${label}: plaintext marker leaked into stored record`)
}

await t('app_instances: local-only LA-/LQ- ids, template + source ref encrypted, readable back', async () => {
  const s = createMemoryStorage()
  const rec = await createAppInstance(s, SECRET, {
    source: { kind: 'paste', ref: `pasted ${MARK}` },
    local_template: {
      title: `Local Fund ${MARK}`, org: 'Org One', cycle_year: 2027, deadline: '2027-03-01',
      sections: [{ section_id: 's1', title: 'About' }],
      questions: [
        { text: `Describe your mission ${MARK}`, word_limit: 100, required: true, section_id: 's1' },
        { text: 'What is your traction?', char_limit: 500 },
      ],
    },
  })
  assert.ok(rec.instance_id.startsWith('LA-'))
  assert.equal(rec.application_id, rec.instance_id)
  assert.equal(rec.question_refs.length, 2)
  assert.ok(rec.question_refs.every((r) => r.question_occurrence_id.startsWith('LQ-')))
  assertNoPlaintext(await s.getAll('app_instances'), 'app_instances')
  const view = await readAppInstance(s, SECRET, rec.instance_id)
  assert.equal(view.template.title, `Local Fund ${MARK}`)
  assert.equal(view.template.questions[0].text, `Describe your mission ${MARK}`)
  assert.equal(view.template.questions[0].word_limit, 100)
  assert.equal(view.template.questions[0].required, true)
  assert.equal(view.template.questions[1].required, false)
  assert.equal(view.source_ref, `pasted ${MARK}`)
  // local-only must use LQ- ids
  await assert.rejects(() => createAppInstance(s, SECRET, {
    source: { kind: 'file' },
    local_template: { title: 'x', org: 'y', questions: [{ question_occurrence_id: 'pq-1', text: 'Q' }] },
  }), VaultScopeError)
  await assert.rejects(() => createAppInstance(s, SECRET, { source: { kind: 'paste' } }), VaultScopeError)
  await assert.rejects(() => createAppInstance(s, SECRET, { program_id: 'p', source: { kind: 'bogus' } }), VaultScopeError)
})

await t('app_instances: catalog-backed AI- instance stores ids only (no public text duplicated)', async () => {
  const s = createMemoryStorage()
  const rec = await createAppInstance(s, SECRET, {
    program_id: 'prog-1', ap_serial: 'AP-0001', cycle_id: 'cyc-2027', template_revision_sha: 'a'.repeat(64),
    source: { kind: 'catalog', ref: 'prog-1' },
    question_refs: [
      { question_occurrence_id: 'pq-2', canonical_question_id: 'cq-9', order: 1 },
      { question_occurrence_id: 'pq-1', canonical_question_id: null, order: 0 },
    ],
  })
  assert.ok(rec.instance_id.startsWith('AI-'))
  assert.equal(rec.local_template_enc, undefined)
  assert.deepEqual(rec.question_refs.map((r) => r.question_occurrence_id), ['pq-1', 'pq-2'])
  assert.equal((await listAppInstances(s)).length, 1)
  // scope override adopts pre-v5 program-scoped answers
  const adopt = await createAppInstance(s, SECRET, { program_id: 'prog-1', application_id: 'prog-1', source: { kind: 'existing' }, question_refs: [] })
  assert.equal(adopt.application_id, 'prog-1')
})

await t('facts: immutable versions, encrypted values, revise/retract/history, key + conflict guards', async () => {
  const s = createMemoryStorage()
  const f1 = await createFact(s, SECRET, { kind: 'organization', key: 'org.legal_name', value: `Acme ${MARK}` })
  assertNoPlaintext(await s.getAll('facts'), 'facts')
  const f2 = await reviseFact(s, SECRET, { fact_id: f1.fact_id, value: 'Acme Two', expected_latest_version_id: f1.fact_version_id })
  assert.equal(f2.supersedes, f1.fact_version_id)
  assert.equal(f2.fact_id, f1.fact_id)
  // the old row is untouched
  assert.equal((await s.get('facts', f1.fact_version_id)).value_enc, f1.value_enc)
  let live = await listFacts(s, SECRET)
  assert.equal(live.length, 1)
  assert.equal(live[0].value, 'Acme Two')
  // stale expected head refused
  await assert.rejects(
    () => reviseFact(s, SECRET, { fact_id: f1.fact_id, value: 'x', expected_latest_version_id: f1.fact_version_id }),
    VaultFactConflictError,
  )
  // one live fact per (kind, key)
  await assert.rejects(() => createFact(s, SECRET, { kind: 'organization', key: 'org.legal_name', value: 'dup' }), VaultFactConflictError)
  // free-text keys refused
  await assert.rejects(() => createFact(s, SECRET, { kind: 'personal', key: 'My Secret Name', value: 'v' }), VaultScopeError)
  await retractFact(s, SECRET, { fact_id: f1.fact_id })
  live = await listFacts(s, SECRET)
  assert.equal(live.length, 0)
  const hist = await factHistory(s, SECRET, f1.fact_id)
  assert.deepEqual(hist.map((h) => [h.value, h.retracted]), [[`Acme ${MARK}`, false], ['Acme Two', false], ['', true]])
  // after retraction the key is free again
  await createFact(s, SECRET, { kind: 'organization', key: 'org.legal_name', value: 'Acme Three' })
  assert.equal((await listFacts(s, SECRET, { kind: 'organization' })).length, 1)
})

await t('evidence: encrypted, linked to version WITHOUT changing the version, union with cited ids, dangling reported', async () => {
  const s = createMemoryStorage()
  const { version } = await seed(s)
  const snap = JSON.stringify(await s.get('versions', version.id))
  const e1 = await addEvidence(s, SECRET, {
    kind: 'url', title: `Press ${MARK}`, url: `https://example.test/${MARK}`, excerpt: `quote ${MARK}`,
  })
  assertNoPlaintext(await s.getAll('evidence'), 'evidence')
  assert.match(e1.content_sha256, /^[0-9a-f]{64}$/)
  assert.equal(e1.verification, 'unverified')
  await linkEvidence(s, e1.evidence_id, { target_kind: 'version', target_id: version.id })
  await linkEvidence(s, e1.evidence_id, { target_kind: 'version', target_id: version.id }) // idempotent
  assert.equal((await s.get('evidence', e1.evidence_id)).links.length, 1)
  assert.equal(JSON.stringify(await s.get('versions', version.id)), snap, 'version untouched by linking')
  // a child version citing evidence at creation
  const e2 = await addEvidence(s, SECRET, { kind: 'note', title: 'Self note' })
  const child = await createChildVersion(s, SECRET, { parent_version_id: version.id, body: 'edited body', evidence_ids: [e2.evidence_id, 'ev-missing'] })
  assert.deepEqual(child.evidence_ids, [e2.evidence_id, 'ev-missing'])
  // hash unaffected by evidence ids
  assert.equal(child.sha256, await sha256Hex(canonicalJson({ title: 't', body: 'edited body' })))
  const { evidence, missing } = await listEvidenceFor(s, SECRET, 'version', child.id)
  assert.deepEqual(evidence.map((e) => e.title), ['Self note'])
  assert.deepEqual(missing, ['ev-missing'])
  const v1 = await listEvidenceFor(s, SECRET, 'version', version.id)
  assert.equal(v1.evidence[0].url, `https://example.test/${MARK}`)
  await setEvidenceVerification(s, e1.evidence_id, { verification: 'source_checked', freshness_checked_at: '2026-10-01T00:00:00.000Z' })
  const back = await readEvidence(s, SECRET, e1.evidence_id)
  assert.equal(back.verification, 'source_checked')
  assert.equal(back.freshness_checked_at, '2026-10-01T00:00:00.000Z')
  await assert.rejects(() => linkEvidence(s, e1.evidence_id, { target_kind: 'version', target_id: 'nope' }), VaultNotFoundError)
  await assert.rejects(() => addEvidence(s, SECRET, { kind: 'url', title: 'no url' }), VaultScopeError)
})

await t('reviews: hash-bound, append-only, share the events seq with approvals, approved is not a review decision', async () => {
  const s = createMemoryStorage()
  const { version } = await seed(s)
  await approve(s, version)
  const r = await recordReviewDecision(s, SECRET, {
    version_id: version.id, expected_sha256: version.sha256, decision: 'needs_evidence',
    rationale: `why ${MARK}`, actor_class: 'human', actor_id: 'u-1',
  })
  assert.equal(r.seq, 2)
  assertNoPlaintext(await s.getAll('reviews'), 'reviews')
  assert.equal(await readReviewRationale(SECRET, r), `why ${MARK}`)
  const ev = await listEvents(s)
  assert.deepEqual(ev.map((e) => e.kind), ['approval_decision', 'review_decision'])
  assert.ok(!JSON.stringify(ev).includes(MARK), 'ledger carries no free text')
  await assert.rejects(() => recordReviewDecision(s, SECRET, {
    version_id: version.id, expected_sha256: 'f'.repeat(64), decision: 'needs_revision', actor_class: 'human', actor_id: 'u',
  }), VaultApprovalMismatchError)
  await assert.rejects(() => recordReviewDecision(s, SECRET, {
    version_id: version.id, expected_sha256: version.sha256, decision: 'approved', actor_class: 'human', actor_id: 'u',
  }), VaultScopeError)
  await assert.rejects(() => recordReviewDecision(s, SECRET, {
    version_id: version.id, expected_sha256: version.sha256, decision: 'under_review', actor_class: 'agent', actor_id: '',
  }), VaultScopeError)
  assert.equal((await listReviews(s, { version_id: version.id })).length, 1)
  assert.ok(!REVIEW_DECISIONS.includes('approved'))
})

await t('comments: bound to exact version + sha, replies join the thread, cross-answer replies refused', async () => {
  const s = createMemoryStorage()
  const { version } = await seed(s)
  const other = await seed(s, { occ: 'q2' })
  const c1 = await addComment(s, SECRET, {
    version_id: version.id, expected_sha256: version.sha256, body: `please fix ${MARK}`, actor_class: 'human', actor_id: 'u',
  })
  assert.equal(c1.version_id, version.id)
  assert.equal(c1.version_sha256, version.sha256)
  assert.equal(c1.answer_id, version.answer_id)
  assert.ok(c1.thread_id.startsWith('TH-'))
  assertNoPlaintext(await s.getAll('comments'), 'comments')
  const child = await createChildVersion(s, SECRET, { parent_version_id: version.id, body: 'fixed' })
  const c2 = await addComment(s, SECRET, {
    version_id: child.id, body: 'done', parent_comment_id: c1.comment_id, actor_class: 'agent', actor_id: 'companion',
  })
  assert.equal(c2.thread_id, c1.thread_id)
  assert.equal(c2.version_id, child.id)
  const thread = await listComments(s, SECRET, { thread_id: c1.thread_id })
  assert.deepEqual(thread.map((c) => c.body), [`please fix ${MARK}`, 'done'])
  await assert.rejects(() => addComment(s, SECRET, {
    version_id: other.version.id, body: 'x', parent_comment_id: c1.comment_id, actor_class: 'human', actor_id: 'u',
  }), VaultScopeError)
  await assert.rejects(() => addComment(s, SECRET, {
    version_id: version.id, expected_sha256: '0'.repeat(64), body: 'x', actor_class: 'human', actor_id: 'u',
  }), VaultApprovalMismatchError)
})

await t('suggestions: written ONLY to suggestions; text encrypted; never an approval or review', async () => {
  const s = createMemoryStorage()
  const { version } = await seed(s)
  const counts = async () => ({
    approvals: (await s.getAll('approvals')).length,
    reviews: (await s.getAll('reviews')).length,
    versions: (await s.getAll('versions')).length,
    events: (await s.getAll('events')).length,
  })
  const before = await counts()
  const sug = await recordSuggestion(s, SECRET, {
    question_occurrence_id: 'q1', kind: 'recommendation', classification: 'direct',
    candidate_version_id: version.id, reason_codes: ['looks_good'],
    explanation: `recommend approval ${MARK}`, weaknesses: 'w', unsupported_claims: 'c',
    provider: 'mockco', model: 'm-1',
  })
  assert.deepEqual(await counts(), before)
  assert.equal(sug.candidate_version_sha256, version.sha256)
  assertNoPlaintext(await s.getAll('suggestions'), 'suggestions')
  const view = await readSuggestion(SECRET, sug)
  assert.equal(view.explanation, `recommend approval ${MARK}`)
  assert.equal((await listSuggestions(s, { question_occurrence_id: 'q1' })).length, 1)
  await assert.rejects(() => recordSuggestion(s, SECRET, {
    question_occurrence_id: 'q1', kind: 'recommendation', explanation: 'x', reason_codes: ['Free Text!'],
  }), VaultScopeError)
  // and the recommended version is still not approved
  await assert.rejects(() => freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  }), PacketFreezeError)
})

// =========================================================================
// Direct / Adapt / Gap
// =========================================================================

const OCC = {
  text: 'Describe the problem your company solves.',
  canonical_question_id: 'cq-problem',
  word_limit: 50,
  char_limit: 400,
  program_name: 'Target Fund',
  org_name: 'Target Org',
  cycle_year: 2027,
}
function cand(over = {}) {
  return {
    version_id: 'v-1', version_sha256: 'a'.repeat(64),
    body: 'We help small clinics schedule patients without phone calls.',
    title: 'Problem', question_text: 'Describe the problem your company solves.',
    scope: { application_id: 'answer-bank', question_occurrence_id: 'bq-1' },
    canonical_question_id: 'cq-problem', approved: true, created_at: '2026-09-01T00:00:00.000Z',
    program_name: null, org_name: null, evidence_ids: ['ev-1'],
    ...over,
  }
}
const codes = (r) => r.reasons.map((x) => x.code)

await t('classify: Direct — approved, same canonical, within limits, no flags', async () => {
  const r = classifyReuse(OCC, [cand()])
  assert.equal(r.classification, 'direct')
  assert.equal(r.candidate_version_id, 'v-1')
  assert.deepEqual(r.reasons, [])
  assert.deepEqual(r.evidence_ids, ['ev-1'])
  assert.equal(r.similarity, 1)
})

await t('classify: Direct — normalized-equal wording without canonical ids', async () => {
  const r = classifyReuse(
    { ...OCC, canonical_question_id: null },
    [cand({ canonical_question_id: null, question_text: '  describe THE problem your company solves ' })],
  )
  assert.equal(r.classification, 'direct')
})

await t('classify: Adapt — over word limit by N', async () => {
  const body = Array.from({ length: 62 }, (_, i) => `word${i}`).join(' ')
  const r = classifyReuse(OCC, [cand({ body })])
  assert.equal(r.classification, 'adapt')
  const w = r.reasons.find((x) => x.code === 'over_word_limit')
  assert.equal(w.over_by, 12)
  assert.equal(w.actual, wordCount(body))
  assert.match(w.message, /over word limit by 12 words/)
})

await t('classify: Adapt — over char limit', async () => {
  const r = classifyReuse({ ...OCC, word_limit: null, char_limit: 20 }, [cand()])
  assert.equal(r.classification, 'adapt')
  const c = r.reasons.find((x) => x.code === 'over_char_limit')
  assert.equal(c.over_by, cand().body.length - 20)
})

await t('classify: Adapt — mentions another program/org name', async () => {
  const r = classifyReuse(OCC, [cand({ body: 'At Other Accelerator we learned to ship weekly.', program_name: 'Other Accelerator' })])
  assert.equal(r.classification, 'adapt')
  assert.deepEqual(r.reasons.find((x) => x.code === 'mentions_other_program').names, ['Other Accelerator'])
  // own program name is not an audience flag; known names list works too
  const own = classifyReuse(OCC, [cand({ body: 'Target Fund is a great fit for us.' })], { known_program_names: ['Target Fund', 'Rival Fund'] })
  assert.equal(own.classification, 'direct')
  const known = classifyReuse(OCC, [cand({ body: 'Rival Fund backed our pilot.' })], { known_program_names: ['Rival Fund'] })
  assert.deepEqual(codes(known), ['mentions_other_program'])
})

await t('classify: Adapt — dated year older than cycle', async () => {
  const r = classifyReuse(OCC, [cand({ body: 'In 2025 we reached 40 clinics.' })])
  assert.equal(r.classification, 'adapt')
  assert.deepEqual(r.reasons.find((x) => x.code === 'dated_year').years, [2025])
  // a founding year far outside the window is not a staleness flag
  assert.equal(classifyReuse(OCC, [cand({ body: 'Founded in 2009, we serve clinics.' })]).classification, 'direct')
  // cycle year falls back to the deadline
  const d = classifyReuse({ ...OCC, cycle_year: null, deadline: '2027-02-01' }, [cand({ body: 'In 2026 we grew.' })])
  assert.deepEqual(codes(d), ['dated_year'])
})

await t('classify: Adapt — unapproved source', async () => {
  const r = classifyReuse(OCC, [cand({ approved: false })])
  assert.equal(r.classification, 'adapt')
  assert.deepEqual(codes(r), ['unapproved'])
})

await t('classify: Adapt — different question qualifier under the same canonical id', async () => {
  const r = classifyReuse(
    { ...OCC, text: 'Describe the problem your company solves for customers in the last 12 months.' },
    [cand()],
  )
  assert.equal(r.classification, 'adapt')
  const q = r.reasons.find((x) => x.code === 'different_question_qualifier')
  assert.ok(q.qualifiers.includes('customers'))
  assert.ok(q.qualifiers.includes('12'))
})

await t('classify: Adapt — related but different question (medium similarity)', async () => {
  const r = classifyReuse(
    { ...OCC, canonical_question_id: 'cq-other', text: 'What problem do clinics face when they schedule patients?' },
    [cand({ question_text: 'How do you help clinics schedule patients?' })],
  )
  assert.equal(r.classification, 'adapt')
  assert.ok(codes(r).includes('different_question'))
  assert.ok(r.similarity >= 0.3)
})

await t('classify: Gap — nothing related; empty candidate list', async () => {
  const r = classifyReuse(
    { ...OCC, canonical_question_id: 'cq-x', text: 'Upload your audited financial statements.' },
    [cand({ canonical_question_id: 'cq-y', question_text: 'Who is on your founding team?', body: 'Two engineers and a nurse.' })],
  )
  assert.equal(r.classification, 'gap')
  assert.equal(r.candidate_version_id, undefined)
  assert.deepEqual(codes(r), ['no_related_answer'])
  assert.equal(classifyReuse(OCC, []).classification, 'gap')
})

await t('classify: prefers a Direct candidate over a newer Adapt one; lists alternatives', async () => {
  const r = classifyReuse(OCC, [
    cand({ version_id: 'v-new', approved: false, created_at: '2026-10-01T00:00:00.000Z' }),
    cand({ version_id: 'v-ok' }),
  ])
  assert.equal(r.classification, 'direct')
  assert.equal(r.candidate_version_id, 'v-ok')
  assert.deepEqual(r.alternatives.map((a) => [a.version_id, a.classification]), [['v-new', 'adapt']])
})

// =========================================================================
// Status derivation table
// =========================================================================

function ver(id, at, over = {}) {
  return { id, answer_id: 'a1', parent_version_id: null, title: 'x', body: 'x', sha256: `${id}`.padEnd(64, '0'), method: 'manual', provenance: null, created_at: at, immutable: true, ...over }
}
function ap(v, decision, seq, over = {}) {
  return { id: `ap-${seq}`, version_id: v.id, version_sha256: v.sha256, decision, actor_class: 'human', at: `2026-01-0${seq}T00:00:00.000Z`, seq, ...over }
}
function rv(v, decision, seq, over = {}) {
  return { review_id: `rv-${seq}`, answer_id: 'a1', version_id: v.id, version_sha256: v.sha256, decision, actor_class: 'human', actor_id: 'u', at: `2026-01-0${seq}T00:00:00.000Z`, seq, ...over }
}
function sg(kind, over = {}) {
  return { suggestion_id: `sg-${kind}`, question_occurrence_id: 'q1', kind, explanation_enc: 'x', evidence_ids: [], created_at: 't', ...over }
}

await t('status table: every state from versions + reviews + approvals + suggestions + packets', async () => {
  const v1 = ver('v1', '2026-01-01T00:00:00.000Z')
  const v2 = ver('v2', '2026-02-01T00:00:00.000Z', { parent_version_id: 'v1' })
  const D = (o) => deriveQuestionStatus({ versions: [], approvals: [], reviews: [], suggestions: [], ...o })
  const rows = [
    ['nothing', D({}), 'gap'],
    ['suggestion only', D({ suggestions: [sg('reuse', { classification: 'adapt' })] }), 'suggested'],
    ['gap suggestion only', D({ suggestions: [sg('reuse', { classification: 'gap' })] }), 'gap'],
    ['evidence_gap only', D({ suggestions: [sg('evidence_gap')] }), 'needs_evidence'],
    ['human draft', D({ versions: [v1] }), 'under_review'],
    ['provider draft', D({ versions: [ver('v1', 't', { method: 'byok' })] }), 'suggested'],
    ['reused draft', D({ versions: [ver('v1', 't', { derived_from: { version_id: 'z', version_sha256: 'z' } })] }), 'suggested'],
    ['approved', D({ versions: [v1], approvals: [ap(v1, 'approved', 1)] }), 'approved'],
    ['in packet', D({ versions: [v1], approvals: [ap(v1, 'approved', 1)], packet_version_ids: ['v1'] }), 'included_in_packet'],
    ['revoked', D({ versions: [v1], approvals: [ap(v1, 'approved', 1), ap(v1, 'rejected', 2)] }), 'rejected'],
    ['review rejected', D({ versions: [v1], reviews: [rv(v1, 'rejected', 1)] }), 'rejected'],
    ['needs_revision after approval', D({ versions: [v1], approvals: [ap(v1, 'approved', 1)], reviews: [rv(v1, 'needs_revision', 2)] }), 'needs_revision'],
    ['re-approved after review', D({ versions: [v1], approvals: [ap(v1, 'approved', 2)], reviews: [rv(v1, 'needs_revision', 1)] }), 'approved'],
    ['needs_evidence', D({ versions: [v1], reviews: [rv(v1, 'needs_evidence', 1)] }), 'needs_evidence'],
    ['superseded', D({ versions: [v1], reviews: [rv(v1, 'superseded', 1)] }), 'superseded'],
    ['under_review', D({ versions: [v1], reviews: [rv(v1, 'under_review', 1)] }), 'under_review'],
    ['request does not reopen approval', D({ versions: [v1], approvals: [ap(v1, 'approved', 1)], reviews: [rv(v1, 'evidence_requested', 2)] }), 'approved'],
    ['human evidence request', D({ versions: [v1], reviews: [rv(v1, 'evidence_requested', 1)] }), 'needs_evidence'],
    ['agent rejected = advisory', D({ versions: [v1], reviews: [rv(v1, 'rejected', 1, { actor_class: 'agent' })] }), 'needs_revision'],
    ['agent review never revokes', D({ versions: [v1], approvals: [ap(v1, 'approved', 1)], reviews: [rv(v1, 'rejected', 2, { actor_class: 'agent' })] }), 'approved'],
    ['legacy agent approval', D({ versions: [v1], approvals: [ap(v1, 'approved', 1, { actor_class: 'agent' })] }), 'suggested'],
    ['agent row after human approval', D({ versions: [v1], approvals: [ap(v1, 'approved', 1), ap(v1, 'rejected', 2, { actor_class: 'agent' })] }), 'under_review'],
    ['restored approval', D({ versions: [v1], approvals: [ap(v1, 'approved', 1, { restored_from_backup: true })] }), 'under_review'],
    ['hash-mismatched approval', D({ versions: [v1], approvals: [ap(v1, 'approved', 1, { version_sha256: 'f'.repeat(64) })] }), 'under_review'],
    ['older approved, newer draft', D({ versions: [v2, v1], approvals: [ap(v1, 'approved', 1)] }), 'under_review'],
    ['evidence required, none', D({ versions: [v1], evidence_required: true }), 'needs_evidence'],
    ['evidence_gap on governing', D({ versions: [v1], suggestions: [sg('evidence_gap', { candidate_version_id: 'v1' })] }), 'needs_evidence'],
  ]
  for (const [label, got, want] of rows) assert.equal(got.status, want, label)
  const older = D({ versions: [v1, v2], approvals: [ap(v1, 'approved', 1)] })
  assert.equal(older.governing_version_id, 'v2')
  assert.equal(older.approved_version_id, 'v1')
  assert.equal(older.freeze_eligible, false)
  assert.ok(older.reasons.includes('newer_version_not_approved'))
  // status ≡ freeze gate: approved/included ⇔ freeze_eligible
  for (const [, got] of rows) {
    assert.equal(got.freeze_eligible, got.status === 'approved' || got.status === 'included_in_packet')
  }
})

// =========================================================================
// Human approval hardening
// =========================================================================

await t('recordHumanApproval: hash-bound — mismatch refused and nothing written', async () => {
  const s = createMemoryStorage()
  const { version } = await seed(s)
  await assert.rejects(
    () => recordHumanApproval(s, { version_id: version.id, expected_sha256: 'e'.repeat(64), actor_id: 'u', via: 'review_ui' }),
    VaultApprovalMismatchError,
  )
  assert.equal((await s.getAll('approvals')).length, 0)
  assert.equal((await s.getAll('events')).length, 0)
  const rec = await approve(s, version)
  assert.equal(rec.actor_class, 'human')
  assert.equal(rec.actor_id, 'u-test')
  assert.equal(rec.via, 'review_ui')
  assert.equal(rec.version_sha256, version.sha256)
  const ev = (await listEvents(s))[0]
  assert.equal(ev.payload.via, 'review_ui')
  assert.equal(ev.payload.actor_id, 'u-test')
  // input guards
  await assert.rejects(() => recordHumanApproval(s, { version_id: version.id, expected_sha256: version.sha256, actor_id: '  ', via: 'review_ui' }), VaultScopeError)
  await assert.rejects(() => recordHumanApproval(s, { version_id: version.id, expected_sha256: version.sha256, actor_id: 'u', via: 'legacy' }), VaultScopeError)
  await assert.rejects(() => recordHumanApproval(s, { version_id: 'missing', expected_sha256: version.sha256, actor_id: 'u', via: 'review_ui' }), VaultNotFoundError)
})

await t('recordHumanApproval: a swapped row (stored sha kept, plaintext changed) is refused with secret', async () => {
  const s = createMemoryStorage()
  const { version } = await seed(s, { body: 'original text' })
  const forged = { ...(await s.get('versions', version.id)), body: JSON.stringify(await encryptText(SECRET, 'swapped text')) }
  await s.put('versions', forged)
  await assert.rejects(
    () => recordHumanApproval(s, { version_id: version.id, expected_sha256: version.sha256, actor_id: 'u', via: 'review_ui', secret: SECRET }),
    VaultApprovalMismatchError,
  )
  assert.equal((await s.getAll('approvals')).length, 0)
})

await t('agent cannot approve: v5 APIs have no agent approval path; agent signals never satisfy freeze', async () => {
  const s = createMemoryStorage()
  const { version } = await seed(s)
  await recordSuggestion(s, SECRET, {
    question_occurrence_id: 'q1', kind: 'recommendation', classification: 'direct', candidate_version_id: version.id, explanation: 'approve it',
  })
  await recordReviewDecision(s, SECRET, {
    version_id: version.id, expected_sha256: version.sha256, decision: 'under_review', actor_class: 'agent', actor_id: 'companion',
  })
  await addComment(s, SECRET, { version_id: version.id, body: 'LGTM — approved', actor_class: 'agent', actor_id: 'companion' })
  // recordHumanApproval has no actor_class input: even a forged one is ignored
  const r = await recordHumanApproval(s, { version_id: version.id, expected_sha256: version.sha256, actor_id: 'u', via: 'review_ui', actor_class: 'agent', secret: SECRET })
  assert.equal(r.actor_class, 'human')
  await recordHumanRevocation(s, { version_id: version.id, expected_sha256: version.sha256, actor_id: 'u', via: 'review_ui' })
  // only the human rows exist in the approvals ledger
  assert.deepEqual((await listApprovals(s, version.id)).map((a) => [a.actor_class, a.decision]), [['human', 'approved'], ['human', 'rejected']])
  await assert.rejects(() => freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }],
  }), /unapproved selection/)
})

await t('edit approved → new child version, NOT approved; parent keeps its approval', async () => {
  const s = createMemoryStorage()
  const { version } = await seed(s, { title: 'Mission', body: 'v1 text' })
  await approve(s, version)
  const child = await editAsChildVersion(s, SECRET, { parent_version_id: version.id, body: 'v2 text' })
  assert.equal(child.parent_version_id, version.id)
  assert.equal(child.answer_id, version.answer_id)
  assert.notEqual(child.sha256, version.sha256)
  assert.equal((await readVersion(s, SECRET, child.id)).title, 'Mission')
  assert.equal(approvalGate(child, await s.getAll('approvals'), []).approved, false)
  assert.equal(approvalGate(version, await s.getAll('approvals'), []).approved, true)
  const st = await getQuestionStatus(s, SECRET, { application_id: 'app1', question_occurrence_id: 'q1' })
  assert.equal(st.status, 'under_review')
  assert.equal(st.governing_version_id, child.id)
  assert.equal(st.approved_version_id, version.id)
  await assert.rejects(() => freezeApplicationPacket(s, SECRET, {
    application_id: 'app1',
    selections: [{ question_occurrence_id: 'q1', version_id: child.id, question_text_snapshot: 'Q?' }],
  }), /unapproved selection/)
})

// =========================================================================
// Packet freeze compatibility
// =========================================================================

await t('freeze: agent suggestion / agent review never satisfy; human reopening review blocks; re-approval unblocks; included_in_packet after freeze', async () => {
  const s = createMemoryStorage()
  const { version } = await seed(s)
  const sel = { application_id: 'app1', selections: [{ question_occurrence_id: 'q1', version_id: version.id, question_text_snapshot: 'Q?' }] }
  await recordSuggestion(s, SECRET, { question_occurrence_id: 'q1', kind: 'reuse', classification: 'direct', candidate_version_id: version.id, explanation: 'x' })
  await recordReviewDecision(s, SECRET, { version_id: version.id, expected_sha256: version.sha256, decision: 'under_review', actor_class: 'agent', actor_id: 'a' })
  await assert.rejects(() => freezeApplicationPacket(s, SECRET, sel), /unapproved selection/)

  await approve(s, version)
  // agent review AFTER approval cannot block it either
  await recordReviewDecision(s, SECRET, { version_id: version.id, expected_sha256: version.sha256, decision: 'rejected', actor_class: 'agent', actor_id: 'a' })
  // a human reopening review does block it
  await recordReviewDecision(s, SECRET, { version_id: version.id, expected_sha256: version.sha256, decision: 'needs_revision', actor_class: 'human', actor_id: 'u' })
  await assert.rejects(() => freezeApplicationPacket(s, SECRET, sel), /unapproved selection/)
  assert.equal((await getQuestionStatus(s, SECRET, { application_id: 'app1', question_occurrence_id: 'q1' })).status, 'needs_revision')

  await approve(s, version)
  assert.equal((await getQuestionStatus(s, SECRET, { application_id: 'app1', question_occurrence_id: 'q1' })).status, 'approved')
  const { packet } = await freezeApplicationPacket(s, SECRET, sel)
  assert.equal(packet.questions[0].version_id, version.id)
  assert.equal((await getQuestionStatus(s, SECRET, { application_id: 'app1', question_occurrence_id: 'q1' })).status, 'included_in_packet')
  // human requests do not reopen
  await requestEvidenceOrHelp(s, SECRET, { version_id: version.id, expected_sha256: version.sha256, kind: 'help_requested', note: 'tighten?' })
  assert.equal((await getQuestionStatus(s, SECRET, { application_id: 'app1', question_occurrence_id: 'q1' })).status, 'included_in_packet')
})

// =========================================================================
// Backup v2
// =========================================================================

async function populated() {
  const s = createMemoryStorage()
  const inst = await createAppInstance(s, SECRET, {
    source: { kind: 'paste' },
    local_template: { title: 'Local', org: 'O', questions: [{ text: 'Q one?' }] },
  })
  const occ = inst.question_refs[0].question_occurrence_id
  const v = await saveInstanceDraft(s, SECRET, inst.instance_id, occ, { title: 'A', body: 'answer one' })
  await approve(s, v)
  await recordReviewDecision(s, SECRET, { version_id: v.id, expected_sha256: v.sha256, decision: 'help_requested', actor_class: 'human', actor_id: 'u' })
  await addComment(s, SECRET, { version_id: v.id, body: 'c', actor_class: 'human', actor_id: 'u' })
  const e = await addEvidence(s, SECRET, { kind: 'note', title: 'n', links: [{ target_kind: 'version', target_id: v.id }] })
  await createFact(s, SECRET, { kind: 'project', key: 'project.name', value: 'P', evidence_ids: [e.evidence_id] })
  await recordSuggestion(s, SECRET, { instance_id: inst.instance_id, question_occurrence_id: occ, kind: 'reuse', classification: 'gap', explanation: 'none' })
  return { s, inst, occ, v }
}

await t('backup v2: every v5 store round-trips; decisions restore marked + unattested', async () => {
  assert.equal(BACKUP_FORMAT_VERSION, 2)
  const { s, inst, occ, v } = await populated()
  const dump = await exportVault(s, SECRET)
  const s2 = createMemoryStorage()
  const preview = await previewVaultImport(s2, SECRET, dump)
  for (const n of V5_STORES) assert.equal(preview.stores[n].insert, 1, `preview ${n}`)
  const res = await importVault(s2, SECRET, dump)
  for (const n of V5_STORES) assert.equal(res.counts[n], 1, `restore ${n}`)
  // content readable under the same secret
  assert.equal((await readAppInstance(s2, SECRET, inst.instance_id)).template.questions[0].text, 'Q one?')
  assert.equal((await listFacts(s2, SECRET))[0].value, 'P')
  assert.equal((await listComments(s2, SECRET, { version_id: v.id }))[0].body, 'c')
  // decision-bearing records are marked restored; review seq stripped
  const [review] = await s2.getAll('reviews')
  assert.equal(review.restored_from_backup, true)
  assert.equal(review.seq, undefined)
  assert.equal((await s2.getAll('suggestions'))[0].restored_from_backup, true)
  assert.equal((await s2.getAll('approvals'))[0].restored_from_backup, true)
  assert.equal((await s2.getAll('facts'))[0].restored_from_backup, undefined)
  // restored approval does not qualify: status is not approved, freeze refuses
  const rows = await listInstanceQuestions(s2, SECRET, inst.instance_id, { classify: false })
  assert.equal(rows[0].status.status, 'under_review')
  assert.equal(rows[0].status.freeze_eligible, false)
  await assert.rejects(() => freezeApplicationPacket(s2, SECRET, {
    application_id: inst.application_id,
    selections: [{ question_occurrence_id: occ, version_id: v.id, question_text_snapshot: 'Q one?' }],
  }), /unapproved selection/)
  // a fresh local approval re-qualifies
  await approve(s2, v)
  assert.equal((await listInstanceQuestions(s2, SECRET, inst.instance_id, { classify: false }))[0].status.status, 'approved')
  // second import: all duplicates
  const again = await importVault(s2, SECRET, dump)
  for (const n of V5_STORES) assert.equal(again.counts[n] ?? 0, 0)
})

await t('backup v1 file (no v5 arrays) still restores under v5', async () => {
  const s1 = createMemoryStorage()
  const { version } = await seed(s1, { body: 'legacy body' })
  await approveVersion(s1, { version_id: version.id, decision: 'approved', actor_class: 'human' })
  // craft a genuine v1 payload: export, then strip v5 arrays + set version 1
  const env = JSON.parse(await exportVault(s1, SECRET))
  const { decryptText } = await import('./crypto.ts')
  const payload = JSON.parse(await decryptText(SECRET, env))
  for (const n of V5_STORES) delete payload[n]
  payload.format_version = 1
  const v1 = JSON.stringify({ format: 'aqua-local-backup', ...(await encryptText(SECRET, canonicalJson(payload))) })
  const s2 = createMemoryStorage()
  const res = await importVault(s2, SECRET, v1)
  assert.equal(res.counts.versions, 1)
  assert.equal((await readVersion(s2, SECRET, version.id)).body, 'legacy body')
  assert.equal((await s2.getAll('approvals'))[0].restored_from_backup, true)
  for (const n of V5_STORES) assert.equal((await s2.getAll(n)).length, 0)
  // newer-than-supported still refused
  payload.format_version = 3
  const v3 = JSON.stringify({ format: 'aqua-local-backup', ...(await encryptText(SECRET, canonicalJson(payload))) })
  await assert.rejects(() => importVault(createMemoryStorage(), SECRET, v3), /newer than supported/)
})

// =========================================================================
// Client board: listInstanceQuestions + drafting
// =========================================================================

await t('board: Direct / Adapt / Gap per question + derived status; drafting from a candidate is suggested, never approved', async () => {
  const s = createMemoryStorage()
  // Bank answers (answer-bank scope) for reuse
  const bankInst = await createInstance(s, SECRET, {
    source: { kind: 'paste' },
    application_id: 'answer-bank',
    local_template: {
      title: 'Bank', org: '', questions: [
        { question_occurrence_id: 'LQ-bank-1', canonical_question_id: 'cq-problem', text: 'Describe the problem you solve.' },
        { question_occurrence_id: 'LQ-bank-2', canonical_question_id: 'cq-team', text: 'Who is on your team?' },
      ],
    },
  })
  const b1 = await saveInstanceDraft(s, SECRET, bankInst.instance_id, 'LQ-bank-1', { title: 'Problem', body: 'Clinics lose hours to phone scheduling.' })
  await approveAsHuman(s, { version_id: b1.id, expected_sha256: b1.sha256, actor_id: 'u', secret: SECRET })
  await saveInstanceDraft(s, SECRET, bankInst.instance_id, 'LQ-bank-2', { title: 'Team', body: 'Two engineers and a nurse.' })

  const inst = await createInstance(s, SECRET, {
    source: { kind: 'paste' },
    local_template: {
      title: 'New Fund', org: 'New Org', cycle_year: 2027, questions: [
        { canonical_question_id: 'cq-problem', text: 'Describe the problem you solve.', word_limit: 100 },
        { canonical_question_id: 'cq-team', text: 'Who is on your team?' },
        { text: 'Upload audited financial statements.' },
      ],
    },
  })
  assert.equal((await listInstances(s)).length, 2)
  const rows = await listInstanceQuestions(s, SECRET, inst.instance_id, { now: '2026-10-22T00:00:00.000Z' })
  assert.deepEqual(rows.map((r) => r.classification.classification), ['direct', 'adapt', 'gap'])
  assert.deepEqual(rows.map((r) => r.status.status), ['gap', 'gap', 'gap'])
  assert.equal(rows[0].classification.candidate_version_id, b1.id)
  assert.ok(rows[1].classification.reasons.some((r) => r.code === 'unapproved'))
  assert.equal(rows[0].text, 'Describe the problem you solve.')
  assert.equal(rows[0].word_limit, 100)

  // persist the classification as a suggestion → status 'suggested' (no version yet)
  await recordClassificationSuggestion(s, SECRET, rows[0].question_occurrence_id, rows[0].classification, { instance_id: inst.instance_id })
  let after = await listInstanceQuestions(s, SECRET, inst.instance_id, { classify: false })
  assert.equal(after[0].status.status, 'suggested')
  assert.equal(after[2].status.status, 'gap')

  // draft from the Direct candidate: derived_from recorded, status suggested, NOT approved
  const draft = await saveInstanceDraft(s, SECRET, inst.instance_id, rows[0].question_occurrence_id, {
    title: 'Problem', body: 'Clinics lose hours to phone scheduling.', derived_from_version_id: b1.id,
  })
  assert.deepEqual(draft.derived_from, { version_id: b1.id, version_sha256: b1.sha256 })
  after = await listInstanceQuestions(s, SECRET, inst.instance_id, { classify: false })
  assert.equal(after[0].status.status, 'suggested')
  assert.equal(after[0].status.freeze_eligible, false)
  assert.equal(after[0].answer_id, draft.answer_id)
  // only a human approval of THIS version makes it approved
  await approveAsHuman(s, { version_id: draft.id, expected_sha256: draft.sha256, secret: SECRET })
  after = await listInstanceQuestions(s, SECRET, inst.instance_id, { classify: false })
  assert.equal(after[0].status.status, 'approved')
  // a second save creates a child of the latest — and drops back to under_review
  const v2 = await saveInstanceDraft(s, SECRET, inst.instance_id, rows[0].question_occurrence_id, { title: 'Problem', body: 'Clinics lose ten hours a week.' })
  assert.equal(v2.parent_version_id, draft.id)
  after = await listInstanceQuestions(s, SECRET, inst.instance_id, { classify: false })
  assert.equal(after[0].status.status, 'under_review')
  assert.equal(after[0].status.approved_version_id, draft.id)
  await assert.rejects(() => saveInstanceDraft(s, SECRET, inst.instance_id, 'LQ-not-in-instance', { title: 'x', body: 'y' }), VaultNotFoundError)
  // facts via client
  const fact = await addFact(s, SECRET, { kind: 'personal', key: 'person.name', value: 'Sam' })
  assert.ok(fact.fact_id)
})

await t('suggestionFromClassification: reason codes plaintext-safe, messages only in encrypted explanation', async () => {
  const r = classifyReuse(OCC, [cand({ body: `At ${MARK} Fund we learned.`, program_name: `${MARK} Fund` })])
  const input = suggestionFromClassification('q1', r)
  assert.deepEqual(input.reason_codes, ['mentions_other_program'])
  const s = createMemoryStorage()
  const rec = await recordSuggestion(s, SECRET, { ...input, candidate_version_id: null })
  assertNoPlaintext(await s.getAll('suggestions'), 'suggestion explanation')
  assert.ok((await readSuggestion(SECRET, rec)).explanation.includes(MARK))
})

// =========================================================================
// Per-uid isolation + sign-out (session.ts getStorage with an injected opener)
// =========================================================================

const SB_URL = 'https://testref0123.supabase.co'
const SB_BASE = 'sb-testref0123-auth-token'
function b64url(x) {
  return Buffer.from(x, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function signIn(uid) {
  const v = `base64-${b64url(JSON.stringify({ access_token: 'at', refresh_token: 'rt', user: { id: uid } }))}`
  globalThis.document = { cookie: `${SB_BASE}=${encodeURIComponent(v)}` }
}
function signOutCookies() { globalThis.document = { cookie: '' } }

await t('isolation: two uids get separate vaults; switching revokes the old handle; sign-out closes + locks', async () => {
  const session = await import('../aqua-local-client/session.ts')
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = SB_URL
  const dbs = new Map()
  const closed = []
  session.__setVaultOpenerForTests(async (name) => {
    if (!dbs.has(name)) dbs.set(name, createMemoryStorage())
    const inner = dbs.get(name)
    return { ...Object.fromEntries(['get', 'put', 'putIfAbsent', 'getAll', 'delete', 'keys', 'tx'].map((k) => [k, inner[k].bind(inner)])), close: () => closed.push(name) }
  })
  session.__setSessionProbeForTests(async () => ({ uid: null }))
  try {
    session.invalidateVaultIdentity()
    signIn('uid-aaa')
    const a = await session.getStorage()
    assert.equal(a.dbName, 'aqua-local-uid-aaa')
    const instA = await createInstance(a.storage, SECRET, {
      source: { kind: 'paste' }, local_template: { title: 'A only', org: '', questions: [{ text: 'Q?' }] },
    })
    const vA = await saveInstanceDraft(a.storage, SECRET, instA.instance_id, instA.question_refs[0].question_occurrence_id, { title: 't', body: 'A private' })
    await addComment(a.storage, SECRET, { version_id: vA.id, body: 'A comment', actor_class: 'human', actor_id: 'uid-aaa' })

    // account switch → B sees nothing of A, A's handle is dead
    signIn('uid-bbb')
    const b = await session.getStorage()
    assert.equal(b.dbName, 'aqua-local-uid-bbb')
    assert.equal((await listInstances(b.storage)).length, 0)
    assert.equal((await b.storage.getAll('versions')).length, 0)
    assert.equal((await b.storage.getAll('comments')).length, 0)
    await assert.rejects(() => listInstances(a.storage), VaultScopeError)
    await assert.rejects(() => a.storage.get('versions', vA.id), VaultScopeError)
    assert.ok(closed.includes('aqua-local-uid-aaa'), 'A connection closed on account switch')

    // sign-out → B's handle refuses every operation; connection closed
    session.invalidateVaultIdentity()
    signOutCookies()
    await assert.rejects(() => listInstances(b.storage), VaultScopeError)
    await assert.rejects(() => approveAsHuman(b.storage, { version_id: 'x', expected_sha256: 'a'.repeat(64) }), VaultScopeError)
    assert.ok(closed.includes('aqua-local-uid-bbb'), 'B connection closed on sign-out')

    // A signs back in → A's data is intact in A's vault only
    signIn('uid-aaa')
    const a2 = await session.getStorage()
    assert.equal(a2.dbName, 'aqua-local-uid-aaa')
    assert.equal((await listInstances(a2.storage)).length, 1)
    assert.equal((await readVersion(a2.storage, SECRET, vA.id)).body, 'A private')
    // and the per-uid vaults never share a record
    const idsA = new Set((await dbs.get('aqua-local-uid-aaa').getAll('versions')).map((v) => v.id))
    for (const v of await dbs.get('aqua-local-uid-bbb').getAll('versions')) assert.ok(!idsA.has(v.id))
  } finally {
    session.__setVaultOpenerForTests(null)
    session.__setSessionProbeForTests(null)
    session.invalidateVaultIdentity()
    signOutCookies()
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl
  }
})


await t('M09 hardening: backup carries an account fingerprint INSIDE the encrypted payload (absent = unknown)', async () => {
  const s = createMemoryStorage()
  await seed(s, { body: `${MARK} account-bound body` })
  const UID = '00000000-0000-4000-8000-00000000abcd'
  const bound = await exportVault(s, SECRET, { account_uid: UID })
  const env = JSON.parse(bound)
  assert.equal(env.account_fp, undefined, 'never in the plaintext envelope')
  assert.ok(!bound.includes(UID), 'the uid never appears in the file')
  const payload = JSON.parse(await decryptText(SECRET, env))
  assert.equal(payload.account_fp_scheme, BACKUP_ACCOUNT_FP_SCHEME)
  assert.equal(payload.account_fp, await backupAccountFingerprint(SECRET, UID))
  assert.match(payload.account_fp, /^[0-9a-f]{64}$/)
  assert.notEqual(await backupAccountFingerprint('another-secret', UID), payload.account_fp, 'keyed by the vault secret')
  assert.equal(await backupAccountFingerprint(SECRET, ` ${UID.toUpperCase()} `), payload.account_fp, 'uid normalized')
  assert.equal(await backupAccountStatus(SECRET, bound, UID), 'match')
  assert.equal(await backupAccountStatus(SECRET, bound, '00000000-0000-4000-8000-00000000ffff'), 'mismatch')
  const legacy = await exportVault(s, SECRET)
  assert.equal(JSON.parse(await decryptText(SECRET, JSON.parse(legacy))).account_fp, undefined)
  assert.equal(await backupAccountStatus(SECRET, legacy, UID), 'unknown', 'older backups: account unknown')
  // still restores (backward compatible both ways)
  const s2 = createMemoryStorage()
  const r = await importVault(s2, SECRET, bound)
  assert.equal(r.counts.versions, 1)
})


await t('M09b: a history_attestation approval is a hash-bound human approval for freeze; its backup copy is restored/unattested', async () => {
  const { recordHistoryAttestation } = await import('./repo.ts')
  const { buildVersionPayload } = await import('./repo.ts')
  const s = createMemoryStorage()
  const a = await createAnswer(s, { application_id: 'LA-h', question_occurrence_id: 'LQ-h' })
  const { record, receipt } = await buildVersionPayload(SECRET, { answer_id: a.id, title: 'Submitted', body: 'Synthetic submitted answer.', method: 'imported' })
  record.history = true
  await s.put('versions', record)
  await s.put('provenance', receipt)
  const ap = await recordHistoryAttestation(s, SECRET, { version_id: record.id, expected_sha256: record.sha256, effective_at: '2025-01-15', statement: 'I submitted this.', actor_id: 'u-test' })
  assert.equal(approvalGate(record, await listApprovals(s)).approved, true)
  const st = deriveQuestionStatus({ versions: [record], approvals: await listApprovals(s), reviews: [], suggestions: [] })
  assert.equal(st.status, 'approved')
  const s2 = createMemoryStorage()
  await importVault(s2, SECRET, await exportVault(s, SECRET))
  const [restored] = await listApprovals(s2)
  assert.equal(restored.id, ap.id)
  assert.equal(restored.restored_from_backup, true)
  assert.equal(approvalGate(record, [restored]).approved, false)
})

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`)
