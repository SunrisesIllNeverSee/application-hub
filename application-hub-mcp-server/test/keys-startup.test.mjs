// Key refusal (service role, secret, wrong role, unknown) before any request,
// config sources, startup without a workspace, removed TRANSPORT=http, and
// tier enforcement for the companion setup tools in catalog mode.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { assertAnonKey, parseCatalogConfig, KeyRefusal } from '../src/catalog/key.mjs'
import { resolveCatalogConfig } from '../src/node/config.mjs'
import { INIT, req, runServer, sc, scratch } from './helpers.mjs'
import { ANON_JWT, AUTH_JWT, CONFIG, ORIGIN, PUBLISHABLE, SERVICE_JWT, fakePostgrest, jwt } from './fake-postgrest.mjs'

test('assertAnonKey accepts only the public key', () => {
  assert.equal(assertAnonKey(PUBLISHABLE).kind, 'publishable')
  assert.equal(assertAnonKey(ANON_JWT).kind, 'anon_jwt')
  const refused = [
    [SERVICE_JWT, 'service_role_key'],
    ['sb_secret_abcdefghijklmnop', 'secret_key'],
    [AUTH_JWT, 'wrong_role'],
    [jwt({ iss: 'supabase' }), 'wrong_role'],
    ['not-a-key', 'unrecognized_key'],
    ['', 'missing_key'],
  ]
  for (const [k, code] of refused) {
    assert.throws(() => assertAnonKey(k), (e) => e instanceof KeyRefusal && e.code === code, code)
  }
  // the message never quotes the key
  try {
    assertAnonKey(SERVICE_JWT)
  } catch (e) {
    assert.ok(!e.message.includes(SERVICE_JWT.split('.')[1]))
  }
})

test('parseCatalogConfig validates origin and table names', () => {
  const c = parseCatalogConfig({ ...CONFIG, tables: { programs: 'programs', bogus: 'x' } })
  assert.equal(c.origin, ORIGIN)
  assert.equal(c.tables.program_cycles, 'program_cycles')
  for (const bad of [{ ...CONFIG, supabase_url: 'http://evil.example' }, { ...CONFIG, supabase_url: `${ORIGIN}/rest/v1` }, { ...CONFIG, publishable_key: 'REPLACE-WITH-THE-PUBLIC-PUBLISHABLE-KEY' }, { ...CONFIG, tables: { programs: 'programs;drop' } }, []]) {
    assert.throws(() => parseCatalogConfig(bad), (e) => e.name === 'ConfigError')
  }
  assert.throws(() => parseCatalogConfig({ ...CONFIG, publishable_key: SERVICE_JWT }), KeyRefusal)
})

test('a service-role or wrong-role key stops startup before any request, from every config source', async () => {
  const dir = scratch('keys')
  const file = path.join(dir, 'cfg.json')
  for (const key of [SERVICE_JWT, 'sb_secret_abcdefghijklmnop', AUTH_JWT]) {
    fs.writeFileSync(file, JSON.stringify({ ...CONFIG, publishable_key: key }))
    const fake = fakePostgrest()
    const cfgFetch = async () => new Response(JSON.stringify({ ...CONFIG, publishable_key: key }), { status: 200 })
    const runs = [
      await runServer([], [INIT(1)], { env: { AQUA_SUPABASE_URL: ORIGIN, AQUA_PUBLISHABLE_KEY: key }, fetchImpl: fake.fetchImpl }),
      await runServer(['--catalog-config', file], [INIT(1)], { fetchImpl: fake.fetchImpl }),
      await runServer([], [INIT(1)], { env: { AQUA_CATALOG_CONFIG: file }, fetchImpl: fake.fetchImpl }),
      await runServer([], [INIT(1)], { env: { AQUA_CATALOG_CONFIG_URL: 'https://aquaidp.example/.well-known/aqua-catalog.json' }, fetchImpl: cfgFetch }),
    ]
    for (const r of runs) {
      assert.equal(r.code, 2)
      assert.match(r.err, /Refusing to start/)
      assert.equal(r.out.length, 0, 'nothing is served')
    }
    assert.equal(fake.requests.length, 0, 'no catalog request was made')
  }
})

test('config sources: default URL, 404 means not configured, offline skips the fetch', async () => {
  const seen = []
  const f404 = async (url) => { seen.push(url); return new Response('nope', { status: 404 }) }
  const r = await resolveCatalogConfig({ env: {}, fetchImpl: f404 })
  assert.equal(seen[0], 'https://aquaidp.xyz/.well-known/aqua-catalog.json')
  assert.deepEqual([r.configured, /HTTP 404/.test(r.reason)], [false, true])
  const off = await resolveCatalogConfig({ env: { AQUA_CATALOG_OFFLINE: '1' }, fetchImpl: () => assert.fail('no fetch offline') })
  assert.equal(off.configured, false)
  const ok = await resolveCatalogConfig({ env: { AQUA_CATALOG_CONFIG_URL: 'https://x.example/c.json' }, fetchImpl: async () => new Response(JSON.stringify(CONFIG)) })
  assert.deepEqual([ok.configured, ok.cfg.origin], [true, ORIGIN])
  assert.equal((await resolveCatalogConfig({ env: { AQUA_CATALOG_CONFIG_URL: 'http://x.example/c.json' } })).configured, false) // https only
})

test('startup without a workspace: catalog tools + companion setup tools, served from a configured catalog', async () => {
  const fake = fakePostgrest()
  const r = await runServer([], [INIT(1), req(2, 'tools/list'), req(3, 'tools/call', { name: 'locate_workspace', arguments: {} }), req(4, 'tools/call', { name: 'hub_get_program_questions', arguments: { slug: 'yc-summer-2026' } }), req(5, 'resources/read', { uri: 'aqua://programs/yc-summer-2026' })], {
    env: { AQUA_CATALOG_OFFLINE: '', AQUA_SUPABASE_URL: ORIGIN, AQUA_PUBLISHABLE_KEY: PUBLISHABLE },
    fetchImpl: fake.fetchImpl,
  })
  assert.equal(r.code, 0)
  const names = r.responses.get(2).result.tools.map((t) => t.name)
  assert.equal(names.length, 14)
  for (const n of ['locate_workspace', 'init_workspace', 'doctor']) assert.ok(names.includes(n), n)
  assert.ok(!names.some((n) => ['create_draft_version', 'approve_answer', 'search_answer_bank'].includes(n)))
  assert.equal(sc(r.responses.get(3)).tool, 'locate_workspace')
  assert.equal(sc(r.responses.get(4)).count, 2)
  const tpl = JSON.parse(r.responses.get(5).result.contents[0].text)
  assert.equal(tpl.status, 'ok')
  assert.equal(tpl.questions.length, 2)
  assert.equal(tpl.untrusted_content.data.questions[0].asked_as, 'What problem are you solving?')
  assert.match(r.err, /catalog configured \(env\)/)
})

test('TRANSPORT=http (1.x self-hosted HTTP) is refused', async () => {
  const r = await runServer([], [INIT(1)], { env: { TRANSPORT: 'http' } })
  assert.equal(r.code, 2)
  assert.match(r.err, /TRANSPORT=http was removed/)
})
