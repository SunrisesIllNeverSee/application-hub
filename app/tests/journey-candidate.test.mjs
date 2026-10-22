// M09 W6 — "Suggest for the public catalog": the server-built public
// candidate mapped onto W3's candidate schema (m09/catalog-promotion
// lib/catalog-promotion/schema.ts) and VALIDATED WITH W3's OWN VALIDATOR;
// private / uncertain / corrected wording never included; leaks refused;
// only public URLs with reuse not disallowed; 201 / 400 / 422 / 503.
// Synthetic data only. Run: node --test tests/journey-candidate.test.mjs
//
// W3's pure validator is loaded from the W3 branch at test time
// (`git show m09/catalog-promotion:…` into a temp dir under tests/, removed
// afterwards), or from lib/catalog-promotion/ once the branches are merged.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { extractApplication } from '../lib/catalog/extract.ts'
import { correctWording, modelFromLocalExtraction, modelFromUrlProposal, setProgramIdentity } from '../lib/journey/review-model.ts'
import { buildCandidateRequest, candidateEligibility, ianaTimeZone, submitCandidate } from '../lib/journey/candidate.ts'
import { DEV_JOURNEY_CATALOG, DEV_PASTE_TEXT, DEV_URL } from '../lib/journey/dev-fixture.ts'
import { extractUrlResponse } from './fixtures/journey-fixtures.mjs'

const T = '2026-10-22T12:00:00.000Z'
const here = dirname(fileURLToPath(import.meta.url))
const TMP = join(here, '.w3-contract-tmp')
let w3 = null

