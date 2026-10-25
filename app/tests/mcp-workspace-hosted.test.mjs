// Hosted personal-workspace MCP endpoint (POST /mcp with a Bearer token,
// app/app/api/mcp/_lib/workspace.ts): Bearer auth + WWW-Authenticate challenge,
// per-user rate limit, 10 MB body cap, per-request workspace backend over the
// caller's hosted store, catalog parity with the public surface.
// Supabase and JWT verification are dep-injected; fixtures are synthetic.
// Run: node --test tests/mcp-workspace-hosted.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { handleWorkspaceMcpPost, bearerToken, MAX_WORKSPACE_BODY_BYTES } from '../app/api/mcp/_lib/workspace.ts'
import { POST } from '../app/api/mcp/route.ts'
import { rateLimitAllow } from '../lib/rate-limit.ts'
import { seededWorkspace, FORM_MD } from '../../aqua-companion/test/mcp-helpers.mjs'
import { PASS, VAULT } from '../../aqua-companion/test/helpers.mjs'
import { createFsStore } from '../app/api/mcp/_vendor/workspace/companion/src/store/workspace-store.mjs'
import { readHostedReview, canApproveHostedCard } from '../lib/aqua-hosted.ts'
import { ANON_JWT, ORIGIN, SERVICE_JWT, fakePostgrest } from '../../application-hub-mcp-server/test/fake-postgrest.mjs'

const ENV = { NEXT_PUBLIC_SUPABASE_URL: ORIGIN, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_JWT, NODE_ENV: 'production' }
const PUBLIC = ['hub_find_similar_questions', 'hub_get_acceptance_stats', 'hub_get_heat_scores', 'hub_get_program_by_slug', 'hub_get_program_detail', 'hub_get_program_themes', 'hub_get_program_questions', 'hub_get_program_rankings', 'hub_get_question_significance', 'hub_get_universal_questions', 'hub_search_programs']
const USER = { id: '5d8b1f2e-3c4a-4b5c-8d6e-7f8a9b0c1d2e' }
const USER2 = { id: '7a9c2e4f-5b6d-4e8f-9a0b-1c2d3e4f5a6b' }
const METADATA = 'https://aquaidp.xyz/.well-known/oauth-protected-resource'

let ipSeq = 0
function post(body, { token = 'GOOD-TOKEN', headers = {}, raw = false } = {}) {
  const h = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18', 'x-forwarded-for': `203.0.113.${(ipSeq++ % 250) + 1}`, ...headers }
  if (token) h.authorization = `Bearer ${token}`
  return new Request('https://aquaidp.xyz/api/mcp', { method: 'POST', headers: h, body: raw ? body : JSON.stringify(body) })
}
const rpc = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) })
const allowAll = () => true

const verifyToken = async (t) => {
  if (t === 'GOOD-TOKEN') return USER
  if (t === 'GOOD-TOKEN-2') return USER2
  const e = new Error('bad_jwt')
  e.name = 'JWSSignatureVerificationFailed'
  throw e
}

/** Chainable PostgREST fake: `client.from(t).eq(k,v)...` resolves `tables[t]` rows matching the eq filters. */
function fakeSupabaseClient(tables = {}) {
  const requests = []
  const builder = (table) => {
    const filters = {}
    const rows = () => (tables[table] ?? []).filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v))
    const b = {}
    for (const m of ['select', 'order', 'limit', 'insert', 'update', 'delete']) b[m] = () => b
    b.eq = (k, v) => { filters[k] = v; return b }
    b.single = () => Promise.resolve({ data: rows()[0] ?? null, error: null })
    b.then = (res, rej) => Promise.resolve({ data: rows(), error: null }).then(res, rej)
    return b
  }
  return {
    requests,
    from: (t) => { requests.push({ table: t }); return builder(t) },
    rpc: (fn, args) => { requests.push({ rpc: fn, args }); return Promise.resolve({ data: 2, error: null }) },
  }
}

function deps(over = {}) {
  const fake = over.fake ?? fakePostgrest()
  const client = over.client ?? fakeSupabaseClient()
  const d = {
    env: ENV,
    fetchImpl: fake.fetchImpl,
    allow: allowAll,
    verifyToken,
    createClient: () => client,
    findWorkspace: async () => null,
    ...over,
  }
  return { deps: d, fake, client }
}

