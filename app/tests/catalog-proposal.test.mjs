// M09 W2 — read-only extraction proposal (what /api/catalog/extract-url returns)
// plus source-shape checks on the route and the intake/paste fixes.
// Synthetic data only. Run: node --test tests/catalog-proposal.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildExtractionProposal, matchProgram, searchTermsFor } from '../lib/catalog/proposal.ts'
import { extractFromHtml, extractFromText } from '../lib/catalog/extract.ts'

const PROGRAMS = [
  { id: 'p1', slug: 'example-accelerator', name: 'Example Accelerator', organization: 'Example Ventures', apply_url: 'https://accelerator.example.org/apply/' },
  { id: 'p2', slug: 'other-fund', name: 'Other Fund', organization: 'Other Fund', apply_url: 'https://forms.gle/abc' },
]
const CYCLES = [{ program_id: 'p2', cycle_name: 'S27', apply_url: 'https://other.example.net/s27', closes_at: '2027-05-01T00:00:00Z' }]
const SOURCE = { provenance: 'public_source', reuse: 'allowed', final_url: 'https://accelerator.example.org/apply', fetched_at: '2026-10-22T00:00:00.000Z', content_sha256: 'b'.repeat(64) }

test('matchProgram: apply_url (trailing slash/www-insensitive), cycle url, host, name', () => {
  assert.equal(matchProgram({ final_url: 'https://www.accelerator.example.org/apply' }, PROGRAMS).best.basis, 'apply_url')
  const c = matchProgram({ final_url: 'https://other.example.net/s27' }, PROGRAMS, CYCLES)
  assert.equal(c.best.basis, 'cycle_apply_url')
  assert.equal(c.best.cycle.cycle_name, 'S27')
  const h = matchProgram({ final_url: 'https://accelerator.example.org/faq' }, PROGRAMS)
  assert.equal(h.best.basis, 'host')
  assert.equal(h.needs_review, true)
  const shared = matchProgram({ final_url: 'https://forms.gle/zzz' }, PROGRAMS)
  assert.equal(shared.best, null, 'shared form hosts never match by host')
  const n = matchProgram({ final_url: 'https://new.example.com/', title: 'Example Accelerator' }, PROGRAMS)
  assert.equal(n.best.basis, 'name')
  assert.equal(n.needs_review, true)
})

test('proposal: questions with requirements + match, candidate, private context redacted, writes none', () => {
  const html = `<html><head><title>Example Accelerator</title></head><body>
    <p>Applications close March 1, 2027 at 11:59 PM PT.</p>
    <label for=a>What problem are you solving? (Maximum 250 words)</label><textarea id=a></textarea>
    <label for=b>Contact email</label><input id=b type=email value="founder@example.com">
    <label for=c>What problem are you solving, and why now?</label><textarea id=c>We already solved it.</textarea>
    <label for=d>Tell us about your team.</label><textarea id=d></textarea>
    <label for=e>Tell us about your team</label><textarea id=e></textarea>
  </body></html>`
  const extraction = extractFromHtml(html, { baseUrl: SOURCE.final_url })
  const catalog = [
    { id: 'q-problem', text: 'What problem are you solving?', variants: [{ text: 'What problem are you solving? (200 words)', word_limit: 200 }] },
    { id: 'q-team', text: 'Tell us about your team.' },
  ]
  const p = buildExtractionProposal({ extraction, source: SOURCE, programs: PROGRAMS, cycles: CYCLES, catalog })
  assert.equal(p.writes, 'none')
  assert.equal(p.program_match.program_id, 'p1')
  const [q0, q1, q2, q3, q4] = p.questions
  assert.equal(q0.match.tier, 'normalized')
  assert.equal(q0.match.canonical_question_id, 'q-problem')
  assert.deepEqual(q0.match.differences.limit_changes, ['word_limit: 200 → 250'])
  assert.equal(q0.requirements.word_limit, 250)
  assert.equal(q1.has_private_context, true, 'filled email is private context')
  assert.equal(q2.match.tier, 'semantic')
  assert.equal(q2.match.needs_review, true)
  assert.equal(q3.match.tier, 'exact')
  assert.equal(q4.match.duplicate_of, 3)
  assert.deepEqual(p.duplicates, [{ indices: [3, 4], tier: 'exact' }])
  assert.ok(p.public_candidate, JSON.stringify(p.public_candidate_refused))
  assert.equal(p.public_candidate.status, 'candidate')
  const json = JSON.stringify({ ...p, classification: undefined })
  assert.ok(!json.includes('founder@example.com'), 'filled values never in the proposal')
  assert.ok(!json.includes('We already solved it'), 'answer text never in the proposal')
  assert.equal(p.private_summary.kinds.filled_value, 2)
})

