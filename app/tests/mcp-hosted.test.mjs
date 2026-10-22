// Hosted read-only MCP endpoint (app/app/api/mcp): Streamable HTTP POST
// behaviour, read-only public tool set, anon-key-only client, rate limit,
// and no logging of anything that came from the request.
// Run: node --test tests/mcp-hosted.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { handleMcpPost, handleMcpGet, handleMcpDelete, handleMcpOptions, MAX_BODY_BYTES } from '../app/api/mcp/_lib/hosted.ts'
import { ANON_JWT, ORIGIN, SERVICE_JWT, fakePostgrest } from '../../application-hub-mcp-server/test/fake-postgrest.mjs'
import { drift } from '../../application-hub-mcp-server/scripts/vendor-hosted.mjs'

const ENV = { NEXT_PUBLIC_SUPABASE_URL: ORIGIN, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_JWT, NODE_ENV: 'production' }
const PUBLIC = ['hub_find_similar_questions', 'hub_get_acceptance_stats', 'hub_get_heat_scores', 'hub_get_program_by_slug', 'hub_get_program_detail', 'hub_get_program_dna', 'hub_get_program_questions', 'hub_get_program_rankings', 'hub_get_question_significance', 'hub_get_universal_questions', 'hub_search_programs']

let ipSeq = 0
function post(body, { headers = {}, raw = false } = {}) {
  return new Request('https://aquaidp.xyz/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-forwarded-for': `203.0.113.${(ipSeq++ % 250) + 1}`, ...headers },
    body: raw ? body : JSON.stringify(body),
  })
}
const rpc = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) })
const allowAll = () => true

async function call(body, deps = {}, opts = {}) {
  const fake = deps.fake ?? fakePostgrest()
  const res = await handleMcpPost(post(body, opts), { env: ENV, fetchImpl: fake.fetchImpl, allow: allowAll, ...deps })
  const text = await res.text()
  return { res, json: text ? JSON.parse(text) : null, fake }
}

test('initialize, then stateless calls without a session', async () => {
  const init = await call(rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } }))
  assert.equal(init.res.status, 200)
  assert.equal(init.res.headers.get('content-type'), 'application/json')
  assert.equal(init.res.headers.get('mcp-session-id'), null)
  assert.equal(init.json.result.protocolVersion, '2025-06-18')
  assert.match(init.json.result.instructions, /hosted read-only endpoint/)
  const list = await call(rpc(2, 'tools/list'), {}, { headers: { 'mcp-protocol-version': '2025-06-18' } })
  assert.deepEqual(list.json.result.tools.map((t) => t.name).sort(), PUBLIC)
  for (const t of list.json.result.tools) assert.equal(t._meta['aqua/tier'], 'read')
})

test('hosted exposes no workspace tools, no write tier, and no workspace resource', async () => {
  for (const name of ['create_draft_version', 'approve_answer', 'search_answer_bank', 'import_local_application', 'get_workspace_setup', 'hub_save_answer']) {
    const r = await call(rpc(1, 'tools/call', { name, arguments: {} }))
    assert.equal(r.json.error.code, -32602, name)
  }
  const res = await call(rpc(2, 'resources/list'))
  assert.deepEqual(res.json.result.resources.map((x) => x.uri), ['aqua://programs'])
  assert.equal((await call(rpc(3, 'resources/read', { uri: 'aqua://workspace/status' }))).json.error.code, -32002)
  const prompts = await call(rpc(4, 'prompts/list'))
  assert.deepEqual(prompts.json.result.prompts.map((p) => p.name), ['start-application', 'reuse-my-answers', 'get-ready-to-export'])
})

test('public tools answer from the anon client with GETs only', async () => {
  const r = await call(rpc(1, 'tools/call', { name: 'hub_get_program_questions', arguments: { slug: 'yc-summer-2026' } }), {}, { headers: { 'mcp-protocol-version': '2025-06-18' } })
  assert.equal(r.json.result.structuredContent.status, 'ok')
  assert.equal(r.json.result.structuredContent.count, 2)
  assert.ok(r.fake.requests.length > 0)
  for (const q of r.fake.requests) {
    assert.equal(q.method, 'GET')
    assert.equal(q.headers.apikey, ANON_JWT)
  }
  const tpl = await call(rpc(2, 'resources/read', { uri: 'aqua://programs/yc-summer-2026' }))
  assert.equal(JSON.parse(tpl.json.result.contents[0].text).questions.length, 2)
})

