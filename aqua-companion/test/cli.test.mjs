// The real executable, run as a child process (no TTY: consent needs --yes).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { PASS, scratch } from './helpers.mjs'

const BIN = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'bin', 'aqua-companion.mjs')

function sh(args, env = {}) {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
    input: '',
  })
  return { code: r.status, out: r.stdout, err: r.stderr }
}

test('bin: --help, --version, unknown command', () => {
  const h = sh(['--help'])
  assert.equal(h.code, 0)
  assert.match(h.out, /import-backup <file>/)
  assert.match(h.out, /never written to disk or logs/)
  assert.equal(sh(['--version']).out.trim(), '0.2.3')
  assert.equal(sh(['frobnicate']).code, 2)
})

test('bin: init -> status -> verify as a real process; consent and passphrase rules hold', () => {
  const dir = scratch('cli')
  let r = sh(['init', '--path', dir], { AQUA_PASSPHRASE: PASS })
  assert.equal(r.code, 3)
  assert.equal(fs.existsSync(path.join(dir, 'AQUA')), false)
  r = sh(['init', '--path', dir, '--yes'])
  assert.equal(r.code, 2, 'no passphrase and no terminal -> refused')
  assert.match(r.err, /AQUA_PASSPHRASE/)
  r = sh(['init', '--path', dir, '--yes'], { AQUA_PASSPHRASE: PASS })
  assert.equal(r.code, 0, r.err)
  r = sh(['status', '--json', '--workspace', dir])
  assert.equal(r.code, 0)
  assert.equal(JSON.parse(r.out).account_bound, false)
  r = sh(['verify', '--workspace', dir], { AQUA_PASSPHRASE: PASS })
  assert.equal(r.code, 0, r.err)
})
