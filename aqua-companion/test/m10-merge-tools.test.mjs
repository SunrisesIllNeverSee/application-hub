// Plugin-merge tools (m10): link_history, link_answer, mark_question,
// update_question, add_question, assemble_application — happy path through the
// real stdio server, plus restart persistence of the new record kinds.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { seededWorkspace, inbox, startServer, FORM_MD } from './mcp-helpers.mjs'

const HISTORY_MD = [
  '---', 'program: Past Grant', 'date: 2025-11-01', '---', '',
  'Q: What problem are you solving?', 'A: We reduce grant-writing time for small nonprofits.',
].join('\n')

async function setup() {
  const { v, root } = await seededWorkspace('m10-merge')
  inbox(root, 'form.md', FORM_MD)
  fs.mkdirSync(path.join(root, 'inbox/history'), { recursive: true })
  fs.writeFileSync(path.join(root, 'inbox/history/past.md'), HISTORY_MD)
  const c = startServer(root)
  await c.initialize()
  const imp = await c.call('import_local_application', { file: 'form.md' })
  const appId = imp.application_id ?? imp.instance_id
  const det = await c.call('inspect_extracted_questions', { application_id: appId })
  const qs = det.untrusted_content.data.questions
  return { v, root, c, appId, occ0: qs[0].question_occurrence_id, occ1: qs[1].question_occurrence_id }
}

const refused = (r) => r.__isError === true || r.status === 'error' || r.status === 'refused'

test('merge tools: link, mark, note, add, assemble — staged, surfaced, persistent', async () => {
  const { root, c, appId, occ0, occ1 } = await setup()
  try {
    const hist = await c.call('import_history', { folder: 'history' })
    const ansId = hist.files?.[0]?.answer_ids?.[0]
    assert.ok(ansId, 'import_history reports answer_ids for link_history')

    const lh = await c.call('link_history', { application_id: appId, question_occurrence_id: occ0, history_answer_id: ansId, reason: 'same intent' })
    assert.equal(lh.status, 'ok')
    assert.equal(lh.link_type, 'history_candidate')

    const bad = await c.call('link_history', { application_id: appId, question_occurrence_id: occ0, history_answer_id: 'not-an-answer', reason: 'x' })
    assert.equal(refused(bad), true, 'unknown history answer is refused')

    const mq = await c.call('mark_question', { application_id: appId, question_occurrence_id: occ1, state: 'skipped', reason: 'optional field left blank' })
    assert.equal(mq.status, 'ok')

    const noReason = await c.call('mark_question', { application_id: appId, question_occurrence_id: occ1, state: 'not_applicable' })
    assert.equal(refused(noReason), true, 'mark without reason is refused')

    const uq = await c.call('update_question', { application_id: appId, question_occurrence_id: occ0, summary: 'problem statement', required: 'required' })
    assert.equal(uq.status, 'ok')

    const aq = await c.call('add_question', { application_id: appId, order: 9, text: 'What is your budget?', required: 'optional' })
    assert.equal(aq.status, 'ok')
    assert.ok(aq.question_occurrence_id)

    const st = await c.call('read_review_status', { application_id: appId })
    const row0 = st.questions.find((q) => q.question_occurrence_id === occ0)
    const row1 = st.questions.find((q) => q.question_occurrence_id === occ1)
    assert.equal(row0.candidate_links.length, 1)
    assert.equal(row0.candidate_links[0].link_type, 'history_candidate')
    assert.equal(row1.mark.state, 'skipped')
    assert.ok(st.questions.some((q) => q.question_occurrence_id === aq.question_occurrence_id), 'user-added question gets a review row')
    assert.ok(st.user_added_questions.some((q) => q.question_occurrence_id === aq.question_occurrence_id))

    const pp = await c.call('prepare_packet', { application_id: appId })
    assert.equal(pp.blockers.filter((b) => b.question_occurrence_id === occ1).length, 0, 'skipped mark resolves the question for packet readiness')

    const laBad = await c.call('link_answer', { application_id: appId, question_occurrence_id: occ0, version_id: 'nonexistent', reason: 'x' })
    assert.equal(refused(laBad), true, 'link_answer refuses unknown version')

    const asBad = await c.call('assemble_application', { application_id: appId, map: [{ question_occurrence_id: occ0, version_id: 'nonexistent' }] })
    assert.equal(refused(asBad), true, 'assemble refuses unapproved/unknown versions')
  } finally {
    await c.close()
  }

  // §6 restart persistence: records survive a fresh server/model
  const c2 = startServer(root)
  try {
    await c2.initialize()
    const st = await c2.call('read_review_status', { application_id: appId })
    const row0 = st.questions.find((q) => q.question_occurrence_id === occ0)
    const row1 = st.questions.find((q) => q.question_occurrence_id === occ1)
    assert.equal(row0.candidate_links.length, 1, 'link persists across restart')
    assert.equal(row1.mark.state, 'skipped', 'mark persists across restart')
    assert.ok(st.user_added_questions.length >= 1, 'user-added question persists across restart')
  } finally {
    await c2.close()
  }
})
