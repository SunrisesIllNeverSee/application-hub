// §6 merge-completion sequence as a guarded test: the 7-step run through the
// personal workspace MCP on one persistent answer bank.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { seededWorkspace, inbox, startServer, FORM_MD } from './mcp-helpers.mjs'

const FORM2 = '# Other Grant 2027\n\nOrganization: Second Org\n\n1. What problem are you solving? *\n2. Describe your budget. *\n'
const HISTORY_MD = [
  '---', 'program: Past Grant', 'date: 2025-11-01', '---', '',
  'Q: What problem are you solving?', 'A: We reduce grant-writing time for small nonprofits.',
].join('\n')

test('§6 merge sequence: import, index, history, review, human approval boundary, reuse, assemble, restart persistence', async () => {
  const { v, root } = await seededWorkspace('m10-seq')
  inbox(root, 'form.md', FORM_MD)
  inbox(root, 'form2.md', FORM2)
  fs.mkdirSync(path.join(root, 'inbox/history'), { recursive: true })
  fs.writeFileSync(path.join(root, 'inbox/history/past.md'), HISTORY_MD)

  const c = startServer(root)
  let occ0, appId
  try {
    await c.initialize()
    // 1. import blank + index
    const imp = await c.call('import_local_application', { file: 'form.md' })
    appId = imp.application_id ?? imp.instance_id
    const det = await c.call('inspect_extracted_questions', { application_id: appId })
    assert.equal(det.question_count, 3)
    occ0 = det.untrusted_content.data.questions[0].question_occurrence_id
    // 2. import completed history (staged unconfirmed)
    const hist = await c.call('import_history', { folder: 'history' })
    assert.equal(hist.counts.answers, 1)
    // 3. combined review sheet
    const st = await c.call('read_review_status', { application_id: appId })
    assert.equal(st.questions.length, 3)
    // 4. approval path is human-only: agent links a candidate; the tool refuses to approve
    const link = await c.call('link_history', {
      application_id: appId, question_occurrence_id: occ0,
      history_answer_id: hist.files[0].answer_ids[0], reason: 'same question',
    })
    assert.equal(link.status, 'ok')
    const rd = await c.call('present_review_decisions', { application_id: appId })
    assert.ok(rd.saved_to, 'offline review file built')
    const appr = await c.call('approve_answer', { application_id: appId })
    assert.equal(appr.status, 'requires_human', 'approval stays human-only')
    // 5. second blank application
    const imp2 = await c.call('import_local_application', { file: 'form2.md' })
    const appId2 = imp2.application_id ?? imp2.instance_id
    assert.ok(appId2)
    // 6. assess reuse + assemble markdown draft
    const st2 = await c.call('read_review_status', { application_id: appId2 })
    assert.ok(st2.questions.some((q) => q.recommendation), 'reuse assessment emitted')
    const asm = await c.call('assemble_application', { application_id: appId2, map: [] })
    assert.equal(asm.status, 'ok')
    assert.ok(asm.saved_to, 'markdown draft written')
  } finally {
    await c.close()
  }

  // 7. restart the host: same records, same state
  const c2 = startServer(root)
  try {
    await c2.initialize()
    const st3 = await c2.call('read_review_status', { application_id: appId })
    assert.equal(st3.questions.find((q) => q.question_occurrence_id === occ0)?.candidate_links?.length, 1, 'link persists across restart')
    assert.equal(st3.questions.length, 3, 'records persist across restart')
    // approval state persists across restart too: the vault-approved version
    // imported in the seed is still reported approved on its instance
    const stV = await c2.call('read_review_status', { application_id: v.inst.application_id })
    const approvedRow = stV.questions.find((q) => q.question_occurrence_id === v.q1)
    assert.equal(approvedRow?.approved_version_id, v.version.id, 'human approval persists across restart')
    assert.ok(['approved', 'included_in_packet'].includes(approvedRow?.status), 'approval-derived status persists across restart')
  } finally {
    await c2.close()
  }
})
