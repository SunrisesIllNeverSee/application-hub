// LF-24 legacy-import tests — self-contained, no test runner.
// Run: node lib/aqua-local/run-legacy-import-tests.mjs  (Node >=22.6 type-strips .ts imports)
import assert from 'node:assert/strict'
import { createMemoryStorage } from './vault.ts'
import { listVersions, readVersion } from './repo.ts'
import { canonicalJson, sha256Hex } from './crypto.ts'
import {
  importLegacyAnswers,
  runLegacyImport,
  LegacyExportShapeError,
  LegacyExportUserMismatchError,
  LEGACY_IMPORT_APPLICATION_ID,
} from './legacy-import.ts'

const SECRET = 'correct-horse-battery-staple'
let passed = 0
async function t(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`) }
  catch (e) { console.error(`FAIL ${name}: ${e.message}`); process.exitCode = 1 }
}

// Mirrors the server route: sha over canonicalJson({title, body}).
async function makeRow(sourceId, title, body, extra = {}) {
  return {
    source_id: sourceId,
    archived_question_id: 'aq-' + sourceId,
    question_text: title,
    answer_content: body,
    version: 1,
    word_count: body.split(/\s+/).filter(Boolean).length,
    confidence: 'draft',
    created_at: '2024-01-01T00:00:00.000Z',
    last_updated: '2024-01-02T00:00:00.000Z',
    sha256: await sha256Hex(canonicalJson({ title, body })),
    ...extra,
  }
}

async function makeExport(rows, over = {}) {
  return {
    format: 'aqua-legacy-answers',
    format_version: 1,
    user_id: 'user-1',
    exported_at: new Date().toISOString(),
    answers: rows,
    ...over,
  }
}

// --- import: rows land as answers+imported versions with provenance ---
await t('imports rows as imported versions, preserves source created_at', async () => {
  const s = createMemoryStorage()
  const payload = await makeExport([
    await makeRow('src-1', 'Why this program?', 'Because it funds research.'),
  ])
  const res = await importLegacyAnswers(s, SECRET, payload)
  assert.equal(res.imported, 1)
  const answers = await s.getAll('answers')
  assert.equal(answers.length, 1)
  assert.equal(answers[0].scope.application_id, LEGACY_IMPORT_APPLICATION_ID)
  assert.equal(answers[0].scope.question_occurrence_id, 'src-1')
  const versions = await listVersions(s, answers[0].id)
  assert.equal(versions.length, 1)
  assert.equal(versions[0].method, 'imported')
  assert.equal(versions[0].provenance, 'legacy-import:src-1')
  assert.equal(versions[0].created_at, '2024-01-01T00:00:00.000Z') // preserved
  const read = await readVersion(s, SECRET, versions[0].id)
  assert.equal(read.body, 'Because it funds research.')
})

// --- ledger entry written ---
await t('writes imports ledger entry with counts', async () => {
  const s = createMemoryStorage()
  const payload = await makeExport([await makeRow('src-1', 'q', 'a real answer body')])
  const res = await importLegacyAnswers(s, SECRET, payload)
  const ledger = await s.get('imports', res.batch_id)
  assert.ok(ledger)
  assert.deepEqual(ledger.source_ids, ['src-1'])
  assert.equal(ledger.counts.imported, 1)
})

// --- dedup on re-import ---
await t('second import of same payload is a no-op (dedup by source_id)', async () => {
  const s = createMemoryStorage()
  const payload = await makeExport([
    await makeRow('src-1', 'q1', 'first answer body'),
    await makeRow('src-2', 'q2', 'second answer body'),
  ])
  const r1 = await importLegacyAnswers(s, SECRET, payload)
  assert.equal(r1.imported, 2)
  const r2 = await importLegacyAnswers(s, SECRET, payload)
  assert.equal(r2.imported, 0)
  assert.equal(r2.skipped_duplicates, 2)
  assert.equal((await s.getAll('answers')).length, 2)
  assert.equal((await s.getAll('versions')).length, 2)
})

// --- sha mismatch flagged + skipped ---
await t('sha256 mismatch is flagged and the row is not imported', async () => {
  const s = createMemoryStorage()
  const bad = await makeRow('src-bad', 'q', 'tampered content body')
  bad.sha256 = 'deadbeef'.repeat(8)
  const good = await makeRow('src-ok', 'q', 'good answer body here')
  const res = await importLegacyAnswers(s, SECRET, await makeExport([bad, good]))
  assert.deepEqual(res.sha_mismatches, ['src-bad'])
  assert.equal(res.imported, 1)
  const answers = await s.getAll('answers')
  assert.equal(answers.length, 1)
  assert.equal(answers[0].scope.question_occurrence_id, 'src-ok')
})

// --- blank bodies refused ---
await t('blank/invisible bodies are skipped, not imported', async () => {
  const s = createMemoryStorage()
  const row = await makeRow('src-blank', 'q', '   ')
  row.sha256 = await sha256Hex(canonicalJson({ title: 'q', body: '   ' }))
  const res = await importLegacyAnswers(s, SECRET, await makeExport([row]))
  assert.deepEqual(res.blank_skipped, ['src-blank'])
  assert.equal(res.imported, 0)
})

// --- cross-account guard client-side ---
await t('payload for a different user is refused when expectedUserId given', async () => {
  const s = createMemoryStorage()
  const payload = await makeExport([await makeRow('src-1', 'q', 'body body body')], { user_id: 'other-user' })
  await assert.rejects(
    () => importLegacyAnswers(s, SECRET, payload, { expectedUserId: 'user-1' }),
    LegacyExportUserMismatchError,
  )
  assert.equal((await s.getAll('versions')).length, 0)
})

// --- shape validation ---
await t('malformed payloads refused', async () => {
  const s = createMemoryStorage()
  await assert.rejects(() => importLegacyAnswers(s, SECRET, null), LegacyExportShapeError)
  await assert.rejects(() => importLegacyAnswers(s, SECRET, { format: 'wrong', answers: [] }), LegacyExportShapeError)
  await assert.rejects(
    () => importLegacyAnswers(s, SECRET, { format: 'aqua-legacy-answers', format_version: 99, answers: [] }),
    LegacyExportShapeError,
  )
})

// --- injected fetch path (UI confirmation boundary lives in the caller) ---
await t('runLegacyImport fetches via injected fetcher then imports', async () => {
  const s = createMemoryStorage()
  const payload = await makeExport([await makeRow('src-9', 'q', 'fetched answer body')])
  let called = 0
  const res = await runLegacyImport(s, SECRET, async () => { called++; return payload })
  assert.equal(called, 1)
  assert.equal(res.imported, 1)
})

console.log(`\n${passed} tests passed`)
