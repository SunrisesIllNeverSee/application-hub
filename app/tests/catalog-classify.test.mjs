// M09 W2 — public / private / uncertain classification + candidate refusal.
// Synthetic data only. Secret-shaped strings are assembled at runtime so no
// credential-like literal is committed to this public repository.
// Run: node --test tests/catalog-classify.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectSecrets,
  detectPII,
  urlSensitivity,
  sanitizeSourceUrl,
  classifyExtraction,
  buildPublicCandidate,
  PublicCandidateLeakError,
} from '../lib/catalog/classify.ts'
import { extractFromText, extractFromHtml } from '../lib/catalog/extract.ts'

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const FAKE_JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'synthetic-user', iat: 1 })}.${'s'.repeat(32)}`
const FAKE_STRIPE = ['sk', 'live', 'x'.repeat(24)].join('_')
const FAKE_GH = 'ghp' + '_' + 'A1b2'.repeat(9)
const PUBLIC = { provenance: 'public_source', reuse: 'allowed', final_url: 'https://accelerator.example.org/apply?utm_source=x', fetched_at: '2026-10-22T00:00:00.000Z', content_sha256: 'a'.repeat(64) }

test('detectSecrets: JWT, API keys, bearer tokens, private key, assignments', () => {
  const kinds = (t) => detectSecrets(t).map((f) => f.kind)
  assert.ok(kinds(`token ${FAKE_JWT}`).includes('jwt'))
  assert.ok(kinds(`key=${FAKE_STRIPE}`).includes('api_key'))
  assert.ok(kinds(`use ${FAKE_GH} here`).includes('api_key'))
  assert.ok(kinds(`Authorization: Bearer ${'abcDEF123'.repeat(3)}`).includes('bearer_token'))
  assert.ok(kinds('-----BEGIN ' + 'PRIVATE KEY-----').includes('private_key'))
  assert.ok(kinds('password: hunter2hunter2').includes('credential_assignment'))
  // previews never echo the secret
  for (const f of detectSecrets(`x ${FAKE_JWT}`)) assert.ok(!f.preview.includes(FAKE_JWT.slice(10, 40)))
  assert.deepEqual(detectSecrets('What problem are you solving?'), [])
})

test('urlSensitivity: token params, credentials, Docs/Drive edit links, private hosts', () => {
  assert.deepEqual(urlSensitivity('https://forms.example.org/apply?token=abc'), ['url_token_param'])
  assert.ok(urlSensitivity('https://x.example.org/f?X-Amz-Signature=abc').includes('url_token_param'))
  assert.ok(urlSensitivity('https://user:pw@x.example.org/').includes('url_credentials'))
  assert.ok(urlSensitivity('https://docs.google.com/document/d/1AbC/edit').includes('private_doc_link'))
  assert.ok(urlSensitivity('https://drive.google.com/file/d/1AbC/view').includes('private_doc_link'))
  assert.deepEqual(urlSensitivity('https://docs.google.com/forms/d/e/1FAIpQ/viewform'), [], 'published Google Form is public')
  assert.ok(urlSensitivity('http://localhost:3000/apply').includes('private_network_url'))
  assert.ok(urlSensitivity('http://192.168.1.10/form').includes('private_network_url'))
  assert.ok(urlSensitivity('http://[::1]/').includes('private_network_url'))
  assert.deepEqual(urlSensitivity('https://accelerator.example.org/apply'), [])
})

test('sanitizeSourceUrl strips tracking/token params, refuses private hosts', () => {
  assert.equal(sanitizeSourceUrl('https://a.example.org/apply?utm_source=x&cycle=s27&sig=zz#frag'), 'https://a.example.org/apply?cycle=s27')
  assert.equal(sanitizeSourceUrl('http://10.0.0.5/apply'), null)
})

test('detectPII: emails, phones, street addresses, personal names', () => {
  const kinds = (t) => [...new Set(detectPII(t).map((f) => f.kind))]
  assert.deepEqual(kinds('reach me at jane.doe@example.com'), ['email'])
  assert.deepEqual(kinds('call (555) 010-4477'), ['phone'])
  assert.deepEqual(kinds('call +1 555 010 4477'), ['phone'])
  assert.deepEqual(kinds('we are at 1200 Market Street, Suite 400'), ['street_address'])
  assert.ok(kinds('Hello, my name is Avery Quinn and I build tools.').includes('personal_name'))
  assert.deepEqual(kinds('What is your name? Tell us about your team.'), [])
  assert.deepEqual(kinds('Applications close March 1, 2027 at 11:59 PM PT.'), [])
})

test('classification: answer prose, filled values, PII and secrets are private; prompts potentially public', () => {
  const ex = extractFromText([
    'Company name: Synthetic Co',
    '1. What problem are you solving? (max 250 words)',
    'We help small clinics schedule shifts. Contact jane.doe@example.com.',
    '2. Who are your users?',
    `3. Which key do you use (for example ${FAKE_STRIPE})?`,
    '4. Describe your team.',
  ].join('\n'))
  const c = classifyExtraction(ex, PUBLIC)
  const pubQs = c.public.questions.map((q) => q.asked_as)
  assert.ok(pubQs.includes('What problem are you solving? (max 250 words)'))
  assert.ok(pubQs.includes('Who are your users?'))
  assert.ok(pubQs.includes('Describe your team.'))
  assert.ok(!pubQs.some((q) => /Which key/.test(q)), 'question carrying a secret is private')
  const privKinds = c.private.map((p) => p.kind)
  assert.ok(privKinds.includes('following_text'))
  assert.ok(privKinds.includes('filled_value'))
  assert.ok(c.private.some((p) => p.kind === 'question' && p.reasons.some((r) => r.startsWith('secret:'))))
  const q = c.public.questions.find((x) => x.asked_as.startsWith('What problem'))
  assert.equal(q.requirements.word_limit, 250)
  assert.equal(q.normalized, 'what problem are you solving')
  assert.equal(c.public.source_refs[0].url, 'https://accelerator.example.org/apply')
})

test('classification: first-person / answer-like prompts are uncertain (kept private)', () => {
  const ex = extractFromHtml('<label for=a>I founded my company in 2020 because I saw a gap?</label><textarea id=a></textarea><label for=b>What is your mission?</label><textarea id=b></textarea>')
  const c = classifyExtraction(ex, PUBLIC)
  assert.deepEqual(c.public.questions.map((q) => q.asked_as), ['What is your mission?'])
  assert.equal(c.uncertain.length, 1)
  assert.equal(c.uncertain[0].kind, 'question')
})

test('classification: local import → everything non-private is uncertain', () => {
  const ex = extractFromText('1. What problem are you solving?\n2. Who are your users?\n')
  const c = classifyExtraction(ex, { provenance: 'local_import' })
  assert.equal(c.public.questions.length, 0)
  assert.equal(c.uncertain.filter((u) => u.kind === 'question').length, 2)
  assert.throws(() => buildPublicCandidate(c), PublicCandidateLeakError)
})

test('classification: reuse disallowed → uncertain + candidate refused', () => {
  const ex = extractFromText('1. What problem are you solving?\n')
  const c = classifyExtraction(ex, { ...PUBLIC, reuse: 'disallowed' })
  assert.equal(c.public.questions.length, 0)
  assert.throws(() => buildPublicCandidate(c), (e) => e instanceof PublicCandidateLeakError && e.reasons.includes('source disallows reuse'))
})

test('buildPublicCandidate contains ONLY potentially-public fields', () => {
  const ex = extractFromText('# Example Fellowship 2027\nDeadline: April 15, 2027 23:59 UTC\n1. What problem are you solving?\nMy answer mentions jane.doe@example.com and 1200 Market Street.\n2. Why now? (max 100 words)\n')
  const c = classifyExtraction(ex, PUBLIC)
  const cand = buildPublicCandidate(c)
  assert.equal(cand.status, 'candidate')
  assert.equal(cand.requires_human_approval, true)
  assert.equal(cand.program.title, 'Example Fellowship 2027')
  assert.equal(cand.deadlines[0].date, '2027-04-15')
  assert.deepEqual(cand.questions.map((q) => q.asked_as), ['What problem are you solving?', 'Why now? (max 100 words)'])
  const json = JSON.stringify(cand)
  assert.ok(!json.includes('jane.doe'))
  assert.ok(!json.includes('Market Street'))
  assert.ok(!json.includes('My answer'))
  assert.ok(!('following_text' in cand.questions[0]))
})

test('buildPublicCandidate refuses if a private marker leaks into public fields', () => {
  const ex = extractFromText('1. What problem are you solving?\n')
  const c = classifyExtraction(ex, PUBLIC)
  // simulate a bug upstream that put PII into a public field
  c.public.program.title = 'Founder jane.doe@example.com'
  assert.throws(() => buildPublicCandidate(c), (e) => e instanceof PublicCandidateLeakError && e.reasons.includes('pii:email'))

  const c2 = classifyExtraction(ex, PUBLIC)
  c2.public.questions[0].asked_as = `What problem? ${FAKE_JWT}`
  assert.throws(() => buildPublicCandidate(c2), (e) => e instanceof PublicCandidateLeakError && e.reasons.includes('secret:jwt'))

  const ex3 = extractFromText('1. What problem are you solving?\nWe built an offline-first scheduling tool for rural clinics.\n')
  const c3 = classifyExtraction(ex3, PUBLIC)
  c3.public.program.description = 'We built an offline-first scheduling tool for rural clinics.'
  assert.throws(() => buildPublicCandidate(c3), (e) => e instanceof PublicCandidateLeakError && e.reasons.some((r) => /withheld private following_text/.test(r)))
})

test('buildPublicCandidate error messages never contain the leaked value', () => {
  const ex = extractFromText('1. What problem are you solving?\n')
  const c = classifyExtraction(ex, PUBLIC)
  c.public.program.title = 'Reach jane.doe@example.com'
  try { buildPublicCandidate(c); assert.fail('should throw') } catch (e) {
    assert.ok(!String(e.message).includes('jane.doe'))
  }
})
