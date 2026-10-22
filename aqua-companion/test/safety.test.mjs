// Path safety: traversal, absolute paths, symlink escapes, unsafe ids.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mkdirInside, normalizeRel, resolveInside, writeNewInside, PathSafetyError } from '../src/fsafe.mjs'
import { fileNameFor } from '../src/workspace.mjs'
import { ACCOUNT, initWorkspace, mutateEnvelope, buildVault, readManifest, run, scratch, writeFile } from './helpers.mjs'

test('relative-path rules: .., absolute, NUL and empty are refused', () => {
  for (const bad of ['../x', 'a/../../x', '/etc/passwd', 'C:\\x', 'a\0b', '', '..', 'a/..']) {
    assert.throws(() => normalizeRel(bad), PathSafetyError, JSON.stringify(bad))
  }
  assert.equal(normalizeRel('a//b/./c'), 'a/b/c')
})

test('resolveInside refuses symlinked components; writeNewInside never overwrites', () => {
  const root = scratch('fsafe')
  const outside = scratch('fsafe-outside')
  fs.symlinkSync(outside, path.join(root, 'evil'))
  assert.throws(() => resolveInside(root, 'evil/x.json'), /symlink/)
  assert.throws(() => writeNewInside(root, 'evil/x.json', 'data'), /symlink/)
  assert.throws(() => mkdirInside(root, 'evil/sub'), /symlink/)
  assert.deepEqual(fs.readdirSync(outside), [])
  writeNewInside(root, 'ok/a.json', 'one')
  assert.throws(() => writeNewInside(root, 'ok/a.json', 'two'), /EEXIST/)
  assert.equal(fs.readFileSync(path.join(root, 'ok/a.json'), 'utf8'), 'one')
  // a file symlink planted where a record would go is not followed
  fs.symlinkSync(path.join(outside, 'target.json'), path.join(root, 'ok', 'b.json'))
  assert.throws(() => writeNewInside(root, 'ok/b.json', 'x'), /symlink|EEXIST/)
  assert.equal(fs.existsSync(path.join(outside, 'target.json')), false)
})

test('a symlinked workspace folder pointing outside is refused by commands; nothing is written outside', async () => {
  const dir = scratch('symlink-escape')
  const root = await initWorkspace(dir)
  const outside = scratch('symlink-outside')
  fs.rmSync(path.join(root, 'evidence'), { recursive: true })
  fs.symlinkSync(outside, path.join(root, 'evidence'))
  const r = await run(['add-evidence', '--title', 'synthetic', '--workspace', root, '--yes'])
  assert.notEqual(r.code, 0)
  assert.match(r.err, /symlink/)
  assert.deepEqual(fs.readdirSync(outside), [])
  const v = await run(['verify', '--workspace', root])
  assert.equal(v.code, 4)
  assert.match(v.out, /symlink inside the workspace/)
})

test('a manifest entry with a traversal path is reported by verify and never read', async () => {
  const dir = scratch('manifest-traversal')
  const root = await initWorkspace(dir)
  await run(['add-evidence', '--title', 'synthetic', '--workspace', root, '--yes'])
  const secretOutside = writeFile(dir, 'outside-secret.json', '{"x":1}')
  const m = readManifest(root)
  const [k] = Object.keys(m.records)
  m.records[k].path = `../${path.basename(secretOutside)}`
  fs.writeFileSync(path.join(root, 'workspace.json'), JSON.stringify(m))
  const v = await run(['verify', '--workspace', root])
  assert.equal(v.code, 4)
  assert.match(v.out, /unsafe path in manifest/)
  assert.match(v.out, /integrity MAC mismatch/)
  // other commands refuse to run on a manifest edited outside the companion
  const s = await run(['show', k, '--reveal', '--workspace', root])
  assert.equal(s.code, 4)
})

test('vault record ids that are not filename-safe get safe file names (identity stays inside the file)', async () => {
  for (const id of ['../../etc/passwd', 'a/b', '.hidden', 'x'.repeat(300), 'intake:abc/def']) {
    const name = fileNameFor('catalog', id)
    assert.ok(/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(name), name)
    assert.equal(name.includes('/'), false)
  }
  const v = await buildVault()
  const dir = scratch('weird-ids')
  const root = await initWorkspace(dir)
  const env = await mutateEnvelope(v.envelope, (p) => {
    p.catalog_cache.push({ key: 'program:../../../escape', blob: { name: 'x' }, fetched_at: new Date().toISOString() })
    p.evidence[0].evidence_id = '../../../../evidence-escape'
  })
  const r = await run(['import-backup', writeFile(dir, 'w.json', env), '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.equal(r.code, 0, r.err)
  for (const e of Object.values(readManifest(root).records)) {
    assert.doesNotThrow(() => resolveInside(fs.realpathSync(root), e.path))
    assert.equal(e.path.includes('..'), false)
  }
  assert.equal(fs.existsSync(path.join(dir, 'evidence-escape')), false)
  assert.equal((await run(['verify', '--workspace', root])).code, 0)
})

test('only src/net.mjs reaches the network (public catalog GETs); src, bin and vendored modules have no other network code', () => {
  const base = path.join(path.dirname(new URL(import.meta.url).pathname), '..')
  const files = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(mjs|js)$/.test(e.name)) files.push(p)
    }
  }
  for (const d of ['src', 'bin', 'vendor']) walk(path.join(base, d))
  assert.ok(files.length > 20)
  const NET = path.join(base, 'src', 'net.mjs')
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    for (const bad of [/\bfetch\s*\(/, /node:(http|https|net|dgram|tls|dns|http2)\b/, /from ['"](http|https|net|dgram|tls|dns|http2)['"]/, /WebSocket/, /XMLHttpRequest/, /EventSource/]) {
      assert.equal(bad.test(text), false, `${path.relative(base, f)} matches ${bad}`)
    }
    if (f !== NET) assert.equal(/globalThis\.fetch|fetchImpl\(/.test(text), false, `${path.relative(base, f)} must not call fetch`)
  }
  // the one network call: GET, no redirects followed, no credentials, origin pinned
  const net = fs.readFileSync(NET, 'utf8')
  assert.equal((net.match(/fetchImpl\(/g) ?? []).length, 1)
  assert.match(net, /method: 'GET'/)
  assert.match(net, /redirect: 'error'/)
  assert.match(net, /credentials: 'omit'/)
  assert.match(net, /url\.origin !== origin/)
})
