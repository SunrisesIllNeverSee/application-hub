// M09b — import-history (CLI + MCP import_history) and the two approval
// round trips through the REAL app vault modules:
//   history: import_history -> export-backup -> app importVault -> browser
//            confirm (recordHistoryAttestation) -> app exportVault ->
//            sync_from_vault_export -> read_review_status approved
//   drafts:  create_draft_version -> export-backup -> app importVault ->
//            approveAsHuman -> app exportVault -> sync_from_vault_export ->
//            read_review_status approved, hash preserved
// All content is synthetic.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { MARK, VAULT, allBytes, initWorkspace, loadApp, readManifest, run, scratch, writeFile } from './helpers.mjs'
import { inbox, startServer, syntheticDocx, trustedPart } from './mcp-helpers.mjs'
import { buildVault } from './helpers.mjs'

const UID = '00000000-0000-4000-8000-00000000c0de'
/** A workspace seeded from a browser backup that carries the account fingerprint (M09 hardening), as real exports do. */
async function boundWorkspace(label) {
  const v = await buildVault()
  const dir = scratch(label)
  const root = await initWorkspace(dir)
  const env = await v.app.exportVault(v.storage, VAULT, { account_uid: UID })
  const r = await run(['import-backup', writeFile(dir, 'vault-backup.json', env), '--workspace', root, '--yes'])
  if (r.code !== 0) throw new Error(`import failed: ${r.err}`)
  fs.mkdirSync(path.join(root, 'inbox'), { recursive: true })
  return { v, dir, root }
}
import { dateFromFilename, parseDateValue, parseHistoryFile } from '../src/history-parse.mjs'

const APPLIB = new URL('../../app/lib/aqua-local/', import.meta.url)
const enc = (s) => new TextEncoder().encode(s)

const FILES = {
  'accelerator.md': `---\nprogram: Synthetic Accelerator\nsubmitted: 2025-03-01\n---\n# Synthetic Accelerator application\n\n## What are you building? (150 words)\n\nWe build synthetic scheduling widgets. ${MARK}\n\n## Why now?\n\nRegulation changed in [CONFIRM year].\n`,
  'grant.txt': 'Synthetic Grant\nSubmitted: March 5, 2024\n\nQ: Describe your mission.\nA: To make synthetic data useful.\n\nQ: What is your budget?\nA: Forty synthetic dollars.\n',
  'fellowship.json': JSON.stringify({ program: 'Synthetic Fellowship', submitted_at: '2023-11-20', answers: [{ question: 'Why you?', answer: 'Because synthetic.' }, { question: 'Anything else?', answer: '' }] }),
  'fund-answers.csv': 'question,answer\n"What is your traction?","100 synthetic users"\n"Team size?",3\n',
  'page.html': '<html><head><title>Synthetic HTML App</title><meta name="submitted" content="2024-06-01"></head><body><h2>What problem do you solve?</h2><p>Synthetic scheduling pain.</p></body></html>',
  'notes.pdf': '%PDF-1.4 synthetic',
}

function historyFolder(root, sub = 'history') {
  for (const [name, content] of Object.entries(FILES)) inbox(root, `${sub}/${name}`, content)
  inbox(root, `${sub}/older/2022-09-14-word.docx`, syntheticDocx(['What is your company called?', 'Synthetic Widgets Ltd.']))
}

test('date rules: frontmatter > metadata > filename > --date; unknown is flagged, never guessed', async () => {
  assert.deepEqual(parseDateValue('2025-03-01'), { date: '2025-03-01' })
  assert.deepEqual(parseDateValue('March 5, 2024'), { date: '2024-03-05' })
  assert.deepEqual(parseDateValue('5 March 2024'), { date: '2024-03-05' })
  assert.deepEqual(parseDateValue('03/04/2025'), { ambiguous: true })
  assert.deepEqual(parseDateValue('2199-01-01'), { future: true })
  assert.equal(parseDateValue('2025-02-30'), null)
  assert.deepEqual(dateFromFilename('app_2024_01_31.md'), { date: '2024-01-31' })
  const none = await parseHistoryFile({ name: 'x.md', bytes: enc('1. Why now?\n\nBecause.\n') })
  assert.equal(none.submitted_at, null)
  assert.deepEqual(none.flags.filter((f) => f.startsWith('date')), ['date_unknown'])
  const flag = await parseHistoryFile({ name: 'x.md', bytes: enc('1. Why now?\n\nBecause.\n'), date: '2024-02-02' })
  assert.equal(flag.submitted_at, '2024-02-02')
  assert.equal(flag.date_source, 'flag')
  const conflict = await parseHistoryFile({ name: '2025-03-02-x.md', bytes: enc('---\nsubmitted: 2025-03-01\n---\n1. Why now?\n\nBecause.\n') })
  assert.equal(conflict.submitted_at, '2025-03-01')
  assert.ok(conflict.flags.includes('date_conflict'))
  const amb = await parseHistoryFile({ name: 'x.txt', bytes: enc('Submitted: 03/04/2025\n\nQ: Why?\nA: Because.\n') })
  assert.equal(amb.submitted_at, null)
  assert.ok(amb.flags.includes('date_ambiguous') && amb.flags.includes('date_unknown'))
})

