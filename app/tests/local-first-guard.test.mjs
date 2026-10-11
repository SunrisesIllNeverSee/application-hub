// LF-25: local-first server write boundary — unit checks for the shared guard.
// Run: node --test tests/local-first-guard.test.mjs
// (Node 26 strips TypeScript types natively, so the .ts module imports directly.)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isLocalFirst,
  refusePrivateWrite,
  refusePrivateTextFields,
  privateWriteRefusal,
  LOCAL_FIRST_REFUSAL_MESSAGE,
} from '../lib/local-first-guard.ts'

const REFUSAL = 'local-first mode: private content stays on device'

test('refusal message is the contract string', () => {
  assert.equal(LOCAL_FIRST_REFUSAL_MESSAGE, REFUSAL)
})

test('isLocalFirst is off by default / with junk values', () => {
  delete process.env.AQUA_LOCAL_FIRST
  assert.equal(isLocalFirst(), false)
  for (const v of ['0', 'false', 'yes', 'on', '']) {
    process.env.AQUA_LOCAL_FIRST = v
    assert.equal(isLocalFirst(), false, `value ${v}`)
  }
})

test('isLocalFirst engages on "1" and "true"', () => {
  for (const v of ['1', 'true']) {
    process.env.AQUA_LOCAL_FIRST = v
    assert.equal(isLocalFirst(), true, `value ${v}`)
  }
})

test('refusePrivateWrite returns null when flag is off', () => {
  delete process.env.AQUA_LOCAL_FIRST
  assert.equal(refusePrivateWrite(), null)
})

test('refusePrivateWrite returns honest 403 JSON when flag is on', async () => {
  process.env.AQUA_LOCAL_FIRST = '1'
  const res = refusePrivateWrite()
  assert.ok(res instanceof Response)
  assert.equal(res.status, 403)
  const body = await res.json()
  assert.equal(body.error, REFUSAL)
  assert.equal(body.local_first, true)
})

test('refusePrivateWrite merges extra detail fields', async () => {
  process.env.AQUA_LOCAL_FIRST = '1'
  const res = refusePrivateWrite({ detail: 'extra' })
  const body = await res.json()
  assert.equal(body.detail, 'extra')
  assert.equal(body.error, REFUSAL)
})

test('privateWriteRefusal payload is honest', () => {
  const body = privateWriteRefusal()
  assert.equal(body.error, REFUSAL)
  assert.equal(body.local_first, true)
})

// --- F-B7 field-level gate ---

test('refusePrivateTextFields is inert when flag is off', () => {
  delete process.env.AQUA_LOCAL_FIRST
  assert.equal(
    refusePrivateTextFields({ outcome_notes: 'private text' }, ['outcome_notes']),
    null,
  )
})

test('refusePrivateTextFields refuses named free-text fields under flag', async () => {
  process.env.AQUA_LOCAL_FIRST = '1'
  const res = refusePrivateTextFields(
    { status: 'accepted', outcome_notes: 'my private interview notes' },
    ['outcome_notes', 'program_feedback'],
  )
  assert.ok(res instanceof Response)
  assert.equal(res.status, 403)
  const body = await res.json()
  assert.equal(body.error, REFUSAL)
  assert.equal(body.local_first, true)
  assert.deepEqual(body.refused_fields, ['outcome_notes'])
})

test('refusePrivateTextFields permits structured/metadata-only payloads', () => {
  process.env.AQUA_LOCAL_FIRST = '1'
  for (const body of [
    { status: 'accepted' },
    { status: 'waitlisted', interview_date: '2026-10-11', would_recommend: 4 },
    { outcome_notes: null, program_feedback: null }, // explicit clear
    { outcome_notes: '', program_feedback: '   ' }, // empty string
    { program_url: 'https://x.example', kind: 'grant' },
  ]) {
    assert.equal(
      refusePrivateTextFields(body, ['outcome_notes', 'program_feedback', 'notes', 'questions_text']),
      null,
      JSON.stringify(body),
    )
  }
})

test('refusePrivateTextFields refuses non-string field values too', async () => {
  process.env.AQUA_LOCAL_FIRST = '1'
  const res = refusePrivateTextFields({ notes: { nested: 'text' } }, ['notes'])
  assert.ok(res instanceof Response)
  assert.equal(res.status, 403)
})

test('refusePrivateTextFields lists every refused field', async () => {
  process.env.AQUA_LOCAL_FIRST = '1'
  const res = refusePrivateTextFields(
    { outcome_notes: 'a', program_feedback: 'b' },
    ['outcome_notes', 'program_feedback'],
  )
  const body = await res.json()
  assert.deepEqual(body.refused_fields, ['outcome_notes', 'program_feedback'])
})