test('a service-role key in the environment is never used', async () => {
  const fake = fakePostgrest()
  const errors = []
  const orig = console.error
  console.error = (...a) => errors.push(a.join(' '))
  try {
    const r = await call(rpc(1, 'tools/call', { name: 'hub_search_programs', arguments: {} }), { fake, env: { ...ENV, NEXT_PUBLIC_SUPABASE_ANON_KEY: SERVICE_JWT } })
    assert.equal(r.json.result.structuredContent?.reason ?? JSON.parse(r.json.result.content[0].text).reason, 'catalog_not_configured')
  } finally {
    console.error = orig
  }
  assert.equal(fake.requests.length, 0)
  assert.deepEqual(errors, ['mcp hosted: catalog disabled KeyRefusal'])
})

test('transport rules: origin, protocol version, accept, content type, size, batches, notifications', async () => {
  const fake = fakePostgrest()
  const deps = { env: ENV, fetchImpl: fake.fetchImpl, allow: allowAll }
  const status = async (req) => (await handleMcpPost(req, deps)).status
  assert.equal(await status(post(rpc(1, 'ping'), { headers: { origin: 'https://evil.example' } })), 403)
  assert.equal(await status(post(rpc(1, 'ping'), { headers: { origin: 'https://aquaidp.xyz' } })), 200)
  assert.equal(await status(post(rpc(1, 'ping'), { headers: { 'mcp-protocol-version': '1999-01-01' } })), 400)
  assert.equal(await status(post(rpc(1, 'ping'), { headers: { accept: 'text/html' } })), 406)
  assert.equal(await status(post(rpc(1, 'ping'), { headers: { 'content-type': 'text/plain' } })), 415)
  assert.equal(await status(post('x'.repeat(MAX_BODY_BYTES + 1), { raw: true })), 413)
  assert.equal(await status(post('{nope', { raw: true })), 400)
  assert.equal(await status(post([rpc(1, 'ping')])), 400)
  const note = await handleMcpPost(post({ jsonrpc: '2.0', method: 'notifications/initialized' }), deps)
  assert.equal(note.status, 202)
  assert.equal(await note.text(), '')
  assert.equal(handleMcpGet().status, 405)
  assert.match(handleMcpGet().headers.get('allow'), /POST/)
  assert.equal(handleMcpDelete().status, 405)
  assert.equal(handleMcpOptions().status, 204)
})

test('rate limit: the real mcp_hosted limiter answers 429 after 60 requests a minute from one client', async () => {
  const fake = fakePostgrest()
  const ip = '198.51.100.77'
  const make = () => new Request('https://aquaidp.xyz/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(rpc(1, 'ping')) })
  const codes = []
  for (let i = 0; i < 61; i++) codes.push((await handleMcpPost(make(), { env: ENV, fetchImpl: fake.fetchImpl })).status)
  assert.equal(codes.filter((c) => c === 200).length, 60)
  const last = await handleMcpPost(make(), { env: ENV, fetchImpl: fake.fetchImpl })
  assert.equal(last.status, 429)
  assert.equal(last.headers.get('retry-after'), '60')
  // another client is unaffected
  assert.equal((await handleMcpPost(new Request('https://aquaidp.xyz/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.78' }, body: JSON.stringify(rpc(1, 'ping')) }), { env: ENV, fetchImpl: fake.fetchImpl })).status, 200)
})

