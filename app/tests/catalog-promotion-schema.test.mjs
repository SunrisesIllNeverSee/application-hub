// M09 W3: strict candidate schema + private-data rejection.
// Run: node --test tests/catalog-promotion-schema.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateCandidatePayload, validateSourceInput, LIMITS } from '../lib/catalog-promotion/schema.ts'
import { scanText, checkPublicUrl, isPrivateHost, looksLikeAnswer } from '../lib/catalog-promotion/privacy.ts'

const base = () => ({
  program: {
    name: 'Northwind Accelerator — Spring 2027',
    organization: 'Northwind Ventures',
    kind: 'accelerator',
    apply_url: 'https://apply.northwind.vc/spring-2027',
    url: 'https://northwind.vc',
  },
  cycle: { name: 'Spring 2027', closes_at: '2027-03-01T23:59:00Z', timezone: 'America/Los_Angeles' },
  questions: [
    { asked_as: 'What problem are you solving, and why now? Maximum 250 words.', order_index: 1, section: 'Company', required: true, word_limit: 250, response_type: 'text_long', time_context: 'now' },
    { asked_as: 'Link to your deck', order_index: 2, required: false, response_type: 'url' },
  ],
  source_refs: [{ url: 'https://apply.northwind.vc/spring-2027', kind: 'application_form' }],
})

const codes = (r) => (r.ok ? [] : r.errors.map((e) => `${e.path}=${e.code}`))
const hasCode = (r, path, code) => !r.ok && r.errors.some((e) => e.path === path && (e.code.startsWith(code) || e.code.endsWith(`:${code}`)))

test('a well-formed public candidate is accepted and normalized', () => {
  const r = validateCandidatePayload(base())
  assert.equal(r.ok, true, codes(r).join(', '))
  assert.equal(r.value.questions[0].asked_as, 'What problem are you solving, and why now? Maximum 250 words.')
  assert.equal(r.value.questions[0].word_limit, 250)
  assert.equal(r.value.program.apply_url, 'https://apply.northwind.vc/spring-2027')
})

test('unknown keys are rejected at every level (strict allowlist)', () => {
  const p = base()
  p.answers = { q1: 'x' }
  p.program.owner_email_hash = 'x'
  p.questions[0].draft_answer = 'x'
  const r = validateCandidatePayload(p)
  assert.ok(hasCode(r, 'answers', 'unknown_key'))
  assert.ok(hasCode(r, 'program.owner_email_hash', 'unknown_key'))
  assert.ok(hasCode(r, 'questions[0].draft_answer', 'unknown_key'))
})

test('required fields and source refs are enforced', () => {
  const p = base()
  delete p.program.apply_url
  p.source_refs = []
  const r = validateCandidatePayload(p)
  assert.ok(hasCode(r, 'program.apply_url', 'required'))
  assert.ok(hasCode(r, 'source_refs', 'required'))
})

test('max lengths are enforced', () => {
  const p = base()
  p.program.name = 'x'.repeat(LIMITS.name + 1)
  p.questions[0].asked_as = 'Why? '.repeat(400)
  p.questions = p.questions.concat(Array.from({ length: LIMITS.questions }, (_, i) => ({ asked_as: `Q${i}?`, order_index: 100 + i })))
  const r = validateCandidatePayload(p)
  assert.ok(hasCode(r, 'program.name', 'too_long'))
  assert.ok(hasCode(r, 'questions', 'too_many'))
})

test('emails and phone numbers anywhere in the payload are rejected without echoing them', () => {
  const p = base()
  p.questions[0].asked_as = 'Send your deck to founder.jane@gmail.com'
  p.eligibility = 'Call (415) 555-0134 to confirm eligibility.'
  p.program.description = 'International line +44 20 7946 0958 for questions.'
  const r = validateCandidatePayload(p)
  assert.ok(hasCode(r, 'questions[0].asked_as', 'private_data:email'))
  assert.ok(hasCode(r, 'eligibility', 'private_data:phone'))
  assert.ok(hasCode(r, 'program.description', 'private_data:phone'))
  assert.ok(!JSON.stringify(r).includes('gmail.com'), 'error output must not echo values')
  assert.ok(!JSON.stringify(r).includes('555-0134'))
})

