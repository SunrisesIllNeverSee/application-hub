// M09b — "Confirm submitted history" read model + action helper (synthetic data only).
// Run: node --test tests/history-confirm.test.mjs   (Node >= 22.6 strips .ts types)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { createMemoryStorage } from '../lib/aqua-local/vault.ts'
import { listApprovals } from '../lib/aqua-local/repo.ts'
import { approvalGate } from '../lib/aqua-local/status.ts'
import { decryptField } from '../lib/aqua-local/crypto.ts'
import { exportVault, importVault } from '../lib/aqua-local/backup.ts'
import {
  listHistoryCandidates, countPendingHistory, countHistoryRecords, canConfirm, confirmHistorySelection,
  DATE_UNKNOWN_REASON, DEFAULT_ATTESTATION_STATEMENT,
} from '../lib/aqua-local/history-review.ts'
import { seedSyntheticHistory } from '../lib/history-ui/synthetic-seed.ts'
import { recordReviewDecision } from '../lib/aqua-local/review-ledger.ts'

const SECRET = 'synthetic-history-ui-secret'

async function seeded() {
  const s = createMemoryStorage()
  const seed = await seedSyntheticHistory(s, SECRET)
  return { s, seed, groups: await listHistoryCandidates(s, SECRET) }
}
const flat = (groups) => groups.flatMap((g) => g.items)

test('groups by application and submission date (newest first, unknown last) with exact question wording', async () => {
  const { groups } = await seeded()
  assert.deepEqual(groups.map((g) => [g.program, g.submitted_at, g.items.length]), [
    ['Synthetic Founders Fellowship', '2025-03-14', 3],
    ['Example Climate Grant', '2024-11-02', 2],
    ['Example Climate Grant', null, 1],
  ])
  const items = flat(groups)
  assert.ok(items.some((i) => i.question === 'What are you building? (150 words)'))
  for (const i of items) {
    assert.equal(i.status, 'pending')
    assert.match(i.sha256, /^[0-9a-f]{64}$/)
    assert.ok(i.excerpt.length <= 281)
  }
})

test('placeholders and unknown dates are disabled with the reason; placeholder scan is recomputed from the body', async () => {
  const { groups } = await seeded()
  const items = flat(groups)
  const ph = items.find((i) => i.question === 'What traction do you have?')
  assert.deepEqual(ph.placeholder_markers, ['confirm'])
  assert.match(ph.disabled_reason, /placeholder/i)
  const unknown = items.find((i) => i.submitted_at === null)
  assert.equal(unknown.disabled_reason, DATE_UNKNOWN_REASON)
  assert.ok(unknown.flags.includes('date_unknown'))
  assert.equal(items.filter((i) => !i.disabled_reason).length, 4)
})

test('nothing is preselected: the confirm gate needs a selection, the attestation tick and a statement', () => {
  assert.equal(canConfirm({ selected: new Set(), attested: true, statement: DEFAULT_ATTESTATION_STATEMENT }), false)
  assert.equal(canConfirm({ selected: new Set(['v']), attested: false, statement: DEFAULT_ATTESTATION_STATEMENT }), false)
  assert.equal(canConfirm({ selected: ['v'], attested: true, statement: '   ' }), false)
  assert.equal(canConfirm({ selected: ['v'], attested: true, statement: DEFAULT_ATTESTATION_STATEMENT }), true)
})

test('the screen\'s confirm action writes history_attestation approvals as of the submission date', async () => {
  const { s, groups } = await seeded()
  const ok = flat(groups).filter((i) => !i.disabled_reason).slice(0, 2)
  assert.equal(await countPendingHistory(s, SECRET), 4)
  const r = await confirmHistorySelection(s, SECRET, { items: ok, attested: true, statement: 'I submitted these (synthetic).', actor_id: 'u-test' })
  assert.deepEqual(r.map((x) => x.ok), [true, true])
  const approvals = await listApprovals(s)
  assert.equal(approvals.length, 2)
  for (const a of approvals) {
    assert.equal(a.via, 'history_attestation')
    assert.equal(a.actor_class, 'human')
    assert.equal(a.effective_at, ok.find((i) => i.version_id === a.version_id).submitted_at)
    assert.equal(await decryptField(SECRET, a.attestation_enc), 'I submitted these (synthetic).')
    const v = await s.get('versions', a.version_id)
    assert.equal(approvalGate(v, approvals).approved, true)
  }
  const after = flat(await listHistoryCandidates(s, SECRET))
  assert.equal(after.filter((i) => i.status === 'confirmed').length, 2)
  assert.equal(await countPendingHistory(s, SECRET), 2)
})

test('confirm refuses without the attestation tick, and surfaces vault refusals per item (placeholder, unknown date)', async () => {
  const { s, groups } = await seeded()
  const items = flat(groups)
  await assert.rejects(() => confirmHistorySelection(s, SECRET, { items: items.slice(0, 1), attested: false, statement: 'x', actor_id: 'u' }))
  // even if the UI were bypassed, the vault write refuses the placeholder item
  const ph = items.find((i) => i.placeholder_markers.length)
  const unknown = items.find((i) => !i.submitted_at)
  const r = await confirmHistorySelection(s, SECRET, {
    items: [{ ...ph }, unknown], attested: true, statement: 'I submitted these (synthetic).', actor_id: 'u',
  })
  assert.equal(r[0].ok, false)
  assert.match(r[0].error, /placeholder/i)
  assert.equal(r[1].ok, false)
  assert.equal(r[1].error, DATE_UNKNOWN_REASON)
  assert.equal((await listApprovals(s)).length, 0)
})

