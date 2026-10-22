// Bridge tests: real app backup.ts envelopes in, companion envelopes back into
// the app's importVault (in-memory IndexedDB stand-in used by the vault tests).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  ACCOUNT, MARK, PASS, VAULT, allBytes, buildVault, initWorkspace, loadApp, mutateEnvelope, readManifest, run, scratch, writeFile,
} from './helpers.mjs'

async function importedWorkspace() {
  const v = await buildVault()
  const dir = scratch('bridge')
  const root = await initWorkspace(dir)
  const envPath = writeFile(dir, 'vault-backup.json', v.envelope)
  const r = await run(['import-backup', envPath, '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.equal(r.code, 0, r.err)
  return { v, dir, root, envPath }
}

test('import-backup: app envelope becomes encrypted projections in the documented folders', async () => {
  const { v, root } = await importedWorkspace()
  const m = readManifest(root)
  const byKind = (k) => Object.entries(m.records).filter(([, e]) => e.kind === k)
  assert.equal(byKind('version').length, 1)
  assert.equal(byKind('approval').length, 1)
  assert.equal(byKind('signoff').length, 1)
  const [vr, ve] = byKind('version')[0]
  assert.equal(vr, `version:${v.version.id}`)
  assert.equal(ve.authority, 'projection')
  assert.equal(ve.source_vault_id, `versions:${v.version.id}`)
  assert.ok(ve.path.startsWith('answers/history/'))
  assert.ok(byKind('approval')[0][1].path.startsWith('answers/approved/'))
  assert.ok(byKind('app_instance')[0][1].path.startsWith('applications/active/'))
  assert.ok(byKind('signoff')[0][1].path.startsWith('packets/'))
  assert.ok(byKind('fact')[0][1].path.startsWith('facts/'))
  assert.ok(byKind('evidence')[0][1].path.startsWith('evidence/'))
  // public catalog: plaintext JSON under catalog-cache/programs|questions; unknown shapes stay encrypted
  const cats = byKind('catalog').map(([, e]) => e)
  assert.deepEqual(cats.map((e) => e.path.split('/')[1]).sort(), ['programs', 'questions'])
  for (const e of cats) {
    const f = JSON.parse(fs.readFileSync(path.join(root, e.path), 'utf8'))
    assert.equal(f.scope, 'public')
    assert.ok(f.data && !f.enc)
  }
  const unc = byKind('catalog_private')[0][1]
  assert.ok(unc.path.startsWith('catalog-cache/unclassified/'))
  assert.ok(JSON.parse(fs.readFileSync(path.join(root, unc.path), 'utf8')).enc)
  // record file: identity inside the file, metadata outside the ciphertext only where non-private
  const file = JSON.parse(fs.readFileSync(path.join(root, ve.path), 'utf8'))
  assert.deepEqual(Object.keys(file).sort(), ['aqua_record', 'authority', 'created_at', 'enc', 'id', 'kind', 'scope', 'sha256', 'source_vault_id', 'workspace_id'])
  assert.equal(file.id, vr)
  // no private plaintext anywhere in the workspace
  assert.equal(allBytes(root).includes(MARK), false)
  const verify = await run(['verify', '--workspace', root])
  assert.equal(verify.code, 0, verify.out)
})

test('import-backup: re-import is a no-op; show --reveal decrypts with an exposure notice', async () => {
  const { v, root, envPath } = await importedWorkspace()
  const before = readManifest(root).records
  const r = await run(['import-backup', envPath, '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.equal(r.code, 0)
  assert.match(r.out, /0 new, 19 unchanged/)
  assert.deepEqual(Object.keys(readManifest(root).records).sort(), Object.keys(before).sort())
  const plain = await run(['show', v.version.id, '--workspace', root])
  assert.equal(plain.out.includes(MARK), false)
  const shown = await run(['show', v.version.id, '--workspace', root, '--reveal'])
  assert.equal(shown.code, 0)
  assert.ok(shown.out.includes(MARK))
  assert.match(shown.err, /EXPOSURE NOTICE/)
  const ev = await run(['show', v.evidence.evidence_id, '--workspace', root, '--reveal'])
  assert.ok(ev.out.includes(`Synthetic note ${MARK}`), 'vault *_enc fields decrypt on reveal')
})

test('import-backup: wrong vault secret, tampered file and newer format are refused before any write', async () => {
  const v = await buildVault()
  const dir = scratch('bridge-refuse')
  const root = await initWorkspace(dir)
  const snap = fs.readFileSync(path.join(root, 'workspace.json'))
  const envPath = writeFile(dir, 'b.json', v.envelope)
  let r = await run(['import-backup', envPath, '--workspace', root, '--account', ACCOUNT, '--yes'], { env: { AQUA_VAULT_SECRET: 'wrong-secret-value' } })
  assert.notEqual(r.code, 0)
  assert.match(r.err, /wrong vault secret/)
  const tampered = await mutateEnvelope(v.envelope, (p) => { p.versions[0].body_plaintext += ' edited' })
  r = await run(['import-backup', writeFile(dir, 't.json', tampered), '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.notEqual(r.code, 0)
  assert.match(r.err, /sha256 mismatch/)
  const newer = await mutateEnvelope(v.envelope, (p) => { p.format_version = 3 })
  r = await run(['import-backup', writeFile(dir, 'n.json', newer), '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.match(r.err, /newer than supported/)
  assert.deepEqual(fs.readFileSync(path.join(root, 'workspace.json')), snap)
})

test('account binding: first import binds; another account is refused unless --allow-account-mismatch', async () => {
  const { root, envPath } = await importedWorkspace()
  const m = readManifest(root)
  assert.equal(m.account_binding.bound, true)
  assert.equal(JSON.stringify(m).includes(ACCOUNT), false, 'account id is not stored in plaintext')
  let r = await run(['import-backup', envPath, '--workspace', root, '--account', 'someone-else@example.invalid', '--yes'])
  assert.equal(r.code, 5)
  assert.match(r.err, /different AQUA account/)
  r = await run(['import-backup', envPath, '--workspace', root, '--yes'])
  assert.equal(r.code, 5)
  r = await run(['import-backup', envPath, '--workspace', root, '--account', 'someone-else@example.invalid', '--allow-account-mismatch', '--yes'])
  assert.equal(r.code, 0)
  assert.ok(readManifest(root).imports.length === 2)
  // an unbound workspace refuses a first import without --account
  const dir2 = scratch('bridge-unbound')
  const root2 = await initWorkspace(dir2)
  r = await run(['import-backup', envPath, '--workspace', root2, '--yes'])
  assert.equal(r.code, 5)
  assert.match(r.err, /First import/)
})

test('conflicts: same id with different content is recorded, never overwritten; approvals are never rewritten silently', async () => {
  const { v, dir, root } = await importedWorkspace()
  const apprRid = `approval:${v.approval.id}`
  const approvalPath = readManifest(root).records[apprRid].path
  const apprBytes = fs.readFileSync(path.join(root, approvalPath))
  // a forged/divergent approval row with the same id, and a changed evidence verification
  await v.app.setEvidenceVerification(v.storage, v.evidence.evidence_id, { verification: 'user_confirmed' })
  const changed = await mutateEnvelope(await v.app.exportVault(v.storage, VAULT), (p) => {
    p.approvals[0].decision = 'rejected'
  })
  const r = await run(['import-backup', writeFile(dir, 'changed.json', changed), '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /2 conflict\(s\)/)
  // workspace copy untouched
  assert.deepEqual(fs.readFileSync(path.join(root, approvalPath)), apprBytes)
  const log = fs.readFileSync(path.join(root, 'audit/conflicts.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  assert.equal(log.length, 2)
  assert.ok(log.every((l) => l.op === 'conflict_detected'))
  assert.equal(fs.readdirSync(path.join(root, 'reviews/conflicts')).filter((f) => f.endsWith('.json')).length, 2)
  const list = await run(['conflicts', '--workspace', root, '--json'])
  const open = JSON.parse(list.out)
  assert.equal(open.length, 2)
  const apprConflict = open.find((c) => c.record_id === apprRid)
  const evConflict = open.find((c) => c.record_id === `evidence:${v.evidence.evidence_id}`)

  // resolve without a decision is refused
  let res = await run(['resolve', apprConflict.conflict_id, '--workspace', root, '--yes'])
  assert.equal(res.code, 2)
  // keep workspace for the approval: nothing changes, and the same vault row does not re-raise
  res = await run(['resolve', apprConflict.conflict_id, '--keep', 'workspace', '--workspace', root, '--yes'])
  assert.equal(res.code, 0, res.err)
  assert.deepEqual(fs.readFileSync(path.join(root, approvalPath)), apprBytes)
  // keep vault for the evidence: vault copy installed, workspace copy archived (not deleted)
  const evPath = readManifest(root).records[`evidence:${v.evidence.evidence_id}`].path
  const evBytes = fs.readFileSync(path.join(root, evPath))
  res = await run(['resolve', evConflict.conflict_id, '--keep', 'vault', '--workspace', root, '--yes'])
  assert.equal(res.code, 0, res.err)
  const m = readManifest(root)
  const archived = Object.entries(m.records).find(([k]) => k.startsWith(`evidence:${v.evidence.evidence_id}#archived-`))
  assert.ok(archived)
  assert.deepEqual(fs.readFileSync(path.join(root, archived[1].path)), evBytes)
  const shown = await run(['show', v.evidence.evidence_id, '--workspace', root, '--reveal'])
  assert.match(shown.out, /user_confirmed/)
  const log2 = fs.readFileSync(path.join(root, 'audit/conflicts.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  assert.deepEqual(log2.filter((l) => l.op === 'conflict_resolved').map((l) => l.keep).sort(), ['vault', 'workspace'])
  // re-importing the same changed file raises nothing new
  const again = await run(['import-backup', path.join(dir, 'changed.json'), '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.match(again.out, /0 conflict\(s\)/)
  assert.equal((await run(['verify', '--workspace', root])).code, 0)
})

test('export-backup: staged work restores through the app importVault (fresh and non-empty vault), never with approvals', async () => {
  const { v, dir, root } = await importedWorkspace()
  const app = await loadApp()
  // stage a local application, a draft for it, a child draft of the APPROVED vault version, evidence and a comment
  const form = writeFile(dir, 'form.md', '# Synthetic Grant\n\nOrganization: Example Foundation\n\n1. Describe your project in detail. (200 words)\n2. What is your budget? (500 characters) (required)\n')
  let r = await run(['import-application', form, '--workspace', root, '--yes'])
  assert.equal(r.code, 0, r.err)
  const la = Object.entries(readManifest(root).records).find(([, e]) => e.kind === 'app_instance' && e.authority === 'staging')
  assert.ok(la[0].startsWith('app_instance:LA-'))
  assert.ok(la[1].path.startsWith('applications/queued/'))
  const shownApp = JSON.parse((await run(['show', la[0], '--workspace', root, '--reveal', '--json'])).out).data
  const lq = shownApp.local_template.questions[0].question_occurrence_id
  assert.equal(shownApp.local_template.questions[0].text, 'Describe your project in detail. (200 words)')
  assert.equal(shownApp.local_template.questions[0].word_limit, 200)
  assert.equal(shownApp.local_template.questions[1].char_limit, 500)
  assert.equal(shownApp.local_template.questions[1].required, true)
  const body1 = writeFile(dir, 'b1.txt', `Local draft body ${MARK}\nsecond line`)
  r = await run(['draft', '--application', shownApp.instance_id, '--question', lq, '--body-file', body1, '--title', 'Project', '--workspace', root, '--yes'])
  assert.equal(r.code, 0, r.err)
  const body2 = writeFile(dir, 'b2.txt', 'Revised synthetic widget answer.')
  r = await run(['draft', '--parent', v.version.id, '--body-file', body2, '--title', 'Synthetic answer', '--workspace', root, '--yes'])
  assert.equal(r.code, 0, r.err)
  r = await run(['add-evidence', '--title', 'Synthetic budget sheet', '--kind', 'note', '--link', `version:${v.version.id}`, '--workspace', root, '--yes'])
  assert.equal(r.code, 0, r.err)
  r = await run(['comment', '--version', v.version.id, '--body-file', writeFile(dir, 'c.txt', 'Synthetic local comment'), '--workspace', root, '--yes'])
  assert.equal(r.code, 0, r.err)
  assert.equal(allBytes(root).includes(MARK), false, 'staged drafts are encrypted at rest')

  // export (without --yes it is refused and nothing is written)
  const outPath = path.join(dir, 'for-browser.json')
  r = await run(['export-backup', outPath, '--workspace', root])
  assert.equal(r.code, 3)
  assert.equal(fs.existsSync(outPath), false)
  r = await run(['export-backup', outPath, '--workspace', root, '--yes'])
  assert.equal(r.code, 0, r.err)
  const envelope = fs.readFileSync(outPath, 'utf8')
  const env = JSON.parse(envelope)
  assert.equal(env.format, 'aqua-local-backup')
  assert.equal(env.producer, 'aqua-companion')
  const payload = JSON.parse(await app.decryptText(VAULT, env))
  assert.equal(payload.format_version, 2)
  for (const k of ['approvals', 'signoffs', 'reviews', 'suggestions', 'events', 'packets']) assert.deepEqual(payload[k], [], `${k} never exported`)
  assert.equal(payload.versions.length, 2)
  assert.equal(payload.app_instances.length, 1)

  // 1) fresh vault restore
  const fresh = app.createMemoryStorage()
  const preview = await app.previewVaultImport(fresh, VAULT, envelope)
  assert.ok(preview.total_insert >= 5)
  const res = await app.importVault(fresh, VAULT, envelope)
  assert.equal(res.counts.versions, 2)
  const inst = await app.readAppInstance(fresh, VAULT, shownApp.instance_id)
  assert.equal(inst.template.questions[0].text, 'Describe your project in detail. (200 words)')
  assert.equal(inst.source_ref, 'form.md')
  const versions = await fresh.getAll('versions')
  const local = versions.find((x) => x.parent_version_id === null)
  assert.equal((await app.readVersion(fresh, VAULT, local.id)).body, `Local draft body ${MARK}\nsecond line`)
  assert.equal((await fresh.getAll('approvals')).length, 0)

  // 2) the original (non-empty) vault: the child draft arrives unapproved; the parent's approval is untouched
  const res2 = await app.importVault(v.storage, VAULT, envelope)
  assert.equal(res2.counts.versions, 2)
  const child = (await v.storage.getAll('versions')).find((x) => x.parent_version_id === v.version.id)
  assert.ok(child)
  const approvals = await v.storage.getAll('approvals')
  assert.equal(approvals.length, 1)
  assert.equal(approvals[0].version_id, v.version.id)
  const gate = app.approvalGate(child, approvals.filter((a) => a.version_id === child.id), [])
  assert.equal(Boolean(gate.approval), false, 'no approval carries over to the child')
  const comments = await app.listComments(v.storage, VAULT, { version_id: v.version.id })
  assert.ok(comments.some((c) => c.body === 'Synthetic local comment'))
  // M09 hardening M3: a CLI-staged comment arrives as the companion's, never as the user's own.
  const stagedComment = comments.find((c) => c.body === 'Synthetic local comment')
  assert.equal(stagedComment.actor_class, 'agent')
  assert.equal(stagedComment.actor_id, 'aqua-companion')
  assert.equal(stagedComment.via, 'companion')

  // 3) round trip: export from the vault again and import into the workspace -> staged records confirmed, no conflicts
  const back = writeFile(dir, 'vault-after.json', await app.exportVault(v.storage, VAULT))
  r = await run(['import-backup', back, '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /0 conflict\(s\)/)
  const m = readManifest(root)
  const staged = Object.values(m.records).filter((e) => e.authority === 'staging' && ['answer', 'version', 'app_instance', 'evidence', 'comment'].includes(e.kind))
  assert.ok(staged.length >= 6)
  assert.ok(staged.every((e) => e.status === 'in_vault'), JSON.stringify(staged.map((e) => [e.kind, e.status])))
  // nothing left to export
  r = await run(['export-backup', path.join(dir, 'again.json'), '--workspace', root, '--yes'])
  assert.match(r.out, /Nothing to export/)
})

test('import-backup refuses a companion-produced file (it must go through the browser first)', async () => {
  const { dir, root } = await importedWorkspace()
  await run(['add-evidence', '--title', 'n', '--workspace', root, '--yes'])
  const out = path.join(dir, 'c.json')
  assert.equal((await run(['export-backup', out, '--workspace', root, '--yes'])).code, 0)
  const r = await run(['import-backup', out, '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.equal(r.code, 2)
  assert.match(r.err, /Restore it in the browser first/)
})

test('restored decisions stay unattested in the vault (approval from a vault backup is restored_from_backup)', async () => {
  // The companion never re-emits approvals, so the only approvals a browser sees from
  // a restore are its own backup's, which backup.ts marks restored_from_backup.
  const v = await buildVault()
  const app = await loadApp()
  const other = app.createMemoryStorage()
  await app.importVault(other, VAULT, v.envelope)
  const [a] = await other.getAll('approvals')
  assert.equal(a.restored_from_backup, true)
  void PASS
})