before(async () => {
  const merged = join(here, '..', 'lib', 'catalog-promotion', 'schema.ts')
  if (existsSync(merged)) { w3 = await import(pathToFileURL(merged).href); return }
  try {
    mkdirSync(TMP, { recursive: true })
    for (const f of ['schema.ts', 'privacy.ts']) {
      const src = execFileSync('git', ['show', `m09/catalog-promotion:app/lib/catalog-promotion/${f}`], { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      writeFileSync(join(TMP, f), src)
    }
    w3 = await import(pathToFileURL(join(TMP, 'schema.ts')).href)
  } catch {
    w3 = null
  }
})
after(() => rmSync(TMP, { recursive: true, force: true }))

/** Validate a request body exactly as W3's POST handler does. */
function w3Validate(body) {
  const errors = []
  for (const k of Object.keys(body)) if (k !== 'payload' && k !== 'source') errors.push({ path: k, code: 'unknown_key' })
  const p = w3.validateCandidatePayload(body.payload)
  if (!p.ok) errors.push(...p.errors.map((e) => ({ path: `payload.${e.path}`, code: e.code })))
  const s = w3.validateSourceInput(body.source, { curator: false })
  if (!s.ok) errors.push(...s.errors)
  return errors
}

// same synthetic catalog with UUID canonical ids (real catalog ids are UUIDs)
const UUID = { 'aq-problem': '11111111-1111-4111-8111-111111111111', 'aq-team': '22222222-2222-4222-8222-222222222222', 'aq-why-now': '33333333-3333-4333-8333-333333333333', 'aq-market': '44444444-4444-4444-8444-444444444444' }
const UUID_CATALOG = structuredClone(DEV_JOURNEY_CATALOG)
for (const p of UUID_CATALOG.programs) for (const q of p.questions) q.canonical_question_id = UUID[q.canonical_question_id]
const urlModel = (catalog = DEV_JOURNEY_CATALOG, reuse) => modelFromUrlProposal(extractUrlResponse({ catalog, ...(reuse ? { reuse } : {}) }), DEV_URL, T)

test('request body passes W3\'s validateCandidatePayload + validateSourceInput unchanged', (t) => {
  if (!w3) return t.skip('W3 validator not available (branch m09/catalog-promotion missing)')
  for (const catalog of [DEV_JOURNEY_CATALOG, UUID_CATALOG]) {
    const r = buildCandidateRequest(urlModel(catalog), catalog)
    assert.equal(r.ok, true, JSON.stringify(r.reasons))
    const body = JSON.parse(JSON.stringify(r.body))
    assert.deepEqual(w3Validate(body), [])
    // W3 normalizes but must not need to change anything we send
    assert.deepEqual(w3.validateCandidatePayload(body.payload).value, body.payload)
  }
})

test('mapping: program.name/organization/kind/apply_url, cycle with IANA tz, exact wording, url_fetch source', () => {
  const res = extractUrlResponse({ catalog: UUID_CATALOG })
  const r = buildCandidateRequest(modelFromUrlProposal(res, DEV_URL, T), UUID_CATALOG)
  assert.equal(r.ok, true)
  const { payload, source } = r.body
  assert.deepEqual(Object.keys(r.body).sort(), ['payload', 'source'])
  assert.deepEqual(source, { url: DEV_URL, capture_method: 'url_fetch' }, 'server re-fetches; no client snapshot / final_url')
  assert.equal(payload.program.name, res.public_candidate.program.title)
  assert.equal(payload.program.organization, 'Example Ventures', 'from the public catalog match (page did not state it)')
  assert.equal(payload.program.kind, 'other')
  assert.equal(payload.program.apply_url, DEV_URL)
  assert.deepEqual(payload.cycle, { closes_at: '2027-03-01T23:59', timezone: 'America/Los_Angeles' })
  assert.equal(payload.evidence.deadline_quote, 'Applications close March 1, 2027 at 11:59 PM PT.')
  assert.deepEqual(payload.questions.map((q) => q.asked_as), res.public_candidate.questions.map((q) => q.asked_as), 'exact public wording')
  assert.equal(payload.questions[0].word_limit, 150)
  assert.equal(payload.questions[0].required, true)
  assert.equal(payload.questions[0].response_type, 'text_long')
  assert.equal(payload.questions[0].mapping.canonical_question_id, UUID['aq-problem'])
  const teamMapped = payload.questions.filter((q) => q.mapping?.canonical_question_id === UUID['aq-team'])
  assert.equal(teamMapped.length, 1, 'a canonical id is mapped once (W3 refuses duplicates)')
  for (const k of ['kind', 'version', 'status', 'requires_human_approval', 'deadlines', 'verification_notes']) assert.ok(!(k in payload), `${k} dropped`)
  assert.ok(!JSON.stringify(r.body).includes('founder@example.com'), 'filled value (private) excluded')
  assert.deepEqual(payload.source_refs, [{ url: DEV_URL, kind: 'application_form' }])
})

test('organization: page → catalog match → the name the user typed; missing → refused', () => {
  const m = urlModel()
  assert.equal(buildCandidateRequest(m).ok, false, 'no catalog and no organization')
  assert.ok(buildCandidateRequest(m).reasons.some((x) => /organization/.test(x)))
  const typed = buildCandidateRequest(setProgramIdentity(m, { organization: 'Example Ventures' }, T))
  assert.equal(typed.ok, true)
  assert.equal(typed.body.payload.program.organization, 'Example Ventures')
})

test('user corrections stay private: a corrected wording that leaked into the candidate refuses', () => {
  let m = urlModel()
  m = correctWording(m, 'q0', 'What problem are you solving for small clinics?', T)
  const ok = buildCandidateRequest(m, DEV_JOURNEY_CATALOG)
  assert.equal(ok.ok, true)
  assert.ok(!JSON.stringify(ok.body).includes('small clinics'), 'correction not added')
  const leaked = structuredClone(m)
  leaked.public_candidate.questions[0].asked_as = 'What problem are you solving for small clinics?'
  const r = buildCandidateRequest(leaked, DEV_JOURNEY_CATALOG)
  assert.equal(r.ok, false)
  assert.ok(r.reasons.some((x) => /correction would leak/.test(x)))
})

test('uncertain and private items refuse if they reappear; PII refuses; token params are stripped', () => {
  const m = urlModel()
  const u = structuredClone(m)
  u.uncertain = [{ kind: 'program.description', value: 'We built this program for our own portfolio companies', reasons: ['first-person'] }]
  u.public_candidate.program.description = 'We built this program for our own portfolio companies'
  assert.ok(buildCandidateRequest(u, DEV_JOURNEY_CATALOG).reasons.some((x) => /uncertain/.test(x)))
  const p = structuredClone(m)
  p.public_candidate.questions[1].asked_as = 'Email the founder at someone@example.com'
  assert.ok(buildCandidateRequest(p, DEV_JOURNEY_CATALOG).reasons.some((x) => x === 'pii:email'))
  const k = structuredClone(m)
  k.public_candidate.source_refs[0].url = 'https://accelerator.example.org/apply?api_key=sk-ant-abcdefghijklmnopqrstuv'
  const kr = buildCandidateRequest(k, DEV_JOURNEY_CATALOG)
  assert.ok(!kr.ok || !JSON.stringify(kr.body).includes('sk-ant-'), 'secret never sent')
  const pq = structuredClone(m)
  pq.questions[3] = { ...pq.questions[3], visibility: 'private' }
  assert.ok(buildCandidateRequest(pq, DEV_JOURNEY_CATALOG).reasons.some((x) => /withheld private question/.test(x)))
})

test('eligibility: local imports, disallowed reuse and refused candidates are never offered', () => {
  const local = modelFromLocalExtraction(extractApplication({ content: DEV_PASTE_TEXT }), { kind: 'paste', now: T })
  assert.equal(candidateEligibility(local).eligible, false)
  assert.equal(buildCandidateRequest(local).ok, false)
  assert.equal(candidateEligibility(urlModel(DEV_JOURNEY_CATALOG, 'disallowed')).eligible, false)
  const refused = modelFromUrlProposal({ ...extractUrlResponse(), public_candidate: null, public_candidate_refused: ['pii:email'] }, DEV_URL, T)
  const e = candidateEligibility(refused)
  assert.equal(e.eligible, false)
  assert.ok(e.reasons.some((r) => /pii:email/.test(r)))
})

test('time zones: page abbreviations map to IANA; unknown is omitted', () => {
  assert.equal(ianaTimeZone('PT'), 'America/Los_Angeles')
  assert.equal(ianaTimeZone('ET'), 'America/New_York')
  assert.equal(ianaTimeZone('UTC'), 'UTC')
  assert.equal(ianaTimeZone('Europe/Paris'), 'Europe/Paris')
  assert.equal(ianaTimeZone('AoE'), null)
})

test('submit: 201 ok, 400 errors, 422 reuse/fetch, 503 "open soon", network failure honest', async () => {
  const body = buildCandidateRequest(urlModel(), DEV_JOURNEY_CATALOG).body
  let sent
  const ok = await submitCandidate(body, async (u, init) => { sent = [u, JSON.parse(init.body)]; return new Response(JSON.stringify({ candidate: { id: 'cand-1', state: 'extracted', submitted_at: T, source_id: 'src-1' } }), { status: 201 }) })
  assert.deepEqual(ok, { ok: true, candidate_id: 'cand-1', state: 'extracted' })
  assert.equal(sent[0], '/api/catalog/candidates')
  assert.deepEqual(sent[1], JSON.parse(JSON.stringify(body)), 'exactly the shown (serialized) body is posted')
  const bad = await submitCandidate(body, async () => new Response(JSON.stringify({ error: 'invalid_candidate', errors: [{ path: 'payload.program.name', code: 'required' }] }), { status: 400 }))
  assert.equal(bad.code, 'invalid'); assert.equal(bad.errors[0].code, 'required')
  const reuse = await submitCandidate(body, async () => new Response(JSON.stringify({ error: 'source_reuse_disallowed' }), { status: 422 }))
  assert.equal(reuse.code, 'reuse_disallowed')
  const fetchFail = await submitCandidate(body, async () => new Response(JSON.stringify({ error: 'source_fetch_failed', code: 'timeout' }), { status: 422 }))
  assert.equal(fetchFail.code, 'source_fetch_failed')
  const soon = await submitCandidate(body, async () => new Response(JSON.stringify({ error: 'catalog_promotion_unavailable' }), { status: 503 }))
  assert.equal(soon.code, 'unavailable'); assert.match(soon.message, /open soon/)
  const net = await submitCandidate(body, async () => { throw new TypeError('offline') })
  assert.equal(net.code, 'network_error')
})
