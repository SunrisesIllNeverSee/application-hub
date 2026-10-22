// Hardening cases from an independent review: stale-manifest saves,
// authenticated companion-export marker, in-file duplicates, conflict
// de-duplication, retract vs. promote, rekey consent and recover safety,
// and linear-time extraction on hostile input.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { Workspace } from '../src/workspace.mjs'
import { extractApplication } from '../src/extract.mjs'
import { ACCOUNT, PASS, VAULT, buildVault, initWorkspace, loadApp, mutateEnvelope, readManifest, run, scratch, writeFile } from './helpers.mjs'

async function populated(label) {
  const v = await buildVault()
  const dir = scratch(label)
  const root = await initWorkspace(dir)
  const r = await run(['import-backup', writeFile(dir, 'b.json', v.envelope), '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.equal(r.code, 0, r.err)
  return { v, dir, root }
}

test('a run holding a stale manifest cannot overwrite another run\'s save', async () => {
  const dir = scratch('stale')
  const root = await initWorkspace(dir)
  const ctx = { env: { AQUA_PASSPHRASE: PASS }, cwd: dir, flags: { workspace: root }, cache: {} }
  const slow = Workspace.open(ctx)
  await slow.unlock(PASS)
  assert.equal((await run(['add-evidence', '--title', 'synthetic', '--workspace', root, '--yes'])).code, 0)
  slow.manifest.records['answer:x'] = { kind: 'answer', path: 'answers/drafts/x.json', status: 'live' }
  await assert.rejects(() => slow.saveManifest(), /changed by another aqua-companion run/)
  assert.equal(Object.values(readManifest(root).records).filter((e) => e.kind === 'evidence').length, 1)
})

test('a companion export is refused on import even with the outer producer field stripped', async () => {
  const { dir, root } = await populated('marker')
  await run(['add-evidence', '--title', 'synthetic', '--workspace', root, '--yes'])
  const out = path.join(dir, 'c.json')
  assert.equal((await run(['export-backup', out, '--workspace', root, '--yes'])).code, 0)
  const env = JSON.parse(fs.readFileSync(out, 'utf8'))
  delete env.producer
  delete env.account_fp
  const r = await run(['import-backup', writeFile(dir, 'stripped.json', JSON.stringify(env)), '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.equal(r.code, 2)
  assert.match(r.err, /Restore it in the browser first/)
  // and the browser still accepts the file (unknown payload field ignored)
  const app = await loadApp()
  const res = await app.importVault(app.createMemoryStorage(), VAULT, fs.readFileSync(out, 'utf8'))
  assert.equal(res.counts.evidence, 1)
})

test('two different records with one id inside a backup are refused, not silently dropped', async () => {
  const v = await buildVault()
  const dir = scratch('dup')
  const root = await initWorkspace(dir)
  const env = await mutateEnvelope(v.envelope, (p) => { p.approvals.push({ ...p.approvals[0], decision: 'rejected' }) })
  const r = await run(['import-backup', writeFile(dir, 'd.json', env), '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.equal(r.code, 4)
  assert.match(r.err, /two different records/)
  assert.deepEqual(readManifest(root).records, {})
})

test('re-importing the same difference does not open a second conflict', async () => {
  const { v, dir, root } = await populated('dedupe')
  const changed = writeFile(dir, 'c.json', await mutateEnvelope(v.envelope, (p) => { p.approvals[0].decision = 'rejected' }))
  for (let i = 0; i < 2; i++) assert.equal((await run(['import-backup', changed, '--workspace', root, '--account', ACCOUNT, '--yes'])).code, 0)
  const open = JSON.parse((await run(['conflicts', '--json', '--workspace', root])).out)
  assert.equal(open.length, 1)
})

test('a retracted staged record stays retracted when the vault copy comes back', async () => {
  const { v, dir, root } = await populated('tomb')
  const app = await loadApp()
  await run(['add-evidence', '--title', 'synthetic', '--workspace', root, '--yes'])
  const out = path.join(dir, 'e.json')
  await run(['export-backup', out, '--workspace', root, '--yes'])
  await app.importVault(v.storage, VAULT, fs.readFileSync(out, 'utf8'))
  const [k] = Object.entries(readManifest(root).records).find(([, e]) => e.kind === 'evidence' && e.authority === 'staging')
  assert.equal((await run(['retract', k, '--workspace', root, '--yes'])).code, 0)
  const back = writeFile(dir, 'back.json', await app.exportVault(v.storage, VAULT))
  assert.equal((await run(['import-backup', back, '--workspace', root, '--account', ACCOUNT, '--yes'])).code, 0)
  const e = readManifest(root).records[k]
  assert.equal(e.status, 'tombstoned')
  assert.ok(e.vault_seen_at)
})

test('rekey asks for consent (also when finishing an interrupted run); recover refuses while a rekey is unfinished', async () => {
  const { root } = await populated('rekey-consent')
  const NEW = 'synthetic-new-passphrase-77'
  let r = await run(['rekey', '--workspace', root], { env: { AQUA_NEW_PASSPHRASE: NEW } })
  assert.equal(r.code, 3)
  assert.equal(readManifest(root).pending_rekey, null)
  // simulate an interruption: pending_rekey written, no file rewritten yet
  const { deriveWorkspaceKeys, encryptWithKeys, newSaltB64, macHex, canonicalJson } = await import('../src/crypto.mjs')
  const m = readManifest(root)
  const oldKeys = await deriveWorkspaceKeys(PASS, m.kdf.salt_b64, m.kdf.iters)
  const salt = newSaltB64()
  const newKeys = await deriveWorkspaceKeys(NEW, salt)
  m.pending_rekey = { kdf: { alg: 'PBKDF2-SHA256', iters: 210000, salt_b64: salt }, key_check: await encryptWithKeys(newKeys, `aqua-companion-key-check:v1:${m.workspace_id}`), started_at: new Date().toISOString() }
  const { manifest_mac: _mm, ...rest } = m
  m.manifest_mac = await macHex(oldKeys, canonicalJson(rest))
  fs.writeFileSync(path.join(root, 'workspace.json'), JSON.stringify(m))
  r = await run(['recover', '--workspace', root, '--yes'])
  assert.equal(r.code, 4)
  assert.match(r.err, /unfinished/)
  assert.equal(fs.readdirSync(path.join(root, 'audit/quarantine')).length, 0)
  r = await run(['rekey', '--workspace', root], { env: { AQUA_NEW_PASSPHRASE: NEW } })
  assert.equal(r.code, 3, 'finishing also needs consent')
  r = await run(['rekey', '--workspace', root, '--yes'], { env: { AQUA_NEW_PASSPHRASE: NEW } })
  assert.equal(r.code, 0, r.err)
  // after a rekey the manifest backup carries the new key; recover from it works with the new passphrase
  fs.unlinkSync(path.join(root, 'workspace.json'))
  r = await run(['recover', '--workspace', root, '--yes'], { env: { AQUA_PASSPHRASE: NEW } })
  assert.equal(r.code, 0, r.err)
  assert.equal((await run(['verify', '--workspace', root], { env: { AQUA_PASSPHRASE: NEW } })).code, 0)
})

test('recover refuses (and quarantines nothing) when files use a different passphrase than the index', async () => {
  const { root } = await populated('recover-key')
  const bak = fs.readFileSync(path.join(root, 'workspace.json'))
  const NEW = 'synthetic-new-passphrase-88'
  assert.equal((await run(['rekey', '--workspace', root, '--yes'], { env: { AQUA_NEW_PASSPHRASE: NEW } })).code, 0)
  // put back an index from BEFORE the passphrase change and recover with the old passphrase
  fs.writeFileSync(path.join(root, 'workspace.json'), bak)
  const r = await run(['recover', '--workspace', root, '--yes'])
  assert.equal(r.code, 4)
  assert.match(r.err, /different passphrase/)
  assert.equal(fs.readdirSync(path.join(root, 'audit/quarantine')).length, 0)
})

test('application extraction stays fast on hostile input', () => {
  const hostile = [
    '<script>'.repeat(200000),
    '<'.repeat(1000000),
    '<li'.repeat(300000),
    '<!--'.repeat(300000),
    `<p>${'?('.repeat(100000)}</p>`,
    `<p>1. Q? ${' *'.repeat(200000)}x</p>`,
  ]
  for (const h of hostile) {
    const t = Date.now()
    try {
      extractApplication('x.html', h)
      extractApplication('x.md', h)
    } catch {
      /* "no questions" is fine */
    }
    assert.ok(Date.now() - t < 3000, `took ${Date.now() - t}ms on ${h.slice(0, 12)}`)
  }
})
