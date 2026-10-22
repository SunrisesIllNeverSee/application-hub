// M09b — catalog configuration from https://aquaidp.xyz/.well-known/aqua-catalog.json
// (allowlisted origin, local file override, anon/publishable keys only,
// service_role refused outright) and `doctor` (never crashes). No real
// network: fetch is injected.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { initWorkspace, run, scratch, writeFile } from './helpers.mjs'
import { assertPublicKey, describeKey, resolveCatalogConfig } from '../src/catalog.mjs'
import { CONFIG_ORIGIN, CONFIG_PATH, getCatalogConfigJson } from '../src/net.mjs'
import { doctorReport } from '../src/setup.mjs'
import { createAquaToolRegistry } from '../src/registry.mjs'
import { CATALOG_FIXTURE } from './mcp-helpers.mjs'

const jwt = (payload) => `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.c2lnbmF0dXJl`
const ANON = jwt({ iss: 'supabase', ref: 'syntheticref000000000', role: 'anon' })
const SERVICE = jwt({ iss: 'supabase', ref: 'syntheticref000000000', role: 'service_role' })
const DOC = { version: 1, supabase_url: 'https://syntheticref000000000.supabase.co', publishable_key: ANON, tables: { programs: 'programs', program_cycles: 'program_cycles', program_questions: 'program_questions', archived_questions: 'archived_questions' }, notes: ['synthetic'] }

function fakeFetch(routes) {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url, init })
    const u = new URL(url)
    const body = routes(u, init)
    if (body === undefined) return new Response('not found', { status: 404 })
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return { impl, calls }
}

test('keys are decoded: anon JWT and sb_publishable_ accepted; service_role, secret, other roles and opaque keys refused', () => {
  assert.equal(assertPublicKey(ANON).role, 'anon')
  assert.equal(assertPublicKey('sb_publishable_SYNTHETIC').kind, 'publishable')
  assert.throws(() => assertPublicKey(SERVICE), /service_role/)
  assert.throws(() => assertPublicKey('sb_secret_SYNTHETIC'), /SECRET/)
  assert.throws(() => assertPublicKey(jwt({ role: 'authenticated' })), /authenticated/)
  assert.throws(() => assertPublicKey(jwt({ sub: 'x' })), /role "none"/)
  assert.throws(() => assertPublicKey('just-some-opaque-string'), /cannot be checked/)
  assert.equal(describeKey(ANON).ref, 'syntheticref000000000')
})

test('the default config comes from https://aquaidp.xyz/.well-known/aqua-catalog.json only; GET, no redirects, no credentials', async () => {
  const f = fakeFetch((u) => (u.origin === CONFIG_ORIGIN && u.pathname === CONFIG_PATH ? DOC : undefined))
  const cfg = await resolveCatalogConfig({ flags: {}, env: {}, cwd: '/' }, { fetchImpl: f.impl })
  assert.equal(cfg.configured, true)
  assert.equal(cfg.source, 'well-known')
  assert.equal(cfg.origin, DOC.supabase_url)
  assert.equal(cfg.key_role, 'anon')
  assert.deepEqual(cfg.tables, DOC.tables)
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].url, 'https://aquaidp.xyz/.well-known/aqua-catalog.json')
  assert.equal(f.calls[0].init.method, 'GET')
  assert.equal(f.calls[0].init.redirect, 'error')
  assert.equal(f.calls[0].init.credentials, 'omit')
  assert.deepEqual(Object.keys(f.calls[0].init.headers), ['accept'], 'nothing but Accept is sent')
  await assert.rejects(() => getCatalogConfigJson({ fetchImpl: async () => { throw new Error('down') } }), /aquaidp\.xyz could not be reached/)
})

