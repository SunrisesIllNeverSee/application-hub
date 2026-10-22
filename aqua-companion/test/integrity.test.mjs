// verify / recover: checksums, decryptability, orphans, missing files,
// quarantine (never delete), manifest rebuild, audit hash chain.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ACCOUNT, buildVault, initWorkspace, readManifest, run, scratch, writeFile } from './helpers.mjs'

async function populated() {
  const v = await buildVault()
  const dir = scratch('integrity')
  const root = await initWorkspace(dir)
  const r = await run(['import-backup', writeFile(dir, 'b.json', v.envelope), '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.equal(r.code, 0, r.err)
  return { v, dir, root }
}

test('verify passes on a clean workspace and needs the passphrase to decrypt', async () => {
  const { root } = await populated()
  assert.equal((await run(['verify', '--workspace', root])).code, 0)
  const wrong = await run(['verify', '--workspace', root], { env: { AQUA_PASSPHRASE: 'not-the-passphrase' } })
  assert.equal(wrong.code, 4)
  assert.match(wrong.err, /Wrong passphrase/)
  const structure = await run(['verify', '--workspace', root, '--structure-only'], { env: { AQUA_PASSPHRASE: '' } })
  assert.equal(structure.code, 0, structure.err)
})

test('verify detects a modified file, a missing file, an orphan, and a broken audit chain', async () => {
  const { v, root } = await populated()
  const m = readManifest(root)
  const vPath = path.join(root, m.records[`version:${v.version.id}`].path)
  const rec = JSON.parse(fs.readFileSync(vPath, 'utf8'))
  const ct = Buffer.from(rec.enc.ct_b64, 'base64')
  ct[3] ^= 0xff
  rec.enc.ct_b64 = ct.toString('base64')
  fs.writeFileSync(vPath, JSON.stringify(rec))
  fs.unlinkSync(path.join(root, m.records[`fact:${Object.keys(m.records).find((k) => k.startsWith('fact:')).slice(5)}`].path))
  fs.writeFileSync(path.join(root, 'evidence', 'stray.json'), '{"not":"a record"}')
  const log = path.join(root, 'audit/companion.jsonl')
  const lines = fs.readFileSync(log, 'utf8').trim().split('\n')
  lines[0] = lines[0].replace('"init"', '"edited"')
  fs.writeFileSync(log, `${lines.join('\n')}\n`)
  const r = await run(['verify', '--workspace', root, '--json'])
  assert.equal(r.code, 4)
  const { problems } = JSON.parse(r.out)
  assert.ok(problems.some((p) => p.includes(`version:${v.version.id}`) && p.includes('checksum mismatch')))
  assert.ok(problems.some((p) => p.includes('record checksum mismatch') || p.includes('cannot be read')))
  assert.ok(problems.some((p) => p.includes('file missing')))
  assert.ok(problems.some((p) => p.includes('orphan file') && p.includes('evidence/stray.json')))
  assert.ok(problems.some((p) => p.includes('hash chain broken')))
})

test('recover quarantines damaged files (never deletes), adopts unindexed records, marks missing ones', async () => {
  const { v, root } = await populated()
  const m = readManifest(root)
  const vRel = m.records[`version:${v.version.id}`].path
  const damaged = Buffer.from('{"aqua_record":1,"garbage":true}')
  fs.writeFileSync(path.join(root, vRel), damaged)
  // drop one entry from the manifest index (file stays) via the backup copy trick: edit + recover tolerates MAC mismatch
  const evKey = Object.keys(m.records).find((k) => k.startsWith('evidence:'))
  delete m.records[evKey]
  fs.writeFileSync(path.join(root, 'workspace.json'), JSON.stringify(m, null, 2))
  let r = await run(['recover', '--workspace', root])
  assert.equal(r.code, 3, 'recover asks for consent')
  r = await run(['recover', '--workspace', root, '--yes'])
  assert.equal(r.code, 0, r.err)
  const q = fs.readdirSync(path.join(root, 'audit/quarantine'))
  assert.equal(q.length, 1)
  const quarantined = path.join(root, 'audit/quarantine', q[0], vRel)
  assert.deepEqual(fs.readFileSync(quarantined), damaged, 'damaged bytes preserved')
  const m2 = readManifest(root)
  assert.equal(m2.records[`version:${v.version.id}`].status, 'missing')
  assert.equal(m2.records[evKey].status, 'live')
  assert.equal(m2.records[evKey].recovered, true)
  const after = await run(['verify', '--workspace', root])
  assert.equal(after.code, 0, after.out)
  // a later re-import brings the version projection back? No: the index keeps the 'missing' entry for provenance,
  // and verify reports it as a note, not a problem.
  assert.match(after.out, /OK/)
})

test('recover rebuilds a deleted manifest from the backup copy or from record files', async () => {
  const { root } = await populated()
  const before = readManifest(root)
  fs.unlinkSync(path.join(root, 'workspace.json'))
  let r = await run(['recover', '--workspace', root, '--yes'])
  assert.equal(r.code, 0, r.err)
  assert.equal(readManifest(root).workspace_id, before.workspace_id)
  assert.equal((await run(['verify', '--workspace', root])).code, 0)
  // now lose both the manifest and its backup
  fs.unlinkSync(path.join(root, 'workspace.json'))
  fs.unlinkSync(path.join(root, 'workspace.json.bak'))
  r = await run(['recover', '--workspace', root, '--yes'])
  assert.equal(r.code, 0, r.err)
  const rebuilt = readManifest(root)
  assert.equal(rebuilt.workspace_id, before.workspace_id)
  assert.equal(Object.keys(rebuilt.records).length, Object.keys(before.records).length)
  assert.equal((await run(['verify', '--workspace', root])).code, 0)
  // wrong passphrase cannot rebuild
  fs.rmSync(path.join(root, 'workspace.json'), { force: true })
  fs.rmSync(path.join(root, 'workspace.json.bak'), { force: true })
  r = await run(['recover', '--workspace', root, '--yes'], { env: { AQUA_PASSPHRASE: 'wrong-passphrase-x' } })
  assert.notEqual(r.code, 0)
})

test('a projection lost to damage is re-materialized by the next vault import', async () => {
  const { v, dir, root } = await populated()
  const vRel = readManifest(root).records[`version:${v.version.id}`].path
  fs.writeFileSync(path.join(root, vRel), 'garbage')
  assert.equal((await run(['recover', '--workspace', root, '--yes'])).code, 0)
  const r = await run(['import-backup', path.join(dir, 'b.json'), '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /1 new/)
  const m = readManifest(root)
  assert.equal(m.records[`version:${v.version.id}`].status, 'live')
  assert.ok(Object.keys(m.records).some((k) => k.startsWith(`version:${v.version.id}#missing-`)))
  assert.equal((await run(['verify', '--workspace', root])).code, 0)
})
