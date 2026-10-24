// §6 merge-completion sequence as a guarded test: the 7-step run through the
// personal workspace MCP on one persistent answer bank.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { seededWorkspace, inbox, startServer, FORM_MD } from './mcp-helpers.mjs'

const FORM2 = '# Other Grant 2027\n\nOrganization: Second Org\n\n1. What problem are you solving? *\n2. Describe your budget. *\n'
const { v, root } = await seededWorkspace('m10-demo')
inbox(root, 'form.md', FORM_MD)
inbox(root, 'form2.md', FORM2)
fs.mkdirSync(path.join(root, 'inbox/history'), { recursive: true })
fs.writeFileSync(path.join(root, 'inbox/history/past.md'), [
  '---', 'program: Past Grant', 'date: 2025-11-01', '---', '',
  'Q: What problem are you solving?', 'A: We reduce grant-writing time for small nonprofits.',
].join('\n'))

test('§6 merge sequence: import, index, history, review, human approval boundary, reuse, assemble, restart persistence', async () => {
  const c = startServer(root)
const log = (n, s) => console.log(`  ${n}: ${s}`)
try {
  await c.initialize()
  // 1. import blank + index
  const imp = await c.call('import_local_application', { file: 'form.md' })
  const appId = imp.application_id ?? imp.instance_id
  const det = await c.call('inspect_extracted_questions', { application_id: appId })
  assert.equal(det.question_count, 3)
  log('1 import+index', `${det.question_count} questions indexed`)
  const occ0 = det.untrusted_content.data.questions[0].question_occurrence_id
  // 2. import completed history
  const hist = await c.call('import_history', { folder: 'history' })
  const ansId = hist.files[0].answer_ids[0]
  assert.equal(hist.counts.answers, 1)
  log('2 history', 'submitted answers staged unconfirmed')
  // 3. combined review sheet
  const st = await c.call('read_review_status', { application_id: appId })
  log('3 review sheet', `${st.questions.length} rows; statuses: ${[...new Set(st.questions.map(q=>q.status))].join(',')}`)
  // 4. approval goes through the human mechanism — agent stages a link + draft, humans approve in browser
  await c.call('link_history', { application_id: appId, question_occurrence_id: occ0, history_answer_id: ansId, reason: 'same question' })
  const rd = await c.call('present_review_decisions', { application_id: appId })
  const appr = await c.call('approve_answer', { application_id: appId })
  assert.equal(appr.status, 'requires_human', 'approval stays human-only')
  log('4 approval', 'human-only boundary held')
  // 5. second blank application
  const imp2 = await c.call('import_local_application', { file: 'form2.md' })
  const appId2 = imp2.application_id ?? imp2.instance_id
  log('5 second blank', `imported ${appId2}`)
  // 6. assess reuse + markdown draft
  const st2 = await c.call('read_review_status', { application_id: appId2 })
  const recs = st2.questions.map(q => q.recommendation?.classification).filter(Boolean)
  assert.ok(recs.length > 0, 'reuse assessment emitted')
  log('6 reuse assess', `recommendations: ${recs.join(',')}`)
  const asm = await c.call('assemble_application', { application_id: appId2, map: [] })
  assert.equal(asm.status, 'ok')
  assert.ok(asm.saved_to, 'markdown draft written')
  log('6 assemble', `unresolved: ${asm.unresolved?.length ?? 0}`)
  await c.close()
  // 7. restart + same records
  const c2 = startServer(root)
  await c2.initialize()
  const st3 = await c2.call('read_review_status', { application_id: appId })
  assert.equal(st3.questions.find(q=>q.question_occurrence_id===occ0)?.candidate_links?.length, 1, 'link persists across restart')
  assert.equal(st3.questions.length, 3)
  log('7 restart', 'records persist')
  await c2.close()
} finally {}
})
