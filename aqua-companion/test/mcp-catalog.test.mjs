// Public catalog sync against a local fake PostgREST server: only GETs to
// the configured origin, only the public key header, nothing from the
// workspace in any request, non-approved rows dropped client-side, secret
// keys refused, offline fallback, and no partial state on failure.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { MARK, readManifest, run, writeFile } from './helpers.mjs'
import { CATALOG_FIXTURE, seededWorkspace, startServer } from './mcp-helpers.mjs'

const KEY = 'sb_publishable_SYNTHETIC_test_key_0001'
const TABLES = { programs: 'programs', program_cycles: 'cycles', program_questions: 'questions', archived_questions: 'canonical_questions' }

/** Fake PostgREST: returns EVERY row (as if the database boundary were missing) so the client must filter. */
function fakeCatalog() {
  const requests = []
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, headers: req.headers })
    const u = new URL(req.url, 'http://x')
    const table = u.pathname.replace(/^\/rest\/v1\//, '')
    if (req.method !== 'GET' || !(table in TABLES)) {
      res.writeHead(404).end('[]')
      return
    }
    const offset = Number(u.searchParams.get('offset') ?? 0)
    const rows = offset > 0 ? [] : CATALOG_FIXTURE[TABLES[table]]
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(rows))
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, requests, origin: `http://127.0.0.1:${server.address().port}` })))
}

function snapshotEntries(root) {
  return Object.entries(readManifest(root).records).filter(([r]) => r.startsWith('catalog:public-catalog-snapshot'))
}

test('catalog sync (CLI) and refresh_catalog (MCP) read only public canonical rows with the publishable key', async () => {
  const fake = await fakeCatalog()
  try {
    const { root, dir } = await seededWorkspace('mcp-cat')
    const cfg = writeFile(dir, 'public-catalog.json', JSON.stringify({ supabase_url: fake.origin, publishable_key: KEY }))
    const wsId = readManifest(root).workspace_id

    // unconfirmed: plan only, no request
    let r = await run(['catalog', 'sync', '--catalog-config', cfg, '--workspace', root])
    assert.equal(r.code, 3)
    assert.equal(fake.requests.length, 0)
    r = await run(['catalog', 'sync', '--catalog-config', cfg, '--workspace', root, '--yes'])
    assert.equal(r.code, 0, r.err)
    assert.match(r.out, /Saved 2 program/)
    assert.deepEqual([...new Set(fake.requests.map((q) => new URL(q.url, 'http://x').pathname))].sort(), ['/rest/v1/archived_questions', '/rest/v1/program_cycles', '/rest/v1/program_questions', '/rest/v1/programs'])
    for (const q of fake.requests) {
      assert.equal(q.method, 'GET')
      assert.equal(q.headers.apikey, KEY)
      assert.equal(q.headers.authorization, undefined)
      assert.equal(q.headers.cookie, undefined)
      for (const secret of [MARK, wsId, 'synthetic-workspace-pass', 'synthetic-vault-secret']) assert.equal(decodeURIComponent(q.url).includes(secret), false)
    }
    const programsUrl = decodeURIComponent(fake.requests.find((q) => q.url.startsWith('/rest/v1/programs')).url)
    // same approval rule as the site's approvedProgramsFilter(): registry slug OR source canonical
    assert.match(programsUrl, /or=\(slug\.in\.\([^)]*\),source\.eq\.canonical\)/)
    assert.doesNotMatch(programsUrl, /[?&]source=eq\.canonical/)
    // the snapshot is public plaintext, approved rows only
    const [[, entry]] = snapshotEntries(root)
    const file = JSON.parse(fs.readFileSync(path.join(root, entry.path), 'utf8'))
    assert.equal(file.scope, 'public')
    assert.deepEqual(file.data.programs.map((p) => p.id), ['p-synth-1', 'p-curator-published'])
    assert.deepEqual(file.data.questions.map((q) => q.id).sort(), ['pq-1', 'pq-2'])
    assert.deepEqual(file.data.canonical_questions.map((q) => q.id).sort(), ['aq-1', 'aq-2'])
    assert.equal((await run(['verify', '--workspace', root])).code, 0)
    r = await run(['catalog', 'status', '--catalog-config', cfg, '--workspace', root])
    assert.match(r.out, /2 program\(s\)/)

    // same data again: unchanged, no new snapshot
    r = await run(['catalog', 'sync', '--catalog-config', cfg, '--workspace', root, '--yes'])
    assert.match(r.out, /Unchanged/)
    assert.equal(snapshotEntries(root).length, 1)

    // MCP refresh: persists unless read-only
    const c = startServer(root, { env: { AQUA_CATALOG_CONFIG: cfg } })
    try {
      await c.initialize()
      const rf = await c.call('refresh_catalog')
      assert.equal(rf.status, 'ok', JSON.stringify(rf))
      assert.equal(rf.persisted, true)
      assert.equal(rf.programs, 2)
      const d = await c.call('discover_applications', { query: 'accelerator' })
      assert.equal(d.catalog.endpoint_configured, true)
      assert.ok(d.catalog_program_ids.includes('p-synth-1'))
    } finally {
      await c.close()
    }
    const before = snapshotEntries(root).length
    const ro = startServer(root, { args: ['--read-only'], env: { AQUA_CATALOG_CONFIG: cfg } })
    try {
      await ro.initialize()
      const rf = await ro.call('refresh_catalog')
      assert.equal(rf.status, 'ok')
      assert.equal(rf.persisted, false)
    } finally {
      await ro.close()
    }
    assert.equal(snapshotEntries(root).length, before, 'read-only refresh keeps the result in memory only')

    // endpoint down: an error, and the cached snapshot is untouched
    const manifestBefore = readManifest(root).manifest_mac
    await new Promise((resolve) => fake.server.close(resolve))
    const down = startServer(root, { env: { AQUA_CATALOG_CONFIG: cfg } })
    try {
      await down.initialize()
      const rf = await down.call('refresh_catalog')
      assert.equal(rf.status, 'error')
      assert.match(rf.message, /could not be reached|timed out/)
      const d = await down.call('get_application_details', { id: 'p-synth-1' })
      assert.equal(d.status, 'ok', 'tools keep working on the cache')
    } finally {
      await down.close()
    }
    assert.equal(readManifest(root).manifest_mac, manifestBefore)
  } finally {
    fake.server.close()
  }
})

