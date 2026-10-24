// M09b — submitted-history attestation (vault side): placeholder rule in the
// vault write, hash binding, effective_at, encrypted statement, approval
// gate, backup v2 round trip (restored = unattested).
// Run: node lib/aqua-local/run-history-tests.mjs   (Node >=22.6 type-strips .ts imports)
// All fixtures are synthetic.
import assert from 'node:assert/strict'

import { createMemoryStorage } from './vault.ts'
import {
  createAnswer, buildVersionPayload, recordHistoryAttestation, recordHumanApproval, listApprovals, listEvents,
  VaultApprovalMismatchError, VaultPlaceholderError, VaultScopeError,
} from './repo.ts'
import { approvalGate } from './status.ts'
import { exportVault, importVault } from './backup.ts'
import { decryptField, encryptField, decryptText, encryptText } from './crypto.ts'
import { findPlaceholders, normalizeEffectiveAt, isCalendarDate, HISTORY_FORMAT, describePlaceholders, computeHistoryMetaHash, checkHistoryMetaHash, historyMetaHashInput, HISTORY_META_MISMATCH_REASON } from './history.ts'
import { VaultHistoryMetaMismatchError, verifyHistoryMeta } from './repo.ts'
import { listHistoryCandidates, confirmHistorySelection } from './history-review.ts'
import * as Shared from './placeholders.ts'
import { recordHumanRevocation, VaultHistoryApprovalError } from './repo.ts'
import { approveAsHuman } from '../aqua-local-client/review.ts'
import fs from 'node:fs'

