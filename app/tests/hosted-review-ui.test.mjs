// Render the real TSX components with React's server renderer. Only module
// resolution is adapted for the plain-node runner; no React/UI stubs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as hosted from '../lib/aqua-hosted.ts'
import * as utils from '../lib/utils.ts'

const require = createRequire(import.meta.url)
function loadTsx(path, imports) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputText)((id) => imports[id] ?? require(id), module, module.exports)
  return module.exports
}
const ui = loadTsx('../components/review/ui.tsx', { '@/lib/utils': utils })
const { HostedAnswerCard } = loadTsx('../components/review/HostedReviewBoard.tsx', { './ui': ui, '@/lib/aqua-hosted': hosted })

function card(over = {}) {
  return {
    integrity_ok: true, history_source: null,
    context: { original_question: 'What is your project?', requirements: ['150 characters maximum'] },
    answer: { version_id: 'bbbbbbbb-1111-2222-3333-444444444444', version_number: 1, sha256: 'a'.repeat(64),
      body: 'Synthetic garden project.\nExact second line.', created_at: '2026-10-25T00:00:00Z', method_label: 'Drafted by agent', limits: { over_limit: false } },
    status: { label: 'Suggested', tone: 'info' }, approval: { state: 'not_approved', label: 'Not approved' },
    recommendation_badge: { label: 'Agent recommendation: Gap' }, human_review: { label: 'No human review' },
    evidence: { gap: true, uncertain_claims: [], items: [], lineage: [] },
    recommendation: { why: [], weaknesses: [], missing_evidence: [], fact_conflicts: [] },
    ...over,
  }
}
const render = (value) => renderToStaticMarkup(React.createElement(HostedAnswerCard, { card: value, reload: async () => {} }))

test('hosted review displays exact saved wording, hash and four separate status signals without approving on render', () => {
  const html = render(card())
  for (const text of ['Synthetic garden project.\nExact second line.', 'a'.repeat(64), 'Suggested', 'Agent recommendation: Gap', 'Human review: No human review', 'Not approved']) assert.ok(html.includes(text), text)
  assert.ok(html.includes('Review approval of this exact version'))
  assert.ok(!html.includes('Confirm approval</button>'), 'the human must first open the confirmation step')
  assert.ok(!html.includes('synthetic-access-token'))
})

test('imported text is rendered as text, including HTML-like strings', () => {
  const data = card()
  data.answer.body = '<script>alert("synthetic")</script>\n**literal markdown**'
  const html = render(data)
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(html.includes('**literal markdown**'))
})

test('a gap, failed integrity check, or already approved version offers no approval action', () => {
  for (const data of [card({ answer: null }), card({ integrity_ok: false }), card({ approval: { state: 'approved', label: 'Approved' } })]) {
    assert.ok(!render(data).includes('Review approval of this exact version'))
  }
})

test('historical source dates and placeholder warnings stay visible with approval unavailable', () => {
  const html = render(card({ integrity_ok: true, history_source: { source_file: 'synthetic-history.md', source_sha256: 'b'.repeat(64),
    submitted_at: '2025-11-01', date_source: 'frontmatter', flags: ['date_conflict'], placeholder_found: true, metadata_integrity: 'verified' } }))
  for (const text of ['synthetic-history.md', '2025-11-01 (frontmatter)', 'date_conflict', 'contains placeholders and cannot be approved', 'b'.repeat(64)]) assert.ok(html.includes(text), text)
  assert.ok(!html.includes('Review approval of this exact version'))
})