test('import-history CLI: every supported format, exact wording, flags, placeholders; encrypted at rest; re-import skipped', async () => {
  const dir = scratch('m09b-hist-cli')
  const root = await initWorkspace(dir)
  const src = path.join(dir, 'submitted')
  fs.mkdirSync(src, { recursive: true })
  for (const [name, content] of Object.entries(FILES)) writeFile(src, name, content)
  fs.mkdirSync(path.join(src, 'older'), { recursive: true })
  fs.writeFileSync(path.join(src, 'older', '2022-09-14-word.docx'), syntheticDocx(['What is your company called?', 'Synthetic Widgets Ltd.']))
  const dry = await run(['import-history', src, '--workspace', root, '--dry-run'])
  assert.equal(dry.code, 0, dry.err)
  assert.match(dry.out, /accelerator\.md: Synthetic Accelerator \| submitted 2025-03-01 \(from frontmatter\)/)
  assert.match(dry.out, /grant\.txt: Synthetic Grant \| submitted 2024-03-05 \(from metadata\)/)
  assert.match(dry.out, /fund-answers\.csv: .* submitted UNKNOWN/)
  assert.match(dry.out, /older\/2022-09-14-word\.docx: .*submitted 2022-09-14 \(from filename\)/)
  assert.match(dry.out, /! Why now\?/, 'placeholder answers are marked')
  assert.doesNotMatch(dry.out, /notes\.pdf/)
  assert.equal(Object.keys(readManifest(root).records).length, 0, 'dry run writes nothing')
  const r = await run(['import-history', src, '--workspace', root, '--yes'])
  assert.equal(r.code, 0, r.err)
  const recs = Object.values(readManifest(root).records)
  assert.equal(recs.filter((e) => e.kind === 'app_instance').length, 6)
  assert.equal(recs.filter((e) => e.kind === 'version' && e.history).length, 9)
  assert.ok(!allBytes(root).includes(Buffer.from(MARK)), 'answers are encrypted at rest')
  const again = await run(['import-history', src, '--workspace', root, '--yes'])
  assert.match(again.out, /skipped \(already_imported\)/)
  assert.equal(Object.values(readManifest(root).records).filter((e) => e.kind === 'app_instance').length, 6)
  assert.equal((await run(['verify', '--workspace', root])).code, 0)
})

test('MCP import_history: inbox folders only; structured counts outside untrusted_content; nothing approved', async () => {
  const dir = scratch('m09b-hist-mcp')
  const root = await initWorkspace(dir)
  historyFolder(root)
  const c = startServer(root)
  try {
    await c.initialize()
    for (const folder of ['../outside', '/etc', 'exports']) {
      const bad = await c.call('import_history', { folder })
      assert.equal(bad.status, 'refused', folder)
    }
    const r = await c.call('import_history', { folder: 'history', date: '2021-01-01' })
    assert.equal(r.status, 'ok', JSON.stringify(r))
    assert.equal(r.approved, false)
    assert.equal(r.counts.applications, 6)
    assert.equal(r.counts.answers, 9)
    assert.equal(r.counts.with_placeholders, 1)
    const csv = r.files.find((f) => f.file.endsWith('fund-answers.csv'))
    assert.equal(csv.submitted_at, '2021-01-01', 'the date argument fills an unknown date')
    assert.equal(csv.date_source, 'flag')
    const trusted = JSON.stringify(trustedPart(r))
    for (const fileText of ['Synthetic Accelerator', 'Why now?', MARK]) assert.ok(!trusted.includes(fileText), `${fileText} stays in untrusted_content`)
    assert.ok(JSON.stringify(r.untrusted_content.data).includes('Synthetic Accelerator'))
    assert.ok(r.next_steps.some((s) => s.includes('/history')))
  } finally {
    await c.close()
  }
})

