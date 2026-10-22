// init: consent, refusals, manifest, no overwrite.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { LAYOUT_DIRS } from '../src/workspace.mjs'
import { PASS, readManifest, run, scratch } from './helpers.mjs'

test('init without --yes on a non-terminal refuses and creates nothing; --dry-run creates nothing', async () => {
  const dir = scratch('init-consent')
  let r = await run(['init', '--path', dir])
  assert.equal(r.code, 3)
  assert.match(r.out, /Plan: initialize/)
  assert.match(r.out, /How the AQUA companion stores your data/)
  assert.equal(fs.existsSync(path.join(dir, 'AQUA')), false)
  r = await run(['init', '--path', dir, '--dry-run'])
  assert.equal(r.code, 0)
  assert.match(r.out, /Dry run/)
  assert.equal(fs.existsSync(path.join(dir, 'AQUA')), false)
})

test('init creates the layout and a manifest with schema, kdf, key check, authority and no secrets', async () => {
  const dir = scratch('init-ok')
  fs.writeFileSync(path.join(dir, 'unrelated.txt'), 'keep me')
  const r = await run(['init', '--path', dir, '--yes'])
  assert.equal(r.code, 0, r.err)
  const root = path.join(dir, 'AQUA')
  for (const d of LAYOUT_DIRS) assert.ok(fs.statSync(path.join(root, d)).isDirectory(), d)
  const m = readManifest(root)
  assert.equal(m.format, 'aqua-companion-workspace')
  assert.equal(m.schema_version, 1)
  assert.match(m.workspace_id, /^WS-/)
  assert.equal(m.companion_version, '0.2.0')
  assert.equal(m.kdf.alg, 'PBKDF2-SHA256')
  assert.equal(m.kdf.iters, 210000)
  assert.ok(m.kdf.salt_b64 && m.key_check.ct_b64 && m.manifest_mac)
  assert.equal(m.authority.private_authority, 'aqua-browser-vault')
  assert.equal(m.authority.automatic_sync, false)
  assert.equal(m.authority.last_write_wins, false)
  assert.deepEqual(m.records, {})
  assert.equal(fs.readFileSync(path.join(dir, 'unrelated.txt'), 'utf8'), 'keep me')
  assert.ok(fs.readFileSync(path.join(root, 'README.txt'), 'utf8').includes('browser vault is the private authority'))
  const audit = fs.readFileSync(path.join(root, 'audit/companion.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  assert.equal(audit[0].op, 'init')
  assert.equal(fs.readFileSync(path.join(root, 'workspace.json'), 'utf8').includes(PASS), false)
})

test('init refuses to re-initialize an existing workspace and points to status', async () => {
  const dir = scratch('init-twice')
  assert.equal((await run(['init', '--path', dir, '--yes'])).code, 0)
  const snap = fs.readFileSync(path.join(dir, 'AQUA', 'workspace.json'))
  for (const p of [dir, path.join(dir, 'AQUA')]) {
    const r = await run(['init', '--path', p, '--yes'])
    assert.equal(r.code, 2, p)
    assert.match(r.err, /already exists/)
    assert.match(r.err, /status/)
  }
  assert.deepEqual(fs.readFileSync(path.join(dir, 'AQUA', 'workspace.json')), snap)
})

test('init refuses a non-empty folder that is not an AQUA workspace, and a symlinked target', async () => {
  const dir = scratch('init-nonempty')
  fs.mkdirSync(path.join(dir, 'AQUA'))
  fs.writeFileSync(path.join(dir, 'AQUA', 'notes.md'), 'existing user file')
  let r = await run(['init', '--path', dir, '--yes'])
  assert.equal(r.code, 2)
  assert.match(r.err, /not empty/)
  assert.equal(fs.readFileSync(path.join(dir, 'AQUA', 'notes.md'), 'utf8'), 'existing user file')
  assert.deepEqual(fs.readdirSync(path.join(dir, 'AQUA')), ['notes.md'])
  const dir2 = scratch('init-symlink')
  const elsewhere = scratch('init-elsewhere')
  fs.symlinkSync(elsewhere, path.join(dir2, 'AQUA'))
  r = await run(['init', '--path', dir2, '--yes'])
  assert.equal(r.code, 2)
  assert.match(r.err, /symlink/)
  assert.deepEqual(fs.readdirSync(elsewhere), [])
})

test('init accepts an existing EMPTY AQUA folder and rejects short passphrases', async () => {
  const dir = scratch('init-empty')
  fs.mkdirSync(path.join(dir, 'AQUA'))
  let r = await run(['init', '--path', dir, '--yes'], { env: { AQUA_PASSPHRASE: 'short' } })
  assert.equal(r.code, 2)
  assert.match(r.err, /at least 8/)
  assert.deepEqual(fs.readdirSync(path.join(dir, 'AQUA')), [])
  r = await run(['init', '--path', dir, '--yes'])
  assert.equal(r.code, 0, r.err)
})

test('commands find the workspace from --workspace, AQUA_WORKSPACE, or the current folder', async () => {
  const dir = scratch('init-locate')
  await run(['init', '--path', dir, '--yes'])
  assert.equal((await run(['status'], { cwd: dir })).code, 0)
  assert.equal((await run(['status'], { cwd: path.join(dir, 'AQUA', 'answers') })).code, 0)
  assert.equal((await run(['status'], { env: { AQUA_WORKSPACE: dir } })).code, 0)
  const empty = scratch('init-none')
  const r = await run(['status'], { cwd: empty })
  assert.equal(r.code, 2)
  assert.match(r.err, /No AQUA workspace/)
})
