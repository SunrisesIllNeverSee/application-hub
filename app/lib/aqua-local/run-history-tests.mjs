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
import { decryptField, encryptField } from './crypto.ts'
import { findPlaceholders, normalizeEffectiveAt, isCalendarDate, HISTORY_FORMAT, describePlaceholders } from './history.ts'
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
