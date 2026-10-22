// The agent interface is self-contained: it runs on vendored copies of the
// pure app modules (in sync with app/lib), imports nothing from the
// repository at runtime, and works from a copy of aqua-companion/ alone.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { run as vendorRun, parseHeader } from '../scripts/vendor.mjs'
import { PASS, VAULT, initWorkspace, scratch } from './helpers.mjs'
import { FORM_MD, inbox } from './mcp-helpers.mjs'

const COMPANION = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function filesUnder(dir) {
  const out = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else out.push(p)
    }
  }
  walk(dir)
  return out
}

test('vendor/ is in sync with app/lib (the CI check: re-running the vendor script changes nothing)', () => {
  const { drift, files } = vendorRun({ check: true })
  assert.deepEqual(drift, [], `vendor drift: ${drift.join('; ')} (run node aqua-companion/scripts/vendor.mjs)`)
  assert.ok(files.length >= 15)
  const manifest = JSON.parse(fs.readFileSync(path.join(COMPANION, 'vendor', 'VENDOR.json'), 'utf8'))
  assert.deepEqual(manifest.files, files)
  for (const f of filesUnder(path.join(COMPANION, 'vendor', 'lib'))) {
    const h = parseHeader(fs.readFileSync(f, 'utf8'))
    assert.ok(h, `${f} has a vendor header`)
    assert.ok(fs.existsSync(path.join(COMPANION, '..', 'app', 'lib', h.source)), h.source)
  }
})

test('no runtime import reaches outside aqua-companion/', () => {
  for (const f of [...filesUnder(path.join(COMPANION, 'src')), ...filesUnder(path.join(COMPANION, 'bin')), ...filesUnder(path.join(COMPANION, 'vendor'))].filter((x) => x.endsWith('.mjs'))) {
    const text = fs.readFileSync(f, 'utf8')
    for (const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const spec = m[1]
      if (spec.startsWith('node:')) continue
      assert.ok(spec.startsWith('.'), `${path.relative(COMPANION, f)} imports package ${spec}`)
      const target = path.resolve(path.dirname(f), spec)
      assert.ok(target.startsWith(COMPANION + path.sep), `${path.relative(COMPANION, f)} imports ${spec} outside aqua-companion/`)
      assert.ok(fs.existsSync(target), `${path.relative(COMPANION, f)} imports missing ${spec}`)
    }
  }
})

test('a copy of aqua-companion/ alone (no repository, no type stripping) serves the agent interface', async () => {
  const copy = path.join(scratch('mcp-standalone'), 'aqua-companion')
  for (const d of ['bin', 'src', 'vendor', 'config']) fs.cpSync(path.join(COMPANION, d), path.join(copy, d), { recursive: true })
  fs.copyFileSync(path.join(COMPANION, 'package.json'), path.join(copy, 'package.json'))
  const root = await initWorkspace(scratch('mcp-standalone-ws'))
  inbox(root, 'form.md', FORM_MD)
  const lines = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'import_local_application', arguments: { file: 'form.md' } } },
  ].map((m) => JSON.stringify(m)).join('\n')
  const out = execFileSync(process.execPath, ['--no-experimental-strip-types', path.join(copy, 'bin', 'aqua-companion.mjs'), 'mcp', '--workspace', root], {
    input: `${lines}\n`, env: { PATH: process.env.PATH, AQUA_PASSPHRASE: PASS, AQUA_VAULT_SECRET: VAULT }, encoding: 'utf8', cwd: copy,
  })
  const msgs = out.trim().split('\n').map((l) => JSON.parse(l))
  assert.equal(msgs.length, 3)
  assert.ok(msgs[1].result.tools.length >= 21)
  const imp = msgs[2].result.structuredContent
  assert.equal(imp.status, 'ok', JSON.stringify(imp))
  assert.equal(imp.counts.questions, 3)
})
