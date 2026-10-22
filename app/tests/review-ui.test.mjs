// M09 W5 — review UI pure modules + loader integration (synthetic data only).
// Run: node --test tests/review-ui.test.mjs   (Node >= 22.6 strips .ts types)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

import { createMemoryStorage } from '../lib/aqua-local/vault.ts'
import { listApprovals } from '../lib/aqua-local/repo.ts'
import { listReviews } from '../lib/aqua-local/review-ledger.ts'
import { listInstanceQuestions, editAsChildVersion, approveAsHuman, requestEvidenceOrHelp, listVersionComments } from '../lib/aqua-local-client/review.ts'
import {
  buildDecisionFile, parseDecisionFile, planDecisionImport, DECISION_BUILDER_JS,
  DECISION_FILE_FORMAT, MAX_DECISION_FILE_BYTES,
} from '../lib/review-ui/decision-file.ts'
import { buildReviewHtml, escapeHtml } from '../lib/review-ui/html-export.ts'
import {
  boardRowVM, progressSummary, checkLimits, detectFactConflicts, buildCardViewModel,
  freshnessLabel, paragraphsOf, STATUS_LABEL, versionMethodLabel, commentSource, AGENT_DRAFT_LABEL, COMMENT_SOURCE_LABEL,
} from '../lib/review-ui/view-model.ts'
import {
  loadBoard, loadCard, currentStates, applyDecisionPlan, readDecisionExcerpts, issueReviewExportNonce, decisionFileOrigin, DECISION_EXCERPT_CHARS,
} from '../lib/review-ui/load.ts'
import { addComment, listComments } from '../lib/aqua-local/review-ledger.ts'
import { seedSyntheticReview } from '../lib/review-ui/synthetic-seed.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(here, '..')
const SECRET = 'review-ui-test-secret'
const NOW = '2026-10-22T12:00:00.000Z'
const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)

// ---------------------------------------------------------------------------
// decision file
// ---------------------------------------------------------------------------

function sampleFile() {
  return buildDecisionFile(
    { instance_id: 'LA-1', review_exported_at: NOW },
    [
      { question_occurrence_id: 'LQ-1', version_id: 'v1', version_sha256: SHA_A, decision: 'approve' },
      { question_occurrence_id: 'LQ-2', version_id: 'v2', version_sha256: SHA_B, decision: 'needs_revision', comment: 'Tighten the second paragraph' },
      { question_occurrence_id: 'LQ-3', version_id: 'v3', version_sha256: SHA_A, decision: 'comment', comment: 'Question for later' },
    ],
    NOW,
  )
}

test('decision file round-trips through parse', () => {
  const f = sampleFile()
  assert.equal(f.format, DECISION_FILE_FORMAT)
  assert.match(f.notice, /did NOT update AQUA/)
  const r = parseDecisionFile(JSON.stringify(f))
  assert.equal(r.ok, true)
  assert.deepEqual(r.file.decisions, f.decisions)
  assert.equal(r.file.instance_id, 'LA-1')
})

test('decision file validation rejects malformed input', () => {
  const bad = (mut) => {
    const f = JSON.parse(JSON.stringify(sampleFile()))
    mut(f)
    return parseDecisionFile(JSON.stringify(f))
  }
  assert.equal(parseDecisionFile('').ok, false)
  assert.equal(parseDecisionFile('{not json').ok, false)
  assert.equal(parseDecisionFile('[]').ok, false)
  assert.equal(parseDecisionFile('x'.repeat(MAX_DECISION_FILE_BYTES + 1)).ok, false)
  assert.equal(bad((f) => (f.format = 'something-else')).ok, false)
  assert.equal(bad((f) => (f.version = 2)).ok, false)
  assert.equal(bad((f) => delete f.instance_id).ok, false)
  assert.equal(bad((f) => (f.decisions[0].version_sha256 = 'ABC')).ok, false)
  assert.equal(bad((f) => (f.decisions[0].version_sha256 = SHA_A.toUpperCase())).ok, false)
  assert.equal(bad((f) => (f.decisions[0].decision = 'approved')).ok, false, 'only approve|needs_revision|needs_evidence|comment')
  assert.equal(bad((f) => (f.decisions[2].comment = '   ')).ok, false, 'comment-only needs text')
  assert.equal(bad((f) => (f.decisions[0].decided_at = 'yesterday')).ok, false)
  assert.equal(bad((f) => f.decisions.push({ ...f.decisions[0] })).ok, false, 'duplicate version decision')
  const warn = bad((f) => (f.extra = 1))
  assert.equal(warn.ok, true)
  assert.match(warn.warnings[0], /extra/)
})

