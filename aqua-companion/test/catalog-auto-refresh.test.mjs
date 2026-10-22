// The catalog read tools (discover_applications, get_application_details,
// match_canonical_questions) refresh an empty or stale public catalog cache
// automatically: public read-only GETs with the anon/publishable key only,
// the same config rules as refresh_catalog. Offline or unconfigured, they
// say catalog_empty: run refresh_catalog. All data is synthetic.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { initWorkspace, readManifest, scratch, writeFile } from './helpers.mjs'
import { CATALOG_FIXTURE, startServer } from './mcp-helpers.mjs'
import { catalogMaxAgeHours, catalogNeedsRefresh } from '../src/catalog.mjs'

const KEY = 'sb_publishable_SYNTHETIC_auto_refresh_0001'
const TABLES = { programs: 'programs', program_cycles: 'cycles', program_questions: 'questions', archived_questions: 'canonical_questions' }

function fakeCatalog() {
  const requests = []
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, headers: req.headers })
    const u = new URL(req.url, 'http://x')
    const table = u.pathname.replace(/^\/rest\/v1\//, '')
    if (req.method !== 'GET' || !(table in TABLES)) return res.writeHead(404).end('[]')
    const rows = Number(u.searchParams.get('offset') ?? 0) > 0 ? [] : CATALOG_FIXTURE[TABLES[table]]
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(rows))
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, requests, origin: `http://127.0.0.1:${server.address().port}` })))
}
const snapshots = (root) => Object.entries(readManifest(root).records).filter(([r, e]) => r.startsWith('catalog:public-catalog-snapshot') && e.status !== 'archived').length

test('max-age setting and staleness rule', () => {
  assert.equal(catalogMaxAgeHours({}), 24)
  assert.equal(catalogMaxAgeHours({ AQUA_CATALOG_MAX_AGE_HOURS: '6' }), 6)
  assert.equal(catalogMaxAgeHours({ AQUA_CATALOG_MAX_AGE_HOURS: '0' }), 0)
  assert.equal(catalogMaxAgeHours({ AQUA_CATALOG_MAX_AGE_HOURS: 'nonsense' }), 24)
  const now = Date.parse('2026-10-22T12:00:00Z')
  const cat = (at) => ({ snapshot: { fetched_at: at }, programs: [{ id: 'p' }] })
  assert.equal(catalogNeedsRefresh({ snapshot: null, programs: [] }, { now }), 'empty')
  assert.equal(catalogNeedsRefresh(cat('2026-10-22T00:00:00Z'), { now }), null)
  assert.equal(catalogNeedsRefresh(cat('2026-10-21T11:00:00Z'), { now }), 'stale')
  assert.equal(catalogNeedsRefresh(cat('2026-10-21T11:00:00Z'), { now, maxAgeHours: 0 }), null)
})

test('empty cache: the first catalog read refreshes it (public GETs, publishable key only) and saves it; a fresh cache is not refetched', async () => {
  const fake = await fakeCatalog()
  try {
    const dir = scratch('auto-refresh')
    const root = await initWorkspace(dir)
    const cfg = writeFile(dir, 'public-catalog.json', JSON.stringify({ supabase_url: fake.origin, publishable_key: KEY }))
    const c = startServer(root, { env: { AQUA_CATALOG_CONFIG: cfg } })
    try {
      await c.initialize()
      const d = await c.call('discover_applications', { query: 'synthetic' })
      assert.equal(d.status, 'ok', JSON.stringify(d))
      assert.equal(d.catalog_refresh.refreshed, true)
      assert.equal(d.catalog_refresh.persisted, true)
      assert.equal(d.catalog_refresh.stale_reason, 'empty')
      assert.ok(d.catalog_program_ids.includes('p-synth-1'))
      assert.equal(d.catalog_empty, undefined)
      for (const q of fake.requests) {
        assert.equal(q.method, 'GET')
        assert.equal(q.headers.apikey, KEY)
        assert.equal(q.headers.authorization, undefined)
        assert.equal(q.headers.cookie, undefined)
      }
      const n = fake.requests.length
      assert.ok(n >= 1)
      const g = await c.call('get_application_details', { id: 'yc-summer-2026' })
      assert.equal(g.status, 'ok')
      assert.equal(g.catalog_refresh.attempted, false)
      assert.equal(g.catalog_refresh.reason, 'fresh')
      assert.equal(fake.requests.length, n, 'fresh cache: no new request')
    } finally {
      await c.close()
    }
    assert.equal(snapshots(root), 1, 'the public cache was saved')
  } finally {
    fake.server.close()
  }
})