test('nothing from the request body is ever logged, on any path', async () => {
  const SENTINEL = 'ZQX-REQUEST-BODY-SENTINEL-7781'
  const logged = []
  const saved = {}
  for (const k of ['log', 'info', 'warn', 'error', 'debug']) {
    saved[k] = console[k]
    console[k] = (...a) => logged.push(a.map(String).join(' '))
  }
  const ow = process.stdout.write.bind(process.stdout)
  const ew = process.stderr.write.bind(process.stderr)
  process.stdout.write = (s, ...r) => { logged.push(String(s)); return ow(s, ...r) }
  process.stderr.write = (s, ...r) => { logged.push(String(s)); return ew(s, ...r) }
  try {
    const failing = fakePostgrest({ fail: true })
    const bodies = [
      rpc(1, 'tools/call', { name: 'hub_search_programs', arguments: { query: SENTINEL } }),
      rpc(2, 'tools/call', { name: SENTINEL, arguments: {} }),
      rpc(3, 'tools/call', { name: 'hub_find_similar_questions', arguments: { text: SENTINEL, [SENTINEL]: 1 } }),
      rpc(4, 'resources/read', { uri: `aqua://programs/${SENTINEL}` }),
      rpc(5, 'prompts/get', { name: 'start-application', arguments: { program: SENTINEL } }),
      rpc(6, SENTINEL),
    ]
    for (const b of bodies) {
      await call(b)
      await call(b, { fake: failing })
      await call(b, { env: { ...ENV, NEXT_PUBLIC_SUPABASE_ANON_KEY: SERVICE_JWT } })
    }
    await handleMcpPost(post(`{"${SENTINEL}":`, { raw: true }), { env: ENV, allow: allowAll })
    await handleMcpPost(post(rpc(7, 'ping'), { headers: { origin: `https://${SENTINEL}.example` } }), { env: ENV, allow: allowAll })
  } finally {
    for (const k of Object.keys(saved)) console[k] = saved[k]
    process.stdout.write = ow
    process.stderr.write = ew
  }
  assert.ok(!logged.join('\n').includes(SENTINEL), 'request content reached a log')
})

test('the route is thin, read-only and holds no privileged client', () => {
  const route = fs.readFileSync(new URL('../app/api/mcp/route.ts', import.meta.url), 'utf8')
  const lib = fs.readFileSync(new URL('../app/api/mcp/_lib/hosted.ts', import.meta.url), 'utf8')
  assert.match(route, /export const runtime = 'nodejs'/)
  for (const fn of ['POST', 'GET', 'DELETE', 'OPTIONS']) assert.match(route, new RegExp(`export async function ${fn}\\(`))
  for (const src of [route, lib]) {
    assert.ok(!src.includes('SERVICE_ROLE'))
    assert.ok(!/createClient|@supabase\/|cookies\(|getUser/.test(src), 'no Supabase client, cookies or auth in the hosted route')
  }
  assert.match(lib, /rateLimitAllow\(key, 'mcp_hosted'\)/)
})

test('the vendored catalog core matches application-hub-mcp-server/src/catalog', () => {
  assert.deepEqual(drift(), [])
})

test('review fix: a chunked body without Content-Length is capped while streaming', async () => {
  let sent = 0
  const body = new ReadableStream({ pull(c) { if (sent > MAX_BODY_BYTES * 2) return c.close(); c.enqueue(new TextEncoder().encode('x'.repeat(4096))); sent += 4096 } })
  const req = new Request('https://aquaidp.xyz/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body, duplex: 'half' })
  assert.equal(req.headers.get('content-length'), null)
  const res = await handleMcpPost(req, { env: ENV, allow: allowAll })
  assert.equal(res.status, 413)
  assert.ok(sent <= MAX_BODY_BYTES + 8192, 'stopped reading near the cap')
})

test('review fix: rotating a spoofed first x-forwarded-for entry does not escape the limit', async () => {
  const seen = []
  const allow = (key) => { seen.push(key); return true }
  const fake = fakePostgrest()
  const send = (headers) => handleMcpPost(new Request('https://aquaidp.xyz/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(rpc(1, 'ping')) }), { env: ENV, fetchImpl: fake.fetchImpl, allow })
  await send({ 'x-forwarded-for': '1.1.1.1, 192.0.2.10' })
  await send({ 'x-forwarded-for': '2.2.2.2, 192.0.2.10' })
  assert.equal(seen[0], seen[1], 'keyed on the proxy-added (last) entry')
  await send({ 'x-vercel-forwarded-for': '192.0.2.99', 'x-forwarded-for': '3.3.3.3, 192.0.2.10' })
  await send({ 'x-vercel-forwarded-for': '192.0.2.99', 'x-forwarded-for': '4.4.4.4, 192.0.2.11' })
  assert.equal(seen[2], seen[3], 'x-vercel-forwarded-for wins')
  assert.notEqual(seen[0], seen[2])
  assert.ok(seen.every((k) => /^mcp-ip:[0-9a-f]{24}$/.test(k)), 'raw IPs are never used as keys')
})
