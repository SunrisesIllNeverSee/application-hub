// Hosted input path (m10): the import tools accept file content inline
// (file_name + content_base64, or files: [{name, content_base64}], or a bare
// file_sha256 for evidence) so a remote client with no inbox/ filesystem can
// upload documents. The local stdio path keeps working identically; the
// content path must produce the same rows, refuse malformed input cleanly,
// and enforce the same size caps. All content is synthetic.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { VAULT, loadApp } from './helpers.mjs'
import { FORM_MD, inbox, seededWorkspace, startServer } from './mcp-helpers.mjs'

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')
const refused = (r) => r.__isError === true || r.status === 'error' || r.status === 'refused'

const HISTORY_MD = [
  '---', 'program: Past Grant', 'date: 2025-11-01', '---', '',
  'Q: What problem are you solving?', 'A: We reduce grant-writing time for small nonprofits.',
].join('\n')

test('content arguments give the same import as the inbox file; bad input is refused cleanly', async () => {
  const { root } = await seededWorkspace('m10-hosted-import')
  inbox(root, 'form.md', FORM_MD)
  const c = startServer(root)
  try {
    await c.initialize()

    // identical extraction through both paths
    const viaFile = await c.call('import_local_application', { file: 'form.md' })
    const viaContent = await c.call('import_local_application', { file_name: 'form.md', content_base64: b64(FORM_MD) })
    assert.equal(viaFile.status, 'ok', JSON.stringify(viaFile))
    assert.equal(viaContent.status, 'ok', JSON.stringify(viaContent))
    const rows = (r) => r.untrusted_content.data.questions.map((q) => ({ text: q.text, order: q.order, requirements: q.requirements, section: q.section }))
    assert.deepEqual(rows(viaContent), rows(viaFile), 'content-argument import produces identical question rows to the inbox path')
    assert.equal(viaContent.untrusted_content.data.deadline, viaFile.untrusted_content.data.deadline)
    assert.equal(viaContent.counts.questions, viaFile.counts.questions)

    // both paths at once: ambiguous
    const both = await c.call('import_local_application', { file: 'form.md', file_name: 'form.md', content_base64: b64(FORM_MD) })
    assert.equal(refused(both), true, 'file + content_base64 is refused')
    assert.equal(both.reason, 'invalid_arguments')

    // malformed base64: a tool refusal, not a crash
    for (const bad of ['%%%not-base64%%%', 'TQ', 'a=b=c', 'not a string!!']) {
      const r = await c.call('import_local_application', { file_name: 'form.md', content_base64: bad })
      assert.equal(refused(r), true, `malformed base64 ${JSON.stringify(bad)}`)
      assert.equal(r.reason, 'invalid_base64', JSON.stringify(r))
    }

    // an extension the tool does not accept
    const badExt = await c.call('import_local_application', { file_name: 'form.exe', content_base64: b64(FORM_MD) })
    assert.equal(refused(badExt), true)
    assert.equal(badExt.reason, 'unsupported_format')
    const traversal = await c.call('import_local_application', { file_name: '../form.md', content_base64: b64(FORM_MD) })
    assert.equal(refused(traversal), true)
    const noName = await c.call('import_local_application', { content_base64: b64(FORM_MD) })
    assert.equal(refused(noName), true)
    const neither = await c.call('import_local_application', {})
    assert.equal(refused(neither), true)

    // oversized content: 5 MB + 1 byte decodes past the cap (the encoded
    // string still fits the schema bound exactly)
    const big = await c.call('import_local_application', { file_name: 'big.md', content_base64: Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64') })
    assert.equal(refused(big), true)
    assert.equal(big.reason, 'too_large', JSON.stringify(big))
  } finally {
    await c.close()
  }
})

test('history files, evidence hash and observation accept uploaded content too', async () => {
  const { v, root } = await seededWorkspace('m10-hosted-rest')
  inbox(root, 'confirm.txt', 'Synthetic submission confirmation.')
  const app = await loadApp()
  const exported = await app.exportPacket(v.storage, v.packet.packet_id, VAULT)
  const c = startServer(root)
  try {
    await c.initialize()

    // import_history with a files array stages the same as an inbox folder
    const hist = await c.call('import_history', { files: [{ name: 'past.md', content_base64: b64(HISTORY_MD) }] })
    assert.equal(hist.status, 'ok', JSON.stringify(hist))
    assert.equal(hist.staged, true)
    assert.equal(hist.counts.files, 1)
    assert.equal(hist.counts.applications, 1)
    assert.equal(hist.counts.answers, 1)
    // the same content through the inbox folder dedupes on the source hash
    fs.mkdirSync(path.join(root, 'inbox/history'), { recursive: true })
    fs.writeFileSync(path.join(root, 'inbox/history/past.md'), HISTORY_MD)
    const again = await c.call('import_history', { folder: 'history' })
    assert.equal(again.status, 'ok')
    assert.equal(again.files[0].reason, 'already_imported', 'uploaded and inbox files share the same dedupe hash')
    const bothHist = await c.call('import_history', { folder: 'history', files: [{ name: 'x.md', content_base64: b64('x') }] })
    assert.equal(refused(bothHist), true, 'folder + files is refused')
    const badHist = await c.call('import_history', { files: [{ name: 'past.exe', content_base64: b64(HISTORY_MD) }] })
    assert.equal(refused(badHist), true)
    assert.equal(badHist.reason, 'unsupported_format')

    // attach_evidence: file_sha256 alone needs no file at all
    const ev = await c.call('attach_evidence', { file_sha256: 'a'.repeat(64), title: 'Synthetic hash evidence' })
    assert.equal(ev.status, 'ok', JSON.stringify(ev))
    assert.equal(ev.content_sha256, 'a'.repeat(64))
    assert.equal(ev.verification, 'unverified')
    const badSha = await c.call('attach_evidence', { file_sha256: 'not-a-hash', title: 'x' })
    assert.equal(refused(badSha), true)
    const shaPlus = await c.call('attach_evidence', { file_sha256: 'b'.repeat(64), file: 'confirm.txt', title: 'x' })
    assert.equal(refused(shaPlus), true, 'file_sha256 + file is refused')
    const evUp = await c.call('attach_evidence', { file_name: 'confirm.txt', content_base64: b64('Synthetic submission confirmation.'), title: 'Uploaded evidence' })
    assert.equal(evUp.status, 'ok', JSON.stringify(evUp))

    // record_observed_submission via uploaded text
    const ob = await c.call('record_observed_submission', { file_name: 'confirm.txt', content_base64: b64('Synthetic submission confirmation.'), packet_id: v.packet.packet_id })
    assert.equal(ob.status, 'recorded_unattested', JSON.stringify(ob))
    assert.equal(ob.marked_submitted, false)

    // verify_packet via uploaded packet export (.json only)
    const vp = await c.call('verify_packet', { file_name: 'packet.json', content_base64: b64(exported) })
    assert.equal(vp.status, 'ok', JSON.stringify(vp))
    assert.equal(vp.verified, true)
    assert.equal(vp.file, 'packet.json')
    const noJson = await c.call('verify_packet', { file_name: 'packet.txt', content_base64: b64(exported) })
    assert.equal(refused(noJson), true)
    assert.equal(noJson.reason, 'unsupported_format')
    const bothVp = await c.call('verify_packet', { file: 'confirm.txt', file_name: 'packet.json', content_base64: b64(exported) })
    assert.equal(refused(bothVp), true)
  } finally {
    await c.close()
  }
})
