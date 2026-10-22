// M09 W9 — AT15 "User imports on another device → no false claim of
// automatic private-data synchronization": static half (copy + code).
// The browser half (a second device context for the same account) is in
// tests/acceptance/acceptance.browser.mjs.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(here, '..', '..')
const REPO = path.resolve(APP, '..')

// Wording that would claim private data follows the user to other devices.
const SYNC_CLAIM = /\b(auto(matic(ally)?)?[ -]?sync(ed|s|ing)?|sync(ed|s|ing)? (across|to) (all |your |other )*devices|synced to (the )?cloud|available on all (of )?your devices|backed up automatically|cloud backup|keeps? your (answers|vault|data) in sync)\b/i

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, exts, out)
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p)
  }
  return out
}

test('AT15: no user-facing copy claims automatic sync of private data', () => {
  const files = [
    ...walk(path.join(APP, 'components'), ['.tsx', '.ts']),
    ...walk(path.join(APP, 'app'), ['.tsx', '.ts', '.md', '.mdx']),
    ...walk(path.join(APP, 'public'), ['.md', '.txt']),
    ...walk(path.join(APP, 'content'), ['.md', '.mdx']),
    path.join(REPO, 'aqua-companion', 'README.md'),
    ...walk(path.join(REPO, 'aqua-companion', 'docs'), ['.md']),
  ]
  assert.ok(files.length > 50, `scanned ${files.length} files`)
  const hits = []
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n')
    lines.forEach((l, i) => {
      const m = l.match(SYNC_CLAIM)
      // a NEGATED statement ("no automatic sync") is the honest claim, not a false one
      if (m && !/\b(no|not|never|without|isn't|is not|does not|doesn't)\b[^.]{0,40}$/i.test(l.slice(0, m.index))) hits.push(`${path.relative(REPO, f)}:${i + 1}: ${l.trim().slice(0, 120)}`)
    })
  }
  assert.deepEqual(hits, [])
})

test('AT15: the sync contract says import/export only, no automatic or hosted sync', () => {
  const sync = fs.readFileSync(path.join(REPO, 'aqua-companion', 'docs', 'SYNC.md'), 'utf8')
  assert.match(sync, /no automatic or hosted sync/i)
  assert.match(sync, /not bidirectional synchronization/i)
  assert.match(sync, /No automatic sync, background watcher, hosted relay or cloud storage/)
  const readme = fs.readFileSync(path.join(REPO, 'aqua-companion', 'README.md'), 'utf8')
  assert.match(readme, /never syncs/i)
})

test('AT15: the browser vault client has no network path of its own (no fetch in lib/aqua-local-client)', () => {
  const files = walk(path.join(APP, 'lib', 'aqua-local-client'), ['.ts', '.tsx']).filter((f) => !path.basename(f).startsWith('run-'))
  const withFetch = files.filter((f) => /\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|new WebSocket/.test(fs.readFileSync(f, 'utf8')))
  assert.deepEqual(withFetch.map((f) => path.relative(APP, f)), [])
})

test('AT15: device-scoped copy is present where the vault is opened and restored', () => {
  const unlock = fs.readFileSync(path.join(APP, 'components', 'aqua-local', 'UnlockPanel.tsx'), 'utf8')
  assert.match(unlock, /never leaves this device/)
  const restore = fs.readFileSync(path.join(APP, 'components', 'aqua-local', 'RestoreBackupPanel.tsx'), 'utf8')
  assert.match(restore, /never leave this device/)
  const banner = fs.readFileSync(path.join(APP, 'components', 'aqua-local', 'VaultStatusBanner.tsx'), 'utf8')
  assert.match(banner, /your answers exist only on this device/)
})
