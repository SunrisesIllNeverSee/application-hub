// M09 W6 — Step F prepare validation: missing approval, required missing,
// over limit, sha mismatch, undecryptable, unexplained skips, newer drafts.
// Plus an end-to-end check against a memory vault (approval gate + rehash).
// Synthetic data only. Run: node --test tests/journey-prepare.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validatePrepare, measure } from '../lib/journey/prepare.ts'
import { buildPrepareInputs } from '../lib/journey/lifecycle.ts'
import { activateInstance } from '../lib/journey/activate.ts'
import { modelFromCatalogProgram } from '../lib/journey/review-model.ts'
import { createMemoryStorage } from '../lib/aqua-local/vault.ts'
import { approveAsHuman, listInstanceQuestions, saveInstanceDraft } from '../lib/aqua-local-client/review.ts'
import { DEV_JOURNEY_CATALOG } from '../lib/journey/dev-fixture.ts'

const base = { text: 'Q', required: true, word_limit: null, char_limit: null, has_versions: true, status: 'approved', skip_reason: null }
const approved = (o = {}) => ({ version_id: 'v1', recorded_sha256: 'a'.repeat(64), recomputed_sha256: 'a'.repeat(64), word_count: 10, char_count: 60, is_governing: true, ...o })
const codes = (r) => r.blockers.map((b) => b.code)

test('all approved, within limits, hashes match → ready', () => {
  const r = validatePrepare([{ ...base, question_occurrence_id: 'a', approved: approved() }, { ...base, question_occurrence_id: 'b', required: false, has_versions: false, status: 'gap', approved: null, skip_reason: 'Not applicable to us' }])
  assert.equal(r.ready, true)
  assert.deepEqual(r.counts, { total: 2, ready: 1, skipped: 1, blocked: 0 })
})

test('required missing vs missing approval', () => {
  const r = validatePrepare([
    { ...base, question_occurrence_id: 'a', has_versions: false, status: 'gap', approved: null },
    { ...base, question_occurrence_id: 'b', status: 'under_review', approved: null },
  ])
  assert.equal(r.ready, false)
  assert.deepEqual(codes(r), ['required_missing', 'missing_approval'])
  assert.equal(r.blockers[0].fix, 'draft'); assert.equal(r.blockers[1].fix, 'review')
})

test('a required question cannot be skipped', () => {
  const r = validatePrepare([{ ...base, question_occurrence_id: 'a', has_versions: false, status: 'gap', approved: null, skip_reason: 'later' }])
  assert.ok(codes(r).includes('required_skip_refused'))
})

test('over word / char limit', () => {
  const r = validatePrepare([{ ...base, question_occurrence_id: 'a', word_limit: 5, char_limit: 50, approved: approved() }])
  assert.deepEqual(codes(r), ['over_word_limit', 'over_char_limit'])
  assert.match(r.blockers[0].message, /5 word\(s\) over the 5-word limit/)
})

test('sha mismatch and undecryptable block', () => {
  const r = validatePrepare([
    { ...base, question_occurrence_id: 'a', approved: approved({ recomputed_sha256: 'b'.repeat(64) }) },
    { ...base, question_occurrence_id: 'b', approved: approved({ recomputed_sha256: null }) },
  ])
  assert.deepEqual(codes(r), ['sha_mismatch', 'undecryptable'])
})

test('optional: unexplained skip blocks; newer unapproved draft warns only', () => {
  const r = validatePrepare([
    { ...base, question_occurrence_id: 'a', required: false, has_versions: false, status: 'gap', approved: null },
    { ...base, question_occurrence_id: 'b', required: false, status: 'suggested', approved: null },
    { ...base, question_occurrence_id: 'c', approved: approved({ is_governing: false }) },
  ])
  assert.deepEqual(codes(r), ['unexplained_skip', 'unexplained_skip'])
  assert.equal(r.blockers[0].fix, 'skip_reason')
  assert.deepEqual(r.warnings.map((w) => w.code), ['newer_draft_unapproved'])
  assert.equal(r.per_question.c.state, 'ready')
  assert.equal(validatePrepare([]).ready, false, 'nothing to prepare is not ready')
})

test('measure counts words and characters like the review card', () => {
  assert.deepEqual(measure('Hello  wide\nworld'), { word_count: 3, char_count: 17 })
})

test('vault integration: only human hash-bound approvals count; tampered body → sha mismatch', async () => {
  const s = createMemoryStorage()
  const SECRET = 'synthetic-test-secret-2'
  const inst = await activateInstance(s, SECRET, modelFromCatalogProgram(DEV_JOURNEY_CATALOG.programs[0]), DEV_JOURNEY_CATALOG)
  const catalog_questions = DEV_JOURNEY_CATALOG.programs[0].questions.map((q) => ({ question_occurrence_id: q.canonical_question_id, text: q.asked_as, canonical_question_id: q.canonical_question_id, word_limit: q.word_limit, char_limit: q.char_limit, required: q.required }))
  const v1 = await saveInstanceDraft(s, SECRET, inst.instance_id, 'aq-problem', { title: 'Problem', body: 'Clinics lose hours to paperwork every week.' })
  const v2 = await saveInstanceDraft(s, SECRET, inst.instance_id, 'aq-team', { title: 'Team', body: 'Two synthetic founders.' })
  await approveAsHuman(s, { version_id: v1.id, expected_sha256: v1.sha256 })
  await approveAsHuman(s, { version_id: v2.id, expected_sha256: v2.sha256 })
  let rows = await listInstanceQuestions(s, SECRET, inst.instance_id, { catalog_questions, classify: false })
  let r = validatePrepare(await buildPrepareInputs(s, SECRET, rows, { 'aq-why-now': 'We have no timing argument yet' }))
  assert.equal(r.ready, true, JSON.stringify(r.blockers))
  // tamper: swap the stored body ciphertext for another version's (hash no longer matches)
  const other = await saveInstanceDraft(s, SECRET, inst.instance_id, 'aq-why-now', { title: 'Why now', body: 'A different synthetic body.' })
  const rec = await s.get('versions', v1.id)
  await s.put('versions', { ...rec, body: other.body, title: other.title })
  rows = await listInstanceQuestions(s, SECRET, inst.instance_id, { catalog_questions, classify: false })
  r = validatePrepare(await buildPrepareInputs(s, SECRET, rows))
  assert.ok(codes(r).includes('sha_mismatch'))
  assert.ok(codes(r).includes('unexplained_skip'), 'optional draft without approval or skip reason')
})