test('JWTs, bearer tokens and API keys are rejected as secrets', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
  for (const [field, text, kind] of [
    ['eligibility', `token ${jwt}`, 'secret:jwt'],
    ['requirements', 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345', 'secret:bearer_token'],
    ['eligibility', `key ${'sk' + '_live_' + '51H' + 'x'.repeat(22)}`, 'secret:api_key'],
    ['eligibility', 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123', 'secret:api_key'],
    ['eligibility', `${'AKIA' + 'IOSFODNN7EXAMPLE'} is our key`, 'secret:api_key'],
    ['requirements', 'password: hunter2hunter2', 'secret:credential_assignment'],
  ]) {
    const p = base()
    p[field] = text
    const r = validateCandidatePayload(p)
    assert.ok(hasCode(r, field, kind), `${kind}: ${codes(r).join(', ')}`)
  }
})

test('URLs with token/key/signature params, credentials, or private hosts are rejected', () => {
  const cases = [
    ['https://apply.northwind.vc/form?token=abc123', 'token_url'],
    ['https://apply.northwind.vc/form?X-Amz-Signature=deadbeef', 'token_url'],
    ['https://apply.northwind.vc/form?sig=1&expires=2', 'token_url'],
    ['https://apply.northwind.vc/cb#access_token=abc', 'token_url'],
    ['https://user:pass@apply.northwind.vc/form', 'token_url'],
    ['http://localhost:3000/apply', 'private_url'],
    ['http://127.0.0.1/apply', 'private_url'],
    ['http://10.1.2.3/apply', 'private_url'],
    ['http://192.168.1.10/apply', 'private_url'],
    ['http://172.20.0.5/apply', 'private_url'],
    ['http://169.254.169.254/latest/meta-data', 'private_url'],
    ['http://[::1]/apply', 'private_url'],
    ['http://intranet/apply', 'private_url'],
    ['ftp://apply.northwind.vc/form', 'invalid_url'],
    ['javascript:alert(1)', 'invalid_url'],
  ]
  for (const [u, code] of cases) {
    const p = base()
    p.program.apply_url = u
    const r = validateCandidatePayload(p)
    assert.ok(hasCode(r, 'program.apply_url', code), `${u}: ${codes(r).join(', ')}`)
  }
  // URLs embedded in prose are checked too
  const p = base()
  p.requirements = 'Upload via https://files.northwind.vc/u?signature=abc before applying.'
  assert.ok(hasCode(validateCandidatePayload(p), 'requirements', 'secret:token_url'))
  // email hidden in a URL
  const q = base()
  q.program.url = 'https://northwind.vc/ref/jane%40gmail.com'
  assert.ok(hasCode(validateCandidatePayload(q), 'program.url', 'private_data'))
})

test('answer-like first-person prose is rejected; program copy is not', () => {
  const answer = 'I started this company because my own experience as a founder taught me that I needed better tools. ' +
    'My cofounder and I built the first version in my apartment, and I have been working on it full time since I left my job last year. ' +
    'I believe my background makes me the right person.'
  assert.equal(looksLikeAnswer(answer), true)
  const p = base()
  p.program.description = answer
  assert.ok(hasCode(validateCandidatePayload(p), 'program.description', 'private_data:answer_like'))

  const programCopy = 'We invest in pre-seed founders building software for the physical economy. Our program runs twelve weeks, ' +
    'and we provide capital, mentorship and a community of operators. You should apply if you are building something ambitious and ' +
    'want a partner who will roll up their sleeves with you from day one.'
  assert.equal(looksLikeAnswer(programCopy), false)
  const ok = base()
  ok.program.description = programCopy
  assert.equal(validateCandidatePayload(ok).ok, true)
})

test('mapping rules: tier enum, uuid format, novel cannot carry an id, duplicates rejected', () => {
  const id = '838aefff-6a28-4bef-81d9-e76bbece8d45'
  const p = base()
  p.questions[0].mapping = { canonical_question_id: id, tier: 'semantic', confidence: 0.8 }
  p.questions[1].mapping = { canonical_question_id: id, tier: 'curator' }
  assert.ok(hasCode(validateCandidatePayload(p), 'questions[1].mapping.canonical_question_id', 'duplicate'))
  const q = base()
  q.questions[0].mapping = { canonical_question_id: 'not-a-uuid', tier: 'exact' }
  q.questions[1].mapping = { canonical_question_id: id, tier: 'novel' }
  const r = validateCandidatePayload(q)
  assert.ok(hasCode(r, 'questions[0].mapping.canonical_question_id', 'invalid_uuid'))
  assert.ok(hasCode(r, 'questions[1].mapping.tier', 'novel_with_canonical'))
  const s = base()
  s.questions[0].mapping = { tier: 'bogus' }
  assert.ok(hasCode(validateCandidatePayload(s), 'questions[0].mapping.tier', 'invalid_enum'))
})

test('order_index must be unique; dates and time zones must be valid', () => {
  const p = base()
  p.questions[1].order_index = 1
  p.cycle.timezone = 'Mars/Olympus'
  p.cycle.opens_at = '2027-04-01'
  const r = validateCandidatePayload(p)
  assert.ok(hasCode(r, 'questions[1].order_index', 'duplicate'))
  assert.ok(hasCode(r, 'cycle.timezone', 'invalid_timezone'))
  assert.ok(hasCode(r, 'cycle.closes_at', 'before_opens_at'))
  const q = base()
  q.cycle.closes_at = 'next Friday'
  assert.ok(hasCode(validateCandidatePayload(q), 'cycle.closes_at', 'invalid_date'))
})

test('source input: submitter capture methods only, url_fetch ignores client snapshot, secrets in snapshot refused', () => {
  const ok = validateSourceInput({ url: 'https://apply.northwind.vc/spring-2027', capture_method: 'public_paste', snapshot_text: 'Questions: apply@northwind.vc' }, { curator: false })
  assert.equal(ok.ok, true, 'contact info in public page text is allowed at intake (flagged by checks)')
  assert.ok(!validateSourceInput({ url: 'https://a.northwind.vc', capture_method: 'curator_upload' }, { curator: false }).ok)
  assert.ok(validateSourceInput({ url: 'https://a.northwind.vc', capture_method: 'curator_upload' }, { curator: true }).ok)
  // url_fetch: the server captures; a client snapshot / final_url is ignored, not trusted
  const fetch = validateSourceInput({ url: 'https://a.northwind.vc', capture_method: 'url_fetch', snapshot_text: 'forged page', final_url: 'https://elsewhere.vc' }, { curator: false })
  assert.ok(fetch.ok)
  assert.equal(fetch.value.snapshot_text, undefined)
  assert.equal(fetch.value.final_url, undefined)
  assert.ok(!validateSourceInput({ url: 'http://127.0.0.1/x', capture_method: 'url_fetch' }, { curator: true }).ok)
  const secret = validateSourceInput({ url: 'https://a.northwind.vc', capture_method: 'public_paste', snapshot_text: 'Bearer abcdefghijklmnopqrstuvwxyz012345' }, { curator: false })
  assert.ok(!secret.ok && secret.errors.some((e) => e.code === 'secret:bearer_token'))
  const priv = validateSourceInput({ url: 'http://192.168.0.2/form', capture_method: 'public_paste' }, { curator: false })
  assert.ok(!priv.ok && priv.errors.some((e) => e.code.endsWith('private_url')))
  const big = validateSourceInput({ url: 'https://a.northwind.vc', capture_method: 'public_paste', snapshot_text: 'x'.repeat(LIMITS.snapshot + 1) }, { curator: false })
  assert.ok(!big.ok && big.errors.some((e) => e.code === 'too_long'))
})

test('privacy primitives', () => {
  assert.equal(isPrivateHost('apply.ycombinator.com'), false)
  assert.equal(isPrivateHost('8.8.8.8'), false)
  assert.equal(isPrivateHost('100.64.0.1'), true)
  assert.equal(isPrivateHost('fd12:3456::1'), true)
  assert.equal(isPrivateHost('service.internal'), true)
  assert.equal(checkPublicUrl('https://tally.so/r/mRdP14').ok, true)
  assert.deepEqual(scanText('What is your company going to make? Please describe your product.'), [])
  assert.deepEqual(scanText('Deadline: 2026-05-13. Batch: S26. Check size $500,000.'), [], 'dates and amounts are not phones')
})
