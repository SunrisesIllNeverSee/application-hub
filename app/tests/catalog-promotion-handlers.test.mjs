// M09 W3: route-level tests for /api/catalog/candidates* handlers.
// The Next.js route files only wire real dependencies (next/headers cookies,
// the service-role client, the network fetch) into lib/catalog-promotion/
// handlers.ts, so the handlers are exercised here with an in-memory fake
// Supabase client and W2's real fetchPublicApplication over a fake transport.
// Run: node --test tests/catalog-promotion-handlers.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { handleSubmit, handleList, handleTransition, handlePublish, handleRecheckSource } from '../lib/catalog-promotion/handlers.ts'
import { fetchPublicApplication } from '../lib/catalog/fetch-public.ts'

const USER = '00000000-0000-4000-8000-0000000000a2'
const CURATOR = '00000000-0000-4000-8000-0000000000c1'
const CAND = '11111111-1111-4111-8111-111111111111'
const SRC = '22222222-2222-4222-8222-222222222222'
const CANON_Q = '33333333-3333-4333-8333-333333333333'

// ---------- fake Supabase (records every call; responder decides results) ----------
function fakeDb(responder = () => null) {
  const calls = []
  const from = (table) => {
    const st = { table, op: 'select', filters: [], payload: undefined }
    const resolve = () => { calls.push(st); return Promise.resolve(responder(st) ?? { data: null, error: null }) }
    const b = {
      select() { return b },
      insert(p) { st.op = 'insert'; st.payload = p; return b },
      update(p) { st.op = 'update'; st.payload = p; return b },
      eq(c, v) { st.filters.push([c, v]); return b },
      in(c, v) { st.filters.push([c, v]); return b },
      order() { return b },
      limit() { return b },
      single() { return resolve() },
      maybeSingle() { return resolve() },
      then(res, rej) { return resolve().then(res, rej) },
    }
    return b
  }
  const rpc = (name, args) => { const st = { table: `rpc:${name}`, op: 'rpc', payload: args }; calls.push(st); return Promise.resolve(responder(st) ?? { data: null, error: null }) }
  return { calls, from, rpc }
}

const writes = (db) => db.calls.filter((c) => c.op === 'insert' || c.op === 'update')
const rpcs = (db, name) => db.calls.filter((c) => c.table === `rpc:${name}`)

