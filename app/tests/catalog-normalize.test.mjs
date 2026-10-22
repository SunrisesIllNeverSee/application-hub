// M09 W2 — requirement parsing + normalization. Synthetic prompts only.
// Run: node --test tests/catalog-normalize.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseRequirements,
  normalizeQuestion,
  foldText,
  tokenSimilarity,
} from '../lib/catalog/normalize.ts'

// [input, expected subset]
const CASES = [
  ['Tell us about your team. Maximum 250 words.', { word_limit: 250 }],
  ['Describe your product (500 characters max)', { char_limit: 500 }],
  ['What is your traction? max 1,000 chars', { char_limit: 1000 }],
  ['Summarize your idea in up to 3 sentences.', { sentence_limit: 3 }],
  ['Why this market? ≤ 200 words', { word_limit: 200 }],
  ['Company name *required', { required: true }],
  ['LinkedIn profile (optional)', { optional: true, required: false }],
  ['Company name *', { required: true }],
  ['What are you building? (250 words)', { word_limit: 250 }],
  ['Explain your business model in 150 words or less', { word_limit: 150 }],
  ['Describe the problem — 300 word limit', { word_limit: 300 }],
  ['Describe the problem. 300-word limit', { word_limit: 300 }],
  ['Word limit: 400. What is your vision?', { word_limit: 400 }],
  ['Character limit 280 — pitch us in a tweet', { char_limit: 280 }],
  ['Who are your competitors? No more than 100 words.', { word_limit: 100 }],
  ['Who are your users? Up to 2,500 characters', { char_limit: 2500 }],
  ['Describe your mission in one sentence', { sentence_limit: 1 }],
  ['Outline your roadmap (150-250 words)', { word_min: 150, word_limit: 250 }],
  ['Describe your traction between 100 and 200 words', { word_min: 100, word_limit: 200 }],
  ['Tell us a story [500 characters]', { char_limit: 500 }],
  ['What did you ship in the last 12 months?', { time_context: ['in the last 12 months'] }],
  ['What are your goals for this year?', { time_context: ['this year'] }],
  ['What are your 2026 revenue targets?', { time_context: ['2026'] }],
  ['How much have you raised to date?', { time_context: ['to date'] }],
  ['What problem are you solving, and why now?', { qualifiers: ['and why now'] }],
  ['Describe your traction with evidence.', { qualifiers: ['with evidence'] }],
  ['Required: Founder email', { required: true }],
  ['Phone number - optional', { optional: true }],
  ['Pitch in under 50 words', { word_limit: 50 }],
  ['What licenses are required?', { required: undefined }],
  ['Describe your 3 biggest risks', { word_limit: undefined, sentence_limit: undefined }],
]

for (const [input, expected] of CASES) {
  test(`parseRequirements: ${input}`, () => {
    const r = parseRequirements(input)
    for (const [k, v] of Object.entries(expected)) {
      if (Array.isArray(v)) {
        for (const item of v) assert.ok(r[k].map((x) => x.toLowerCase()).includes(item.toLowerCase()), `${k} should include "${item}" — got ${JSON.stringify(r[k])}`)
      } else {
        assert.equal(r[k], v, `${k} — got ${JSON.stringify(r)}`)
      }
    }
  })
}

test('requirement table has at least 25 cases', () => {
  assert.ok(CASES.length >= 25)
})

test('directive example keeps limit, qualifiers separately', () => {
  const q = 'What problem are you solving, why is it important now, and what evidence supports your assessment? Maximum 250 words.'
  const r = parseRequirements(q)
  assert.equal(r.word_limit, 250)
  assert.ok(r.qualifiers.some((x) => /important now/i.test(x)))
  assert.ok(r.qualifiers.some((x) => /evidence supports/i.test(x)))
  assert.deepEqual(r.limit_clauses, ['Maximum 250 words'])
})

test('normalizeQuestion strips limit clauses and numbering but returns them', () => {
  const n = normalizeQuestion('3. Tell us about your team (max 250 words) *')
  assert.equal(n.normalized, 'tell us about your team')
  assert.equal(n.requirements.word_limit, 250)
  assert.equal(n.requirements.required, true)
  assert.equal(n.original, '3. Tell us about your team (max 250 words) *')
})

test('normalizeQuestion keeps time context and qualifiers in the key (they change meaning)', () => {
  assert.notEqual(normalizeQuestion('What did you ship this year?').normalized, normalizeQuestion('What did you ship?').normalized)
  assert.notEqual(normalizeQuestion('What problem are you solving, and why now?').normalized, normalizeQuestion('What problem are you solving?').normalized)
})

test('foldText folds case, whitespace, punctuation and smart quotes', () => {
  assert.equal(foldText('  What’s   YOUR  “Team”? '), foldText("what's your team"))
  assert.equal(foldText('1,000'), '1000')
})

test('tokenSimilarity is symmetric-ish and bounded', () => {
  const a = 'What problem are you solving?'
  const b = 'What problem are you solving, and why now?'
  const s = tokenSimilarity(a, b)
  assert.ok(s > 0.6 && s <= 1, String(s))
  assert.equal(tokenSimilarity('', b), 0)
  assert.ok(tokenSimilarity('Who are your customers?', 'Who are your competitors?') < 0.5)
})