test('embedded in-browser builder produces a file parseDecisionFile accepts', () => {
  const build = new Function(`${DECISION_BUILDER_JS}; return aquaBuildDecisionFile`)()
  const out = build(
    { instance_id: 'LA-1', review_exported_at: NOW },
    [
      { question_occurrence_id: 'LQ-1', version_id: 'v1', version_sha256: SHA_A, decision: 'approve', comment: '' },
      { question_occurrence_id: 'LQ-2', version_id: 'v2', version_sha256: SHA_B, decision: null, comment: 'only a comment' },
      { question_occurrence_id: 'LQ-3', version_id: 'v3', version_sha256: SHA_A, decision: null, comment: '' },
    ],
    NOW,
  )
  const r = parseDecisionFile(JSON.stringify(out))
  assert.equal(r.ok, true, JSON.stringify(r.errors))
  assert.equal(r.file.decisions.length, 2, 'blank rows are dropped')
  assert.equal(r.file.decisions[0].comment, null)
  assert.equal(r.file.decisions[1].decision, 'comment')
  const ref = buildDecisionFile({ instance_id: 'LA-1', review_exported_at: NOW }, [
    { question_occurrence_id: 'LQ-1', version_id: 'v1', version_sha256: SHA_A, decision: 'approve' },
    { question_occurrence_id: 'LQ-2', version_id: 'v2', version_sha256: SHA_B, decision: 'comment', comment: 'only a comment' },
  ], NOW)
  assert.deepEqual(out, ref, 'browser and module builders agree byte-for-byte')
})

test('import plan: ready / already approved / stale hash / superseded / unknown / wrong instance', () => {
  const f = buildDecisionFile({ instance_id: 'LA-1' }, [
    { question_occurrence_id: 'q1', version_id: 'v1', version_sha256: SHA_A, decision: 'approve' },
    { question_occurrence_id: 'q2', version_id: 'v2', version_sha256: SHA_A, decision: 'approve' },
    { question_occurrence_id: 'q3', version_id: 'v3', version_sha256: SHA_A, decision: 'approve', comment: 'still a note' },
    { question_occurrence_id: 'q4', version_id: 'v4a', version_sha256: SHA_A, decision: 'needs_evidence' },
    { question_occurrence_id: 'q5', version_id: 'nope', version_sha256: SHA_A, decision: 'approve' },
    { question_occurrence_id: 'q-missing', version_id: 'v9', version_sha256: SHA_A, decision: 'approve' },
  ], NOW)
  const current = [
    { question_occurrence_id: 'q1', versions: [{ id: 'v1', sha256: SHA_A }], governing_version_id: 'v1', governing_approved: false },
    { question_occurrence_id: 'q2', versions: [{ id: 'v2', sha256: SHA_B }], governing_version_id: 'v2', governing_approved: false },
    { question_occurrence_id: 'q3', versions: [{ id: 'v3', sha256: SHA_A }], governing_version_id: 'v3', governing_approved: true },
    { question_occurrence_id: 'q4', versions: [{ id: 'v4a', sha256: SHA_A }, { id: 'v4b', sha256: SHA_B }], governing_version_id: 'v4b', governing_approved: false },
    { question_occurrence_id: 'q5', versions: [{ id: 'v5', sha256: SHA_A }], governing_version_id: 'v5', governing_approved: false },
  ]
  const p = planDecisionImport(f, 'LA-1', current)
  assert.equal(p.ok, true)
  assert.deepEqual(p.items.map((i) => i.status), ['ready', 'stale_hash', 'already_approved', 'stale_superseded', 'unknown_version', 'unknown_question'])
  assert.deepEqual(p.items.map((i) => i.applicable), [true, false, true, false, false, false])
  assert.equal(p.items[2].writes_decision, false, 'no second approval row')
  assert.equal(p.items[2].writes_comment, true)
  assert.equal(p.items[3].version_number, 1)
  assert.equal(p.stale, 4)
  const wrong = planDecisionImport(f, 'LA-other', current)
  assert.equal(wrong.ok, false)
  assert.equal(wrong.items.length, 0)
})

// ---------------------------------------------------------------------------
// view model (pure)
// ---------------------------------------------------------------------------

test('limits, paragraphs, freshness', () => {
  const l = checkLimits('one two three four', 3, 10)
  assert.equal(l.word_count, 4)
  assert.equal(l.over_word_by, 1)
  assert.equal(l.over_char_by, 8)
  assert.equal(l.over_limit, true)
  assert.equal(checkLimits('fine', null, null).over_limit, false)
  assert.deepEqual(paragraphsOf('a\n\n\nb\nc'), ['a', 'b\nc'])
  assert.equal(freshnessLabel(null, NOW).stale, true)
  assert.equal(freshnessLabel('2026-10-21T12:00:00.000Z', NOW).label, 'Checked yesterday')
  assert.equal(freshnessLabel('2025-01-01T00:00:00.000Z', NOW).stale, true)
})

