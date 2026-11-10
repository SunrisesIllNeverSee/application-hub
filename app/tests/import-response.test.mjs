// Run: node --test tests/import-response.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { importReplyText } from '../lib/import-response.ts'

test('reads the text block after a leading thinking block', () => {
  const r = importReplyText({ stop_reason: 'end_turn', content: [{ type: 'thinking' }, { type: 'text', text: ' [] ' }] })
  assert.deepEqual(r, { ok: true, text: '[]' })
})
test('max_tokens is a specific error', () => {
  const r = importReplyText({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '[{"q"' }] })
  assert.equal(r.ok, false)
  assert.match(r.error, /cut off/)
})
test('refusal is a specific error', () => {
  const r = importReplyText({ stop_reason: 'refusal', content: [] })
  assert.equal(r.ok, false)
  assert.match(r.error, /declined/)
})
test('thinking-only or empty reply is an error, not an empty import', () => {
  for (const content of [[{ type: 'thinking' }], [], [{ type: 'text', text: '   ' }]]) {
    assert.equal(importReplyText({ stop_reason: 'end_turn', content }).ok, false)
  }
})