test('unconfigured, secret keys and non-https endpoints are refused before any request; tools fall back to the cache', async () => {
  const fake = await fakeCatalog()
  try {
    const { root, dir } = await seededWorkspace('mcp-cat-refuse')
    // default config ships placeholders
    let r = await run(['catalog', 'sync', '--workspace', root, '--yes'])
    assert.equal(r.code, 2)
    assert.match(r.err, /not configured/)
    const serviceJwt = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from('{"role":"service_role"}').toString('base64url')}.c2lnbmF0dXJl`
    for (const [url, key, re] of [
      [fake.origin, serviceJwt, /service_role/],
      [fake.origin, 'sb_secret_synthetic', /SECRET key/],
      ['http://example.org', KEY, /https/],
      [`${fake.origin}/rest/v1`, KEY, /origin only/],
    ]) {
      const cfg = writeFile(dir, `cfg-${Math.random().toString(16).slice(2)}.json`, JSON.stringify({ supabase_url: url, publishable_key: key }))
      r = await run(['catalog', 'sync', '--catalog-config', cfg, '--workspace', root, '--yes'])
      assert.notEqual(r.code, 0)
      assert.match(r.err, re)
    }
    assert.equal(fake.requests.length, 0, 'no request was ever sent')
    const c = startServer(root)
    try {
      await c.initialize()
      const rf = await c.call('refresh_catalog')
      assert.equal(rf.status, 'unavailable')
      const d = await c.call('discover_applications', {})
      assert.equal(d.status, 'ok')
      assert.equal(d.catalog.endpoint_configured, false)
      assert.match(d.catalog.offline_note, /not configured/)
      const m = await c.call('match_canonical_questions', { questions: ['What problem are you solving?'] })
      assert.equal(m.status, 'ok')
    } finally {
      await c.close()
    }
  } finally {
    fake.server.close()
  }
})
