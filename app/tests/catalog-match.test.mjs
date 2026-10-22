// M09 W2 — tiered QU matcher. Synthetic catalog only.
// Run: node --test tests/catalog-match.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchOccurrence, matchBatch } from '../lib/catalog/match.ts'

const CATALOG = [
  { id: 'q-problem', text: 'What problem are you solving?', variants: [{ text: 'What problem are you solving? (200 words)', word_limit: 200 }] },
  { id: 'q-team', text: 'Tell us about your team.' },
  { id: 'q-traction', text: 'Describe your traction to date.' },
  { id: 'q-customers', text: 'Who are your customers?' },
]

test('exact tier: folded wording equal → auto-link, no differences', () => {
  const r = matchOccurrence({ asked_as: '  what problem are YOU solving ' }, CATALOG)
  assert.equal(r.tier, 'exact')
  assert.equal(r.canonical_question_id, 'q-problem')
  assert.equal(r.auto_link, true)
  assert.equal(r.needs_review, false)
  assert.equal(r.differences.limits_changed, false)
})

test('normalized tier: numbering + limit clause ignored for the key', () => {
  const r = matchOccurrence({ asked_as: '2) Tell us about your team *' }, CATALOG)
  assert.equal(r.tier, 'normalized')
  assert.equal(r.canonical_question_id, 'q-team')
  assert.equal(r.auto_link, true)
})

test('same wording, new word limit → links canonical, flags limits_changed', () => {
  // previous cycle recorded 200 words; this cycle asks for 250
  const r = matchOccurrence({ asked_as: 'What problem are you solving? (Maximum 250 words)' }, CATALOG)
  assert.ok(r.tier === 'normalized' || r.tier === 'exact', r.tier)
  assert.equal(r.canonical_question_id, 'q-problem')
  assert.equal(r.auto_link, true)
  assert.equal(r.differences.limits_changed, true)
  assert.deepEqual(r.differences.limit_changes, ['word_limit: 200 → 250'])
  assert.ok(r.reasons.some((x) => /keep occurrence limits/.test(x)))
})

test('structural limit (e.g. maxlength) also counts as a limit change', () => {
  const r = matchOccurrence({ asked_as: 'Tell us about your team.', requirements: { char_limit: 1500 } }, CATALOG)
  assert.equal(r.tier, 'exact')
  assert.equal(r.differences.limits_changed, true)
})

test('added qualifier → semantic tier, never auto-linked, qualifier reported', () => {
  const r = matchOccurrence({ asked_as: 'What problem are you solving, and why now?' }, CATALOG)
  assert.equal(r.tier, 'semantic')
  assert.equal(r.canonical_question_id, 'q-problem')
  assert.equal(r.auto_link, false)
  assert.equal(r.needs_review, true)
  assert.ok(r.differences.qualifiers_added.some((q) => /why now/i.test(q)), JSON.stringify(r.differences))
})

test('changed time context → not normalized-equal; reported', () => {
  const r = matchOccurrence({ asked_as: 'Describe your traction in the last 12 months.' }, CATALOG)
  assert.equal(r.tier, 'semantic')
  assert.equal(r.canonical_question_id, 'q-traction')
  assert.equal(r.needs_review, true)
  assert.equal(r.differences.time_context_changed, true)
})

test('injected semantic scorer is used and semantic is ALWAYS needs_review', () => {
  const r = matchOccurrence({ asked_as: 'Which pain point does your startup address?' }, CATALOG, {
    semanticScore: (_occ, cand) => (cand.id === 'q-problem' ? 0.91 : 0.2),
  })
  assert.equal(r.tier, 'semantic')
  assert.equal(r.canonical_question_id, 'q-problem')
  assert.equal(r.confidence, 0.91)
  assert.equal(r.needs_review, true)
  assert.equal(r.auto_link, false)
})

test('novel: unrelated question, nothing linked', () => {
  const r = matchOccurrence({ asked_as: 'What is your favourite open-source license and why?' }, CATALOG)
  assert.equal(r.tier, 'novel')
  assert.equal(r.canonical_question_id, undefined)
  assert.equal(r.auto_link, false)
})

test('false-merge guard: shared prefix is NOT a match (old ILIKE behaviour)', () => {
  const r = matchOccurrence({ asked_as: "Tell us about your team's hiring plan for the next 12 months." }, CATALOG)
  assert.notEqual(r.tier, 'exact')
  assert.notEqual(r.tier, 'normalized')
  assert.equal(r.auto_link, false)
})

test('ambiguous catalog duplicates → link withheld for review', () => {
  const r = matchOccurrence({ asked_as: 'Who are your customers?' }, [...CATALOG, { id: 'q-customers-dup', text: 'who are your customers' }])
  assert.equal(r.tier, 'exact')
  assert.equal(r.auto_link, false)
  assert.equal(r.needs_review, true)
})

test('matchBatch detects duplicates within one application', () => {
  const occ = [
    { asked_as: 'Tell us about your team.' },
    { asked_as: 'Who are your customers?' },
    { asked_as: '5. Tell us about your team (max 100 words)' },
    { asked_as: 'TELL US ABOUT YOUR TEAM' },
  ]
  const { results, duplicates } = matchBatch(occ, CATALOG)
  assert.equal(duplicates.length, 1)
  assert.deepEqual(duplicates[0].indices, [0, 2, 3])
  assert.equal(results[0].duplicate_of, undefined)
  assert.equal(results[2].duplicate_of, 0)
  assert.equal(results[3].duplicate_of, 0)
  assert.equal(results[2].needs_review, true)
  assert.equal(results[2].auto_link, false)
  assert.equal(results[1].auto_link, true)
})

test('empty wording is never linked', () => {
  const r = matchOccurrence({ asked_as: '   ' }, CATALOG)
  assert.equal(r.tier, 'novel')
  assert.equal(r.needs_review, true)
})