async function call(body, over = {}, opts = {}) {
  const d = deps(over)
  const res = await handleWorkspaceMcpPost(post(body, opts), d.deps)
  const text = await res.text()
  return { res, json: text ? JSON.parse(text) : null, ...d }
}

test('no Authorization header -> 401 with the RFC 9728 challenge', async () => {
  const { res } = await call(rpc(1, 'ping'), {}, { token: null })
  assert.equal(res.status, 401)
  const www = res.headers.get('www-authenticate')
  assert.ok(www?.startsWith('Bearer '), www)
  assert.ok(www.includes(`resource_metadata="${METADATA}"`), www)
})

test('a token that fails JWKS verification -> 401 invalid_token; the token is never logged', async () => {
  const logged = []
  const orig = console.error
  console.error = (...a) => logged.push(a.join(' '))
  try {
    const { res } = await call(rpc(1, 'ping'), {}, { token: 'SYNTHETIC-UNVERIFIABLE-TOKEN-7781' })
    assert.equal(res.status, 401)
    const www = res.headers.get('www-authenticate')
    assert.ok(www.includes('error="invalid_token"'), www)
    assert.ok(www.includes(`resource_metadata="${METADATA}"`), www)
  } finally {
    console.error = orig
  }
  assert.ok(!logged.join('\n').includes('SYNTHETIC-UNVERIFIABLE-TOKEN-7781'), 'the bearer token reached a log')
})

test('bearerToken parses only the RFC 6750 header form', () => {
  assert.equal(bearerToken(post(rpc(1, 'ping'))), 'GOOD-TOKEN')
  assert.equal(bearerToken(post(rpc(1, 'ping'), { token: null })), null)
  assert.equal(bearerToken(post(rpc(1, 'ping'), { token: null, headers: { authorization: 'Basic abc' } })), null)
})

test('catalog tools still list and answer under a Bearer token', async () => {
  const { json } = await call(rpc(1, 'tools/list'), {}, { headers: { 'mcp-protocol-version': '2025-06-18' } })
  const names = json.result.tools.map((t) => t.name)
  for (const p of PUBLIC) assert.ok(names.includes(p), p)
  // Authentication discovers the full capability list even before setup.
  for (const w of ['import_local_application', 'import_history', 'search_answer_bank', 'create_draft_version', 'read_review_status', 'link_answer', 'assemble_application']) assert.ok(names.includes(w), w)
  assert.ok(!names.includes('sync_from_vault_export'), 'filesystem-only vault synchronization is not advertised')
  assert.ok(!/run aqua-mcp-server|--workspace/.test((await call(rpc(2, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'synthetic', version: '1' } }))).json.result.instructions))
  const r = await call(rpc(2, 'tools/call', { name: 'hub_get_program_questions', arguments: { slug: 'yc-summer-2026' } }))
  assert.equal(r.json.result.structuredContent.status, 'ok')
  assert.ok(r.fake.requests.length > 0)
})

test('without a hosted workspace, discoverable tools return setup guidance without changing anything', async () => {
  for (const name of ['search_answer_bank', 'create_draft_version', 'read_review_status']) {
    const r = await call(rpc(1, 'tools/call', { name, arguments: {} }))
    assert.equal(r.json.result.isError, true, name)
    assert.equal(r.json.result.structuredContent.status, 'workspace_not_initialized', name)
    assert.equal(r.json.result.structuredContent.tool, name)
    assert.match(r.json.result.structuredContent.message, /https:\/\/aquaidp.xyz\/workspace/)
  }
  // filesystem setup tools are not exposed on the hosted surface at all
  for (const name of ['locate_workspace', 'init_workspace', 'doctor']) {
    const r = await call(rpc(1, 'tools/call', { name, arguments: {} }))
    assert.equal(r.json.error.code, -32602, name)
  }
})

