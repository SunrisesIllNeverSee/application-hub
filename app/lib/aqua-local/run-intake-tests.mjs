// AM-0017 — local-first intake adapter tests.
// Run: node lib/aqua-local/run-intake-tests.mjs   (Node >=22.6 type-strips)
import assert from 'node:assert/strict'
import { createMemoryStorage } from './vault.ts'
import { importLocalIntake, listLocalIntakes, intakeApplicationId, importLegacyQAPairs } from './intake.ts'
import { extractQAPairsDeterministic, parsePairs } from '../intake-extract-shared.ts'
import { extractManualIntake, buildIntakeMeta } from '../intake/manual-intake.ts'
import { createVersion, approveVersion } from './repo.ts'
import { freezeApplicationPacket } from './packets.ts'

const SECRET = 'correct-horse-battery-staple'
let passed = 0
async function t(name, fn) {
  try { await fn(); passed++; console.log('PASS', name) }
  catch (e) { process.exitCode = 1; console.log('FAIL', name + ':', e.message) }
}

const SAMPLE = `Acme Accelerator Fall 2026 — application form

1. Tell us about your team — who are the cofounders and why are you together? — 250 words
2. What is your traction to date? — optional
3. How would you describe your go-to-market strategy? — 300 words
`

function extractionFor(text) {
  const payloadBase = {
    source_type: 'manual_paste', raw_input: text,
    source_url: 'https://acme.example.com/apply', source_title: 'Acme Accelerator',
    vertical_hint: 'tech', kind_hint: null,
    captured_at: new Date().toISOString(), capture_method: 'paste',
  }
  return extractManualIntake({ ...payloadBase, metadata: buildIntakeMeta({
    adapterName: 'test', actorId: 'test', route: 'local:intake', payload: payloadBase }) })
}

await t('deterministic extraction produces questions', async () => {
  const ex = extractionFor(SAMPLE)
  assert.equal(ex.questions.length, 3)
  assert.equal(ex.entity.name, 'Acme Accelerator')
})

await t('intake import creates scoped answer slots + catalog record', async () => {
  const s = createMemoryStorage()
  const ex = extractionFor(SAMPLE)
  const res = await importLocalIntake(s, ex, { source_type: 'manual_paste' })
  assert.equal(res.question_count, 3)
  assert.ok(res.application_id.startsWith('local-intake-'))
  const answers = await s.getAll('answers')
  assert.equal(answers.length, 3)
  assert.ok(answers.every((a) => a.scope.application_id === res.application_id))
  const catalog = await s.get('catalog_cache', `intake:${res.application_id}`)
  assert.ok(catalog)
  assert.ok(!JSON.stringify(catalog.blob).includes(SAMPLE), 'raw pasted text never stored')
  assert.equal(catalog.blob.questions.length, 3)
  const intakes = await listLocalIntakes(s)
  assert.equal(intakes.length, 1)
})

await t('re-import does not clobber answered slots', async () => {
  const s = createMemoryStorage()
  const ex = extractionFor(SAMPLE)
  const res = await importLocalIntake(s, ex, { source_type: 'manual_paste' })
  const answers = await s.getAll('answers')
  await createVersion(s, SECRET, {
    answer_id: answers[0].id, title: 'mine', body: 'my answer', method: 'manual' })
  await importLocalIntake(s, ex, { source_type: 'manual_paste' })
  const after = await s.getAll('answers')
  assert.equal(after.length, 3, 'no duplicate slots')
  const versions = await s.getAll('versions')
  assert.equal(versions.length, 1, 'existing version preserved')
})

await t('intake-scoped versions flow through the packet path', async () => {
  const s = createMemoryStorage()
  const ex = extractionFor(SAMPLE)
  const res = await importLocalIntake(s, ex, { source_type: 'manual_paste' })
  const answers = await s.getAll('answers')
  const selections = []
  for (const a of answers) {
    const v = await createVersion(s, SECRET, {
      answer_id: a.id, title: 'v', body: 'answer body', method: 'manual' })
    await approveVersion(s, { version_id: v.id, decision: 'approved', actor_class: 'human' })
    selections.push({
      question_occurrence_id: a.scope.question_occurrence_id,
      version_id: v.id,
      question_text_snapshot: 'Q?',
    })
  }
  const { packet } = await freezeApplicationPacket(s, SECRET, {
    application_id: res.application_id, selections })
  assert.equal(packet.questions.length, 3)
})

await t('scope ids are deterministic + collision-free across different pastes', async () => {
  const ex1 = extractionFor(SAMPLE)
  const ex2 = extractionFor(SAMPLE + '\nExtra question line?\n')
  const id1 = await intakeApplicationId(ex1.entity.slug, ex1.questions)
  const id2 = await intakeApplicationId(ex2.entity.slug, ex2.questions)
  assert.notEqual(id1, id2)
  // same paste → same id (idempotent re-import)
  const id1b = await intakeApplicationId(ex1.entity.slug, ex1.questions)
  assert.equal(id1, id1b)
})