test('history round trip: export-backup -> browser confirm (vault refuses placeholders) -> export -> sync_from_vault_export -> approved', async () => {
  const app = await loadApp()
  const hr = await import(new URL('history-review.ts', APPLIB).href)
  const { v, dir, root } = await boundWorkspace('m09b-hist-loop')
  historyFolder(root)
  const c = startServer(root)
  try {
    await c.initialize()
    const imp = await c.call('import_history', { folder: 'history' })
    assert.equal(imp.status, 'ok')
    const out = path.join(dir, 'for-browser.json')
    const ex = await run(['export-backup', out, '--workspace', root, '--yes'])
    assert.equal(ex.code, 0, ex.err)
    // --- the browser (real app vault modules, same storage the workspace was seeded from) ---
    await app.importVault(v.storage, VAULT, fs.readFileSync(out, 'utf8'))
    const groups = await hr.listHistoryCandidates(v.storage, VAULT)
    const items = groups.flatMap((g) => g.items)
    assert.equal(items.length, 9)
    const accel = groups.find((g) => g.program === 'Synthetic Accelerator')
    assert.equal(accel.submitted_at, '2025-03-01')
    const clean = accel.items.find((i) => i.question.includes('What are you building'))
    const dirty = accel.items.find((i) => i.question.includes('Why now'))
    assert.equal(clean.disabled_reason, null)
    assert.match(dirty.disabled_reason, /placeholder/)
    assert.equal(items.find((i) => i.question.includes('traction')).disabled_reason, hr.DATE_UNKNOWN_REASON)
    // the vault write itself refuses the placeholder item, whatever the UI does
    await assert.rejects(() => app.recordHistoryAttestation(v.storage, VAULT, { version_id: dirty.version_id, expected_sha256: dirty.sha256, effective_at: '2025-03-01', statement: 'I submitted this.', actor_id: 'u-test' }), /placeholder/)
    const res = await hr.confirmHistorySelection(v.storage, VAULT, { items: [clean], attested: true, statement: 'I submitted this answer on 2025-03-01.', actor_id: 'u-test' })
    assert.deepEqual(res.map((x) => x.ok), [true])
    const browserExport = await app.exportVault(v.storage, VAULT, { account_uid: UID })
    inbox(root, 'browser-export.json', browserExport)
    // --- back in the agent's workspace ---
    const sync = await c.call('sync_from_vault_export', { file: 'browser-export.json' })
    assert.equal(sync.status, 'ok', JSON.stringify(sync))
    assert.ok(sync.counts.promoted >= 9, 'staged history records are confirmed in the vault')
    const st = await c.call('read_review_status', { application_id: imp.files.find((f) => f.file.endsWith('accelerator.md')).instance_id })
    const q = st.questions.find((x) => x.approved_version_id === clean.version_id)
    assert.ok(q, 'the confirmed history answer is approved in the workspace view')
    assert.equal(q.status, 'approved')
    assert.equal(st.questions.filter((x) => x.status === 'approved').length, 1, 'the placeholder answer stays unapproved')
  } finally {
    await c.close()
  }
})

test('draft round trip: companion draft -> export-backup -> importVault -> approveAsHuman -> exportVault -> sync_from_vault_export -> approved, hash preserved', async () => {
  const app = await loadApp()
  const review = await import(new URL('../aqua-local-client/review.ts', APPLIB).href)
  const { v, dir, root } = await boundWorkspace('m09b-draft-loop')
  const c = startServer(root)
  try {
    await c.initialize()
    const before = await c.call('read_review_status', { application_id: v.inst.instance_id })
    assert.notEqual(before.questions.find((q) => q.question_occurrence_id === v.q2).status, 'approved')
    const d = await c.call('create_draft_version', { application_id: v.inst.instance_id, question_occurrence_id: v.q2, body: 'Now, because synthetic demand doubled.', title: 'Why now' })
    assert.equal(d.status, 'ok')
    const out = path.join(dir, 'drafts.json')
    assert.equal((await run(['export-backup', out, '--workspace', root, '--yes'])).code, 0)
    await app.importVault(v.storage, VAULT, fs.readFileSync(out, 'utf8'))
    const restored = await v.storage.get('versions', d.version_id)
    assert.equal(restored.sha256, d.sha256, 'the browser holds the exact drafted version')
    await review.approveAsHuman(v.storage, { version_id: d.version_id, expected_sha256: d.sha256, actor_id: 'u-test', secret: VAULT })
    inbox(root, 'after-approval.json', await app.exportVault(v.storage, VAULT, { account_uid: UID }))
    // another account's export is refused (no silent cross-account merge)
    inbox(root, 'other-account.json', await app.exportVault(v.storage, VAULT, { account_uid: '00000000-0000-4000-8000-0000000000ff' }))
    const other = await c.call('sync_from_vault_export', { file: 'other-account.json' })
    assert.equal(other.reason, 'account_mismatch')
    const sync = await c.call('sync_from_vault_export', { file: 'after-approval.json' })
    assert.equal(sync.status, 'ok', JSON.stringify(sync))
    const st = await c.call('read_review_status', { application_id: v.inst.instance_id })
    const q2 = st.questions.find((q) => q.question_occurrence_id === v.q2)
    assert.equal(q2.status, 'approved')
    assert.equal(q2.approved_version_id, d.version_id)
    assert.equal(st.approvals_as_of, sync.approvals_as_of)
    const pr = await c.call('prepare_packet', { application_id: v.inst.instance_id })
    const pq = pr.questions.find((q) => q.question_occurrence_id === v.q2)
    assert.equal(pq.selectable_version_id, d.version_id)
    assert.equal(pq.approval_bound_to_hash, true, 'the approval is bound to the drafted sha256')
    // the same file again: nothing new, still approved
    const again = await c.call('sync_from_vault_export', { file: 'after-approval.json' })
    assert.equal(again.status, 'ok')
    // a companion-produced file is refused (it must go through the browser first)
    fs.copyFileSync(out, path.join(root, 'inbox', 'companion-file.json'))
    const refused = await c.call('sync_from_vault_export', { file: 'companion-file.json' })
    assert.equal(refused.status, 'refused')
    assert.match(refused.message, /export-backup/)
  } finally {
    await c.close()
  }
})