test('a well-known document carrying a service_role key is a hard refusal; nothing is fetched from the catalog', async () => {
  const f = fakeFetch((u) => (u.pathname === CONFIG_PATH ? { ...DOC, publishable_key: SERVICE } : CATALOG_FIXTURE.programs))
  await assert.rejects(() => resolveCatalogConfig({ flags: {}, env: {}, cwd: '/' }, { fetchImpl: f.impl }), (e) => e.name === 'CatalogKeyRefusal' && e.role === 'service_role')
  const dir = scratch('m09b-cfg-svc')
  const sink = { write() { return true } }
  const reg = await createAquaToolRegistry({ workspace: await initWorkspace(dir), env: { AQUA_PASSPHRASE: 'synthetic-workspace-pass-7Q4x', AQUA_VAULT_SECRET: 'synthetic-vault-secret-9Z2k' }, cwd: dir, fetchImpl: f.impl, stderr: sink })
  const rf = await reg.dispatch('refresh_catalog', {})
  assert.equal(rf.result.status, 'unavailable')
  assert.match(rf.result.reason, /service_role/)
  assert.ok(f.calls.every((c) => new URL(c.url).pathname === CONFIG_PATH), 'no catalog request with a refused key')
  const doc = await reg.dispatch('doctor', {})
  const cc = doc.result.checks.find((c) => c.name === 'catalog_config')
  assert.equal(cc.status, 'fail')
  assert.equal(cc.refused, true)
})

test('a local file override wins and never touches the network; placeholders stay offline', async () => {
  const dir = scratch('m09b-cfg-file')
  const cfgFile = writeFile(dir, 'cfg.json', JSON.stringify({ supabase_url: 'https://syntheticref000000000.supabase.co', publishable_key: 'sb_publishable_SYNTHETIC' }))
  const boom = async () => { throw new Error('network must not be used') }
  const cfg = await resolveCatalogConfig({ flags: { 'catalog-config': cfgFile }, env: {}, cwd: dir }, { fetchImpl: boom })
  assert.equal(cfg.configured, true)
  assert.equal(cfg.source, 'file')
  const off = await resolveCatalogConfig({ flags: {}, env: { AQUA_CATALOG_OFFLINE: '1' }, cwd: dir }, { fetchImpl: boom })
  assert.equal(off.configured, false)
  const down = await resolveCatalogConfig({ flags: {}, env: {}, cwd: dir }, { fetchImpl: boom })
  assert.equal(down.configured, false)
  assert.match(down.reason, /could not be loaded from https:\/\/aquaidp\.xyz\/\.well-known\/aqua-catalog\.json/)
})

test('doctor: config, connectivity, canonical-only read (counts), workspace, keychain; never throws', async () => {
  const dir = scratch('m09b-doctor')
  const root = await initWorkspace(dir)
  const f = fakeFetch((u) => {
    if (u.pathname === CONFIG_PATH) return DOC
    if (u.pathname === '/rest/v1/programs') {
      assert.equal(u.searchParams.get('source'), 'eq.canonical', 'canonical-only read')
      return CATALOG_FIXTURE.programs.filter((p) => p.source === 'canonical').slice(0, 1)
    }
    return undefined
  })
  const s = { env: {}, cwd: dir, flags: {}, workspace: root, fetchImpl: f.impl, exec: () => { throw new Error('no item') }, platform: 'darwin', state: () => ({ mode: 'ready', root, workspace_id: 'WS-synthetic' }) }
  const r = await doctorReport(s)
  const by = Object.fromEntries(r.checks.map((c) => [c.name, c]))
  assert.equal(by.catalog_config.status, 'ok')
  assert.equal(by.catalog_config.key_role, 'anon')
  assert.equal(by.connectivity.status, 'ok')
  assert.equal(by.canonical_read.status, 'ok')
  assert.equal(by.canonical_read.programs, 1)
  assert.equal(by.workspace.status, 'ok')
  assert.ok(['ok', 'warn'].includes(by.keychain.status))
  // everything broken at once: still a report
  const broken = await doctorReport({ env: {}, cwd: path.join(dir, 'missing'), flags: {}, workspace: path.join(dir, 'missing'), fetchImpl: async () => { throw new Error('offline') }, state: () => ({ mode: 'not_initialized' }) })
  assert.equal(broken.status, 'ok')
  assert.notEqual(broken.overall, 'ok')
  // CLI: --json --offline, exit 0 on warnings
  const cli = await run(['doctor', '--json', '--offline', '--workspace', root])
  assert.equal(cli.code, 0, cli.err)
  const j = JSON.parse(cli.out)
  assert.ok(j.checks.some((c) => c.name === 'workspace' && c.status === 'ok'))
  // CLI without a passphrase: reports the workspace as locked instead of crashing
  const locked = await run(['doctor', '--offline', '--workspace', root], { env: { AQUA_PASSPHRASE: '' } })
  assert.match(locked.out, /workspace/)
  assert.ok(fs.existsSync(root))
})
