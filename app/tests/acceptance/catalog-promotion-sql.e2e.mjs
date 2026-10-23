// M09 W9 — AT02 + AT17 end to end: the REAL /api/catalog/candidates* route
// handlers (lib/catalog-promotion/handlers.ts) driven against a LOCAL
// throwaway Postgres with migration 058 applied (same load order as
// supabase/tests/m09/run_local.sh). Only the PostgREST HTTP hop is replaced
// (tests/acceptance/sql-supabase.mjs): the service client runs as
// service_role, the user client as authenticated with RLS, so grants, RLS,
// triggers and the 058 RPCs decide every outcome.
//
//   M09_E2E_PGROOT=<scratch> node --test tests/acceptance/catalog-promotion-sql.e2e.mjs
// Skips (does not pass) when initdb/pg_ctl/psql are not installed.
// Never connects to Supabase. All data synthetic (example.org / example.test).

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleSubmit, handleList, handleTransition, handlePublish } from '../../lib/catalog-promotion/handlers.ts'
import { fetchPublicApplication } from '../../lib/catalog/fetch-public.ts'
import { sqlClient, sqlAs } from './sql-supabase.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(here, '..', '..', '..')
const MIG = path.join(REPO, 'supabase', 'migrations')
const P0 = path.join(REPO, 'supabase', 'tests', 'p0')
const ROOT = process.env.M09_E2E_PGROOT ?? fs.mkdtempSync(path.join(os.tmpdir(), 'aqua-m09-e2e-'))
const PGDATA = path.join(ROOT, 'data')
const PORT = Number(process.env.M09_E2E_PGPORT ?? 54338)
const conn = { host: '127.0.0.1', port: PORT, user: 'postgres', db: 'm09e2e' }
const HAVE_PG = ['initdb', 'pg_ctl', 'psql'].every((b) => spawnSync('which', [b]).status === 0)

const SUBMITTER = '00000000-0000-4000-8000-0000000000e1'
const CURATOR = '00000000-0000-4000-8000-0000000000e2'
const STRANGER = '00000000-0000-4000-8000-0000000000e3'