test('fact conflicts: number mismatch flagged, matching value and years ignored', () => {
  const facts = [
    { fact_id: 'f1', fact_version_id: 'fv1', kind: 'organization', key: 'org.customers', value: '40', supersedes: null, evidence_ids: [], created_at: NOW, method: 'manual', retracted: false },
    { fact_id: 'f2', fact_version_id: 'fv2', kind: 'organization', key: 'org.employees', value: '12', supersedes: null, evidence_ids: [], created_at: NOW, method: 'manual', retracted: false },
    { fact_id: 'f3', fact_version_id: 'fv3', kind: 'organization', key: 'org.legacy', value: 'x', supersedes: null, evidence_ids: [], created_at: NOW, method: 'manual', retracted: true },
  ]
  const c = detectFactConflicts('In 2024 we had 35 paying customers. Our 12 employees ship weekly.', facts)
  assert.equal(c.length, 1)
  assert.equal(c[0].fact_key, 'org.customers')
  assert.equal(c[0].kind, 'number_mismatch')
  assert.doesNotMatch(c[0].message, /2024/)
  assert.equal(detectFactConflicts('We serve 40 customers.', facts).length, 0)
})

test('board rows: categories and progress summary', () => {
  const st = (status, freeze = false) => ({ status, governing_version_id: 'v', governing_version_sha256: SHA_A, approved_version_id: null, freeze_eligible: freeze, decided_by: null, reasons: [] })
  const base = { order: 0, text: 'Q', required: true, word_limit: 10, char_limit: null, classification: null, evidence_ids: [], versions: [{ id: 'v', sha256: SHA_A }] }
  const rows = [
    boardRowVM({ ...base, question_occurrence_id: 'a', status: st('approved', true) }, { words: 5, chars: 20 }),
    boardRowVM({ ...base, question_occurrence_id: 'b', status: st('approved', true) }, { words: 50, chars: 200 }),
    boardRowVM({ ...base, question_occurrence_id: 'c', status: st('gap'), versions: [] }),
    boardRowVM({ ...base, question_occurrence_id: 'd', status: st('needs_evidence') }),
    boardRowVM({ ...base, question_occurrence_id: 'e', status: st('included_in_packet', true), required: false }),
  ]
  assert.deepEqual(rows[0].categories, ['all', 'ready', 'approved'])
  assert.deepEqual(rows[1].categories, ['all', 'attention', 'approved'], 'over-limit approved answer needs attention, not ready')
  assert.deepEqual(rows[2].categories, ['all', 'gaps'])
  assert.deepEqual(rows[3].categories, ['all', 'attention'])
  assert.deepEqual(rows[4].categories, ['all', 'ready', 'approved', 'in_packet'])
  const s = progressSummary(rows)
  assert.equal(s.total, 5)
  assert.equal(s.approved, 3)
  assert.equal(s.in_packet, 1)
  assert.equal(s.gaps, 1)
  assert.equal(s.required_total, 4)
  assert.equal(s.required_approved, 2)
  assert.equal(STATUS_LABEL.included_in_packet, 'Included in packet')
})

test('card view model keeps status, recommendation, review and approval separate', () => {
  const v1 = { id: 'v1', answer_id: 'a', parent_version_id: null, title: '', body: '', sha256: SHA_A, method: 'manual', provenance: null, created_at: '2026-10-01T00:00:00.000Z', immutable: true }
  const v2 = { ...v1, id: 'v2', parent_version_id: 'v1', sha256: SHA_B, created_at: '2026-10-02T00:00:00.000Z' }
  const approvals = [{ id: 'ap1', version_id: 'v1', version_sha256: SHA_A, decision: 'approved', actor_class: 'human', at: '2026-10-01T01:00:00.000Z', seq: 1, via: 'review_ui' }]
  const card = buildCardViewModel({
    instance_id: 'LA-1', program_name: 'P', org_name: null, deadline: '2026-11-01T00:00:00.000Z',
    question: { question_occurrence_id: 'q', canonical_question_id: null, text: 'Describe it', word_limit: 50, char_limit: null, required: true },
    versions: [v2, v1], approvals, reviews: [], governing: { title: 't', body: 'Body text here.' },
    evidence: [], suggestions: [], comments: [], facts: [],
    status: { status: 'under_review', governing_version_id: 'v2', governing_version_sha256: SHA_B, approved_version_id: 'v1', freeze_eligible: false, decided_by: null, reasons: ['newer_version_not_approved'] },
    classification: { classification: 'adapt', reasons: [{ code: 'unapproved', message: 'source is not approved' }], evidence_ids: [], similarity: 0.5, alternatives: [] },
    now: NOW,
  })
  assert.equal(card.answer.version_number, 2)
  assert.equal(card.approval.state, 'approved_older', 'v1 approval does not carry to v2')
  assert.match(card.approval.label, /v1 was approved, v2 is not/)
  assert.equal(card.status.label, 'Under review')
  assert.equal(card.recommendation_badge.label, 'Agent recommendation: Adapt')
  assert.equal(card.human_review.decision, null)
  assert.equal(card.evidence.gap, true)
  assert.ok(card.recommendation.missing_evidence.includes('No evidence linked to this version.'))
  assert.equal(card.evidence.lineage[1].parent_number, 1)
  assert.match(card.context.deadline_label, /days left/)
})

