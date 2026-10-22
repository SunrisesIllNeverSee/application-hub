// Agent interface, tool level: every capability's happy path on a synthetic
// workspace (imported vault backup with an approved, frozen, signed packet),
// driven through the real child-process server.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { MARK, VAULT, loadApp, readManifest, run, writeFile } from './helpers.mjs'
import { CATALOG_FIXTURE, FORM_MD, UNTRUSTED_NOTICE, inbox, seededWorkspace, snapshotRecords, startServer, syntheticDocx } from './mcp-helpers.mjs'

test('every capability works end to end on a synthetic workspace', async () => {
  const { v, dir, root } = await seededWorkspace('mcp-tools')
  const app = await loadApp()
  // public catalog from an exported file (no network in this test)
  const r0 = await run(['catalog', 'import-file', writeFile(dir, 'catalog.json', JSON.stringify(CATALOG_FIXTURE)), '--workspace', root, '--yes'])
  assert.equal(r0.code, 0, r0.err)
  inbox(root, 'form.md', FORM_MD)
  inbox(root, 'pilot-results.txt', `Synthetic pilot: 40 synthetic users. ${MARK}`)
  inbox(root, 'confirmation.txt', 'Thank you, your synthetic application was received.')
  // a real packet export from the app vault, and a tampered copy
  const exported = await app.exportPacket(v.storage, v.packet.packet_id, VAULT)
  inbox(root, 'packet.json', exported)
  const tampered = JSON.parse(exported)
  tampered.packet.questions[0].answer_body += ' (edited)'
  inbox(root, 'packet-tampered.json', JSON.stringify(tampered))

  const approvalsBefore = snapshotRecords(root).approvals
  const c = startServer(root)
  try {
    await c.initialize()

    // 1 discover
    const d = await c.call('discover_applications', { query: 'synthetic accelerator' })
    assert.equal(d.status, 'ok')
    assert.ok(d.catalog_program_ids.includes('p-synth-1'))
    assert.equal(d.catalog_program_ids.includes('p-not-approved'), false, 'non-canonical rows are never cached')
    assert.equal(d.catalog_program_ids.includes('p-not-registered'), false, 'slugs outside the approval registry are never cached')
    assert.ok(d.workspace_instance_ids.includes(v.inst.instance_id))
    assert.equal(d.untrusted_content.notice, UNTRUSTED_NOTICE)
    assert.equal(d.catalog.endpoint_configured, false)

    // 2 details: catalog program and workspace application
    const pd = await c.call('get_application_details', { id: 'yc-summer-2026' })
    assert.equal(pd.kind, 'catalog_program')
    assert.equal(pd.untrusted_content.data.questions[0].text, 'What problem are you solving? (200 words max)')
    assert.equal(pd.untrusted_content.data.questions[0].requirements.word_limit, 200)
    assert.equal(pd.untrusted_content.data.deadline.at, '2026-11-01T07:00:00Z')
    assert.match(pd.untrusted_content.data.deadline.timezone, /UTC/)
    assert.equal(pd.verification.catalog_status, 'canonical')
    const wd = await c.call('get_application_details', { id: v.inst.instance_id })
    assert.equal(wd.kind, 'workspace_application')
    assert.equal(wd.origin, 'browser_vault')
    assert.equal(wd.untrusted_content.data.questions[0].text, 'What are you building? (150 words)')
    const vd = await c.call('get_application_details', { id: 'program:synthetic-1' })
    assert.equal(vd.kind, 'vault_cached_program')
    assert.equal(vd.untrusted_content.data.name, 'Synthetic Program')

    // 3 import from inbox (vendored parsers), exact wording, uncertain items reported
    const imp = await c.call('import_local_application', { file: 'form.md' })
    assert.equal(imp.status, 'ok', JSON.stringify(imp))
    assert.equal(imp.counts.questions, 3)
    const qs = imp.untrusted_content.data.questions
    assert.deepEqual(qs.map((q) => q.text), ['What problem are you solving? (200 words max)', 'Describe your team. *', 'What have you shipped in the last 12 months?'])
    assert.equal(qs[0].requirements.word_limit, 200)
    assert.equal(imp.untrusted_content.data.deadline, '2027-03-03')
    assert.equal(imp.untrusted_content.data.deadline_hint.timezone, 'PT')
    assert.ok(imp.instance_id.startsWith('LA-'))

    // 5 inspect
    const ins = await c.call('inspect_extracted_questions', { application_id: imp.instance_id })
    assert.equal(ins.question_count, 3)
    assert.equal(ins.has_source_document, true)
    assert.ok(ins.untrusted_content.data.questions[2].requirements.time_context.length >= 1, 'time context kept')

    // 6 match against cached canonical questions
    const mt = await c.call('match_canonical_questions', { application_id: imp.instance_id })
    assert.equal(mt.catalog_available, true)
    const m1 = mt.results.find((r) => r.occurrence === imp.question_ids[0])
    assert.ok(['exact', 'normalized'].includes(m1.tier), m1.tier)
    assert.equal(m1.canonical_question_id, 'aq-1')
    for (const r of mt.results) if (r.tier === 'semantic') assert.equal(r.needs_review, true)
    const adhoc = await c.call('match_canonical_questions', { questions: ['Who is on your founding team and why?'] })
    assert.ok(['semantic', 'novel'].includes(adhoc.results[0].tier))
    assert.equal(adhoc.results[0].needs_review || adhoc.results[0].tier === 'novel', true)

    // 7 search the private bank (decrypted in memory)
    const s = await c.call('search_answer_bank', { query: 'synthetic widget' })
    const hit = s.results.find((x) => x.id === v.version.id)
    assert.ok(hit, JSON.stringify(s.results))
    assert.equal(hit.approved, true)
    assert.ok(s.untrusted_content.data.results.find((x) => x.id === v.version.id).snippet.includes('synthetic widget'))

    // 8 draft (derived from the approved vault answer) - unapproved, method recorded as agent draft
    const dr = await c.call('create_draft_version', { application_id: imp.instance_id, question_occurrence_id: imp.question_ids[0], title: 'Problem', body: 'We solve a synthetic problem for synthetic users.', derived_from_version_id: v.version.id })
    assert.equal(dr.status, 'ok', JSON.stringify(dr))
    assert.equal(dr.approved, false)
    assert.equal(dr.method, 'byok')
    assert.deepEqual(dr.derived_from, { version_id: v.version.id, version_sha256: v.version.sha256 })
    assert.match(dr.honest_status, /not in the browser vault/)
    const child = await c.call('create_draft_version', { parent_version_id: v.version.id, body: 'A revised synthetic widget answer.' })
    assert.equal(child.parent_version_id, v.version.id)
    assert.equal(child.approved, false, 'editing an approved answer creates an unapproved child')

    // 9 evidence: attach a file from inbox, request evidence on the draft
    const ev = await c.call('attach_evidence', { file: 'pilot-results.txt', title: 'Synthetic pilot results', version_id: dr.version_id })
    assert.equal(ev.status, 'ok', JSON.stringify(ev))
    assert.equal(ev.verification, 'unverified')
    const rq = await c.call('request_evidence', { version_id: child.version_id, note: 'Need a synthetic metric source.' })
    assert.equal(rq.status, 'ok')
    assert.equal(rq.workspace_only, true)

    // 11 status: derived statuses + Direct/Adapt/Gap
    const st = await c.call('read_review_status', { application_id: imp.instance_id })
    const q1 = st.questions.find((q) => q.question_occurrence_id === imp.question_ids[0])
    assert.equal(q1.status, 'suggested') // agent draft: needs the human
    assert.ok(q1.reasons.includes('provider_generated') || q1.reasons.includes('reused_from_other_answer'))
    assert.equal(q1.freeze_eligible, false)
    assert.equal(q1.governing_staged_only, true)
    assert.equal(st.questions.find((q) => q.question_occurrence_id === imp.question_ids[1]).status, 'gap')
    const vst = await c.call('read_review_status', { application_id: v.inst.instance_id })
    const vq1 = vst.questions.find((q) => q.question_occurrence_id === v.q1)
    assert.equal(vq1.status, 'needs_evidence', 'the evidence request on the newest version shows up')
    assert.equal(vq1.approved_version_id, v.version.id)
    assert.ok(['direct', 'adapt', 'gap'].includes(vst.questions[1].recommendation.classification))

    // 10 present review decisions: offline HTML in exports/reviews/
    const pr = await c.call('present_review_decisions', { application_id: v.inst.instance_id })
    assert.equal(pr.status, 'ok')
    assert.ok(pr.saved_to.startsWith('exports/reviews/'))
    const html = fs.readFileSync(path.join(root, pr.saved_to), 'utf8')
    assert.match(html, /Offline review file — clicking here does NOT update AQUA/)
    assert.match(html, /default-src 'none'/)
    assert.match(pr.cannot_approve, /only/)
    assert.equal(pr.summary.questions, 2)

    // 12 prepare packet: readiness only
    const pp = await c.call('prepare_packet', { application_id: v.inst.instance_id })
    assert.equal(pp.froze_anything, false)
    const pq = pp.questions.find((q) => q.question_occurrence_id === v.q1)
    assert.equal(pq.selectable_version_id, v.version.id)
    assert.equal(pq.approval_bound_to_hash, true)
    assert.equal(pq.integrity_ok, true)
    assert.equal(pq.newer_unapproved_version, true) // the agent's child draft is newer and unapproved
    const pl = await c.call('prepare_packet', { application_id: imp.instance_id })
    assert.equal(pl.ready_to_freeze, false)
    assert.ok(pl.blockers.some((b) => b.code === 'no_approved_version'))
    assert.ok(pl.blockers.some((b) => b.code === 'required_without_approved_answer'))

    // 13 export packet: human only
    const xp = await c.call('export_packet', { application_id: v.inst.instance_id })
    assert.equal(xp.status, 'requires_human')
    assert.ok(xp.how.length >= 3)

    // 14 verify packet exports from inbox/
    const vp = await c.call('verify_packet', { file: 'packet.json' })
    assert.equal(vp.verified, true, JSON.stringify(vp))
    const vt = await c.call('verify_packet', { file: 'inbox/packet-tampered.json' })
    assert.equal(vt.verified, false)
    assert.ok(vt.checks.some((x) => x.name === 'per-answer sha256' && !x.pass))

    // 15 observed submission: stored, never marked submitted
    const statesBefore = Object.values(readManifest(root).records).filter((e) => e.kind === 'packet_state').map((e) => e.content_mac)
    const ob = await c.call('record_observed_submission', { file: 'confirmation.txt', packet_id: v.packet.packet_id })
    assert.equal(ob.status, 'recorded_unattested')
    assert.equal(ob.requires_human_attestation, true)
    assert.equal(ob.marked_submitted, false)
    assert.deepEqual(Object.values(readManifest(root).records).filter((e) => e.kind === 'packet_state').map((e) => e.content_mac), statesBefore)

    // human-only stubs
    for (const name of ['attest_submission', 'approve_answer', 'sign_packet', 'submit_catalog_candidate']) {
      const h = await c.call(name, {})
      assert.equal(h.status, 'requires_human', name)
      assert.ok(Array.isArray(h.how) && h.how.length >= 2, name)
      assert.ok(h.reason)
    }

    // 4 catalog candidate: refused without a public source; built (sanitized) with one
    const noSrc = await c.call('prepare_catalog_candidate', { application_id: imp.instance_id })
    assert.equal(noSrc.status, 'refused')
    assert.equal(noSrc.reason, 'no_public_source')
    inbox(root, 'public-form.md', FORM_MD)
    const pub = await c.call('import_local_application', { file: 'public-form.md', source_url: 'https://example.org/apply?utm_source=x' })
    const cand = await c.call('prepare_catalog_candidate', { application_id: pub.instance_id })
    assert.equal(cand.status, 'ok', JSON.stringify(cand))
    assert.equal(cand.requires_human_approval, true)
    assert.equal(cand.untrusted_content.data.deep_link, `https://aquaidp.xyz/apply?url=${encodeURIComponent('https://example.org/apply')}`)
    assert.equal(cand.untrusted_content.data.candidate.status, 'candidate')
    assert.ok(fs.existsSync(path.join(root, cand.saved_to)))
    const link = await c.call('submit_catalog_candidate', { source_url: 'https://example.org/apply' })
    assert.equal(link.link, cand.untrusted_content.data.deep_link)
  } finally {
    assert.equal(await c.close(), 0)
  }

  // the workspace is still consistent, nothing was approved, and the drafts reach the browser unapproved
  const ver = await run(['verify', '--workspace', root])
  assert.equal(ver.code, 0, ver.out)
  assert.equal(snapshotRecords(root).approvals, approvalsBefore)
  const outPath = path.join(dir, 'for-browser.json')
  const ex = await run(['export-backup', outPath, '--workspace', root, '--yes'])
  assert.equal(ex.code, 0, ex.err)
  const payload = JSON.parse(await app.decryptText(VAULT, JSON.parse(fs.readFileSync(outPath, 'utf8'))))
  for (const k of ['approvals', 'signoffs', 'reviews', 'suggestions', 'packets', 'packet_states']) assert.deepEqual(payload[k], [], k)
  assert.ok(payload.versions.every((x) => x.method === 'byok' && /agent/.test(x.provenance)))
  assert.equal(payload.evidence.length, 1)
  assert.equal(payload.evidence[0].verification, 'unverified')
  const fresh = app.createMemoryStorage()
  await app.importVault(fresh, VAULT, fs.readFileSync(outPath, 'utf8'))
  assert.equal((await fresh.getAll('approvals')).length, 0)
  for (const ver2 of await fresh.getAll('versions')) {
    assert.equal(app.approvalGate(ver2, [], []).approved, false)
  }
})