test('an existing workspace: tools listed; unwired store session -> hosted_backend_unavailable', async () => {
  const client = fakeSupabaseClient({ aqua_workspaces: [{ id: 'row-1', workspace_key: 'WS-1' }] })
  const over = {
    client,
    findWorkspace: async () => ({ id: 'row-1', workspace_key: 'WS-1' }),
    storeFactory: () => ({ loadManifest: async () => ({ manifest: { workspace_id: 'WS-1' }, rev: 1 }) }),
  }
  const list = await call(rpc(1, 'tools/list'), over, { headers: { 'mcp-protocol-version': '2025-06-18' } })
  const names = list.json.result.tools.map((t) => t.name)
  for (const w of ['search_answer_bank', 'create_draft_version', 'read_review_status']) assert.ok(names.includes(w), w)
  for (const p of PUBLIC.slice(0, 3)) assert.ok(names.includes(p), p)
  const r = await call(rpc(2, 'tools/call', { name: 'search_answer_bank', arguments: { query: 'x' } }), over)
  assert.equal(r.json.result.isError, true)
  assert.equal(r.json.result.structuredContent.error, 'hosted_backend_unavailable')
  // the status resource is only served once a real session exists
  const res = await call(rpc(3, 'resources/read', { uri: 'aqua://workspace/status' }), over)
  assert.equal(res.json.error.code, -32002)
})

test('an injected session receives workspace calls and serves aqua://workspace/status', async () => {
  const seen = []
  const session = {
    callTool: async (name, args) => { seen.push([name, args]); return { result: { tool: name, status: 'ok' }, isError: false } },
    readStatus: async () => ({ status: 'ok', applications: [] }),
  }
  const over = {
    findWorkspace: async () => ({ id: 'row-1', workspace_key: 'WS-1' }),
    storeFactory: () => ({ loadManifest: async () => ({ manifest: { workspace_id: 'WS-1' }, rev: 1 }) }),
    sessionFactory: async () => session,
  }
  const r = await call(rpc(1, 'tools/call', { name: 'search_answer_bank', arguments: { query: 'motor' } }), over)
  assert.equal(r.json.result.structuredContent.status, 'ok')
  assert.deepEqual(seen, [['search_answer_bank', { query: 'motor' }]])
  const rl = await call(rpc(2, 'resources/list'), over)
  assert.ok(rl.json.result.resources.some((x) => x.uri === 'aqua://workspace/status'))
  const rr = await call(rpc(3, 'resources/read', { uri: 'aqua://workspace/status' }), over)
  assert.equal(JSON.parse(rr.json.result.contents[0].text).status, 'ok')
  const prompts = await call(rpc(4, 'prompts/get', { name: 'reuse-my-answers' }), over)
  assert.ok(!prompts.json.error, 'hasWorkspace=true reaches prompts')
})

