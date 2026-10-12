// Vault score gate-parity tests — uses the @/ alias shim from governance.
// Run: node --import file:///$AQUARND/.../ir-node-alias.mjs lib/aqua-local-client/run-score-tests.mjs
import assert from 'node:assert/strict'
import { createMemoryStorage } from '../aqua-local/vault.ts'
import { createAnswer, createVersion, approveVersion } from '../aqua-local/repo.ts'
import { computeVaultScore } from './local-score.ts'

const SECRET = 'correct-horse-battery-staple'
let passed = 0
async function t(name, fn) {
  try { await fn(); passed++; console.log('PASS', name) }
  catch (e) { process.exitCode = 1; console.log('FAIL', name + ':', e.message) }
}

await t('restored approval after real approval does NOT count (latest-first parity with freeze)', async () => {
  const s = createMemoryStorage()
  const answer = await createAnswer(s, { application_id: 'a', question_occurrence_id: 'q1' })
  const v = await createVersion(s, SECRET, { answer_id: answer.id, title: 'v', body: 'hello world', method: 'manual' })
  await approveVersion(s, { version_id: v.id, actor_class: 'human', decision: 'approved' })
  // simulate a restored row landing LATER (newer at) — latest wins: refused
  const approvals = await s.getAll('approvals')
  const restored = { ...approvals[0], id: 'restored-1', restored_from_backup: true, seq: approvals[0].seq + 10 }
  await s.put('approvals', restored)
  const score = await computeVaultScore(s, SECRET)
  assert.equal(score.approvedCount, 0, 'restored latest decision must not count as approved')
})

await t('real human approval counts', async () => {
  const s = createMemoryStorage()
  const answer = await createAnswer(s, { application_id: 'a', question_occurrence_id: 'q1' })
  const v = await createVersion(s, SECRET, { answer_id: answer.id, title: 'v', body: 'hello', method: 'manual' })
  await approveVersion(s, { version_id: v.id, actor_class: 'human', decision: 'approved' })
  const score = await computeVaultScore(s, SECRET)
  assert.equal(score.approvedCount, 1)
})

await t('agent-classed approval never counts', async () => {
  const s = createMemoryStorage()
  const answer = await createAnswer(s, { application_id: 'a', question_occurrence_id: 'q1' })
  const v = await createVersion(s, SECRET, { answer_id: answer.id, title: 'v', body: 'hello', method: 'manual' })
  await approveVersion(s, { version_id: v.id, actor_class: 'agent', decision: 'approved' })
  const score = await computeVaultScore(s, SECRET)
  assert.equal(score.approvedCount, 0)
})

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`)