test('after a Restore, confirmations from the file are not live: items show pending again', async () => {
  const { s, groups } = await seeded()
  await confirmHistorySelection(s, SECRET, { items: flat(groups).filter((i) => !i.disabled_reason).slice(0, 1), attested: true, statement: 'Synthetic.', actor_id: 'u' })
  const s2 = createMemoryStorage()
  await importVault(s2, SECRET, await exportVault(s, SECRET))
  assert.equal(await countHistoryRecords(s2), 6)
  const items = flat(await listHistoryCandidates(s2, SECRET))
  assert.equal(items.filter((i) => i.status === 'confirmed').length, 0, 'restored approvals stay unattested')
  assert.equal(await countPendingHistory(s2, SECRET), 4)
})

test('an empty vault lists nothing', async () => {
  const s = createMemoryStorage()
  assert.deepEqual(await listHistoryCandidates(s, SECRET), [])
  assert.equal(await countPendingHistory(s, SECRET), 0)
})

test('the route is protected, flag-gated, and the dev harness 404s in production', async () => {
  const mw = await readFile(new URL('../middleware.ts', import.meta.url), 'utf8')
  assert.match(mw, /PROTECTED_ROUTES = \[[^\]]*'\/history'/)
  const page = await readFile(new URL('../app/(app)/history/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /NEXT_PUBLIC_AQUA_LOCAL_FIRST/)
  assert.match(page, /if \(!LOCAL_FIRST\) notFound\(\)/, 'gated on the shared fail-closed client flag')
  assert.match(page, /notFound\(\)/)
  const harness = await readFile(new URL('../app/dev/history-harness/page.tsx', import.meta.url), 'utf8')
  assert.match(harness, /process\.env\.NODE_ENV === 'production'\) notFound\(\)/)
  const ui = await readFile(new URL('../components/history/HistoryConfirm.tsx', import.meta.url), 'utf8')
  assert.match(ui, /useState<Set<string>>\(\(\) => new Set\(\)\) \/\/ nothing preselected/)
  assert.doesNotMatch(ui, /fetch\(/)
})

test('low parse confidence: surfaced with notes, needs an explicit review, never preselected; older imports stay null', async () => {
  const s = createMemoryStorage()
  await seedSyntheticHistory(s, SECRET, [{
    program: 'Synthetic Split Check Grant',
    submitted_at: '2024-09-10',
    source_file: 'synthetic-split-check.docx',
    qa: [
      { question: 'Who is on your team?', answer: 'Two synthetic founders.\n\nHow will you use the funds?\n\nSynthetic buoys.', parse_confidence: 'low', parse_notes: ['answer_contains_question_line'] },
      { question: 'Why now?', answer: 'Synthetic costs fell.', parse_confidence: 'high' },
      { question: 'Anything else?', answer: 'No (synthetic).' },
    ],
  }])
  const items = flat(await listHistoryCandidates(s, SECRET))
  const low = items.find((i) => i.question === 'Who is on your team?')
  assert.equal(low.parse_confidence, 'low')
  assert.deepEqual(low.parse_notes, ['answer_contains_question_line'])
  assert.equal(low.needs_review, true)
  assert.equal(low.disabled_reason, null, 'reviewable, not refused')
  const high = items.find((i) => i.question === 'Why now?')
  assert.equal(high.parse_confidence, 'high')
  assert.equal(high.needs_review, false)
  const legacy = items.find((i) => i.question === 'Anything else?')
  assert.equal(legacy.parse_confidence, null)
  assert.equal(legacy.needs_review, false)
  const ui = await readFile(new URL('../components/history/HistoryConfirm.tsx', import.meta.url), 'utf8')
  assert.match(ui, /data-testid="history-low-confidence"/)
  assert.match(ui, /data-testid="history-review-check"/)
  assert.match(ui, /it\.needs_review && !reviewed\.has\(it\.version_id\)/, 'a low-confidence item cannot be selected until reviewed')
})

test('LOW: a later human reopening review makes a confirmed record pending again (matches the freeze gate)', async () => {
  const { s, groups } = await seeded()
  const item = flat(groups).find((i) => !i.disabled_reason)
  await confirmHistorySelection(s, SECRET, { items: [item], attested: true, statement: 'I submitted this (synthetic).', actor_id: 'u-test' })
  let now = flat(await listHistoryCandidates(s, SECRET)).find((i) => i.version_id === item.version_id)
  assert.equal(now.status, 'confirmed')
  assert.equal(now.confirmed_effective_at, item.submitted_at)
  await recordReviewDecision(s, SECRET, { version_id: item.version_id, expected_sha256: item.sha256, decision: 'needs_revision', actor_class: 'human', actor_id: 'u-test' })
  now = flat(await listHistoryCandidates(s, SECRET)).find((i) => i.version_id === item.version_id)
  assert.equal(now.status, 'pending', 'reopened by review: no longer shown as already confirmed')
  assert.equal(now.disabled_reason, null, 'and it can be confirmed again')
})