// ---------------- AM-0009/0102: legacy Q&A import ----------------

const QA_SAMPLE = `Y Combinator W26 Application

Q: Tell us about your team.
A: We are two engineers and one domain expert. We met at a previous company and have shipped together for three years.

Q: What problem are you solving?
A: Founders spend 40+ hours per accelerator application repeating the same answers. We help them reuse their best material safely.

Q: Describe your traction.
A: 120 beta users, 340 applications drafted, NPS of 62 in our first cohort.
`

await t('deterministic Q/A parser extracts pairs', async () => {
  const pairs = extractQAPairsDeterministic(QA_SAMPLE)
  assert.equal(pairs.length, 3)
  assert.equal(pairs[0].confidence, 'draft', 'deterministic parse never claims higher confidence')
  assert.ok(pairs[1].answer_text.includes('40+ hours'))
})

await t('legacy import lands versions in the bank — re-import extends not duplicates', async () => {
  const s = createMemoryStorage()
  const pairs = extractQAPairsDeterministic(QA_SAMPLE)
  const r1 = await importLegacyQAPairs(s, SECRET, pairs, { label: 'yc-w26' })
  assert.equal(r1.created_answers, 3)
  assert.equal(r1.added_versions, 3)
  const r2 = await importLegacyQAPairs(s, SECRET, pairs, { label: 'yc-w26-reimport' })
  assert.equal(r2.created_answers, 0, 'same pairs dedupe onto existing slots')
  assert.equal(r2.added_versions, 3, 're-import adds versions, not answers')
  const answers = await s.getAll('answers')
  assert.equal(answers.length, 3)
  const versions = await s.getAll('versions')
  assert.equal(versions.length, 6)
})

await t('imported bodies stay encrypted + raw paste never stored', async () => {
  const s = createMemoryStorage()
  const pairs = extractQAPairsDeterministic(QA_SAMPLE)
  await importLegacyQAPairs(s, SECRET, pairs, { label: 'yc' })
  const versions = await s.getAll('versions')
  assert.ok(!versions[0].body.includes('120 beta users'), 'ciphertext at rest')
  const catalog = await s.getAll('catalog_cache')
  assert.ok(!JSON.stringify(catalog).includes('Founders spend 40+ hours'), 'no raw text in catalog')
})

await t('provider-shaped JSON output parses via parsePairs', async () => {
  const llm = '```json\n[{"question_text":"Team?","answer_text":"Three cofounders.","theme":"team","confidence":"solid"},{"question_text":"Traction?","answer_text":"x","theme":"traction","confidence":"locked"}]\n```'
  const pairs = parsePairs(llm)
  assert.equal(pairs.length, 1, 'short answer dropped per contract')
  assert.equal(pairs[0].confidence, 'solid')
})



await t('IR-031: distinct questions sharing a 280-char prefix get separate slots', async () => {
  const s = createMemoryStorage()
  const shared = 'Shared prefix question '.padEnd(280, 'x')
  const pairs = [
    { question_text: shared + 'A', answer_text: 'First distinct answer here.', theme: 'other', confidence: 'draft' },
    { question_text: shared + 'B', answer_text: 'Second distinct answer here.', theme: 'other', confidence: 'draft' },
    { question_text: '', answer_text: 'An answer with no question at all.', theme: 'other', confidence: 'draft' },
  ]
  const res = await importLegacyQAPairs(s, SECRET, pairs, { label: 'test' })
  assert.equal(res.created_answers, 2, 'two distinct questions = two slots')
  assert.equal(res.skipped_short, 1, 'empty question skipped')
})

await t('IR-032: bare ?-line inside an answer stays answer text', async () => {
  const pairs = extractQAPairsDeterministic(
    'Q: Tell us about the team?\nA: We wondered — is this really the right path? Yes it is.\nA question inside?'
  )
  assert.equal(pairs.length, 1, 'mid-answer ?-line must not split the pair')
  assert.ok(pairs[0].answer_text.includes('right path?'))
  assert.ok(pairs[0].answer_text.includes('A question inside?'))
})


await t('blank-guard: Cf-only body skipped (canon invariant parity with createVersion)', async () => {
  const s = createMemoryStorage()
  const zwsp = '\u200B'.repeat(20)
  const pairs = [
    { question_text: 'A real question here?', answer_text: zwsp, theme: 'other', confidence: 'draft' },
    { question_text: 'A real question here?', answer_text: 'A real substantive answer body.', theme: 'other', confidence: 'draft' },
  ]
  const res = await importLegacyQAPairs(s, SECRET, pairs, { label: 'cf' })
  assert.equal(res.added_versions, 1, 'Cf-only body refused — only the real answer lands')
})


console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`)