test('real encrypted engine: uploaded drafts and history reach hosted review with exact text, provenance and no automatic approval', async (t) => {
  const fixture = await seededWorkspace('hosted-browser-review')
  t.after(() => fs.rmSync(fixture.dir, { recursive: true, force: true }))
  const previous = { pass: process.env.AQUA_PASSPHRASE, vault: process.env.AQUA_VAULT_SECRET, offline: process.env.AQUA_CATALOG_OFFLINE }
  process.env.AQUA_PASSPHRASE = PASS
  process.env.AQUA_VAULT_SECRET = VAULT
  process.env.AQUA_CATALOG_OFFLINE = '1'
  t.after(() => {
    for (const [key, value] of [['AQUA_PASSPHRASE', previous.pass], ['AQUA_VAULT_SECRET', previous.vault], ['AQUA_CATALOG_OFFLINE', previous.offline]]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  const store = createFsStore(fixture.root)
  const loaded = await store.loadManifest()
  const over = { findWorkspace: async () => ({ id: 'real-engine-row', workspace_key: loaded.manifest.workspace_id }), storeFactory: () => store }
  const invoke = async (name, args) => (await call(rpc(1, 'tools/call', { name, arguments: args }), over)).json.result.structuredContent
  const imported = await invoke('import_local_application', { file_name: 'blank-review.md', content_base64: Buffer.from(FORM_MD).toString('base64') })
  assert.equal(imported.status, 'ok')
  const appId = imported.instance_id
  const initial = await invoke('read_review_status', { application_id: appId })
  const questionId = initial.questions[0].question_occurrence_id
  const body = 'Exact synthetic wording.\nSecond line stays on the same saved version.'
  const drafted = await invoke('create_draft_version', { application_id: appId, question_occurrence_id: questionId, title: 'Hosted browser test', body })
  assert.equal(drafted.status, 'ok')
  assert.match(drafted.next_steps[0], /https:\/\/aquaidp.xyz\/workspace/)
  assert.ok(!/export-backup|terminal|Restore/.test(drafted.next_steps.join(' ')))
  const historyText = '---\nprogram: Synthetic Historic Review\nsubmitted_at: 2025-11-01\n---\n\n## What problem are you solving?\nHistorical garden watering.\n\n## What is your deck URL?\n[TODO]\n'
  const history = await invoke('import_history', { files: [{ name: 'past-review.md', content_base64: Buffer.from(historyText).toString('base64') }] })
  assert.equal(history.status, 'ok')
  assert.match(history.next_steps[0], /https:\/\/aquaidp.xyz\/workspace/)
  // Use the actual browser helper and MCP resource handler, with only the
  // transport and record store substituted; the encryption/model are real.
  const data = await readHostedReview('GOOD-TOKEN', { fetchImpl: (_url, init) => handleWorkspaceMcpPost(post(JSON.parse(init.body)), deps(over).deps) })
  const current = data.applications.find((app) => app.instance_id === appId)
  assert.ok(current)
  const card = current.review.cards.find((card) => card.question_occurrence_id === questionId)
  assert.equal(card.answer.body, body)
  assert.equal(card.answer.version_id, drafted.version_id)
  assert.equal(card.answer.sha256, drafted.sha256)
  assert.equal(card.integrity_ok, true)
  assert.equal(card.approval.state, 'not_approved')
  assert.equal(canApproveHostedCard(card), true)
  assert.ok(current.review.cards.some((card) => card.answer === null))
  const historical = data.applications.find((app) => app.review.history && app.review.title === 'Synthetic Historic Review')
  assert.ok(historical)
  const savedHistory = historical.review.cards.find((card) => card.answer?.body === 'Historical garden watering.')
  assert.equal(savedHistory.history_source.source_file, 'past-review.md')
  assert.equal(savedHistory.history_source.submitted_at, '2025-11-01')
  assert.equal(savedHistory.history_source.metadata_integrity, 'verified')
  assert.equal(savedHistory.approval.state, 'not_approved')
  const placeholder = historical.review.cards.find((card) => card.history_source?.placeholder_found)
  assert.ok(placeholder)
  assert.equal(canApproveHostedCard(placeholder), false)
  assert.ok(!JSON.stringify(data).includes(PASS))
  assert.ok(!JSON.stringify(data).includes(VAULT))
})

test('default wiring: caller-JWT client + vendored store hit aqua_workspaces under RLS, never a privileged key', async () => {
  const client = fakeSupabaseClient({
    aqua_workspaces: [{ id: 'row-1', workspace_key: 'WS-1', manifest: { workspace_id: 'WS-1' }, manifest_rev: 1 }],
  })
  let seenJwt = null
  const r = await call(rpc(1, 'tools/call', { name: 'search_answer_bank', arguments: {} }), {
    client,
    findWorkspace: undefined, // real findWorkspaceRow over the fake client
    createClient: (env, jwt) => {
      seenJwt = jwt
      assert.equal(env.NEXT_PUBLIC_SUPABASE_ANON_KEY, ANON_JWT, 'anon/publishable key only')
      return client
    },
    storeFactory: undefined, // real createSupabaseStore
    sessionFactory: async () => ({ callTool: async (name) => ({ result: { tool: name, status: 'ok' }, isError: false }) }),
  })
  assert.equal(seenJwt, 'GOOD-TOKEN', "the caller's JWT feeds the Data API client")
  assert.equal(r.json.result.structuredContent.status, 'ok', 'workspace store resolved the session')
  assert.ok(client.requests.length >= 2)
  assert.ok(client.requests.every((x) => x.table === 'aqua_workspaces'), 'only aqua_workspaces was touched')
})

test('a service-role key in the environment is refused before any workspace request is made', async () => {
  const logged = []
  const orig = console.error
  console.error = (...a) => logged.push(a.join(' '))
  try {
    const d = deps({ env: { ...ENV, NEXT_PUBLIC_SUPABASE_ANON_KEY: SERVICE_JWT }, createClient: undefined })
    const res = await handleWorkspaceMcpPost(post(rpc(1, 'tools/list')), d.deps)
    assert.equal(res.status, 500)
    assert.deepEqual(logged, ['mcp workspace: internal error KeyRefusal'])
  } finally {
    console.error = orig
  }
})

test('per-user rate limit: real mcp_workspace limiter, keyed by user id not IP', async () => {
  const seen = []
  const allow = (k, a) => { seen.push([k, a]); return rateLimitAllow(k, a) }
  const mk = (token, ip) => () => handleWorkspaceMcpPost(post(rpc(1, 'ping'), { token, headers: { 'x-forwarded-for': ip } }), {
    env: ENV, verifyToken, allow, createClient: () => fakeSupabaseClient(), findWorkspace: async () => null,
  })
  const u1ip1 = mk('GOOD-TOKEN', '198.51.100.60')
  for (let i = 0; i < 60; i++) assert.equal((await u1ip1()).status, 200, i)
  // the per-user bucket is full: same user from another IP still 429s
  assert.equal((await mk('GOOD-TOKEN', '198.51.100.61')()).status, 429)
  // a different user is unaffected
  assert.equal((await mk('GOOD-TOKEN-2', '198.51.100.61')()).status, 200)
  assert.ok(seen.some(([k, a]) => a === 'mcp_workspace' && /^mcp-user:[0-9a-f]{24}$/.test(k)), 'user key used')
  assert.ok(seen.some(([k, a]) => a === 'mcp_hosted' && /^mcp-ip:[0-9a-f]{24}$/.test(k)), 'ip key also applied')
})

test('10 MB body cap; a body past the catalog 64 KB cap still parses', async () => {
  const big = { jsonrpc: '2.0', id: 1, method: 'ping', params: { pad: 'x'.repeat(128 * 1024) } }
  assert.equal((await call(big)).res.status, 200)
  const res = await handleWorkspaceMcpPost(post('x'.repeat(MAX_WORKSPACE_BODY_BYTES + 1), { raw: true }), deps().deps)
  assert.equal(res.status, 413)
})

test('guard parity with the catalog surface', async () => {
  const status = async (req) => (await handleWorkspaceMcpPost(req, deps().deps)).status
  assert.equal(await status(post(rpc(1, 'ping'), { headers: { origin: 'https://evil.example' } })), 403)
  assert.equal(await status(post(rpc(1, 'ping'), { headers: { 'mcp-protocol-version': '1999-01-01' } })), 400)
  assert.equal(await status(post(rpc(1, 'ping'), { headers: { accept: 'text/html' } })), 406)
  assert.equal(await status(post(rpc(1, 'ping'), { headers: { 'content-type': 'text/plain' } })), 415)
  assert.equal(await status(post('{nope', { raw: true })), 400)
  assert.equal(await status(post([rpc(1, 'ping')])), 400)
  const note = await handleWorkspaceMcpPost(post({ jsonrpc: '2.0', method: 'notifications/initialized' }), deps().deps)
  assert.equal(note.status, 202)
  assert.equal(await note.text(), '')
  // rate-limit response carries retry-after
  const deny = await handleWorkspaceMcpPost(post(rpc(1, 'ping')), { ...deps().deps, allow: () => false })
  assert.equal(deny.status, 429)
  assert.equal(deny.headers.get('retry-after'), '60')
})

test('route.ts keeps catalog fallback for unauthenticated POSTs; workspace surface stays privilege-free', async () => {
  const route = fs.readFileSync(new URL('../app/api/mcp/route.ts', import.meta.url), 'utf8')
  const lib = fs.readFileSync(new URL('../app/api/mcp/_lib/workspace.ts', import.meta.url), 'utf8')
  assert.match(route, /bearerToken\(req\) \? handleWorkspaceMcpPost\(req\) : handleMcpPost\(req\)/)
  assert.ok(!/createClient|@supabase\/|cookies\(|getUser/.test(route), 'route.ts stays thin')
  assert.ok(!/service_role|SERVICE_ROLE|createFsStore/.test(lib), 'no service role and no filesystem store in the hosted path')
  assert.match(lib, /rateLimitAllow\(key, action\)/)
  assert.match(lib, /'mcp_workspace'/)
  // live dispatch: a Bearer POST reaches the workspace handler (401 on the
  // synthetic token), a plain POST keeps catalog behavior (200 ping)
  assert.equal((await POST(post(rpc(1, 'ping'), { token: null }))).status, 200)
  assert.equal((await POST(post(rpc(1, 'ping'), { token: 'SYNTHETIC-TOKEN' }))).status, 401)
})