test('stale cache (older than the max age) is refreshed; AQUA_CATALOG_MAX_AGE_HOURS=0 turns auto-refresh off', async () => {
  const fake = await fakeCatalog()
  try {
    const dir = scratch('auto-refresh-stale')
    const root = await initWorkspace(dir)
    const cfg = writeFile(dir, 'public-catalog.json', JSON.stringify({ supabase_url: fake.origin, publishable_key: KEY }))
    const off = startServer(root, { env: { AQUA_CATALOG_CONFIG: cfg, AQUA_CATALOG_MAX_AGE_HOURS: '0' } })
    try {
      await off.initialize()
      const m = await off.call('match_canonical_questions', { questions: ['What problem are you solving?'] })
      assert.equal(m.catalog_refresh.reason, 'disabled')
      assert.equal(m.catalog_empty, 'run refresh_catalog')
      assert.equal(fake.requests.length, 0)
    } finally {
      await off.close()
    }
    const c = startServer(root, { env: { AQUA_CATALOG_CONFIG: cfg, AQUA_CATALOG_MAX_AGE_HOURS: '0.0000001' } })
    try {
      await c.initialize()
      const first = await c.call('match_canonical_questions', { questions: ['What problem are you solving?'] })
      assert.equal(first.catalog_refresh.refreshed, true)
      assert.equal(first.catalog_available, true)
      await new Promise((r) => setTimeout(r, 20))
      const n = fake.requests.length
      const again = await c.call('discover_applications', {})
      assert.equal(again.catalog_refresh.stale_reason, 'stale')
      assert.equal(again.catalog_refresh.refreshed, true)
      assert.ok(fake.requests.length > n, 'a stale cache is fetched again')
    } finally {
      await c.close()
    }
  } finally {
    fake.server.close()
  }
})

test('offline or unconfigured with an empty cache: catalog_empty: run refresh_catalog, nothing written', async () => {
  const fake = await fakeCatalog()
  const dir = scratch('auto-refresh-offline')
  const root = await initWorkspace(dir)
  const cfg = writeFile(dir, 'public-catalog.json', JSON.stringify({ supabase_url: fake.origin, publishable_key: KEY }))
  await new Promise((resolve) => fake.server.close(resolve)) // endpoint down
  const before = readManifest(root).manifest_mac
  const c = startServer(root, { env: { AQUA_CATALOG_CONFIG: cfg } })
  try {
    await c.initialize()
    const m = await c.call('match_canonical_questions', { questions: ['Why now?'] })
    assert.equal(m.status, 'ok')
    assert.equal(m.catalog_refresh.reason, 'offline')
    assert.equal(m.catalog_empty, 'run refresh_catalog')
    const g = await c.call('get_application_details', { id: 'p-synth-1' })
    assert.equal(g.catalog_empty, 'run refresh_catalog', JSON.stringify(g))
    assert.equal(g.catalog_refresh.reason, 'recently_failed', 'a failed attempt is not retried at once')
  } finally {
    await c.close()
  }
  const un = startServer(root) // test default: AQUA_CATALOG_OFFLINE=1, no config file
  try {
    await un.initialize()
    const d = await un.call('discover_applications', {})
    assert.equal(d.catalog_refresh.reason, 'not_configured')
    assert.equal(d.catalog_empty, 'run refresh_catalog')
  } finally {
    await un.close()
  }
  assert.equal(readManifest(root).manifest_mac, before)
})

test('--read-only: the auto-refreshed catalog is kept for the session only', async () => {
  const fake = await fakeCatalog()
  try {
    const dir = scratch('auto-refresh-ro')
    const root = await initWorkspace(dir)
    const cfg = writeFile(dir, 'public-catalog.json', JSON.stringify({ supabase_url: fake.origin, publishable_key: KEY }))
    const before = readManifest(root).manifest_mac
    const ro = startServer(root, { args: ['--read-only'], env: { AQUA_CATALOG_CONFIG: cfg } })
    try {
      await ro.initialize()
      const d = await ro.call('discover_applications', { query: 'synthetic' })
      assert.equal(d.catalog_refresh.refreshed, true)
      assert.equal(d.catalog_refresh.persisted, false)
      assert.ok(d.catalog_program_ids.includes('p-synth-1'))
      const n = fake.requests.length
      const g = await ro.call('get_application_details', { id: 'p-synth-1' })
      assert.equal(g.status, 'ok')
      assert.equal(fake.requests.length, n, 'the session copy is fresh')
    } finally {
      await ro.close()
    }
    assert.equal(readManifest(root).manifest_mac, before)
    assert.equal(snapshots(root), 0)
  } finally {
    fake.server.close()
  }
})