// ---------------------------------------------------------------------------
// HTML export
// ---------------------------------------------------------------------------

async function seededCards() {
  const s = createMemoryStorage()
  const seed = await seedSyntheticReview(s, SECRET)
  const board = await loadBoard(s, SECRET, seed.instance_id, {}, { classify: true, now: NOW })
  const cards = []
  for (const row of board.rows) cards.push(await loadCard(s, SECRET, { instance_id: seed.instance_id, row, context: board.context, now: NOW }))
  return { s, seed, board, cards }
}

test('HTML export is self-contained, escaped, and says it does not update AQUA', async () => {
  const { seed, board, cards } = await seededCards()
  // Inject hostile text into a copy of a card to prove escaping.
  const evil = structuredClone(cards[0])
  evil.answer.paragraphs = ['<script>alert(1)</script> & "quotes"']
  evil.context.original_question = '<img src=x onerror=alert(1)>'
  evil.evidence.items = [{ ...evil.evidence.items[0], url: 'javascript:alert(1)' }]
  const html = buildReviewHtml({ instance_id: seed.instance_id, program_name: board.context.program_name, org_name: board.context.org_name, exported_at: NOW, cards: [...cards, evil] })
  assert.match(html, /^<!doctype html>/)
  assert.match(html, /<meta name="viewport"/)
  assert.match(html, /Content-Security-Policy" content="default-src 'none'/)
  assert.match(html, /base-uri 'none'; form-action 'none'"/, 'L7: no <base> hijack, no form posts')
  assert.match(html, /prefers-color-scheme:dark/)
  assert.match(html, /clicking here does NOT update AQUA/)
  assert.match(html, /Recommendation — not evidence, not approval/)
  assert.doesNotMatch(html, /<script>alert/)
  assert.doesNotMatch(html, /<img src=x/)
  assert.doesNotMatch(html, /href="javascript:/)
  assert.ok(html.includes(escapeHtml('<script>alert(1)</script> & "quotes"')))
  // No external resources at all (links to evidence are the only http(s) URLs, as anchors).
  assert.doesNotMatch(html, /<(script|link|img|iframe)[^>]+(src|href)="https?:/i)
  assert.equal((html.match(/<script>/g) ?? []).length, 1)
  // Every card with a version has bound decision controls carrying its full hash.
  for (const c of cards) {
    if (c.answer) {
      assert.ok(html.includes(`data-version="${c.answer.version_id}" data-sha="${c.answer.sha256}"`))
    }
  }
  assert.equal((html.match(/class="card"/g) ?? []).length, cards.length + 1)
})

test('HTML export inline script builds a valid decision file from its controls', async () => {
  const { seed, board, cards } = await seededCards()
  const NONCE = 'c'.repeat(64)
  const html = buildReviewHtml({ instance_id: seed.instance_id, program_name: board.context.program_name, org_name: null, exported_at: NOW, export_nonce: NONCE, cards })
  assert.ok(html.includes(`data-nonce="${NONCE}"`))
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  // Minimal DOM: one fieldset per card with a version; approve the first.
  const sets = cards.filter((c) => c.answer).map((c, i) => ({
    attrs: { 'data-occ': c.question_occurrence_id, 'data-version': c.answer.version_id, 'data-sha': c.answer.sha256 },
    getAttribute(k) { return this.attrs[k] },
    querySelector(sel) { return sel.startsWith('input') ? (i === 0 ? { value: 'approve' } : null) : { value: i === 1 ? 'a note' : '' } },
  }))
  let downloaded = null
  const listeners = {}
  const mk = (id) => ({ textContent: '', addEventListener: (ev, fn) => (listeners[`${id}:${ev}`] = fn), setAttribute() {}, getAttribute() { return null } })
  const els = { count: mk('count'), download: mk('download'), theme: mk('theme') }
  const el = mk('root')
  const ctx = {
    document: {
      body: { getAttribute: (k) => (k === 'data-instance' ? seed.instance_id : k === 'data-nonce' ? NONCE : NOW), appendChild() {} },
      documentElement: el,
      querySelectorAll: () => sets,
      getElementById: (id) => els[id],
      addEventListener() {},
      createElement: () => ({ click() {}, remove() {}, set href(v) {}, get href() { return 'blob:x' }, set download(v) { downloaded = v } }),
    },
    Blob: class { constructor(parts) { ctx.lastBlob = parts.join('') } },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    window: { matchMedia: () => ({ matches: false }) },
    setTimeout: (fn) => fn(),
    Date,
  }
  vm.runInNewContext(script, ctx)
  listeners['download:click']()
  assert.match(els.count.textContent, /not applied to AQUA/)
  assert.match(downloaded, new RegExp(`^aqua-decisions-${seed.instance_id}-`))
  const parsed = parseDecisionFile(ctx.lastBlob)
  assert.equal(parsed.ok, true, JSON.stringify(parsed.errors))
  assert.equal(parsed.file.decisions.length, 2)
  assert.equal(parsed.file.decisions[0].decision, 'approve')
  assert.equal(parsed.file.decisions[1].decision, 'comment')
  assert.equal(parsed.file.export_nonce, NONCE, 'M2: the export nonce round-trips through the offline page')
})

// ---------------------------------------------------------------------------
// loader integration over the real vault lib (in-memory)
// ---------------------------------------------------------------------------

test('seeded cards: lineage, derived source, fact conflict, challenge, gap', async () => {
  const { seed, cards } = await seededCards()
  const by = Object.fromEntries(cards.map((c) => [c.question_occurrence_id, c]))
  assert.equal(by[seed.occ.company].evidence.items.length, 2)
  assert.equal(by[seed.occ.company].recommendation.classification, 'direct')
  const tr = by[seed.occ.traction]
  assert.equal(tr.recommendation.classification, 'adapt')
  assert.ok(tr.evidence.derived_from?.found)
  assert.equal(tr.recommendation.fact_conflicts[0]?.fact_key, 'org.customers')
  assert.ok(tr.evidence.uncertain_claims.some((u) => u.source === 'agent'))
  assert.equal(tr.status.kind, 'suggested')
  assert.equal(by[seed.occ.team].answer.method, 'byok')
  assert.equal(by[seed.occ.team].answer.provider, 'anthropic')
  assert.equal(by[seed.occ.funding].status.kind, 'needs_evidence')
  assert.ok(by[seed.occ.funding].evidence.uncertain_claims.some((u) => u.source === 'challenge'))
  assert.equal(by[seed.occ.funding].answer.limits.over_limit, true)
  assert.equal(by[seed.occ.extra].answer, null)
  assert.equal(by[seed.occ.extra].status.kind, 'gap')
  const comp = by[seed.occ.competitors]
  assert.equal(comp.approval.state, 'approved_older')
  assert.equal(comp.comments.threads[0].comments[0].on_label, 'on v1')
  assert.equal(comp.comments.threads[0].comments[0].on_current_version, false)
})

test('approve binds the displayed hash; edit creates an unapproved child; requests are not approvals', async () => {
  const s = createMemoryStorage()
  const seed = await seedSyntheticReview(s, SECRET)
  let rows = await listInstanceQuestions(s, SECRET, seed.instance_id, { classify: false })
  const row = rows.find((r) => r.question_occurrence_id === seed.occ.company)
  const v1 = row.versions.at(-1)
  await assert.rejects(approveAsHuman(s, { version_id: v1.id, expected_sha256: SHA_A }), /refused|mismatch/i)
  const ap = await approveAsHuman(s, { version_id: v1.id, expected_sha256: v1.sha256, secret: SECRET })
  assert.equal(ap.version_sha256, v1.sha256)
  assert.equal(ap.actor_class, 'human')
  rows = await listInstanceQuestions(s, SECRET, seed.instance_id, { classify: false })
  let card = await loadCard(s, SECRET, { instance_id: seed.instance_id, row: rows.find((r) => r.question_occurrence_id === seed.occ.company), context: { program_name: null, org_name: null, deadline: null, cycle_year: null }, now: NOW })
  assert.equal(card.approval.state, 'approved')
  assert.equal(card.approval.bound_sha_prefix, v1.sha256.slice(0, 12))
  const v2 = await editAsChildVersion(s, SECRET, { parent_version_id: v1.id, body: 'Edited synthetic body.' })
  rows = await listInstanceQuestions(s, SECRET, seed.instance_id, { classify: false })
  card = await loadCard(s, SECRET, { instance_id: seed.instance_id, row: rows.find((r) => r.question_occurrence_id === seed.occ.company), context: { program_name: null, org_name: null, deadline: null, cycle_year: null }, now: NOW })
  assert.equal(card.answer.version_id, v2.id)
  assert.equal(card.approval.state, 'approved_older')
  assert.equal(card.status.kind, 'under_review')
  // Evidence/help request on the new version is recorded but is not approval.
  await requestEvidenceOrHelp(s, SECRET, { version_id: v2.id, expected_sha256: v2.sha256, kind: 'evidence_requested', note: 'need a source' })
  rows = await listInstanceQuestions(s, SECRET, seed.instance_id, { classify: false })
  const after = rows.find((r) => r.question_occurrence_id === seed.occ.company)
  assert.equal(after.status.status, 'needs_evidence')
  assert.equal(after.status.freeze_eligible, false)
  assert.equal((await listApprovals(s, v2.id)).length, 0)
})

test('decision import: plan from current state, apply only confirmed items, stale never applied', async () => {
  const s = createMemoryStorage()
  const seed = await seedSyntheticReview(s, SECRET)
  let rows = await listInstanceQuestions(s, SECRET, seed.instance_id, { classify: false })
  const g = (occ) => rows.find((r) => r.question_occurrence_id === occ).versions.at(-1)
  const company = g(seed.occ.company)
  const team = g(seed.occ.team)
  const traction = g(seed.occ.traction)
  const comp = rows.find((r) => r.question_occurrence_id === seed.occ.competitors).versions[0] // v1 (superseded)
  const file = buildDecisionFile({ instance_id: seed.instance_id }, [
    { question_occurrence_id: seed.occ.company, version_id: company.id, version_sha256: company.sha256, decision: 'approve', comment: 'Looks right' },
    { question_occurrence_id: seed.occ.team, version_id: team.id, version_sha256: team.sha256, decision: 'needs_revision', comment: 'Add years of experience' },
    { question_occurrence_id: seed.occ.traction, version_id: traction.id, version_sha256: SHA_B, decision: 'approve' },
    { question_occurrence_id: seed.occ.competitors, version_id: comp.id, version_sha256: comp.sha256, decision: 'approve' },
  ], NOW)
  const parsed = parseDecisionFile(JSON.stringify(file))
  assert.equal(parsed.ok, true)
  const plan = planDecisionImport(parsed.file, seed.instance_id, currentStates(rows), { origin: 'this_vault' })
  assert.deepEqual(plan.items.map((i) => i.status), ['ready', 'ready', 'stale_hash', 'stale_superseded'])
  // User unticks the team decision before confirming.
  const results = await applyDecisionPlan(s, SECRET, plan, 'u-test', new Set([company.id]))
  assert.equal(results.length, 1)
  assert.deepEqual(results[0].wrote, ['approval', 'comment'])
  const aps = await listApprovals(s, company.id)
  assert.equal(aps.at(-1).via, 'decision_file')
  assert.equal(aps.at(-1).actor_class, 'human')
  assert.equal(aps.at(-1).actor_id, 'u-test')
  assert.equal((await listApprovals(s, traction.id)).length, 0, 'stale hash never applied')
  assert.equal((await listApprovals(s, comp.id)).filter((a) => a.via === 'decision_file').length, 0, 'superseded never applied')
  assert.equal((await listReviews(s, { version_id: team.id })).length, 0, 'unticked item not applied')
  const comments = await listVersionComments(s, SECRET, { version_id: company.id })
  assert.equal(comments.at(-1).body, 'Looks right')
  // Applying the rest writes a human review decision (not an approval).
  const r2 = await applyDecisionPlan(s, SECRET, plan, 'u-test', new Set([team.id]))
  assert.deepEqual(r2[0].wrote, ['review', 'comment'])
  const rv = await listReviews(s, { version_id: team.id })
  assert.equal(rv[0].decision, 'needs_revision')
  assert.equal((await listApprovals(s, team.id)).length, 0)
  rows = await listInstanceQuestions(s, SECRET, seed.instance_id, { classify: false })
  assert.equal(rows.find((r) => r.question_occurrence_id === seed.occ.company).status.status, 'approved')
  assert.equal(rows.find((r) => r.question_occurrence_id === seed.occ.team).status.status, 'needs_revision')
})

test('a version changed between plan and confirm is refused at write time', async () => {
  const s = createMemoryStorage()
  const seed = await seedSyntheticReview(s, SECRET)
  const rows = await listInstanceQuestions(s, SECRET, seed.instance_id, { classify: false })
  const v = rows.find((r) => r.question_occurrence_id === seed.occ.company).versions.at(-1)
  const file = buildDecisionFile({ instance_id: seed.instance_id }, [
    { question_occurrence_id: seed.occ.company, version_id: v.id, version_sha256: v.sha256, decision: 'approve' },
  ], NOW)
  const plan = planDecisionImport(file, seed.instance_id, currentStates(rows), { origin: 'this_vault' })
  // Tamper the stored hash after planning (simulates a concurrent change).
  const stored = await s.get('versions', v.id)
  await s.put('versions', { ...stored, sha256: SHA_B })
  const res = await applyDecisionPlan(s, SECRET, plan, 'u-test')
  assert.equal(res[0].ok, false)
  assert.match(res[0].error, /refused|mismatch|does not hash/i)
  assert.equal((await listApprovals(s, v.id)).length, 0)
})

// ---------------------------------------------------------------------------
// static guards
// ---------------------------------------------------------------------------

async function walk(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p)))
    else if (/\.(tsx?|mjs)$/.test(e.name)) out.push(p)
  }
  return out
}