test('import_local_application reads .docx, .csv, .json and .html with the vendored parsers; PDF is refused with guidance', async () => {
  const { root } = await seededWorkspace('mcp-formats')
  inbox(root, 'form.docx', syntheticDocx(['Synthetic Fellowship 2027', '1. What problem are you solving? (Maximum 250 words)', '2. Describe your team &amp; why you (500 characters max)']))
  inbox(root, 'form.csv', 'question,word_limit,required\n"Why this program, and why now?",150,yes\n"What is your budget?",,no\n')
  inbox(root, 'form.json', JSON.stringify({ questions: [{ question: 'What will you build in the program?', word_limit: 300 }] }))
  inbox(root, 'form.html', '<html><body><h1>Synthetic Portal</h1><form><label for="a">What is your one-line pitch?</label><textarea id="a" maxlength="140"></textarea></form></body></html>')
  inbox(root, 'form.pdf', '%PDF-1.4 synthetic')
  const c = startServer(root)
  try {
    await c.initialize()
    const docx = await c.call('import_local_application', { file: 'form.docx' })
    assert.equal(docx.status, 'ok', JSON.stringify(docx))
    assert.deepEqual(docx.untrusted_content.data.questions.map((q) => q.text), ['What problem are you solving? (Maximum 250 words)', 'Describe your team & why you (500 characters max)'])
    assert.equal(docx.untrusted_content.data.questions[1].requirements.char_limit, 500)
    const csv = await c.call('import_local_application', { file: 'form.csv' })
    assert.equal(csv.status, 'ok', JSON.stringify(csv))
    assert.equal(csv.counts.questions, 2)
    assert.equal(csv.untrusted_content.data.questions[0].text, 'Why this program, and why now?')
    const json = await c.call('import_local_application', { file: 'form.json' })
    assert.equal(json.untrusted_content.data.questions[0].requirements.word_limit, 300)
    const html = await c.call('import_local_application', { file: 'form.html' })
    assert.equal(html.status, 'ok', JSON.stringify(html))
    assert.equal(html.untrusted_content.data.questions[0].text, 'What is your one-line pitch?')
    assert.equal(html.untrusted_content.data.questions[0].requirements.char_limit, 140)
    const pdf = await c.call('import_local_application', { file: 'form.pdf' })
    assert.equal(pdf.status, 'refused')
    assert.equal(pdf.reason, 'unsupported_format')
    assert.match(pdf.message, /PDF/)
  } finally {
    await c.close()
  }
  assert.equal((await run(['verify', '--workspace', root])).code, 0)
})