const SECRET = 'synthetic-history-secret'
const MARK = 'ZQX-HISTORY-PRIVATE-MARKER'
let passed = 0
async function t(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`) }
  catch (e) { console.error(`FAIL ${name}: ${e.stack ?? e.message}`); process.exitCode = 1 }
}

/** Insert a version the way an importVault of a companion history record does. */
async function historyVersion(s, body, { history = true, title = 'Synthetic submitted answer' } = {}) {
  const a = await createAnswer(s, { application_id: 'LA-hist', question_occurrence_id: 'LQ-1' })
  const { record, receipt } = await buildVersionPayload(SECRET, { answer_id: a.id, title, body, method: 'imported' })
  if (history) {
    record.history = true
    record.history_enc = await encryptField(SECRET, JSON.stringify({ format: HISTORY_FORMAT, program: 'Synthetic Fund', question: 'Why now?', submitted_at: '2025-03-01' }))
  }
  await s.put('versions', record)
  await s.put('provenance', receipt)
  return record
}
const attest = (s, v, over = {}) => recordHistoryAttestation(s, SECRET, {
  version_id: v.id, expected_sha256: v.sha256, effective_at: '2025-03-01',
  statement: 'I submitted this answer to Synthetic Fund on 2025-03-01.', actor_id: 'u-test', ...over,
})

await t('placeholder scan flags every M09b marker and leaves ordinary prose alone', () => {
  const cases = {
    'We grew 3x [CONFIRM number] last year.': ['confirm'],
    'See deck [ASSET NEEDED: chart].': ['asset_needed'],
    'Revenue is TODO.': ['todo'], 'Launch date tbd.': ['tbd'], 'Contact XXX for details.': ['xxx'],
    'Our CEO <founder name> leads sales.': ['angle'], 'Pending <…> details.': ['angle'], 'Pending <...>': ['angle'],
    'Hello {{first_name}}!': ['mustache'],
  }
  for (const [text, ids] of Object.entries(cases)) assert.deepEqual(findPlaceholders(text), ids, text)
  for (const clean of ['If x < y and z > w we pivot.', 'We are a toddler-focused todolist? no.', 'Price: $5 <10% margin', 'Plain answer.', 'XX large']) {
    assert.deepEqual(findPlaceholders(clean), [], clean)
  }
  assert.match(describePlaceholders(['todo']), /TODO/)
})

await t('effective_at: real calendar dates only, never in the future', () => {
  assert.equal(isCalendarDate('2025-02-29'), false)
  assert.equal(isCalendarDate('2024-02-29'), true)
  assert.equal(normalizeEffectiveAt('2025-03-01'), '2025-03-01')
  assert.equal(normalizeEffectiveAt('2025-03-01T12:00:00Z'), '2025-03-01T12:00:00Z')
  assert.equal(normalizeEffectiveAt('03/01/2025'), null)
  assert.equal(normalizeEffectiveAt('2999-01-01'), null)
  assert.equal(normalizeEffectiveAt(''), null)
})

await t('recordHistoryAttestation writes a hash-bound human approval with effective_at and an encrypted statement', async () => {
  const s = createMemoryStorage()
  const v = await historyVersion(s, `We submitted a synthetic answer. ${MARK}`)
  const a = await attest(s, v)
  assert.equal(a.actor_class, 'human')
  assert.equal(a.via, 'history_attestation')
  assert.equal(a.decision, 'approved')
  assert.equal(a.version_sha256, v.sha256)
  assert.equal(a.effective_at, '2025-03-01')
  assert.ok(a.seq >= 1)
  assert.ok(!JSON.stringify(a).includes('I submitted this answer'), 'statement is ciphertext at rest')
  assert.equal(await decryptField(SECRET, a.attestation_enc), 'I submitted this answer to Synthetic Fund on 2025-03-01.')
  const gate = approvalGate(v, await listApprovals(s), [])
  assert.equal(gate.approved, true, 'the approval gate accepts it as a human approval')
  const ev = (await listEvents(s, 'approval_decision')).at(-1)
  assert.equal(ev.payload.via, 'history_attestation')
  assert.equal(ev.payload.effective_at, '2025-03-01')
})

await t('placeholders are refused IN THE VAULT WRITE (not only the UI); nothing is written', async () => {
  for (const body of ['Our traction: [CONFIRM metric]', 'Team: TBD', 'Founder <name> leads', 'Hi {{name}}', 'Pending XXX', 'TODO write this', '[ASSET NEEDED] pitch video']) {
    const s = createMemoryStorage()
    const v = await historyVersion(s, body)
    await assert.rejects(() => attest(s, v), VaultPlaceholderError, body)
    assert.equal((await listApprovals(s)).length, 0)
    assert.equal((await listEvents(s)).length, 0)
  }
})

await t('hash mismatch, non-history versions, bad dates and blank statements are refused', async () => {
  const s = createMemoryStorage()
  const v = await historyVersion(s, 'Clean synthetic answer.')
  await assert.rejects(() => attest(s, v, { expected_sha256: 'a'.repeat(64) }), VaultApprovalMismatchError)
  await assert.rejects(() => attest(s, v, { expected_sha256: 'nothex' }), VaultApprovalMismatchError)
  await assert.rejects(() => attest(s, v, { effective_at: '2999-12-31' }), VaultScopeError)
  await assert.rejects(() => attest(s, v, { effective_at: 'last spring' }), VaultScopeError)
  await assert.rejects(() => attest(s, v, { statement: '   ' }), VaultScopeError)
  await assert.rejects(() => attest(s, v, { actor_id: '' }), VaultScopeError)
  const plain = await historyVersion(s, 'A normal draft, not history.', { history: false })
  await assert.rejects(() => attest(s, plain), VaultScopeError)
  // a tampered row whose stored sha256 was left intact: plaintext rehash catches it
  const tampered = await historyVersion(s, 'Original synthetic text.')
  const other = await buildVersionPayload(SECRET, { answer_id: tampered.answer_id, title: tampered.title ? 'Synthetic submitted answer' : '', body: 'Swapped body.', method: 'imported' })
  await s.put('versions', { ...tampered, body: other.record.body })
  await assert.rejects(() => attest(s, tampered), VaultApprovalMismatchError)
  assert.equal((await listApprovals(s)).length, 0)
})

await t('recordHumanApproval cannot be used to forge a history_attestation row', async () => {
  const s = createMemoryStorage()
  const v = await historyVersion(s, 'Clean synthetic answer.')
  await assert.rejects(() => recordHumanApproval(s, { version_id: v.id, expected_sha256: v.sha256, actor_id: 'u', via: 'history_attestation' }), VaultScopeError)
})

await t('approval gate: a history_attestation row without effective_at / attestation_enc is not an approval', async () => {
  const v = { id: 'v1', sha256: 'b'.repeat(64) }
  const base = { id: 'ap1', version_id: 'v1', version_sha256: v.sha256, decision: 'approved', actor_class: 'human', at: '2026-10-22T00:00:00Z', seq: 1, actor_id: 'u', via: 'history_attestation' }
  assert.equal(approvalGate(v, [base]).approved, false)
  assert.equal(approvalGate(v, [{ ...base, effective_at: '2025-03-01' }]).approved, false)
  assert.equal(approvalGate(v, [{ ...base, effective_at: '2025-03-01', attestation_enc: '{"x":1}' }]).approved, true)
})

await t('backup v2 carries history approvals and history_enc; restored ones stay unattested', async () => {
  const s = createMemoryStorage()
  const v = await historyVersion(s, 'Clean synthetic answer for backup.')
  const a = await attest(s, v)
  const text = await exportVault(s, SECRET)
  assert.ok(!text.includes('I submitted this answer'))
  const s2 = createMemoryStorage()
  const r = await importVault(s2, SECRET, text)
  assert.equal(r.counts.approvals, 1)
  const [ra] = await listApprovals(s2)
  assert.equal(ra.via, 'history_attestation')
  assert.equal(ra.effective_at, '2025-03-01')
  assert.equal(ra.attestation_enc, a.attestation_enc)
  assert.equal(ra.restored_from_backup, true)
  const rv = await s2.get('versions', v.id)
  assert.equal(rv.history, true)
  assert.equal(JSON.parse(await decryptField(SECRET, rv.history_enc)).submitted_at, '2025-03-01')
  assert.equal(approvalGate(rv, await listApprovals(s2)).approved, false, 'restored = unattested, like other approvals')
  // the user can confirm it again locally
  await attest(s2, rv)
  assert.equal(approvalGate(rv, await listApprovals(s2)).approved, true)
})

// ─── G18: content hash over the history metadata (tamper evidence) ──────────

const HEX64 = /^[0-9a-f]{64}$/
const baseMeta = () => ({
  format: HISTORY_FORMAT, program: 'Synthetic Fund', question: 'Why now?', submitted_at: '2025-03-01', date_source: 'frontmatter',
  flags: ['date_conflict', 'date_ambiguous'], source_sha256: 'a'.repeat(64), source_file: 'fund.md',
  placeholder: { found: false, markers: [] }, imported_at: '2026-10-24T00:00:00.000Z', importer: 'synthetic importer',
  parse_confidence: 'high', parse_notes: ['n1'],
})
const bind = { version_id: 'ver-1', version_sha256: 'b'.repeat(64) }
/** A history version whose encrypted metadata carries a valid meta_sha256 (bound to this version's id + sha256). */
async function hashedHistoryVersion(s, body = 'Clean synthetic answer.', over = {}) {
  const a = await createAnswer(s, { application_id: 'LA-hist', question_occurrence_id: 'LQ-1' })
  const { record, receipt } = await buildVersionPayload(SECRET, { answer_id: a.id, title: 'Synthetic submitted answer', body, method: 'imported' })
  record.history = true
  const meta = { ...baseMeta(), ...over }
  meta.meta_sha256 = await computeHistoryMetaHash(meta, { version_id: record.id, version_sha256: record.sha256 })
  record.history_enc = await encryptField(SECRET, JSON.stringify(meta))
  await s.put('versions', record)
  await s.put('provenance', receipt)
  return { record, meta }
}
const reseal = async (s, record, meta) => s.put('versions', { ...record, history_enc: await encryptField(SECRET, JSON.stringify(meta)) })

await t('G18: meta hash is deterministic, key-order and absence independent, 64-hex', async () => {
  const h1 = await computeHistoryMetaHash(baseMeta(), bind)
  assert.match(h1, HEX64)
  assert.equal(h1, await computeHistoryMetaHash(baseMeta(), bind))
  const m = baseMeta()
  const reordered = Object.fromEntries(Object.entries(m).reverse())
  reordered.flags = [...m.flags].reverse()
  assert.equal(await computeHistoryMetaHash(reordered, bind), h1, 'key order and flag order do not matter')
  const noOpt = baseMeta(); delete noOpt.parse_notes
  const emptyOpt = { ...baseMeta(), parse_notes: [] }
  assert.equal(await computeHistoryMetaHash(noOpt, bind), await computeHistoryMetaHash(emptyOpt, bind), 'absent == empty')
  assert.equal(await computeHistoryMetaHash({ ...baseMeta(), meta_sha256: 'f'.repeat(64) }, bind), h1, 'the hash field itself is not hashed')
  assert.equal(historyMetaHashInput(baseMeta(), bind).domain, 'aqua-history-meta/v1')
  // pinned vector: a change to the canonical form must be deliberate (bump the domain tag)
  assert.equal(h1, 'a982f676dd5a0652fd6f700ac56eba65e6331011f44c52f1e885d9ac38ae8e96')
})

await t('G18: every bound field changes the hash (and checkHistoryMetaHash reports mismatch)', async () => {
  const meta = baseMeta()
  meta.meta_sha256 = await computeHistoryMetaHash(meta, bind)
  assert.equal(await checkHistoryMetaHash(meta, bind), 'verified')
  const changes = {
    format: 'aqua-history/v2', program: 'Other Fund', question: 'Why not?', submitted_at: '2025-03-02', date_source: 'filename',
    flags: ['date_unknown'], source_sha256: 'c'.repeat(64), source_file: 'other.md',
    placeholder: { found: true, markers: ['todo'] }, imported_at: '2026-10-25T00:00:00.000Z', importer: 'someone else',
    parse_confidence: 'low', parse_notes: ['n2'],
  }
  for (const [k, v] of Object.entries(changes)) {
    assert.equal(await checkHistoryMetaHash({ ...meta, [k]: v }, bind), 'mismatch', `changing ${k} must break the hash`)
  }
  for (const k of ['program', 'source_file', 'parse_confidence', 'parse_notes']) {
    const dropped = { ...meta }; delete dropped[k]
    assert.equal(await checkHistoryMetaHash(dropped, bind), 'mismatch', `dropping ${k} must break the hash`)
  }
  assert.equal(await checkHistoryMetaHash(meta, { ...bind, version_id: 'ver-2' }), 'mismatch', 'bound to the version id')
  assert.equal(await checkHistoryMetaHash(meta, { ...bind, version_sha256: 'd'.repeat(64) }), 'mismatch', 'bound to the version content hash')
  assert.equal(await checkHistoryMetaHash({ ...meta, meta_sha256: 'nothex' }, bind), 'mismatch')
  assert.equal(await checkHistoryMetaHash({ ...meta, meta_sha256: '' }, bind), 'mismatch')
})

await t('G18: legacy (no hash / no metadata) is "legacy", never "verified"', async () => {
  assert.equal(await checkHistoryMetaHash(baseMeta(), bind), 'legacy')
  assert.equal(await checkHistoryMetaHash(null, bind), 'legacy')
  assert.equal(await checkHistoryMetaHash(undefined, bind), 'legacy')
})

await t('G18: attestation of hashed metadata succeeds; verifyHistoryMeta reports verified', async () => {
  const s = createMemoryStorage()
  const { record } = await hashedHistoryVersion(s)
  assert.equal((await verifyHistoryMeta(SECRET, record)).status, 'verified')
  const a = await attest(s, record)
  assert.equal(a.via, 'history_attestation')
})

await t('G18: tampered metadata refuses attestation (each bound field), nothing is written', async () => {
  const fields = {
    submitted_at: '2024-01-01', date_source: 'flag', program: 'Forged Fund', question: 'Forged question?', source_sha256: 'e'.repeat(64),
    source_file: 'forged.md', imported_at: '2020-01-01T00:00:00.000Z', importer: 'forger', flags: [], parse_confidence: 'low',
    parse_notes: ['x'], placeholder: { found: true, markers: ['todo'] },
  }
  for (const [k, v] of Object.entries(fields)) {
    const s = createMemoryStorage()
    const { record, meta } = await hashedHistoryVersion(s)
    await reseal(s, record, { ...meta, [k]: v })
    await assert.rejects(() => attest(s, record, { effective_at: '2025-03-01' }), (e) => e instanceof VaultHistoryMetaMismatchError && e.message.includes(HISTORY_META_MISMATCH_REASON), k)
    assert.equal((await listApprovals(s)).length, 0, `${k}: nothing written`)
    assert.equal((await listEvents(s)).length, 0)
  }
})

await t('G18: metadata copied onto another version is refused (bound to version id and sha256); undecryptable metadata with a recorded hash fails closed', async () => {
  const s = createMemoryStorage()
  const a = await hashedHistoryVersion(s, 'First clean answer.')
  const b = await hashedHistoryVersion(s, 'Second clean answer.')
  await s.put('versions', { ...b.record, history_enc: a.record.history_enc })
  await assert.rejects(() => attest(s, b.record), VaultHistoryMetaMismatchError)
  await attest(s, a.record)
  const s2 = createMemoryStorage()
  const { record } = await hashedHistoryVersion(s2)
  await s2.put('versions', { ...record, history_enc: 'not-a-blob' })
  await assert.rejects(() => attest(s2, record), VaultHistoryMetaMismatchError)
})

await t('G18: review model flags verified / legacy / mismatch; mismatch is disabled and shows no forged details', async () => {
  const s = createMemoryStorage()
  const ok = await hashedHistoryVersion(s, 'Verified synthetic answer.')
  const legacy = await historyVersion(s, 'Legacy synthetic answer.')
  const bad = await hashedHistoryVersion(s, 'Tampered synthetic answer.')
  await reseal(s, bad.record, { ...bad.meta, submitted_at: '2001-01-01', question: 'FORGED' })
  const items = (await listHistoryCandidates(s, SECRET)).flatMap((g) => g.items)
  const by = (id) => items.find((i) => i.version_id === id)
  assert.equal(by(ok.record.id).meta_hash_status, 'verified')
  assert.equal(by(ok.record.id).disabled_reason, null)
  assert.equal(by(legacy.id).meta_hash_status, 'legacy')
  assert.equal(by(legacy.id).disabled_reason, null, 'legacy stays confirmable (flagged, not blocked)')
  const t3 = by(bad.record.id)
  assert.equal(t3.meta_hash_status, 'mismatch')
  assert.equal(t3.disabled_reason, HISTORY_META_MISMATCH_REASON)
  assert.equal(t3.submitted_at, null)
  assert.notEqual(t3.question, 'FORGED')
  const res = await confirmHistorySelection(s, SECRET, { items: [by(ok.record.id), by(legacy.id), { version_id: bad.record.id, sha256: bad.record.sha256, submitted_at: '2025-03-01' }], attested: true, statement: 'I submitted these.', actor_id: 'u' })
  assert.deepEqual(res.map((r) => r.ok), [true, true, false])
  assert.equal(res[2].error, HISTORY_META_MISMATCH_REASON)
})

await t('G18: backup round trip keeps the hash valid; restore refuses tampered or unreadable metadata', async () => {
  const s = createMemoryStorage()
  const { record } = await hashedHistoryVersion(s)
  await attest(s, record)
  const text = await exportVault(s, SECRET)
  const s2 = createMemoryStorage()
  await importVault(s2, SECRET, text)
  const rv = await s2.get('versions', record.id)
  assert.equal((await verifyHistoryMeta(SECRET, rv)).status, 'verified')
  await attest(s2, rv)
  // re-seal a backup whose metadata was edited after hashing
  const envelope = JSON.parse(text)
  const payload = JSON.parse(await decryptText(SECRET, envelope))
  const meta = JSON.parse(await decryptField(SECRET, payload.versions[0].history_enc))
  payload.versions[0].history_enc = await encryptField(SECRET, JSON.stringify({ ...meta, submitted_at: '2020-02-02' }))
  const forged = JSON.stringify({ ...envelope, ...(await encryptText(SECRET, JSON.stringify(payload))) })
  await assert.rejects(() => importVault(createMemoryStorage(), SECRET, forged), /history metadata hash mismatch/)
  payload.versions[0].history_enc = 'garbage'
  const garbled = JSON.stringify({ ...envelope, ...(await encryptText(SECRET, JSON.stringify(payload))) })
  await assert.rejects(() => importVault(createMemoryStorage(), SECRET, garbled), /history metadata could not be read/)
  // legacy (unhashed) metadata still restores
  const s3 = createMemoryStorage()
  await historyVersion(s3, 'Legacy synthetic answer for backup.')
  await importVault(createMemoryStorage(), SECRET, await exportVault(s3, SECRET))
})

// ─── M1: placeholder detection cannot be bypassed by Unicode / spacing ──────

const BYPASS_FORMS = {
  'fullwidth brackets': 'We grew 3x \uFF3BCONFIRM\uFF3D last year.',
  'fullwidth letters': 'Revenue \uFF34\uFF2F\uFF24\uFF2F.',
  'zero-width space': 'Revenue is TO\u200BDO.',
  'zero-width joiner + BOM': 'Launch T\u200DB\uFEFFD.',
  'soft hyphen': 'Pending TO\u00ADDO',
  'combining strike-through': 'T\u0336O\u0336D\u0336O\u0336 next',
  'Cyrillic Te': 'Revenue \u0422ODO.',
  'Cyrillic O + Greek Omicron': 'Revenue T\u041ED\u039F.',
  'spaced TO DO': 'Revenue: TO DO',
  'dotted T.B.D.': 'Date: T.B.D.',
  'spaced T B D': 'Date: T B D',
  'lower dotted t.b.d.': 'date t.b.d. soon',
  'spaced X X X': 'Contact X X X',
  '[NAME]': 'Our CEO [NAME] leads sales.',
  '[COMPANY NAME]': 'At [COMPANY NAME] we build tools.',
  'mustache across a newline': 'Hello {{first\nname}}!',
  '[ASSET NEEDED] across a newline': 'See [ASSET\nNEEDED: chart]',
  '[insert …]': 'We have [insert number] customers.',
  '[your …]': 'Founded by [your name].',
  '[Company name]': 'We are [Company name], a startup.',
  '[add …]': 'Our moat: [add detail here]',
  'lorem ipsum': 'Lorem ipsum dolor sit amet.',
  'free-standing ??': 'We have ?? paying users.',
  'currency ??': 'MRR is $?? today.',
  'blank ___': 'Our TAM is ___ billion.',
  'NBSP inside a marker': '[\u00A0CONFIRM metric]',
}

await t('M1: Unicode, confusable, spacing and generic placeholder forms are all detected', () => {
  for (const [name, text] of Object.entries(BYPASS_FORMS)) {
    assert.notDeepEqual(findPlaceholders(text), [], `${name}: ${JSON.stringify(text)}`)
  }
})

await t('M1: ordinary prose stays clean (low false-positive rate)', () => {
  const clean = [
    'I have a lot to do this quarter, and we plan to do it well.',
    'Really?? Yes, we doubled revenue.',
    'Why now? Because costs fell. Why us? Experience.',
    'See the results [1] and the appendix [2].',
    'Read the [link](https://example.org/x) for the full story.',
    'As the founder said, "[...] we grew fast."',
    'The quote reads "teh [sic] product".',
    'Our CEO [Jane] built the first version.',
    'We use snake_case names like user_id in our API.',
    'If x < y and z > w we pivot.',
    'Café résumé naïve façade — all fine.',
    'XX large and X-ray imaging.',
    'We are a toddler-focused todolist? no.',
    'Price: $5 <10% margin',
    'Q&A sessions happen weekly.',
    'Our TBD-free roadmap is public.'.replace('TBD-free', 'fully dated'),
    'Москва and Αθήνα are cities we sell in.',
    'Is it ready? We think so.',
  ]
  for (const text of clean) assert.deepEqual(findPlaceholders(text), [], text)
})

await t('M1: one shared detector module serves the vault, the /history screen and the companion', () => {
  assert.equal(findPlaceholders, Shared.findPlaceholders, 'history.ts re-exports the shared detector')
  assert.equal(describePlaceholders, Shared.describePlaceholders)
  const here = new URL('.', import.meta.url)
  const read = (rel) => fs.readFileSync(new URL(rel, here), 'utf8')
  for (const rel of ['./history.ts', './history-review.ts', './repo.ts']) {
    const src = read(rel)
    assert.ok(!/\{ id: '[a-z_]+', label: '[^']*', re: /.test(src), `${rel} must not carry its own rule table`)
  }
  assert.match(read('./repo.ts'), /from '\.\/placeholders\.ts'/)
  assert.match(read('./history.ts'), /from '\.\/placeholders\.ts'/)
  assert.match(read('./history-review.ts'), /findPlaceholders/)
  assert.equal(Shared.normalizeForPlaceholderScan('\uFF3BTO\u200BDO\uFF3D'), '[TODO]')
})

await t('M1: the vault write refuses the bypass forms too; nothing is written', async () => {
  for (const [name, body] of Object.entries(BYPASS_FORMS)) {
    const s = createMemoryStorage()
    const v = await historyVersion(s, body)
    await assert.rejects(() => attest(s, v), VaultPlaceholderError, name)
    assert.equal((await listApprovals(s)).length, 0, name)
  }
})

// ─── M2: the normal approval path guards history versions and placeholders ──

const human = (v, over = {}) => ({ version_id: v.id, expected_sha256: v.sha256, actor_id: 'u-test', via: 'review_ui', secret: SECRET, ...over })

await t('M2: recordHumanApproval / approveAsHuman refuse an unattested history version; nothing is written', async () => {
  for (const via of ['review_ui', 'decision_file']) {
    const s = createMemoryStorage()
    const v = await historyVersion(s, 'Clean synthetic submitted answer.')
    await assert.rejects(() => recordHumanApproval(s, human(v, { via })), VaultHistoryApprovalError)
    await assert.rejects(() => approveAsHuman(s, { version_id: v.id, expected_sha256: v.sha256, via, secret: SECRET }), VaultHistoryApprovalError)
    assert.equal((await listApprovals(s)).length, 0)
    assert.equal((await listEvents(s)).length, 0)
  }
})

await t('M2: once attested on the history screen, the normal path may record a further approval', async () => {
  const s = createMemoryStorage()
  const v = await historyVersion(s, 'Clean synthetic submitted answer.')
  await attest(s, v)
  const rec = await recordHumanApproval(s, human(v))
  assert.equal(rec.decision, 'approved')
  assert.equal(approvalGate(v, await listApprovals(s)).approved, true)
})

await t('M2: a restored (non-live) attestation does not unlock the normal path', async () => {
  const s = createMemoryStorage()
  const v = await historyVersion(s, 'Clean synthetic submitted answer.')
  const a = await attest(s, v)
  await s.put('approvals', { ...a, restored_from_backup: true })
  await assert.rejects(() => recordHumanApproval(s, human(v)), VaultHistoryApprovalError)
})

await t('M2: the gate ignores a pre-existing normal approval of an unattested history version', async () => {
  const v = { id: 'vh', sha256: 'c'.repeat(64), history: true }
  const row = { id: 'ap1', version_id: 'vh', version_sha256: v.sha256, decision: 'approved', actor_class: 'human', at: '2026-10-22T00:00:00Z', seq: 1, actor_id: 'u', via: 'review_ui' }
  assert.equal(approvalGate(v, [row]).approved, false, 'history version: review_ui approval alone is not enough')
  assert.equal(approvalGate({ id: 'vh', sha256: v.sha256 }, [row]).approved, true, 'non-history version: unchanged')
  const att = { ...row, id: 'ap0', seq: 0, via: 'history_attestation', effective_at: '2025-03-01', attestation_enc: '{"x":1}' }
  assert.equal(approvalGate(v, [att, row]).approved, true)
})

await t('M2: recordHumanApproval refuses bodies with placeholders (including bypass forms); nothing is written', async () => {
  for (const body of ['Our traction: [CONFIRM metric]', 'Revenue \uFF3BCONFIRM\uFF3D', 'Team: TO\u200BDO', 'We have [insert number] users']) {
    const s = createMemoryStorage()
    const v = await historyVersion(s, body, { history: false })
    await assert.rejects(() => recordHumanApproval(s, human(v)), (e) => e instanceof VaultPlaceholderError && /approval refused/.test(e.message), body)
    await assert.rejects(() => approveAsHuman(s, { version_id: v.id, expected_sha256: v.sha256, secret: SECRET }), VaultPlaceholderError)
    assert.equal((await listApprovals(s)).length, 0)
    assert.equal((await listEvents(s)).length, 0)
  }
})

await t('M2: approval without the vault secret fails closed; revocation still works without it', async () => {
  const s = createMemoryStorage()
  const v = await historyVersion(s, 'A clean normal draft.', { history: false })
  await assert.rejects(() => recordHumanApproval(s, human(v, { secret: undefined })), VaultScopeError)
  await assert.rejects(() => recordHumanApproval(s, human(v, { secret: undefined, expected_sha256: 'd'.repeat(64) })), VaultApprovalMismatchError)
  assert.equal((await listApprovals(s)).length, 0)
  await recordHumanApproval(s, human(v))
  const rev = await recordHumanRevocation(s, human(v, { secret: undefined }))
  assert.equal(rev.decision, 'rejected')
})

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`)
