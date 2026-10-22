// M09 W3: verification check runner, duplicate detection, matching, digest parity.
// Run: node --test tests/catalog-promotion-checks.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  runChecks, findDuplicateTemplates, matchQuestions, applyMatches, questionSetSha256, urlKey, compareForm, CHECK_KEYS,
} from '../lib/catalog-promotion/checks.ts'
import { PROGRAMS } from '../../qaapplication/src/canonical-053-data.mjs'

const SNAPSHOT = `Northwind Accelerator — Spring 2027
Applications close March 1, 2027 at 11:59pm Pacific Time.
Eligibility: pre-seed companies with at least one technical founder.
Company
What problem are you solving, and why now?   Maximum 250 words.
Link to your deck
Questions? apply@northwind.vc`

const payload = () => ({
  program: { name: 'Northwind Accelerator — Spring 2027', organization: 'Northwind Ventures', kind: 'accelerator', apply_url: 'https://apply.northwind.vc/spring-2027' },
  cycle: { name: 'Spring 2027', closes_at: '2027-03-01T23:59:00-08:00', timezone: 'America/Los_Angeles' },
  eligibility: 'Pre-seed companies with at least one technical founder.',
  evidence: { deadline_quote: 'Applications close March 1, 2027 at 11:59pm Pacific Time.', requirements_quote: 'pre-seed companies with at least one technical founder' },
  questions: [
    { asked_as: 'What problem are you solving, and why now? Maximum 250 words.', order_index: 1, section: 'Company', word_limit: 250 },
    { asked_as: 'Link to your deck', order_index: 2, required: false },
  ],
  source_refs: [{ url: 'https://apply.northwind.vc/spring-2027', kind: 'application_form' }],
})

const source = (over = {}) => ({
  url: 'https://apply.northwind.vc/spring-2027', capture_method: 'public_paste', reuse: 'allowed',
  robots_disallow: false, verification_status: 'verified', snapshot_text: SNAPSHOT.replace('Questions? apply@northwind.vc', ''), ...over,
})

const programs = [
  { id: 'p-yc', slug: 'yc-summer-2026', name: 'Y Combinator — Summer 2026', organization: 'Y Combinator', url: 'https://www.ycombinator.com/', apply_url: null },
]

test('all six checks pass for a clean, evidenced, reusable public source', () => {
  const c = runChecks({ payload: payload(), source: source(), programs, now: new Date('2026-10-22T00:00:00Z') })
  for (const k of CHECK_KEYS) assert.equal(c.results[k].pass, true, `${k}: ${c.results[k].detail}`)
  assert.equal(c.all_passed, true)
  assert.equal(c.ran_at, '2026-10-22T00:00:00.000Z')
  assert.match(c.question_set_sha256, /^[0-9a-f]{64}$/)
})

test('a successfully captured source is NOT reusable until a curator affirms reuse', () => {
  for (const over of [{ reuse: 'unknown' }, { reuse: 'disallowed' }, { robots_disallow: true }, { verification_status: 'failed' }, { url: 'http://10.0.0.1/form' }]) {
    const c = runChecks({ payload: payload(), source: source(over), programs })
    assert.equal(c.results.source_public_reusable.pass, false, JSON.stringify(over))
    assert.equal(c.all_passed, false)
  }
  assert.equal(runChecks({ payload: payload(), source: null, programs }).results.source_public_reusable.pass, false)
})

test('contact strings in the snapshot fail no_private_data (curator review), payload secrets fail too', () => {
  const c = runChecks({ payload: payload(), source: source({ snapshot_text: SNAPSHOT }), programs })
  assert.equal(c.results.no_private_data.pass, false)
  assert.match(c.results.no_private_data.detail, /email/)
  const bad = payload()
  bad.requirements = 'api_key=abcd1234efgh5678'
  const d = runChecks({ payload: bad, source: source(), programs })
  assert.equal(d.results.no_private_data.pass, false)
})

test('exact wording: whitespace/typography-insensitive, otherwise verbatim; missing indices reported', () => {
  assert.equal(compareForm('What’s  your\nmoat — really?'), "What's your moat - really?")
  const p = payload()
  p.questions[1].asked_as = 'Link to your pitch deck'
  const c = runChecks({ payload: p, source: source(), programs })
  assert.equal(c.results.exact_wording_preserved.pass, false)
  assert.deepEqual(c.missing_wording, [1])
  const none = runChecks({ payload: payload(), source: source({ snapshot_text: null }), programs })
  assert.equal(none.results.exact_wording_preserved.pass, false)
})

