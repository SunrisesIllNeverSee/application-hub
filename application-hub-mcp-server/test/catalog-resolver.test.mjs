// One catalog resolver for aqua-mcp-server and the companion (release review M8):
// the same inputs give the same answer, and the flags and env this server
// takes reach the companion's own catalog resolution.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { resolveCatalogConfig as serverResolve } from '../src/node/config.mjs'
import { resolveCatalogConfig as companionResolve } from '../src/vendor/companion/src/catalog.mjs'
import { createAquaToolRegistry } from '../src/vendor/companion/src/registry.mjs'
import { scratch } from './helpers.mjs'
import { CONFIG } from './fake-postgrest.mjs'

const jwt = (payload) => `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.c2lnbmF0dXJl`
const ANON = jwt({ role: 'anon' })
const GOOD = { ...CONFIG, publishable_key: ANON }

test('both resolve identically for every source and for the same bad inputs', async () => {
  const dir = scratch('resolver')
  const file = path.join(dir, 'cfg.json')
  fs.writeFileSync(file, JSON.stringify(GOOD))
  const bad = path.join(dir, 'bad.json')
  fs.writeFileSync(bad, JSON.stringify({ ...GOOD, supabase_url: 'https://YOUR-PROJECT-REF.supabase.co' }))
  const net = (doc) => async () => new Response(JSON.stringify(doc), { status: 200 })
  const cases = [
    { flags: { 'catalog-config': file }, env: {} },
    { flags: { 'catalog-config': bad }, env: {} },
    { flags: {}, env: { AQUA_SUPABASE_URL: GOOD.supabase_url, AQUA_PUBLISHABLE_KEY: ANON } },
    { flags: {}, env: { AQUA_CATALOG_CONFIG: file } },
    { flags: {}, env: { AQUA_CATALOG_CONFIG_URL: 'https://config.example/c.json' }, fetchImpl: net(GOOD) },
    { flags: {}, env: { AQUA_CATALOG_CONFIG_URL: 'https://config.example/c.json' }, fetchImpl: net({ ...GOOD, supabase_url: 'https://evil.example' }) },
    { flags: {}, env: { AQUA_CATALOG_CONFIG_URL: 'http://config.example/c.json' }, fetchImpl: net(GOOD) },
    { flags: { offline: true }, env: {} },
    { flags: {}, env: { AQUA_CATALOG_OFFLINE: '1' } },
    { flags: {}, env: {}, fetchImpl: net(GOOD) },
    { flags: {}, env: {}, fetchImpl: async () => new Response('nope', { status: 404 }) },
  ]
  for (const c of cases) {
    const ctx = { flags: c.flags, env: c.env, cwd: dir }
    const a = await serverResolve({ ...ctx, fetchImpl: c.fetchImpl })
    const b = await companionResolve(ctx, { fetchImpl: c.fetchImpl })
    assert.equal(a.configured, b.configured, JSON.stringify(c.flags) + JSON.stringify(c.env))
    if (a.configured) assert.deepEqual([a.cfg.origin, a.cfg.key, a.cfg.tables], [b.origin, b.key, b.tables])
    else assert.equal(a.reason, b.reason)
  }
})

test('the companion registry inside this server gets the same --catalog-config / --offline flags', async () => {
  const dir = scratch('resolver-flags')
  const file = path.join(dir, 'cfg.json')
  fs.writeFileSync(file, JSON.stringify(GOOD))
  const reg = await createAquaToolRegistry({ flags: { 'catalog-config': file }, env: {}, cwd: dir, stderr: { write() {} } })
  const cfg = await reg.session.catalogConfig()
  assert.equal(cfg.configured, true)
  assert.equal(cfg.origin, GOOD.supabase_url)
  const off = await createAquaToolRegistry({ flags: { offline: true }, env: {}, cwd: dir, stderr: { write() {} } })
  const offCfg = await off.session.catalogConfig()
  assert.deepEqual([offCfg.configured, offCfg.reason_code], [false, 'offline'])
})

test('LOW: dna, stats and reads of acceptance reports are memoized per program (one upstream GET each)', async () => {
  const { catalog } = await import('./helpers.mjs')
  const c = catalog()
  const before = c.requests.length
  const [a, b] = await Promise.all([c.data.dna('p-1'), c.data.dna('p-1')])
  await c.data.stats('p-1'); await c.data.stats('p-1'); await c.data.reports('p-1'); await c.data.reports('p-1')
  assert.deepEqual(a, b)
  const gets = c.requests.slice(before).map((r) => new URL(r.url, 'http://x').pathname.split('/').pop())
  assert.deepEqual([...gets].sort(), ['acceptance_reports', 'program_dna', 'program_stats'])
})
