// M09 W6 — Step B extraction-review model: corrections keep originals,
// duplicate handling, program match pick/clear, missing requirements.
// Synthetic data only. Run: node --test tests/journey-review.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractApplication } from '../lib/catalog/extract.ts'
import {
  activationBlockers, activeQuestions, clearProgramMatch, clearQuestionMatch, correctWording, mergeDuplicate,
  missingRequirements, modelFromCatalogProgram, modelFromLocalExtraction, modelFromUrlProposal, pickProgramMatch,
  removeQuestion, restoreQuestion, setDeadline, setLimits, setRequired, setUseCatalogTemplate,
} from '../lib/journey/review-model.ts'
import { DEV_JOURNEY_CATALOG, DEV_PASTE_TEXT, DEV_URL } from '../lib/journey/dev-fixture.ts'
import { extractUrlResponse } from './fixtures/journey-fixtures.mjs'

const T = '2026-10-22T12:00:00.000Z'
const urlModel = () => modelFromUrlProposal(extractUrlResponse(), DEV_URL, T)

test('URL proposal → review model: org/program, deadline+TZ, method, reuse, exact questions, matches', () => {
  const m = urlModel()
  assert.equal(m.source.kind, 'url')
  assert.equal(m.source.method, 'url_fetch')
  assert.equal(m.source.reuse, 'allowed')
  assert.equal(m.program_match.program_id, 'prog-example-accel')
  assert.equal(m.cycle.deadline.date, '2027-03-01')
  assert.equal(m.cycle.deadline.timezone, 'PT')
  assert.equal(m.questions.length, 5)
  assert.equal(m.questions[0].original_text, 'What problem are you solving? (Maximum 150 words) *', 'exact wording kept')
  assert.equal(m.questions[0].word_limit, 150)
  assert.equal(m.questions[0].required, true)
  assert.equal(m.questions[0].match.canonical_question_id, 'aq-problem')
  assert.deepEqual(m.duplicates, [{ keys: ['q1', 'q2'], tier: 'normalized' }])
  assert.equal(m.questions[2].duplicate_of, 'q1')
  assert.equal(m.private_summary.kinds.filled_value, 1, 'filled value counted, never shown')
  assert.ok(m.public_candidate, 'server-built candidate carried through')
})

test('correction keeps the original wording and is logged; reverting clears the flag', () => {
  let m = urlModel()
  const original = m.questions[0].original_text
  m = correctWording(m, 'q0', 'What problem are you solving?', T)
  assert.equal(m.questions[0].text, 'What problem are you solving?')
  assert.equal(m.questions[0].original_text, original, 'original untouched')
  assert.equal(m.questions[0].corrected, true)
  assert.deepEqual(m.corrections.at(-1), { key: 'q0', field: 'wording', from: original, to: 'What problem are you solving?', at: T })
  m = correctWording(m, 'q0', original, T)
  assert.equal(m.questions[0].corrected, false)
  assert.equal(m.corrections.length, 2, 'both edits recorded')
  assert.throws(() => correctWording(m, 'q0', '   '), /blank/)
})

test('limits / required corrections keep originals; invalid limits refused', () => {
  let m = urlModel()
  m = setLimits(m, 'q3', { word_limit: 80, char_limit: 600 }, T)
  m = setRequired(m, 'q3', true, T)
  const q = m.questions[3]
  assert.equal(q.word_limit, 80); assert.equal(q.original_word_limit, 100)
  assert.equal(q.char_limit, 600); assert.equal(q.original_char_limit, null)
  assert.equal(q.required, true); assert.equal(q.original_required, null)
  assert.deepEqual(m.corrections.map((c) => c.field), ['word_limit', 'char_limit', 'required'])
  assert.throws(() => setLimits(m, 'q3', { word_limit: 0 }), /positive/)
  assert.throws(() => setLimits(m, 'q3', { word_limit: 2.5 }), /positive/)
})

test('duplicates: merge keeps the stricter limit + required, remove/restore round-trips', () => {
  let m = urlModel()
  m = setLimits(m, 'q2', { word_limit: 120 }, T)
  m = mergeDuplicate(m, 'q2', 'q1', T)
  assert.equal(m.questions[2].status, 'merged')
  assert.equal(m.questions[2].merged_into, 'q1')
  assert.equal(m.questions[1].word_limit, 120, 'stricter limit survives the merge')
  assert.equal(activeQuestions(m).length, 4)
  m = removeQuestion(m, 'q4', T)
  assert.equal(activeQuestions(m).length, 3)
  m = restoreQuestion(m, 'q4', T)
  assert.equal(activeQuestions(m).length, 4)
  assert.ok(m.questions[2].original_text, 'merged question keeps its wording for the record')
  assert.throws(() => mergeDuplicate(m, 'q1', 'q1'), /itself/)
})