test('cycle and deadline/requirements evidence', () => {
  const p = payload()
  delete p.cycle.name
  delete p.cycle.timezone
  p.evidence.deadline_quote = 'Applications close soon'
  const c = runChecks({ payload: p, source: source(), programs })
  assert.equal(c.results.cycle_identified.pass, false)
  assert.equal(c.results.deadline_requirements_evidence.pass, false)
  assert.match(c.results.deadline_requirements_evidence.detail, /time zone/)
  assert.match(c.results.deadline_requirements_evidence.detail, /not found/)

  const rolling = payload()
  rolling.cycle = { is_rolling: true }
  delete rolling.eligibility
  delete rolling.evidence
  const r = runChecks({ payload: rolling, source: source(), programs })
  assert.equal(r.results.cycle_identified.pass, true)
  assert.equal(r.results.deadline_requirements_evidence.pass, true)
})

test('duplicate template detection by apply URL, name and question-set digest', () => {
  const p = payload()
  const existing = [
    { id: 'p1', slug: 'northwind-spring-2027', name: 'Northwind Accelerator - Spring 2027', organization: 'Northwind Ventures', apply_url: 'https://www.apply.northwind.vc/spring-2027/' },
    { id: 'p2', slug: 'other', name: 'Other', organization: 'Other', apply_url: 'https://other.vc/apply' },
  ]
  const sha = questionSetSha256(p.questions)
  const dups = findDuplicateTemplates(p, existing, [{ program_id: 'p2', revision: 1, question_set_sha256: sha }])
  assert.deepEqual(dups.map((d) => [d.slug, d.reasons]), [['northwind-spring-2027', ['apply_url', 'name']], ['other', ['question_set']]])
  const c = runChecks({ payload: p, source: source(), programs: existing })
  assert.equal(c.results.duplicate_template.pass, false)
  // a declared revision of the matched program passes, unless it also resembles another template
  const rev = runChecks({ payload: p, source: source(), programs: existing.slice(0, 1), programMatchId: 'p1' })
  assert.equal(rev.results.duplicate_template.pass, true)
  assert.equal(urlKey('https://WWW.Apply.Northwind.vc/Spring-2027/?utm=x#y'), 'apply.northwind.vc/spring-2027')
})

test('exact and normalized matching against canonical questions; curator mappings win', () => {
  const canon = [
    { id: '11111111-1111-4111-8111-111111111111', text: 'Link to your deck' },
    { id: '22222222-2222-4222-8222-222222222222', text: 'what problem are you solving and why now maximum 250 words' },
  ]
  const p = payload()
  const m = matchQuestions(p.questions, canon)
  assert.deepEqual(m.map((x) => [x.index, x.tier]), [[0, 'normalized'], [1, 'exact']])
  p.questions[1].mapping = { canonical_question_id: '33333333-3333-4333-8333-333333333333', tier: 'curator' }
  const applied = applyMatches(p, m)
  assert.equal(applied.questions[0].mapping.tier, 'normalized')
  assert.equal(applied.questions[1].mapping.canonical_question_id, '33333333-3333-4333-8333-333333333333')
})

test('questionSetSha256 matches public.catalog_question_set_sha256 (058) for the 5 canonical templates', () => {
  // Digests recorded by the 058 backfill on the local Postgres harness
  // (supabase/tests/m09/run_local.sh), computed in SQL from the 053 rows.
  const fromDb = {
    'yc-summer-2026': 'ad0b68b3f49803ed419b9652dc6f4f4074b94a1e50a72ef4cdb8e88ef1a74285',
    'founding-500': '14f81155eda3d455d1cd35ee915cb58962e5b10d07660a48795c4c0b04e65b00',
    'redbud-vc': '7204cbae6e9a1d9d1e06902d1be9445e408c76e75914e9a350376b91e008c1d9',
    'cyberfund-monastery': '9d4aabc967dabbffd170d865d9b8580541cb1c7e1461b4ac70c8898c339c9b81',
    '3xcapital': '19661370070dde966d30ea3bf3b1d3fda587ac259a9e56a0749d9e0a0e898c67',
  }
  for (const p of PROGRAMS) {
    const qs = p.questions.map(([asked_as, section], i) => ({ asked_as, section, order_index: i + 1 }))
    assert.equal(questionSetSha256(qs), fromDb[p.slug], p.slug)
  }
  // edge vector: null section, unsorted input, non-ASCII (same as SQL)
  assert.equal(
    questionSetSha256([{ order_index: 2, section: null, asked_as: 'B' }, { order_index: 1, section: 'S', asked_as: 'Ä – q' }]),
    '48ab579050bce9de263623552e3d4857c24c995552c7c0a23b230fd8859d237a',
  )
})