function deps({ user = USER, curator = false, db = fakeDb(), userDb = fakeDb(), fetchSource, schemaMissing = false } = {}) {
  const wrapped = {
    calls: db.calls,
    rpc: db.rpc,
    from(table) {
      if (table === 'catalog_curators') {
        const b = db.from(table)
        const orig = b.maybeSingle
        b.maybeSingle = () => {
          db.calls.push({ table, op: 'curator-check' })
          if (schemaMissing) return Promise.resolve({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.catalog_curators' in the schema cache" } })
          return Promise.resolve({ data: curator ? { user_id: user } : null, error: null })
        }
        void orig
        return b
      }
      return db.from(table)
    },
  }
  return {
    getUser: async () => ({ user: user ? { id: user } : null, userClient: userDb }),
    admin: () => wrapped,
    rateLimit: () => true,
    fetchSource: fetchSource ?? (async () => { throw Object.assign(new Error('no fetch in this test'), { code: 'network_error' }) }),
  }
}

const post = (body, path = '/api/catalog/candidates') =>
  new Request(`https://aquaidp.test${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const PAYLOAD = {
  program: { name: 'Example Program', organization: 'Example Org', kind: 'accelerator', apply_url: 'https://program.example.org/apply' },
  cycle: { name: 'Spring 2027', closes_at: '2027-05-01T17:00:00-04:00', timezone: 'America/New_York' },
  evidence: { deadline_quote: 'Deadline: May 1, 2027 5pm ET' },
  questions: [{ asked_as: 'What problem are you solving? (max 250 words)', order_index: 1, word_limit: 250 }],
  source_refs: [{ url: 'https://program.example.org/apply', kind: 'application_form' }],
}

// ---------- W2 guarded fetch over a fake transport ----------
const PAGE = '<html><head><title>Example Program — Apply</title></head><body><h1>Example Program</h1><p>Deadline: May 1, 2027 5pm ET</p>' +
  '<label for=a>What problem are you solving? (max 250 words)</label><textarea id=a>my private draft answer about my startup</textarea></body></html>'
function guardedFetch(routes, dns = {}) {
  const resolve = async (h) => (h in dns ? dns[h] : ['93.184.216.34'])
  const fetch = async (url) => {
    const r = routes[url]
    if (!r) return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } })
    return new Response(r.body, { status: 200, headers: r.headers ?? { 'content-type': 'text/html; charset=utf-8' } })
  }
  return (url) => fetchPublicApplication(url, { resolve, fetch, now: () => new Date('2026-10-22T12:00:00Z') })
}

const submitResponder = (st) => {
  if (st.table === 'rpc:catalog_submit_candidate') {
    return { data: { id: CAND, state: st.payload.p_auto_extract ? 'extracted' : 'candidate', submitted_at: '2026-10-22T12:00:00Z', source_id: SRC }, error: null }
  }
  return null
}
// L8: the source row travels inside the single atomic submit RPC
const submittedSource = (db) => rpcs(db, 'catalog_submit_candidate')[0]?.payload.p_source

// ================= submit =================
test('submit: 401 without a user; 503 catalog_promotion_unavailable before 058', async () => {
  assert.equal((await handleSubmit(post({}), deps({ user: null }))).status, 401)
  const r = await handleSubmit(post({ payload: PAYLOAD, source: { url: 'https://program.example.org/apply', capture_method: 'public_paste' } }), deps({ schemaMissing: true }))
  assert.equal(r.status, 503)
  assert.deepEqual(await r.json(), { error: 'catalog_promotion_unavailable' })
})

test('submit: private data is rejected with paths/codes only and nothing is written', async () => {
  const db = fakeDb(submitResponder)
  const bad = { ...PAYLOAD, eligibility: 'Questions? jane.founder@gmail.com' }
  const r = await handleSubmit(post({ payload: bad, source: { url: 'https://program.example.org/apply', capture_method: 'public_paste' } }), deps({ db }))
  assert.equal(r.status, 400)
  const body = await r.json()
  assert.ok(body.errors.some((e) => e.path === 'payload.eligibility' && e.code === 'private_data:email'))
  assert.ok(!JSON.stringify(body).includes('gmail'))
  assert.equal(writes(db).length, 0)
})

test('submit public_paste: client snapshot stored as client-supplied, auto-advance via the transition RPC', async () => {
  const db = fakeDb(submitResponder)
  const r = await handleSubmit(post({ payload: PAYLOAD, source: { url: 'https://program.example.org/apply', capture_method: 'public_paste', snapshot_text: 'pasted page text' } }), deps({ db }))
  assert.equal(r.status, 201)
  const body = await r.json()
  assert.equal(body.candidate.state, 'extracted')
  assert.equal(body.source.trust, 'client_supplied')
  const src = submittedSource(db)
  assert.equal(src.capture_method, 'public_paste')
  assert.equal(src.snapshot_text, 'pasted page text')
  assert.equal(src.fetched_at, undefined)
  const [sub] = rpcs(db, 'catalog_submit_candidate')
  assert.equal(sub.payload.p_auto_extract, true, 'auto-extract requested inside the atomic submit')
  assert.equal(sub.payload.p_submitted_by, USER)
  assert.equal(rpcs(db, 'catalog_transition_candidate').length, 0, 'no separate transition call')
  assert.equal(writes(db).length, 0, 'no direct table writes: one atomic RPC (L8)')
})

test('L8: submit is ONE atomic RPC; a database refusal leaves nothing half-written client-side', async () => {
  const db = fakeDb((st) => st.table === 'rpc:catalog_submit_candidate' ? { data: null, error: { code: '23514', message: 'check violation' } } : null)
  const r = await handleSubmit(post({ payload: PAYLOAD, source: { url: 'https://program.example.org/apply', capture_method: 'public_paste' } }), deps({ db }))
  assert.equal(r.status, 422)
  assert.equal(rpcs(db, 'catalog_submit_candidate').length, 1)
  assert.equal(writes(db).length, 0, 'no separate source insert that could be orphaned')
  const noQ = fakeDb(submitResponder)
  const r2 = await handleSubmit(post({ payload: { ...PAYLOAD, questions: [] }, source: { url: 'https://program.example.org/apply', capture_method: 'public_paste' } }), deps({ db: noQ }))
  assert.equal(r2.status, 201)
  assert.equal((await r2.json()).candidate.state, 'candidate')
  assert.equal(rpcs(noQ, 'catalog_submit_candidate')[0].payload.p_auto_extract, false)
})

test('M1: submit url_fetch at the outbound concurrency cap answers 503 busy and writes nothing', async () => {
  const db = fakeDb(submitResponder)
  const fetchSource = async () => { throw Object.assign(new Error('busy'), { code: 'busy' }) }
  const r = await handleSubmit(post({ payload: PAYLOAD, source: { url: 'https://program.example.org/apply', capture_method: 'url_fetch' } }), deps({ db, fetchSource }))
  assert.equal(r.status, 503)
  assert.deepEqual(await r.json(), { error: 'source_fetch_busy', code: 'busy' })
  assert.equal(db.calls.filter((c) => c.op === 'rpc').length, 0)
})

test('submit url_fetch: server fetches, ignores client snapshot, stores server-observed evidence (public text only)', async () => {
  const db = fakeDb(submitResponder)
  const fetchSource = guardedFetch({ 'https://program.example.org/apply': { body: PAGE }, 'https://program.example.org/robots.txt': { body: 'User-agent: *\nDisallow: /admin\n', headers: { 'content-type': 'text/plain' } } })
  const r = await handleSubmit(post({ payload: PAYLOAD, source: { url: 'https://program.example.org/apply', capture_method: 'url_fetch', snapshot_text: 'FORGED snapshot', final_url: 'https://forged.example.org/' } }), deps({ db, fetchSource }))
  assert.equal(r.status, 201, JSON.stringify(await r.clone().json()))
  assert.equal((await r.json()).source.trust, 'server_captured')
  const src = submittedSource(db)
  assert.equal(src.capture_method, 'url_fetch')
  assert.equal(src.final_url, 'https://program.example.org/apply')
  assert.equal(src.content_sha256, createHash('sha256').update(PAGE).digest('hex'))
  assert.equal(src.fetched_at, '2026-10-22T12:00:00.000Z')
  assert.equal(src.reuse, 'allowed')
  assert.equal(src.robots_disallow, false)
  assert.deepEqual(src.reuse_signals, ['robots.txt:allow'])
  assert.ok(!src.snapshot_text.includes('FORGED'))
  assert.ok(src.snapshot_text.includes('What problem are you solving? (max 250 words)'))
  assert.ok(!src.snapshot_text.includes('private draft answer'), 'filled values never enter the snapshot')
})

test('submit url_fetch: reuse disallowed (noai) and SSRF-blocked hosts are refused before any write', async () => {
  const db = fakeDb(submitResponder)
  const noai = PAGE.replace('<head>', '<head><meta name="robots" content="noai">')
  const r1 = await handleSubmit(post({ payload: PAYLOAD, source: { url: 'https://program.example.org/apply', capture_method: 'url_fetch' } }),
    deps({ db, fetchSource: guardedFetch({ 'https://program.example.org/apply': { body: noai } }) }))
  assert.equal(r1.status, 422)
  assert.equal((await r1.json()).error, 'source_reuse_disallowed')
  const r2 = await handleSubmit(post({ payload: PAYLOAD, source: { url: 'https://program.example.org/apply', capture_method: 'url_fetch' } }),
    deps({ db, fetchSource: guardedFetch({}, { 'program.example.org': ['10.0.0.7'] }) }))
  assert.equal(r2.status, 422)
  assert.deepEqual(await r2.json(), { error: 'source_fetch_failed', code: 'blocked_address' })
  assert.equal(writes(db).length, 0)
  assert.equal(rpcs(db, 'catalog_submit_candidate').length, 0)
})

test('submit url_fetch: the exact-wording check runs against the server snapshot', async () => {
  // Use what submit stored as the source facts for the check runner.
  const db = fakeDb(submitResponder)
  await handleSubmit(post({ payload: PAYLOAD, source: { url: 'https://program.example.org/apply', capture_method: 'url_fetch' } }),
    deps({ db, fetchSource: guardedFetch({ 'https://program.example.org/apply': { body: PAGE } }) }))
  const src = submittedSource(db)
  const { runChecks } = await import('../lib/catalog-promotion/checks.ts')
  const ok = runChecks({ payload: PAYLOAD, source: src, programs: [] })
  assert.equal(ok.source_trust, 'server_captured')
  assert.equal(ok.results.exact_wording_preserved.pass, true, ok.results.exact_wording_preserved.detail)
  assert.match(ok.results.exact_wording_preserved.detail, /server-captured/)
  const reworded = { ...PAYLOAD, questions: [{ asked_as: 'What problem do you solve?', order_index: 1 }] }
  assert.equal(runChecks({ payload: reworded, source: src, programs: [] }).results.exact_wording_preserved.pass, false)
  const pasted = runChecks({ payload: PAYLOAD, source: { ...src, capture_method: 'public_paste' }, programs: [] })
  assert.equal(pasted.source_trust, 'client_supplied')
  assert.match(pasted.results.exact_wording_preserved.detail, /lower trust/)
})

// ================= list =================
test('list: non-curators read through their own RLS client; curators through the service client', async () => {
  const admin = fakeDb(() => ({ data: [], error: null }))
  const userDb = fakeDb(() => ({ data: [{ id: CAND }], error: null }))
  const r = await handleList(new Request('https://aquaidp.test/api/catalog/candidates'), deps({ db: admin, userDb }))
  assert.deepEqual(await r.json(), { is_curator: false, candidates: [{ id: CAND }] })
  assert.ok(userDb.calls.some((c) => c.table === 'catalog_candidates' && c.filters.some(([k, v]) => k === 'submitted_by' && v === USER)))
  assert.ok(!admin.calls.some((c) => c.table === 'catalog_candidates'))
  const r2 = await handleList(new Request('https://aquaidp.test/api/catalog/candidates?state=bogus'), deps({ curator: true }))
  assert.equal(r2.status, 400)
})

// ================= transition =================
const candidateRow = (over = {}) => ({
  id: CAND, state: 'extracted', submitted_by: USER, submitted_at: '2026-10-22T12:00:00Z', updated_at: '2026-10-22T12:00:00Z',
  source_id: SRC, payload: PAYLOAD, checks: {}, program_match_id: null, published_revision_id: null, ...over,
})
function reviewResponder(row, source = { id: SRC, url: 'https://program.example.org/apply', capture_method: 'url_fetch', reuse: 'allowed', robots_disallow: false, verification_status: 'verified', snapshot_text: 'Deadline: May 1, 2027 5pm ET\nWhat problem are you solving? (max 250 words)' }, rpcResult = { data: { self_approved: false }, error: null }) {
  return (st) => {
    if (st.table === 'catalog_candidates' && st.op === 'select') return { data: row, error: null }
    if (st.table === 'catalog_sources' && st.op === 'select') return { data: source, error: null }
    if (st.table === 'programs' || st.table === 'program_template_revisions') return { data: [], error: null }
    if (st.table === 'program_questions') return { data: [{ archived_question: { id: CANON_Q, text: 'What problem are you solving? (max 250 words)' } }], error: null }
    if (st.op === 'rpc') return rpcResult
    return null
  }
}

test('transition: curators only (403), uuid-checked (404), illegal steps refused before the RPC (409)', async () => {
  assert.equal((await handleTransition(post({ to: 'matched' }), deps(), CAND)).status, 403)
  assert.equal((await handleTransition(post({ to: 'matched' }), deps({ curator: true }), 'nope')).status, 404)
  const db = fakeDb(reviewResponder(candidateRow({ state: 'candidate' })))
  const r = await handleTransition(post({ to: 'approved' }), deps({ curator: true, user: CURATOR, db }), CAND)
  assert.equal(r.status, 409)
  assert.equal(rpcs(db, 'catalog_transition_candidate').length, 0)
})

test('transition matched: ONE atomic RPC carries auto-match patch, curator mappings, checks and evidence; no direct writes', async () => {
  const db = fakeDb(reviewResponder(candidateRow()))
  const r = await handleTransition(post({ to: 'matched', source_review: { reuse: 'allowed' } }), deps({ curator: true, user: CURATOR, db }), CAND)
  assert.equal(r.status, 200, JSON.stringify(await r.clone().json()))
  assert.equal(writes(db).length, 0, 'every write goes through the RPC')
  const calls = rpcs(db, 'catalog_transition_candidate')
  assert.equal(calls.length, 1)
  const a = calls[0].payload
  assert.equal(a.to_state, 'matched')
  assert.equal(a.actor_id, CURATOR)
  assert.equal(a.actor_role, 'curator')
  assert.equal(a.payload_patch.questions[0].mapping.canonical_question_id, CANON_Q)
  assert.equal(a.payload_patch.questions[0].mapping.tier, 'exact')
  assert.equal(a.checks.source_trust, 'server_captured')
  assert.deepEqual(a.source_review, { reuse: 'allowed' })
  assert.equal(a.evidence.auto_matched, 1)
})

test('transition verified: failing checks -> 422 without calling the RPC; override with a note goes through', async () => {
  const row = candidateRow({ state: 'matched' })
  const weak = { id: SRC, url: 'https://program.example.org/apply', capture_method: 'public_paste', reuse: 'unknown', robots_disallow: null, verification_status: 'unverified', snapshot_text: '' }
  const db = fakeDb(reviewResponder(row, weak))
  const r = await handleTransition(post({ to: 'verified' }), deps({ curator: true, user: CURATOR, db }), CAND)
  assert.equal(r.status, 422)
  const body = await r.json()
  assert.equal(body.error, 'checks_failed')
  assert.ok(body.failing.includes('source_public_reusable'))
  assert.equal(rpcs(db, 'catalog_transition_candidate').length, 0)
  const db2 = fakeDb(reviewResponder(row, weak))
  const ok = await handleTransition(post({ to: 'verified', override: true, note: 'reuse confirmed with program staff by email' }), deps({ curator: true, user: CURATOR, db: db2 }), CAND)
  assert.equal(ok.status, 200)
  assert.equal(rpcs(db2, 'catalog_transition_candidate')[0].payload.evidence.override, true)
})

test('transition approved: self-approval allowed and surfaced; database refusals map to HTTP codes', async () => {
  const db = fakeDb(reviewResponder(candidateRow({ state: 'verified', submitted_by: CURATOR }), undefined, { data: { self_approved: true }, error: null }))
  const r = await handleTransition(post({ to: 'approved' }), deps({ curator: true, user: CURATOR, db }), CAND)
  assert.equal(r.status, 200)
  assert.equal((await r.json()).self_approved, true)
  const stale = fakeDb(reviewResponder(candidateRow({ state: 'verified' }), undefined, { data: null, error: { code: '40001', message: 'stale transition' } }))
  assert.equal((await handleTransition(post({ to: 'approved' }), deps({ curator: true, user: CURATOR, db: stale }), CAND)).status, 409)
  const frozen = fakeDb(reviewResponder(candidateRow({ state: 'verified' })))
  const f = await handleTransition(post({ to: 'approved', mappings: [{ index: 0, canonical_question_id: null }] }), deps({ curator: true, user: CURATOR, db: frozen }), CAND)
  assert.equal(f.status, 409, 'mapping overrides on a verified candidate are refused (payload frozen)')
  assert.equal((await f.json()).error, 'payload_frozen')
  assert.equal(rpcs(frozen, 'catalog_transition_candidate').length, 0)
})

// ================= publish =================
const FRESH_SRC = { id: SRC, url: 'https://program.example.org/apply', capture_method: 'url_fetch', reuse: 'allowed', robots_disallow: false, verification_status: 'verified', last_checked_at: '2026-10-22T12:00:00Z' }
function publishResponder({ source = FRESH_SRC, approvedEvent = null, rpcResult = { data: { program_slug: 'example-program', revision: 1 }, error: null } } = {}) {
  return (st) => {
    if (st.table === 'catalog_candidates') return { data: { id: CAND, state: 'approved', source_id: SRC }, error: null }
    if (st.table === 'catalog_sources') return { data: source, error: null }
    if (st.table === 'catalog_candidate_events') return { data: approvedEvent, error: null }
    if (st.op === 'rpc') return rpcResult
    return null
  }
}

test('publish: curator only; one RPC with (candidate_id, curator_id); 55000 -> 409 not_approved', async () => {
  assert.equal((await handlePublish(post({}), deps(), CAND)).status, 403)
  const db = fakeDb(publishResponder())
  const r = await handlePublish(post({}), deps({ curator: true, user: CURATOR, db }), CAND)
  assert.equal(r.status, 200)
  assert.deepEqual(rpcs(db, 'catalog_publish_candidate')[0].payload, { candidate_id: CAND, curator_id: CURATOR })
  const no = fakeDb(publishResponder({ rpcResult: { data: null, error: { code: '55000', message: 'candidate is verified, must be approved' } } }))
  const r2 = await handlePublish(post({}), deps({ curator: true, user: CURATOR, db: no }), CAND)
  assert.equal(r2.status, 409)
  assert.deepEqual(await r2.json(), { error: 'not_approved' })
})

// ================= recheck =================
function recheckResponder(source) {
  return (st) => {
    if (st.table === 'catalog_candidates') return { data: { id: CAND, source_id: SRC }, error: null }
    if (st.table === 'catalog_sources' && st.op === 'select') return { data: source, error: null }
    return null
  }
}

test('recheck: unchanged content keeps status; changed -> stale; fetch failure -> failed; noai -> reuse disallowed', async () => {
  const sha = createHash('sha256').update(PAGE).digest('hex')
  const base = { id: SRC, url: 'https://program.example.org/apply', capture_method: 'url_fetch', content_sha256: sha, verification_status: 'verified' }
  const now = () => new Date('2026-11-01T00:00:00Z')
  const run = async (fetchSource, src = base) => {
    const db = fakeDb(recheckResponder(src))
    const r = await handleRecheckSource(post({}), deps({ curator: true, user: CURATOR, db, fetchSource }), CAND, now)
    return { r, body: await r.json(), update: writes(db).find((c) => c.table === 'catalog_sources' && c.op === 'update')?.payload }
  }
  const same = await run(guardedFetch({ 'https://program.example.org/apply': { body: PAGE } }))
  assert.equal(same.update.verification_status, 'verified')
  assert.equal(same.update.last_check.changed, false)
  assert.equal(same.update.last_checked_at, '2026-11-01T00:00:00.000Z')
  const changed = await run(guardedFetch({ 'https://program.example.org/apply': { body: PAGE.replace('250', '300') } }))
  assert.equal(changed.update.verification_status, 'stale')
  assert.equal(changed.update.last_check.changed, true)
  assert.equal(changed.update.snapshot_text, undefined, 'evidence is never overwritten')
  const failed = await run(guardedFetch({}, { 'program.example.org': ['127.0.0.1'] }))
  assert.equal(failed.update.verification_status, 'failed')
  assert.equal(failed.update.last_check.code, 'blocked_address')
  const noai = await run(guardedFetch({ 'https://program.example.org/apply': { body: PAGE.replace('<head>', '<head><meta name="robots" content="noai">') } }))
  assert.equal(noai.update.reuse, 'disallowed')
  assert.equal(noai.update.verification_status, 'failed')
  const pasted = await run(guardedFetch({}), { ...base, capture_method: 'public_paste' })
  assert.equal(pasted.r.status, 409)
  assert.equal(pasted.body.error, 'recheck_requires_url_fetch')
})

test('M1: recheck at the outbound concurrency cap answers 503 and records NO failed check', async () => {
  const sha = createHash('sha256').update(PAGE).digest('hex')
  const db = fakeDb(recheckResponder({ id: SRC, url: 'https://program.example.org/apply', capture_method: 'url_fetch', content_sha256: sha, verification_status: 'verified' }))
  const fetchSource = async () => { throw Object.assign(new Error('busy'), { code: 'busy' }) }
  const r = await handleRecheckSource(post({}), deps({ curator: true, user: CURATOR, db, fetchSource }), CAND)
  assert.equal(r.status, 503)
  assert.equal((await r.json()).error, 'source_fetch_busy')
  assert.equal(writes(db).length, 0, 'a local busy refusal says nothing about the source')
})


// ================= M09 review M5: submitter mappings are suggestions only =================
const OTHER_Q = '44444444-4444-4444-8444-444444444444'

test('M5: submit stores submitter mappings as submitter_suggested, never as a canonical mapping', async () => {
  const db = fakeDb(submitResponder)
  const payload = { ...PAYLOAD, questions: [{ ...PAYLOAD.questions[0], mapping: { canonical_question_id: OTHER_Q, tier: 'exact', confidence: 1, origin: 'auto_match' } }] }
  const r = await handleSubmit(post({ payload, source: { url: 'https://program.example.org/apply', capture_method: 'public_paste', snapshot_text: 'x' } }), deps({ db }))
  assert.equal(r.status, 201)
  const stored = rpcs(db, 'catalog_submit_candidate')[0].payload.p_payload
  assert.equal(stored.questions[0].mapping, undefined, 'no canonical mapping is stored from a submitter')
  assert.deepEqual(stored.questions[0].suggested_mapping, { canonical_question_id: OTHER_Q, tier: 'exact', confidence: 1, decision: 'submitter_suggested' })
})

test('M5: at matched, a stored submitter mapping is demoted and cannot block AQUA\'s own match', async () => {
  // a pre-fix row: the submitter mapped the question to an unrelated canonical question as "exact"
  const legacy = { ...PAYLOAD, questions: [{ ...PAYLOAD.questions[0], mapping: { canonical_question_id: OTHER_Q, tier: 'exact' } }] }
  const db = fakeDb(reviewResponder(candidateRow({ payload: legacy })))
  const r = await handleTransition(post({ to: 'matched' }), deps({ curator: true, user: CURATOR, db }), CAND)
  assert.equal(r.status, 200, JSON.stringify(await r.clone().json()))
  const a = rpcs(db, 'catalog_transition_candidate')[0].payload
  const q = a.payload_patch.questions[0]
  assert.equal(q.mapping.canonical_question_id, CANON_Q, 'the real exact match wins')
  assert.equal(q.mapping.origin, 'auto_match')
  assert.equal(q.suggested_mapping.canonical_question_id, OTHER_Q)
  assert.equal(q.suggested_mapping.decision, 'submitter_suggested')
  assert.equal(a.evidence.suggestions_demoted, 1)
})

test('M5: a suggestion with no real match stays a suggestion until a curator override confirms it', async () => {
  const suggested = { ...PAYLOAD, questions: [{ ...PAYLOAD.questions[0], asked_as: 'Something nobody else asks', suggested_mapping: { canonical_question_id: OTHER_Q, tier: 'exact', decision: 'submitter_suggested' } }] }
  const db = fakeDb(reviewResponder(candidateRow({ payload: suggested })))
  const r = await handleTransition(post({ to: 'matched' }), deps({ curator: true, user: CURATOR, db }), CAND)
  assert.equal(r.status, 200)
  const a = rpcs(db, 'catalog_transition_candidate')[0].payload
  assert.equal(a.payload_patch, null, 'nothing to patch: no canonical mapping was created')
  // the curator confirms it explicitly
  const db2 = fakeDb(reviewResponder(candidateRow({ payload: suggested })))
  const ok = await handleTransition(post({ to: 'matched', mappings: [{ index: 0, canonical_question_id: OTHER_Q, tier: 'curator' }] }), deps({ curator: true, user: CURATOR, db: db2 }), CAND)
  assert.equal(ok.status, 200)
  assert.deepEqual(rpcs(db2, 'catalog_transition_candidate')[0].payload.mappings, [{ index: 0, canonical_question_id: OTHER_Q, tier: 'curator' }])
})

// ================= M09 review M6: stale / failed / disallowed sources =================
const SNAP = 'Deadline: May 1, 2027 5pm ET\nWhat problem are you solving? (max 250 words)'
const srcWith = (over) => ({ id: SRC, url: 'https://program.example.org/apply', capture_method: 'url_fetch', reuse: 'allowed', robots_disallow: false, verification_status: 'verified', snapshot_text: SNAP, ...over })

test('M6: approve is refused for a stale, failed, disallowed or robots-blocked source; an override with a note is recorded', async () => {
  for (const over of [{ verification_status: 'stale' }, { verification_status: 'failed' }, { reuse: 'disallowed' }, { robots_disallow: true }]) {
    const db = fakeDb(reviewResponder(candidateRow({ state: 'verified' }), srcWith(over)))
    const r = await handleTransition(post({ to: 'approved' }), deps({ curator: true, user: CURATOR, db }), CAND)
    assert.equal(r.status, 422, JSON.stringify(over))
    const body = await r.json()
    assert.equal(body.error, 'source_not_fresh')
    assert.ok(body.problems.length >= 1)
    assert.equal(rpcs(db, 'catalog_transition_candidate').length, 0)
    // override without a (long enough) note: still refused
    const db1 = fakeDb(reviewResponder(candidateRow({ state: 'verified' }), srcWith(over)))
    assert.equal((await handleTransition(post({ to: 'approved', override: true, note: 'ok' }), deps({ curator: true, user: CURATOR, db: db1 }), CAND)).status, 422)
    // explicit override with a note goes through and is recorded
    const db2 = fakeDb(reviewResponder(candidateRow({ state: 'verified' }), srcWith(over)))
    const ok = await handleTransition(post({ to: 'approved', override: true, note: 'program staff confirmed the page change is cosmetic' }), deps({ curator: true, user: CURATOR, db: db2 }), CAND)
    assert.equal(ok.status, 200)
    const a = rpcs(db2, 'catalog_transition_candidate')[0].payload
    assert.equal(a.evidence.source_override, true)
    assert.ok(a.evidence.source_problems.length >= 1)
    assert.match(a.note, /cosmetic/)
  }
  // a fresh source needs no override
  const fresh = fakeDb(reviewResponder(candidateRow({ state: 'verified' }), srcWith({})))
  assert.equal((await handleTransition(post({ to: 'approved' }), deps({ curator: true, user: CURATOR, db: fresh }), CAND)).status, 200)
})

test('M6: publish is refused when the source went stale/failed/disallowed, unless the approval recorded an override and nothing changed since', async () => {
  for (const over of [{ verification_status: 'stale' }, { verification_status: 'failed' }, { reuse: 'disallowed' }, { robots_disallow: true }]) {
    const db = fakeDb(publishResponder({ source: { ...FRESH_SRC, ...over } }))
    const r = await handlePublish(post({}), deps({ curator: true, user: CURATOR, db }), CAND)
    assert.equal(r.status, 409, JSON.stringify(over))
    assert.equal((await r.json()).error, 'source_not_fresh')
    assert.equal(rpcs(db, 'catalog_publish_candidate').length, 0)
  }
  const approvedEvent = { to_state: 'approved', note: 'program staff confirmed the page change is cosmetic', evidence: { source_override: true }, at: '2026-10-22T13:00:00Z' }
  // override recorded at approve time, source not re-checked since → publish proceeds
  const ok = fakeDb(publishResponder({ source: { ...FRESH_SRC, verification_status: 'stale', last_checked_at: '2026-10-22T12:30:00Z' }, approvedEvent }))
  assert.equal((await handlePublish(post({}), deps({ curator: true, user: CURATOR, db: ok }), CAND)).status, 200)
  // source re-checked AFTER the override → refused again
  const later = fakeDb(publishResponder({ source: { ...FRESH_SRC, verification_status: 'failed', last_checked_at: '2026-10-22T14:00:00Z' }, approvedEvent }))
  const r2 = await handlePublish(post({}), deps({ curator: true, user: CURATOR, db: later }), CAND)
  assert.equal(r2.status, 409)
  assert.match((await r2.json()).reason, /re-checked after/)
  // a fresh curator override note (10+ characters) on the publish call goes to the RPC, which records it
  const withNote = fakeDb(publishResponder({ source: { ...FRESH_SRC, verification_status: 'stale' } }))
  assert.equal((await handlePublish(post({ note: 'stale flag is a false alarm, verified manually' }), deps({ curator: true, user: CURATOR, db: withNote }), CAND)).status, 200)
  assert.equal(rpcs(withNote, 'catalog_publish_candidate')[0].payload.note, 'stale flag is a false alarm, verified manually')
  const shortNote = fakeDb(publishResponder({ source: { ...FRESH_SRC, verification_status: 'stale' } }))
  assert.equal((await handlePublish(post({ note: 'short' }), deps({ curator: true, user: CURATOR, db: shortNote }), CAND)).status, 409)
  // an approval without an override (or without a note) does not count
  const noNote = fakeDb(publishResponder({ source: { ...FRESH_SRC, verification_status: 'stale', last_checked_at: '2026-10-22T12:30:00Z' }, approvedEvent: { ...approvedEvent, note: null } }))
  assert.equal((await handlePublish(post({}), deps({ curator: true, user: CURATOR, db: noNote }), CAND)).status, 409)
})

test('LOW: source_review that re-opens a closed source needs a note', async () => {
  const db = fakeDb(reviewResponder(candidateRow({ state: 'extracted' }), srcWith({ reuse: 'disallowed' })))
  const r = await handleTransition(post({ to: 'matched', source_review: { reuse: 'allowed' } }), deps({ curator: true, user: CURATOR, db }), CAND)
  assert.equal(r.status, 422)
  assert.equal((await r.json()).error, 'note_required')
  assert.equal(rpcs(db, 'catalog_transition_candidate').length, 0)
  const db2 = fakeDb(reviewResponder(candidateRow({ state: 'extracted' }), srcWith({ verification_status: 'stale' })))
  assert.equal((await handleTransition(post({ to: 'matched', source_review: { verification_status: 'verified' } }), deps({ curator: true, user: CURATOR, db: db2 }), CAND)).status, 422)
  const db3 = fakeDb(reviewResponder(candidateRow({ state: 'extracted' }), srcWith({ reuse: 'disallowed' })))
  const ok = await handleTransition(post({ to: 'matched', note: 'terms page updated to allow reuse', source_review: { reuse: 'allowed' } }), deps({ curator: true, user: CURATOR, db: db3 }), CAND)
  assert.equal(ok.status, 200)
})
