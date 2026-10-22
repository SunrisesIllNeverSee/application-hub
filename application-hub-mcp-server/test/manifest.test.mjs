// TOOLS.json is generated from the registry and must be current; its counts
// must match what each mode actually lists; the hosted vendored copies must
// match src/catalog; and no privileged-key name appears in shipped code.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, MANIFEST_PATH } from '../scripts/gen-tools.mjs'
import { drift } from '../scripts/vendor-hosted.mjs'
import { INIT, req, runServer, scratch } from './helpers.mjs'
import { main as companionMain } from 'aqua-companion/src/cli.mjs'
import { catalogBackend } from '../src/catalog/backend.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PASS = 'synthetic-workspace-pass-7Q4x'
const sink = () => ({ write: () => true })

test('TOOLS.json is up to date (run npm run manifest)', () => {
  assert.equal(fs.readFileSync(MANIFEST_PATH, 'utf8'), render())
})

test('TOOLS.json counts match what each mode lists', async () => {
  const m = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  const catalogMode = await runServer([], [INIT(1), req(2, 'tools/list')])
  const dir = scratch('manifest')
  await companionMain(['init', '--path', dir, '--yes'], { env: { AQUA_PASSPHRASE: PASS }, cwd: dir, stdin: { isTTY: false }, stdout: sink(), stderr: sink() })
  const wsMode = await runServer(['--workspace', path.join(dir, 'AQUA')], [INIT(1), req(2, 'tools/list')], { env: { AQUA_PASSPHRASE: PASS } })
  const hosted = catalogBackend({ data: null }).listTools('2025-11-25')
  const listed = { 'stdio-catalog': catalogMode.responses.get(2).result.tools, 'stdio-workspace': wsMode.responses.get(2).result.tools, hosted }
  for (const [mode, tools] of Object.entries(listed)) {
    assert.equal(m.counts[mode], tools.length, mode)
    assert.deepEqual(m.tools.filter((t) => t.modes.includes(mode)).map((t) => t.name).sort(), tools.map((t) => t.name).sort(), mode)
  }
  for (const t of m.tools) assert.ok(t.description.length > 10 && !t.description.startsWith('[tier'), t.name)
  assert.ok(m.removed_in_2.some((r) => r.name === 'hub_save_answer'))
  assert.ok(m.intentionally_absent.some((r) => r.name === 'configure_security'))
})

test('hosted vendored copies match src/catalog (run npm run vendor:hosted)', () => {
  assert.deepEqual(drift(), [])
})

test('the shared catalog core uses web APIs only (it runs inside the Next.js route)', () => {
  const dir = path.join(ROOT, 'src', 'catalog')
  for (const f of fs.readdirSync(dir)) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8')
    assert.ok(!/from ['"]node:|require\(|process\.|Buffer\./.test(t), `${f} must not use Node-only APIs`)
    assert.ok(!/from ['"](?!\.\/)/.test(t), `${f} must import only sibling modules`)
  }
})

test('no SERVICE_ROLE string anywhere in shipped code (src/, bin/, scripts/, dist/)', () => {
  const hits = []
  const visit = (d) => {
    if (!fs.existsSync(d)) return
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) visit(p)
      else if (fs.readFileSync(p, 'utf8').includes('SERVICE_ROLE')) hits.push(path.relative(ROOT, p))
    }
  }
  for (const d of ['src', 'bin', 'scripts', 'dist']) visit(path.join(ROOT, d))
  assert.deepEqual(hits, [])
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  assert.deepEqual(Object.keys(pkg.dependencies), [], 'no Supabase client or HTTP framework dependency')
})