const ADMIN_LOG = []
const admin = () => sqlClient(conn, { role: 'service_role' }, ADMIN_LOG)
const userClient = (uid) => sqlClient(conn, { role: 'authenticated', uid })
const deps = (uid, extra = {}) => ({
  getUser: async () => ({ user: uid ? { id: uid } : null, userClient: userClient(uid) }),
  admin,
  rateLimit: () => true,
  fetchSource: async () => { throw Object.assign(new Error('no network in this test'), { code: 'network_error' }) },
  ...extra,
})
const post = (p, body) => new Request(`https://aquaidp.test${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const get = (p) => new Request(`https://aquaidp.test${p}`)
const q = (sql) => sqlAs(conn, { role: 'postgres' }, sql)

const APPLY_URL = 'https://harborlight.example.org/apply'
const PAYLOAD = {
  program: { name: 'Harborlight Synthetic Fellowship', organization: 'Example Harborlight Foundation', kind: 'fellowship', apply_url: APPLY_URL },
  cycle: { name: 'Spring 2027', closes_at: '2027-02-15T17:00:00-08:00', timezone: 'America/Los_Angeles' },
  evidence: { deadline_quote: 'Deadline: February 15, 2027 5pm PT' },
  questions: [
    { asked_as: 'How far along are you?', order_index: 1 },
    { asked_as: 'Describe one measurable result from the last 12 months. (100 words max)', order_index: 2, word_limit: 100 },
  ],
  source_refs: [{ url: APPLY_URL, kind: 'application_form' }],
}
const SNAPSHOT = 'Harborlight Synthetic Fellowship — Spring 2027. Deadline: February 15, 2027 5pm PT. How far along are you? Describe one measurable result from the last 12 months. (100 words max)'
const PAGE = `<html><head><title>Harborlight Synthetic Fellowship</title></head><body><h1>Harborlight Synthetic Fellowship</h1><p>Deadline: February 15, 2027 5pm PT</p>
<label for=a>How far along are you?</label><textarea id=a>my private synthetic draft answer</textarea>
<label for=b>Describe one measurable result from the last 12 months. (100 words max)</label><textarea id=b></textarea></body></html>`
const fakeFetch = (pages) => (url) => fetchPublicApplication(url, {
  resolve: async () => ['93.184.216.34'],
  fetch: async (u) => (pages[u] ? new Response(pages[u].body, { status: 200, headers: pages[u].headers ?? { 'content-type': 'text/html; charset=utf-8' } }) : new Response('nf', { status: 404, headers: { 'content-type': 'text/plain' } })),
  now: () => new Date('2026-10-22T12:00:00Z'),
})

const state = (id) => q(`SELECT state FROM catalog_candidates WHERE id = '${id}'`)
const events = (id) => q(`SELECT coalesce(string_agg(from_state||'>'||to_state||':'||actor_role, ',' ORDER BY id), '') FROM catalog_candidate_events WHERE candidate_id = '${id}'`)
const programCount = () => Number(q(`SELECT count(*) FROM programs WHERE name = 'Harborlight Synthetic Fellowship'`))
const anonCanSeeProgram = () => sqlAs(conn, { role: 'anon' }, `SELECT count(*) FROM programs WHERE name = 'Harborlight Synthetic Fellowship' AND source = 'canonical'`)

before(() => {
  if (!HAVE_PG) return
  fs.mkdirSync(ROOT, { recursive: true })
  if (!fs.existsSync(PGDATA)) execFileSync('initdb', ['-D', PGDATA, '-U', 'postgres', '-A', 'trust', '--no-locale', '-E', 'UTF8'], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', PGDATA, '-o', `-p ${PORT} -c listen_addresses=127.0.0.1 -c unix_socket_directories=''`, '-l', path.join(ROOT, 'server.log'), '-w', 'start'], { stdio: 'ignore' })
  execFileSync('psql', ['-X', '-q', '-h', conn.host, '-p', String(PORT), '-U', 'postgres', '-d', 'postgres', '-c', 'DROP DATABASE IF EXISTS m09e2e', '-c', 'CREATE DATABASE m09e2e'], { stdio: 'ignore' })
  const m058 = fs.readdirSync(MIG).find((f) => f.endsWith('_058_catalog_provenance_promotion.sql'))
  // production load order (mirrors supabase/tests/m09/run_local.sh)
  for (const f of [path.join(P0, '00_bootstrap.sql'), path.join(P0, '01_schema_live_baseline.sql'), path.join(MIG, '053_canonical_promotion.sql'),
    path.join(P0, '02_seed_synthetic.sql'), path.join(P0, '03_harness.sql'), path.join(MIG, '054_canonical_write_boundary.sql'),
    path.join(MIG, '055_team_invite_acceptance.sql'), path.join(MIG, '039_program_cycles.sql'), path.join(MIG, m058)]) {
    execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-h', conn.host, '-p', String(PORT), '-U', 'postgres', '-d', conn.db, '-f', f], { stdio: ['ignore', 'ignore', 'ignore'] })
  }
  // synthetic actors; the curator grant is an OWNER action (superuser), never reachable from a client role
  q(`INSERT INTO auth.users (id, aud, role, email, email_confirmed_at) VALUES
     ('${SUBMITTER}','authenticated','authenticated','submitter@example.test', now()),
     ('${CURATOR}','authenticated','authenticated','curator@example.test', now()),
     ('${STRANGER}','authenticated','authenticated','stranger@example.test', now());
     INSERT INTO catalog_curators (user_id, granted_by, note) VALUES ('${CURATOR}', NULL, 'acceptance curator (owner grant)');
     SELECT 1`)
})
after(() => {
  if (!HAVE_PG) return
  spawnSync('pg_ctl', ['-D', PGDATA, '-m', 'fast', 'stop'], { stdio: 'ignore' })
  if (!process.env.M09_E2E_PGROOT) fs.rmSync(ROOT, { recursive: true, force: true })
})

const ids = {}

test('AT02: a submitted public application is staged (extracted), never published, invisible to anon', { skip: !HAVE_PG && 'local Postgres not installed' }, async () => {
  const before = programCount()
  const r = await handleSubmit(post('/api/catalog/candidates', { payload: PAYLOAD, source: { url: APPLY_URL, capture_method: 'public_paste', snapshot_text: SNAPSHOT } }), deps(SUBMITTER))
  const body = await r.json()
  assert.equal(r.status, 201, JSON.stringify(body))
  assert.equal(body.candidate.state, 'extracted')
  assert.equal(body.source.trust, 'client_supplied')
  ids.paste = body.candidate.id
  assert.equal(state(ids.paste), 'extracted')
  assert.equal(events(ids.paste), 'candidate>extracted:system')
  assert.equal(programCount(), before, 'no program row is created by a submission')
  assert.equal(anonCanSeeProgram(), '0')
  assert.throws(() => sqlAs(conn, { role: 'anon' }, 'SELECT count(*) FROM catalog_candidates'), /42501/, 'anon has no read path to candidates')
  // the submitter sees only their own candidate through RLS; a stranger sees none
  const mine = await (await handleList(get('/api/catalog/candidates'), deps(SUBMITTER))).json()
  assert.equal(mine.is_curator, false)
  assert.deepEqual(mine.candidates.map((c) => c.id), [ids.paste])
  const theirs = await (await handleList(get('/api/catalog/candidates'), deps(STRANGER))).json()
  assert.equal(theirs.candidates.length, 0)
})

test('AT02: url_fetch submission stores SERVER-captured evidence; filled values never enter the snapshot', { skip: !HAVE_PG && 'local Postgres not installed' }, async () => {
  const fetchSource = fakeFetch({ [APPLY_URL]: { body: PAGE }, 'https://harborlight.example.org/robots.txt': { body: 'User-agent: *\nDisallow: /admin\n', headers: { 'content-type': 'text/plain' } } })
  const r = await handleSubmit(post('/api/catalog/candidates', { payload: PAYLOAD, source: { url: APPLY_URL, capture_method: 'url_fetch', snapshot_text: 'FORGED client snapshot' } }), deps(SUBMITTER, { fetchSource }))
  const body = await r.json()
  assert.equal(r.status, 201, JSON.stringify(body))
  assert.equal(body.source.trust, 'server_captured')
  ids.fetched = body.candidate.id
  const src = JSON.parse(q(`SELECT to_jsonb(s)::text FROM catalog_sources s JOIN catalog_candidates c ON c.source_id = s.id WHERE c.id = '${ids.fetched}'`))
  assert.equal(src.capture_method, 'url_fetch')
  assert.ok(src.fetched_at && src.content_sha256, 'server fetch fields recorded')
  assert.ok(!src.snapshot_text.includes('FORGED'), 'client snapshot ignored for url_fetch')
  assert.ok(!src.snapshot_text.includes('private synthetic draft'), 'filled form values never stored')
  assert.equal(state(ids.fetched), 'extracted')
})

test('AT02/AT22: a private-data submission is refused with nothing written', { skip: !HAVE_PG && 'local Postgres not installed' }, async () => {
  const n = q('SELECT (SELECT count(*) FROM catalog_candidates)||\'/\'||(SELECT count(*) FROM catalog_sources)')
  const bad = structuredClone(PAYLOAD)
  bad.questions[0].asked_as = 'Email me at founder.synthetic@example.org with your answer'
  const r = await handleSubmit(post('/api/catalog/candidates', { payload: bad, source: { url: APPLY_URL, capture_method: 'public_paste', snapshot_text: SNAPSHOT } }), deps(SUBMITTER))
  assert.equal(r.status, 400)
  const txt = await r.text()
  assert.ok(!txt.includes('founder.synthetic@example.org'), 'the refused value is not echoed')
  assert.equal(q('SELECT (SELECT count(*) FROM catalog_candidates)||\'/\'||(SELECT count(*) FROM catalog_sources)'), n, 'no candidate and no source row')
})

test('AT17: only curators may review or publish; client roles cannot call the publish RPC at all', { skip: !HAVE_PG && 'local Postgres not installed' }, async () => {
  for (const uid of [SUBMITTER, STRANGER]) {
    assert.equal((await handleTransition(post(`/x/${ids.paste}/transition`, { to: 'matched' }), deps(uid), ids.paste)).status, 403)
    assert.equal((await handlePublish(post(`/x/${ids.paste}/publish`, {}), deps(uid), ids.paste)).status, 403)
  }
  assert.equal((await handlePublish(post(`/x/${ids.paste}/publish`, {}), deps(null), ids.paste)).status, 401)
  // bypassing the route: a signed-in client calling the RPC directly is refused by Postgres grants
  const direct = await userClient(SUBMITTER).rpc('catalog_publish_candidate', { candidate_id: ids.paste, curator_id: CURATOR })
  assert.equal(direct.error?.code, '42501')
  assert.throws(() => sqlAs(conn, { role: 'authenticated', uid: SUBMITTER }, `UPDATE catalog_candidates SET state = 'approved' WHERE id = '${ids.paste}'`), /42501/)
  assert.equal(state(ids.paste), 'extracted', 'nothing moved')
})

test('AT17: publish needs approval; verification needs passing checks (source reuse affirmed) or a noted override', { skip: !HAVE_PG && 'local Postgres not installed' }, async () => {
  // publish before approval → refused by the database (not_approved)
  const early = await handlePublish(post(`/x/${ids.paste}/publish`, {}), deps(CURATOR), ids.paste)
  assert.equal(early.status, 409, JSON.stringify(await early.clone().json()))
  // matched: auto-match against the real canonical index in Postgres
  const m = await handleTransition(post(`/x/${ids.paste}/transition`, { to: 'matched' }), deps(CURATOR), ids.paste)
  const mb = await m.json()
  assert.equal(m.status, 200, JSON.stringify(mb))
  assert.equal(state(ids.paste), 'matched')
  const mapping = JSON.parse(q(`SELECT (payload->'questions'->0->'mapping')::text FROM catalog_candidates WHERE id = '${ids.paste}'`))
  assert.ok(mapping?.canonical_question_id, 'exact wording linked to an existing canonical question')
  // verified without a reviewed source → checks fail → 422, state unchanged
  const v1 = await handleTransition(post(`/x/${ids.paste}/transition`, { to: 'verified' }), deps(CURATOR), ids.paste)
  const v1b = await v1.json()
  assert.equal(v1.status, 422, JSON.stringify(v1b))
  assert.ok(v1b.failing.includes('source_public_reusable'))
  assert.equal(state(ids.paste), 'matched')
  // curator reviews the source (reuse allowed, verified) → checks pass → verified
  const v2 = await handleTransition(post(`/x/${ids.paste}/transition`, { to: 'verified', source_review: { reuse: 'allowed', verification_status: 'verified', robots_disallow: false } }), deps(CURATOR), ids.paste)
  const v2b = await v2.json()
  assert.equal(v2.status, 200, JSON.stringify(v2b))
  assert.equal(v2b.checks.all_passed, true)
  assert.equal(state(ids.paste), 'verified')
  assert.equal(q(`SELECT verification_status||'/'||reuse FROM catalog_sources s JOIN catalog_candidates c ON c.source_id = s.id WHERE c.id = '${ids.paste}'`), 'verified/allowed')
  // still not publishable until approved
  assert.equal((await handlePublish(post(`/x/${ids.paste}/publish`, {}), deps(CURATOR), ids.paste)).status, 409)
  const a = await handleTransition(post(`/x/${ids.paste}/transition`, { to: 'approved', note: 'synthetic acceptance approval' }), deps(CURATOR), ids.paste)
  const ab = await a.json()
  assert.equal(a.status, 200, JSON.stringify(ab))
  assert.equal(ab.self_approved, false, 'curator is not the submitter')
  assert.equal(anonCanSeeProgram(), '0', 'approved is still not public')
})

test('AT17: curator publish creates the canonical program in one RPC; anon then reads it; terminal afterwards', { skip: !HAVE_PG && 'local Postgres not installed' }, async () => {
  const p = await handlePublish(post(`/x/${ids.paste}/publish`, {}), deps(CURATOR), ids.paste)
  const pb = await p.json()
  assert.equal(p.status, 200, JSON.stringify(pb))
  assert.equal(state(ids.paste), 'published')
  assert.equal(anonCanSeeProgram(), '1')
  assert.equal(events(ids.paste), 'candidate>extracted:system,extracted>matched:curator,matched>verified:curator,verified>approved:curator,approved>published:curator')
  assert.equal(q(`SELECT count(*) FROM program_template_revisions r JOIN programs p ON p.id = r.program_id WHERE p.name = 'Harborlight Synthetic Fellowship'`), '1')
  assert.equal(q(`SELECT count(*) FROM program_questions pq JOIN programs p ON p.id = pq.program_id WHERE p.name = 'Harborlight Synthetic Fellowship'`), '2')
  const again = await handlePublish(post(`/x/${ids.paste}/publish`, {}), deps(CURATOR), ids.paste)
  assert.ok(again.status >= 400, 'a published candidate is terminal')
  // admin calls went through RPCs only (no direct table writes by the handlers except the recheck path)
  assert.equal(ADMIN_LOG.filter((c) => c.op === 'update').length, 0)
  assert.ok(ADMIN_LOG.some((c) => c.op === 'rpc' && c.table === 'catalog_publish_candidate'))
})

test('AT17: a url_fetch candidate whose source becomes reuse-disallowed cannot be verified or published', { skip: !HAVE_PG && 'local Postgres not installed' }, async () => {
  const id = ids.fetched
  assert.equal((await handleTransition(post(`/x/${id}/transition`, { to: 'matched' }), deps(CURATOR), id)).status, 200)
  const v = await handleTransition(post(`/x/${id}/transition`, { to: 'verified', source_review: { reuse: 'disallowed' } }), deps(CURATOR), id)
  const vb = await v.json()
  assert.equal(v.status, 422, JSON.stringify(vb))
  assert.ok(vb.failing.includes('source_public_reusable'))
  assert.equal(state(id), 'matched')
  // even an owner-side force to approved cannot publish a disallowed source (database rule, CP-E-5 shape)
  q(`UPDATE catalog_sources SET reuse = 'disallowed' FROM catalog_candidates c WHERE c.source_id = catalog_sources.id AND c.id = '${id}'; SELECT 1`)
  const p = await handlePublish(post(`/x/${id}/publish`, {}), deps(CURATOR), id)
  assert.ok(p.status >= 400)
  assert.notEqual(state(id), 'published')
})
