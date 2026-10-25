// Hosted human-approval write path (app/app/api/workspace/approve):
// Bearer auth → stored-vs-claimed sha256 re-check → approval record row +
// audit receipt, all on the caller's own JWT (RLS does the isolation).
// All content is synthetic. Run: node --test tests/hosted-approval.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { handleHostedApprove } from '../app/api/workspace/approve/_lib/approve.ts'

const ORIGIN = 'https://fakeproject.supabase.co'
const ANON = 'sb_publishable_testkey'
const USER = 'user-1111'
const USER2 = 'user-2222'
const TOKEN = 'good-token'
const ENV = { NEXT_PUBLIC_SUPABASE_URL: ORIGIN, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON }

const WS_KEY = 'WS-11111111-2222-3333-4444-555555555555'
const WS_ROW = 'aaaaaaaa-0000-0000-0000-000000000001'
const VERSION_ID = 'bbbbbbbb-1111-2222-3333-444444444444'
const APPROVAL_KEY = 'cccccccc-9999-8888-7777-666666666666'
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const hex = (n) => n.toString(16).padStart(64, '0')

// The stored version record file: a client-encrypted companion record whose
// stored sha256 (server-computed over the bytes) is what the approval binds.
const VERSION_BYTES = Buffer.from(
  JSON.stringify(
    {
      aqua_record: 1,
      workspace_id: WS_KEY,
      id: `version:${VERSION_ID}`,
      kind: 'version',
      scope: 'private',
      authority: 'staging',
      created_at: '2026-10-30T00:00:00.000Z',
      enc: { alg: 'AES-GCM-256', iv_b64: 'c3ludGhldGljLWl2', ct_b64: 'c3ludGhldGljLWN0' },
      sha256: hex(1),
    },
    null,
    2,
  ) + '\n',
)
const VERSION_SHA = sha(VERSION_BYTES)

function approvalRecordBytes(key = APPROVAL_KEY) {
  return Buffer.from(
    JSON.stringify({
      aqua_record: 1,
      workspace_id: WS_KEY,
      id: `approval:${key}`,
      kind: 'approval',
      scope: 'private',
      authority: 'projection',
      created_at: '2026-10-30T00:05:00.000Z',
      enc: { alg: 'AES-GCM-256', iv_b64: 'YXBwcm92YWwtaXY', ct_b64: 'YXBwcm92YWwtY3QtcGF5bG9hZA' },
      sha256: hex(2),
    }) + '\n',
  )
}

function db() {
  return {
    aqua_workspaces: [{ id: WS_ROW, workspace_key: WS_KEY }],
    aqua_workspace_records: [
      {
        id: 'rec-version-1',
        workspace_id: WS_ROW,
        path: `answers/drafts/version-${VERSION_ID}.json`,
        rid: `version:${VERSION_ID}`,
        kind: 'version',
        status: 'live',
        sha256: VERSION_SHA,
      },
    ],
    aqua_workspace_audit: [],
  }
}

// ---------------------------------------------------------------------------
// Minimal PostgREST fake: GET (eq/or/select/order/limit), POST insert with
// the unique (workspace_id,path) / (workspace_id,log_name,seq) constraints,
// DELETE by id. Every request requires the caller's Bearer JWT + an apikey —
// anything else is a 401, like the real RLS/grant boundary.
// ---------------------------------------------------------------------------

function matchCond(row, col, op) {
  if (op.startsWith('eq.')) return String(row[col] ?? '') === op.slice(3)
  if (op.startsWith('like.')) {
    const pat = op.slice(5).replaceAll('%', '.*')
    return new RegExp(`^${pat}$`).test(String(row[col] ?? ''))
  }
  throw new Error(`fake: unsupported filter ${col}=${op}`)
}

function matchOr(row, expr) {
  const inner = expr.replace(/^\(|\)$/g, '')
  return inner.split(',').some((p) => {
    const i = p.indexOf('.')
    const col = p.slice(0, i)
    return matchCond(row, col, p.slice(i + 1))
  })
}