test('no UI surface calls the unbound legacy approval primitive', async () => {
  const files = [...(await walk(path.join(appRoot, 'components'))), ...(await walk(path.join(appRoot, 'app')))]
  for (const f of files) {
    const src = await readFile(f, 'utf8')
    assert.doesNotMatch(src, /\bapproveVersion\b/, `${path.relative(appRoot, f)} must use approveAsHuman / session approve(expected_sha256)`)
    for (const m of src.matchAll(/\bapprove\(storage,\s*([^)]*)\)/g)) {
      assert.match(m[1], /expected_sha256/, `${path.relative(appRoot, f)}: approve() must pass the displayed sha256`)
    }
  }
  const session = await readFile(path.join(appRoot, 'lib/aqua-local-client/session.ts'), 'utf8')
  assert.doesNotMatch(session, /approveVersion\(/)
})

test('review UI sends no analytics and the harness 404s in production', async () => {
  const files = [...(await walk(path.join(appRoot, 'components/review'))), ...(await walk(path.join(appRoot, 'lib/review-ui')))]
  for (const f of files) {
    const src = await readFile(f, 'utf8')
    assert.doesNotMatch(src, /posthog|capture\(|fetch\(/i, path.relative(appRoot, f))
  }
  const harness = await readFile(path.join(appRoot, 'app/dev/review-harness/page.tsx'), 'utf8')
  assert.match(harness, /NODE_ENV === 'production'\) notFound\(\)/)
})

// ---------------------------------------------------------------------------
// M09 hardening M2 / M3 / W8
// ---------------------------------------------------------------------------

test('M2: approve / needs_revision never preselected; foreign files preselect nothing', () => {
  const f = buildDecisionFile({ instance_id: 'LA-1', export_nonce: 'd'.repeat(64) }, [
    { question_occurrence_id: 'q1', version_id: 'v1', version_sha256: SHA_A, decision: 'approve' },
    { question_occurrence_id: 'q2', version_id: 'v2', version_sha256: SHA_A, decision: 'needs_revision' },
    { question_occurrence_id: 'q3', version_id: 'v3', version_sha256: SHA_A, decision: 'needs_evidence' },
    { question_occurrence_id: 'q4', version_id: 'v4', version_sha256: SHA_A, decision: 'comment', comment: 'note' },
  ], NOW)
  const current = ['q1', 'q2', 'q3', 'q4'].map((q, i) => ({ question_occurrence_id: q, versions: [{ id: `v${i + 1}`, sha256: SHA_A }], governing_version_id: `v${i + 1}`, governing_approved: false }))
  const own = planDecisionImport(f, 'LA-1', current, { origin: 'this_vault' })
  assert.equal(own.origin, 'this_vault')
  assert.deepEqual(own.items.map((i) => i.applicable), [true, true, true, true])
  assert.deepEqual(own.items.map((i) => i.preselected), [false, false, true, true])
  const foreign = planDecisionImport(f, 'LA-1', current, { origin: 'foreign' })
  assert.deepEqual(foreign.items.map((i) => i.preselected), [false, false, false, false])
  assert.equal(planDecisionImport(f, 'LA-1', current).origin, 'foreign', 'unverified nonce defaults to foreign')
})

test('M2: export_nonce is validated and optional', () => {
  const ok = parseDecisionFile(JSON.stringify(buildDecisionFile({ instance_id: 'LA-1', export_nonce: 'e'.repeat(64) }, [], NOW)))
  assert.equal(ok.ok, true)
  assert.equal(ok.file.export_nonce, 'e'.repeat(64))
  const legacy = JSON.parse(JSON.stringify(buildDecisionFile({ instance_id: 'LA-1' }, [], NOW)))
  delete legacy.export_nonce
  const l = parseDecisionFile(JSON.stringify(legacy))
  assert.equal(l.ok, true)
  assert.equal(l.file.export_nonce, null)
  const bad = parseDecisionFile(JSON.stringify({ ...legacy, export_nonce: 'not-a-nonce' }))
  assert.equal(bad.ok, false)
})

test('M2: export nonce recorded (hashed) in the vault; only that nonce + instance is "this_vault"', async () => {
  const s = createMemoryStorage()
  const seed = await seedSyntheticReview(s, SECRET)
  const nonce = await issueReviewExportNonce(s, seed.instance_id)
  assert.match(nonce, /^[0-9a-f]{64}$/)
  assert.equal(await decisionFileOrigin(s, seed.instance_id, nonce), 'this_vault')
  assert.equal(await decisionFileOrigin(s, seed.instance_id, 'f'.repeat(64)), 'foreign')
  assert.equal(await decisionFileOrigin(s, seed.instance_id, null), 'foreign')
  assert.equal(await decisionFileOrigin(s, 'LA-someone-else', nonce), 'foreign', 'bound to the instance')
  const events = await s.getAll('events')
  const ev = events.find((e) => e.kind === 'review_exported')
  assert.ok(ev && !JSON.stringify(ev).includes(nonce), 'vault keeps only the nonce hash')
  assert.notEqual(await issueReviewExportNonce(s, seed.instance_id), nonce, 'fresh nonce per export')
})

test('M2: applying a foreign plan needs explicit confirmation; imported comments carry via decision_file', async () => {
  const s = createMemoryStorage()
  const seed = await seedSyntheticReview(s, SECRET)
  const rows = await listInstanceQuestions(s, SECRET, seed.instance_id, { classify: false })
  const v = rows.find((r) => r.question_occurrence_id === seed.occ.company).versions.at(-1)
  const file = buildDecisionFile({ instance_id: seed.instance_id }, [
    { question_occurrence_id: seed.occ.company, version_id: v.id, version_sha256: v.sha256, decision: 'approve', comment: 'From a file (synthetic)' },
  ], NOW)
  const plan = planDecisionImport(file, seed.instance_id, currentStates(rows), { origin: await decisionFileOrigin(s, seed.instance_id, file.export_nonce) })
  assert.equal(plan.origin, 'foreign')
  await assert.rejects(() => applyDecisionPlan(s, SECRET, plan, 'u-test', new Set([v.id])), /not exported by this vault/)
  assert.equal((await listApprovals(s, v.id)).filter((a) => a.via === 'decision_file').length, 0)
  const res = await applyDecisionPlan(s, SECRET, plan, 'u-test', new Set([v.id]), { foreignConfirmed: true })
  assert.deepEqual(res[0].wrote, ['approval', 'comment'])
  const c = (await listComments(s, SECRET, { version_id: v.id })).at(-1)
  assert.equal(c.via, 'decision_file')
  assert.equal(commentSource(c), 'decision_file')
})

test('M2: approve rows get a locally decrypted excerpt capped at ~300 chars', async () => {
  const s = createMemoryStorage()
  const seed = await seedSyntheticReview(s, SECRET)
  const rows = await listInstanceQuestions(s, SECRET, seed.instance_id, { classify: false })
  const ids = rows.filter((r) => r.versions.length).map((r) => r.versions.at(-1).id)
  const ex = await readDecisionExcerpts(s, SECRET, [...ids, 'missing-version'])
  assert.equal(ex.get('missing-version'), null)
  for (const id of ids) {
    const t = ex.get(id)
    assert.equal(typeof t, 'string')
    assert.ok([...t].length <= DECISION_EXCERPT_CHARS + 1)
  }
  const short = await readDecisionExcerpts(s, SECRET, [ids[0]], 5)
  assert.match(short.get(ids[0]), /^.{5}…$/su)
})

test('M3: agent / companion comments are labelled "From companion — review"; via is validated', async () => {
  assert.equal(commentSource({ actor_class: 'agent' }), 'companion')
  assert.equal(commentSource({ actor_class: 'human', via: 'companion' }), 'companion')
  assert.equal(commentSource({ actor_class: 'human' }), null)
  assert.equal(COMMENT_SOURCE_LABEL.companion, 'From companion — review')
  const s = createMemoryStorage()
  const seed = await seedSyntheticReview(s, SECRET)
  const rows = await listInstanceQuestions(s, SECRET, seed.instance_id, { classify: false })
  const v = rows.find((r) => r.question_occurrence_id === seed.occ.company).versions.at(-1)
  await assert.rejects(() => addComment(s, SECRET, { version_id: v.id, body: 'x', actor_class: 'human', actor_id: 'u', via: 'forged' }), /via must be/)
  await addComment(s, SECRET, { version_id: v.id, body: 'staged by the CLI (synthetic)', actor_class: 'agent', actor_id: 'aqua-companion', via: 'companion' })
  const board = await loadBoard(s, SECRET, seed.instance_id, {}, { classify: false, now: NOW })
  const row = board.rows.find((r) => r.question_occurrence_id === seed.occ.company)
  const card = await loadCard(s, SECRET, { instance_id: seed.instance_id, row, context: board.context, now: NOW })
  const cm = card.comments.threads.flatMap((t) => t.comments).find((c) => c.body.startsWith('staged by the CLI'))
  assert.equal(cm.source, 'companion')
  assert.equal(cm.source_label, 'From companion — review')
})

test('W8: companion agent drafts are labelled "Drafted by agent (companion)"', () => {
  const agentNote = 'agent: drafted through aqua-companion mcp (user-operated agent); not reviewed'
  assert.equal(versionMethodLabel({ method: 'byok', provenance: agentNote }), AGENT_DRAFT_LABEL)
  assert.equal(AGENT_DRAFT_LABEL, 'Drafted by agent (companion)')
  assert.equal(versionMethodLabel({ method: 'byok', provenance: null }), 'AI draft · your key')
  assert.equal(versionMethodLabel({ method: 'manual', provenance: agentNote }), 'Written by you', 'only byok drafts are agent drafts')
})