test('proposal: a question whose wording carries PII is redacted', () => {
  const extraction = extractFromText('1. What problem are you solving?\n2. Email jane.doe@example.com with questions?\n')
  const p = buildExtractionProposal({ extraction, source: SOURCE })
  const red = p.questions.find((q) => q.redacted)
  assert.ok(red)
  assert.equal(red.asked_as, null)
  assert.ok(!JSON.stringify({ ...p, classification: undefined }).includes('jane.doe'))
})

test('searchTermsFor returns bounded, filter-safe tokens', () => {
  const ex = extractFromText('1. What problem are you solving?\n2. Describe the problem, (and) your traction!\n')
  const terms = searchTermsFor(ex, 5)
  assert.ok(terms.length <= 5)
  assert.ok(terms.every((t) => /^[a-z0-9]{5,}$/.test(t)))
  assert.equal(terms[0], 'problem')
})

// ── source-shape checks (routes import Next/Supabase and are not unit-importable) ──

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')

test('extract-url route: authenticated, rate-limited, read-only, no body logging', () => {
  const src = read('../app/api/catalog/extract-url/route.ts')
  assert.match(src, /auth\.getUser\(\)/)
  assert.match(src, /rateLimitAllow\(user\.id, 'catalog_extract_url'\)/)
  assert.match(src, /restrictToApprovedPrograms\(/)
  assert.doesNotMatch(src, /\.(insert|update|upsert|delete)\(/, 'route must write nothing')
  assert.doesNotMatch(src, /SUPABASE_SERVICE_ROLE_KEY|createInfraClient|createAdminClient/, 'route uses the user client only')
  assert.doesNotMatch(src, /console\.\w+\([^)]*(extraction|snapshot|text|body)\b/, 'never log fetched content')
  assert.match(src, /urlSensitivity\(/, 'private links are refused before fetching')
})

test('intake route writes word_limit/char_limit and reports match decisions', () => {
  const src = read('../app/api/applications/intake/route.ts')
  assert.match(src, /parseRequirements\(q\.question_text\)/)
  assert.match(src, /word_limit: req\.word_limit \?\? null/)
  assert.match(src, /char_limit: req\.char_limit \?\? null/)
  assert.match(src, /match_decisions: matchDecisions/)
})

// M09 hardening H1: legacy paste/intake routes carry USER-SUPPLIED text and
// must never write the shared catalog with the service role.
const SERVICE_ROLE_RE = /SUPABASE_SERVICE_ROLE_KEY|createInfraClient|createAdminClient|catalogServiceClient|supabase\/infra/

test('paste route: local-first refusal first, user client only (no service role)', () => {
  const src = read('../app/api/import/paste/route.ts')
  const refuse = src.indexOf('refusePrivateWrite()')
  const auth = src.indexOf('auth.getUser()')
  assert.ok(refuse > 0 && refuse < auth, 'local-first refusal still precedes everything')
  assert.doesNotMatch(src, SERVICE_ROLE_RE, 'paste must not use the service role for user-supplied catalog text')
  assert.equal((src.match(/findOrCreateArchivedQuestion\(supabase,/g) ?? []).length, 2)
})

test('intake route: user client only; unmatched questions are staged, never created canonical', () => {
  const src = read('../app/api/applications/intake/route.ts')
  const refuse = src.indexOf('refusePrivateWrite()')
  const auth = src.indexOf('auth.getUser()')
  assert.ok(refuse > 0 && refuse < auth, 'local-first refusal still precedes everything')
  assert.doesNotMatch(src, SERVICE_ROLE_RE, 'intake must not use the service role for user-supplied catalog text')
  assert.match(src, /const catalogClient = supabase/)
  assert.doesNotMatch(src, /findOrCreateArchivedQuestion/, 'intake never mints canonical questions')
  assert.match(src, /decideArchivedQuestion\(catalogClient, q\.question_text\)/)
  assert.match(src, /staged_questions: stagedQuestions/)
  assert.match(src, /\/api\/catalog\/candidates/)
})

test('no route imports the removed service-role infra helper', () => {
  assert.throws(() => read('../lib/supabase/infra.ts'), /ENOENT/)
})

test('intake-extract: no silent first-hit ILIKE merge; tiered matcher decides', () => {
  const src = read('../lib/intake-extract.ts')
  assert.match(src, /matchOccurrence\(/)
  assert.match(src, /m\.tier === 'exact' \|\| m\.tier === 'normalized'/)
  assert.doesNotMatch(src, /if \(data && data\.length > 0\) return \{ id: data\[0\]\.id \}/)
})
