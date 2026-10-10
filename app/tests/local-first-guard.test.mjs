// LF-25: local-first server write boundary — unit checks for the shared guard.
// Run: node --test tests/local-first-guard.test.mjs
// (Node 26 strips TypeScript types natively, so the .ts module imports directly.)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isLocalFirst,
  refusePrivateWrite,
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