function fakePostgrest(rows, opts = {}) {
  const requests = []
  const tables = rows
  async function fetchImpl(url, init = {}) {
    const u = new URL(url)
    const method = init.method ?? 'GET'
    const headers = init.headers ?? {}
    requests.push({ url: u.pathname + u.search, method, headers })
    const reply = (status, body) =>
      new Response(body == null ? '' : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (u.origin !== ORIGIN) return reply(404, { message: 'unknown host' })
    // caller-JWT boundary: no token, wrong token or a different user's token
    // is refused before any table work (stands in for auth + RLS)
    if (headers.authorization !== `Bearer ${TOKEN}` || headers.apikey !== ANON) {
      return reply(401, { code: '42501', message: 'permission denied' })
    }
    const rpc = /^\/rest\/v1\/rpc\/aqua_workspace_approve$/.exec(u.pathname)
    if (rpc) {
      const p = JSON.parse(init.body)
      const ver = tables.aqua_workspace_records.find((r) => r.workspace_id === p.p_workspace_id && r.path === p.p_version_path)
      if (!ver) return reply(400, { message: 'version_not_found', code: 'P0404' })
      if (ver.sha256 !== p.p_expected_sha256) return reply(400, { message: 'sha256_mismatch', code: 'P0409' })
      if (tables.aqua_workspace_records.some((r) => r.workspace_id === p.p_workspace_id && r.path === p.p_record_path))
        return reply(409, { code: '23505', message: 'duplicate key value violates unique constraint' })
      const a = p.p_audit
      if (tables.aqua_workspace_audit.some((r) => r.workspace_id === p.p_workspace_id && r.log_name === a.log_name && r.seq === a.seq))
        return reply(409, { code: '23505', message: 'duplicate key value violates unique constraint' })
      tables.aqua_workspace_records.push({ id: `rec-${tables.aqua_workspace_records.length + 1}`, workspace_id: p.p_workspace_id, path: p.p_record_path, rid: p.p_rid, kind: 'approval', authority: 'projection', scope: 'private', status: 'live', sha256: sha(Buffer.from(p.p_record_b64, 'base64')) })
      tables.aqua_workspace_audit.push({ workspace_id: p.p_workspace_id, log_name: a.log_name, seq: a.seq, entry: a.entry, line: a.line, prev: a.prev })
      return reply(200, null)
    }
    const m = /^\/rest\/v1\/([a-z_]+)$/.exec(u.pathname)
    if (!m) return reply(404, { message: 'no route' })
    const table = m[1]
    if (!(table in tables)) return reply(404, { code: 'PGRST205', message: `Could not find the table 'public.${table}'` })
    if (method === 'GET') {
      let out = tables[table].slice()
      for (const [k, v] of u.searchParams) {
        if (['select', 'order', 'limit', 'offset'].includes(k)) continue
        out = k === 'or' ? out.filter((r) => matchOr(r, v)) : out.filter((r) => matchCond(r, k, v))
      }
      const order = u.searchParams.get('order')
      if (order?.endsWith('.desc')) out.sort((a, b) => (b[order.slice(0, -5)] ?? 0) - (a[order.slice(0, -5)] ?? 0))
      const limit = Number(u.searchParams.get('limit') ?? 1000)
      const select = (u.searchParams.get('select') ?? '*').split(',')
      out = out.slice(0, limit)
      if (select[0] !== '*') out = out.map((r) => Object.fromEntries(select.map((c) => [c, r[c] ?? null])))
      return reply(200, out)
    }
    if (method === 'POST') {
      const row = JSON.parse(init.body)
      if (table === 'aqua_workspace_records') {
        if (tables[table].some((r) => r.workspace_id === row.workspace_id && r.path === row.path)) {
          return reply(409, { code: '23505', message: 'duplicate key value violates unique constraint' })
        }
        const stored = { id: `rec-${tables[table].length + 1}`, ...row }
        tables[table].push(stored)
        return reply(201, [stored])
      }
      if (table === 'aqua_workspace_audit') {
        if (tables[table].some((r) => r.workspace_id === row.workspace_id && r.log_name === row.log_name && r.seq === row.seq)) {
          return reply(409, { code: '23505', message: 'duplicate key value violates unique constraint' })
        }
        tables[table].push(row)
        return reply(201, [])
      }
      return reply(400, { message: 'unsupported' })
    }
    if (method === 'DELETE') {
      const idFilter = u.searchParams.get('id')
      const id = idFilter?.startsWith('eq.') ? idFilter.slice(3) : null
      const n = tables[table].length
      tables[table] = tables[table].filter((r) => r.id !== id)
      return reply(204, null)
    }
    return reply(405, { message: 'method' })
  }
  return { fetchImpl, requests, tables }
}

const verifyJwt = async (token) => {
  if (token === TOKEN) return { id: USER }
  throw new Error('bad token')
}

function post(body, { token = TOKEN, headers = {} } = {}) {
  return new Request(`${ORIGIN}/api/workspace/approve`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

const goodBody = (over = {}) => ({
  version_id: VERSION_ID,
  expected_sha256: VERSION_SHA,
  actor_id: 'local-user',
  via: 'hosted_review',
  record_b64: approvalRecordBytes().toString('base64'),
  ...over,
})

const reindexCalls = []
async function call(body, { tables = db(), token = TOKEN, headers = {}, verify = verifyJwt, encodeRecord = null } = {}) {
  const fake = fakePostgrest(tables)
  const res = await handleHostedApprove(post(body, { token, headers }), {
    env: ENV,
    fetchImpl: fake.fetchImpl,
    reindex: async ({ workspaceId, rid, path }) => { reindexCalls.push({ workspaceId, rid, path }); return true },
    engineCheck: async () => true,
    versionContentSha: async () => VERSION_SHA,
    ...(encodeRecord ? { encodeRecord } : {}),
    verifyJwt: verify,
    allow: () => true,
    now: () => '2026-10-30T00:06:00.000Z',
  })
  const text = await res.text()
  return { res, json: text ? JSON.parse(text) : null, fake }
}

test('missing or invalid auth is a 401 before anything else', async () => {
  const fake = fakePostgrest(db())
  for (const tok of [null, 'forged-token']) {
    const res = await handleHostedApprove(post(goodBody(), { token: tok }), {
      env: ENV,
      fetchImpl: fake.fetchImpl,
      verifyJwt: verifyJwt,
      allow: () => true,
    })
    assert.equal(res.status, 401, `token ${tok}`)
    assert.equal((await res.json()).error, 'unauthorized')
  }
  assert.equal(fake.requests.length, 0, 'no PostgREST call on failed auth')
})

test('a forged expected_sha256 is refused and nothing is written', async () => {
  const tables = db()
  const { res, json, fake } = await call(goodBody({ expected_sha256: hex(99) }), { tables })
  assert.equal(res.status, 409)
  assert.equal(json.error, 'sha256_mismatch')
  assert.equal(tables.aqua_workspace_records.length, 1, 'no approval row was inserted')
  assert.equal(tables.aqua_workspace_audit.length, 0, 'no audit receipt')
  assert.ok(!fake.requests.some((r) => r.method === 'POST'), 'no insert attempted')
})

test('a matching sha256 writes the approval row and a server-stamped receipt', async () => {
  const tables = db()
  const { res, json, fake } = await call(goodBody({ actor_id: 'forged-actor-claim' }), { tables })
  assert.equal(res.status, 200)
  assert.equal(json.status, 'ok')
  assert.equal(json.version_id, VERSION_ID)
  assert.equal(json.version_sha256, VERSION_SHA)
  assert.equal(json.actor_id, USER, 'actor is stamped from the JWT, not the body claim')
  assert.equal(json.via, 'hosted_review')
  const rows = tables.aqua_workspace_records
  assert.equal(rows.length, 2)
  const rec = rows.find((r) => r.kind === 'approval')
  assert.ok(rec, 'approval row exists')
  assert.equal(rec.path, `answers/approved/approval-${APPROVAL_KEY}.json`)
  assert.equal(rec.rid, `approval:${APPROVAL_KEY}`)
  assert.equal(rec.sha256, sha(approvalRecordBytes()))
  assert.equal(rec.status, 'live')
  assert.equal(tables.aqua_workspace_audit.length, 1)
  assert.equal(reindexCalls.length, 1, 'the approval is indexed into manifest.records')
  assert.equal(reindexCalls[0].rid, `approval:${APPROVAL_KEY}`)
  const audit = tables.aqua_workspace_audit[0]
  assert.equal(audit.log_name, 'hosted-approvals.jsonl')
  assert.equal(audit.seq, 1)
  assert.equal(audit.entry.op, 'hosted_approval')
  assert.equal(audit.entry.actor_id, USER)
  assert.equal(audit.entry.actor_class, 'human')
  assert.equal(audit.entry.decision, 'approved')
  assert.equal(audit.entry.via, 'hosted_review')
  assert.equal(audit.entry.actor_label, 'forged-actor-claim', 'caller claim kept only as a labelled claim')
  assert.equal(audit.entry.version_sha256, VERSION_SHA)
  // every PostgREST call ran on the caller's own JWT + the anon key — never a
  // service role or a missing credential
  for (const r of fake.requests) {
    assert.equal(r.headers.authorization, `Bearer ${TOKEN}`)
    assert.equal(r.headers.apikey, ANON)
  }
})

test('replay of the same approval record is idempotent', async () => {
  const tables = db()
  const first = await call(goodBody(), { tables })
  assert.equal(first.res.status, 200)
  const second = await call(goodBody(), { tables })
  assert.equal(second.res.status, 200)
  assert.equal(second.json.already_recorded, true)
  assert.equal(tables.aqua_workspace_records.filter((r) => r.kind === 'approval').length, 1)
})

test('a different record on the same path conflicts instead of overwriting', async () => {
  const tables = db()
  await call(goodBody(), { tables })
  const other = JSON.parse(approvalRecordBytes().toString('utf8'))
  other.enc = { alg: 'AES-GCM-256', iv_b64: 'b3RoZXItaXY', ct_b64: 'b3RoZXItY3Q' } // same approval id, different ciphertext
  const { res, json } = await call(goodBody({ record_b64: Buffer.from(JSON.stringify(other)).toString('base64') }), { tables })
  assert.equal(res.status, 409)
  assert.equal(json.error, 'approval_exists')
  assert.equal(tables.aqua_workspace_records.filter((r) => r.kind === 'approval').length, 1, 'never overwritten')
})

test('version not found / not live / ambiguous', async () => {
  const tables = db()
  const missing = await call(goodBody({ version_id: 'dddddddd-0000-0000-0000-000000000000' }), { tables })
  assert.equal(missing.res.status, 404)
  assert.equal(missing.json.error, 'version_not_found')

  tables.aqua_workspace_records[0].status = 'archived'
  const dead = await call(goodBody(), { tables })
  assert.equal(dead.res.status, 409)
  assert.equal(dead.json.error, 'version_not_live')
  tables.aqua_workspace_records[0].status = 'live'

  tables.aqua_workspace_records.push({
    id: 'rec-version-2',
    workspace_id: WS_ROW,
    path: `answers/history/version-${VERSION_ID}.json`,
    rid: `version:${VERSION_ID}`,
    kind: 'version',
    status: 'live',
    sha256: VERSION_SHA,
  })
  const amb = await call(goodBody(), { tables })
  assert.equal(amb.res.status, 409)
  assert.equal(amb.json.error, 'version_ambiguous')
})

test('body validation: via, hash shape, record shape, size', async () => {
  const bad = (over, code) => call(goodBody(over)).then(({ res, json }) => {
    assert.equal(res.status, 400, JSON.stringify(over))
    assert.equal(json.error, code)
  })
  await bad({ via: 'review_ui' }, 'bad_via')
  await bad({ via: 'agent' }, 'bad_via')
  await bad({ expected_sha256: 'xyz' }, 'bad_expected_sha256')
  await bad({ version_id: 'not-a-uuid' }, 'bad_version_id')
  await bad({ record_b64: '!!!' }, 'bad_record')
  await bad({ record_b64: Buffer.from('{"aqua_record":1,"kind":"version"}').toString('base64') }, 'bad_record')
  // a body larger than the request cap is refused before parsing (413)
  const big = goodBody()
  big.record_b64 = Buffer.from(JSON.stringify({ aqua_record: 1, kind: 'approval', id: `approval:${APPROVAL_KEY}`, workspace_id: WS_KEY }) + 'x'.repeat(300 * 1024)).toString('base64')
  const tooBig = await call(big)
  assert.equal(tooBig.res.status, 413)
})

test('a public-scope plaintext approval record is refused (forgery hole)', async () => {
  const forged = Buffer.from(
    JSON.stringify({
      aqua_record: 1,
      workspace_id: WS_KEY,
      id: `approval:${APPROVAL_KEY}`,
      kind: 'approval',
      scope: 'public',                    // plaintext — no enc envelope at all
      authority: 'projection',
      created_at: '2026-10-30T00:05:00.000Z',
      data: { decision: 'approved', actor_class: 'human' },
      sha256: hex(2),
    }) + '\n',
  )
  const { res, json } = await call(goodBody({ record_b64: forged.toString('base64') }))
  assert.equal(res.status, 400)
  assert.equal(json.error, 'bad_record')
})

test('server-built mode: no record_b64 — the engine encodes, hashes bind the version', async () => {
  const tables = db()
  const encoded = { calls: 0 }
  const { res, json, fake } = await call({ version_id: VERSION_ID, expected_sha256: VERSION_SHA, actor_id: 'local-user', via: 'hosted_review' }, {
    tables,
    encodeRecord: async (a) => { encoded.calls++; return approvalRecordBytes().toString('utf8') },
  })
  assert.equal(res.status, 200)
  assert.equal(encoded.calls, 1, 'the engine built the record, not the client')
  assert.equal(tables.aqua_workspace_records.length, 2, 'the encoded record row was written')
  assert.equal(tables.aqua_workspace_audit.length, 1, 'the audit receipt was written')
  const rpc = fake.requests.find((r) => r.url.includes('rpc/aqua_workspace_approve'))
  assert.ok(rpc, 'the atomic RPC carried the server-built record')
})

test('a record for a different workspace key is refused', async () => {
  const other = JSON.parse(approvalRecordBytes().toString('utf8'))
  other.workspace_id = 'WS-99999999-8888-7777-6666-555555555555'
  const { res, json } = await call(goodBody({ record_b64: Buffer.from(JSON.stringify(other)).toString('base64') }))
  assert.equal(res.status, 404)
  assert.equal(json.error, 'workspace_not_found')
})

test('schema not deployed is an honest 503, not a silent write', async () => {
  const tables = db()
  delete tables.aqua_workspace_records
  const { res, json } = await call(goodBody(), { tables })
  assert.equal(res.status, 503)
  assert.equal(json.error, 'not_configured')
})

test('route is thin, holds no privileged client and never sends service keys', () => {
  const route = readFileSync(new URL('../app/api/workspace/approve/route.ts', import.meta.url), 'utf8')
  const lib = readFileSync(new URL('../app/api/workspace/approve/_lib/approve.ts', import.meta.url), 'utf8')
  assert.match(route, /export const runtime = 'nodejs'/)
  assert.match(route, /export async function POST\(/)
  for (const src of [route, lib]) {
    assert.ok(!src.includes('SERVICE_ROLE'), 'no service-role key anywhere')
    assert.ok(!/getUser|cookies\(\)/.test(src), 'no session-cookie auth path')
  }
  // the only authorization header the lib sends is the caller's own JWT
  assert.match(lib, /authorization: `Bearer \$\{jwt\}`/)
  assert.ok(lib.includes("actor_class: 'human'"), 'the only actor_class it can stamp is human')
})