test('program match: clear, pick from catalog, catalog-template choice', () => {
  let m = urlModel()
  m = clearProgramMatch(m, T)
  assert.equal(m.program_match, null)
  assert.ok(missingRequirements(m).some((s) => /Not matched/.test(s)))
  assert.throws(() => setUseCatalogTemplate(m, true), /program match/)
  m = pickProgramMatch(m, DEV_JOURNEY_CATALOG.programs[1], T)
  assert.equal(m.program_match.program_id, 'prog-sample-fund')
  assert.equal(m.program_match.basis, 'user')
  m = setUseCatalogTemplate(m, true, T)
  assert.equal(m.use_catalog_template, true)
  assert.deepEqual(activationBlockers(m, DEV_JOURNEY_CATALOG), [])
  m = clearQuestionMatch(m, 'q0', T)
  assert.equal(m.questions[0].match_cleared, true)
})

test('paste (local): wording is the user\'s own, everything stays uncertain/private, no candidate', () => {
  const ex = extractApplication({ content: DEV_PASTE_TEXT })
  const m = modelFromLocalExtraction(ex, { kind: 'paste', catalog: DEV_JOURNEY_CATALOG, now: T })
  assert.equal(m.source.method, 'paste')
  assert.equal(m.catalog_lookup, 'local')
  assert.equal(m.public_candidate, null, 'local imports never produce a public candidate')
  assert.ok(m.questions.every((q) => q.visibility !== 'public'), 'local provenance is never public')
  assert.equal(m.questions[0].match.canonical_question_id, 'aq-problem', 'matched against the downloaded catalog, on device')
  assert.equal(m.program.title, 'Northwind Civic Fellowship 2027')
  assert.equal(m.cycle.deadline.timezone, 'ET')
  assert.equal(m.questions[2].required, false)
  assert.equal(m.questions[2].original_required, false, 'explicit (optional) marker')
})

test('catalog template summary: public questions, exact catalog match, no corrections needed', () => {
  const m = modelFromCatalogProgram(DEV_JOURNEY_CATALOG.programs[0], T)
  assert.equal(m.source.method, 'catalog_template')
  assert.equal(m.use_catalog_template, true)
  assert.equal(m.questions.length, 3)
  assert.equal(m.cycle.deadline.timezone, 'UTC')
  assert.deepEqual(activationBlockers(m, DEV_JOURNEY_CATALOG), [])
  assert.throws(() => pickProgramMatch(m, DEV_JOURNEY_CATALOG.programs[1]), /already bound/)
})

test('activation blockers: no questions, withheld wording, missing title; deadline correction validated', () => {
  let m = urlModel()
  for (const q of m.questions) m = removeQuestion(m, q.key, T)
  assert.ok(activationBlockers(m).some((b) => b.code === 'no_questions'))
  const res = extractUrlResponse()
  res.questions[0] = { ...res.questions[0], asked_as: null, redacted: true, visibility: 'private' }
  let w = modelFromUrlProposal(res, DEV_URL, T)
  assert.ok(activationBlockers(w).some((b) => b.code === 'blank_wording' && b.key === 'q0'))
  assert.ok(missingRequirements(w).some((s) => /withheld/.test(s)))
  w = correctWording(w, 'q0', 'What problem are you solving?', T)
  assert.equal(w.questions[0].original_text, null)
  assert.ok(!activationBlockers(w).some((b) => b.key === 'q0'))
  w = { ...w, program: { ...w.program, title: ' ' } }
  assert.ok(activationBlockers(w).some((b) => b.code === 'no_title'))
  assert.throws(() => setDeadline(w, { date: '03/01/2027' }), /YYYY-MM-DD/)
  const d = setDeadline(w, { date: '2027-03-02', time: '17:00', timezone: 'ET' }, T)
  assert.equal(d.cycle.deadline.text, '2027-03-02 17:00 ET')
  assert.equal(d.cycle.original_deadline.date, '2027-03-01', 'original deadline kept')
})

// M09 hardening (W6 follow-up): once a question has a draft, the populate row
// stops showing answer-bank advice (classification chip, reasons, source
// answer) and shows "Draft created (vN)" instead. Source-level check — the
// component imports Next/React and is exercised by tests/browser/journey.browser.mjs.
test('populate rows replace stale answer-bank advice with "Draft created (vN)" once a draft exists', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../components/journey/InstanceJourney.tsx', import.meta.url), 'utf8')
  assert.match(src, /const hasDraft = r\.versions\.length > 0/)
  assert.match(src, /Draft created \(v\{r\.versions\.length\}\)/)
  assert.match(src, /\{c && !hasDraft && <Chip tone=\{CLASS_TONE/)
  assert.match(src, /\{c && !hasDraft && c\.reasons\.length > 0/)
  assert.match(src, /\{c\?\.candidate_version_id && !hasDraft && \(/)
})
