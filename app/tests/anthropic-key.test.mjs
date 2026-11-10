// Run: node --test tests/anthropic-key.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAnthropicKey, ConnectedKeyError } from '../lib/anthropic-key.ts'

const fakeSupabase = (rows) => ({
  from: () => {
    const q = { select: () => q, eq: () => q, limit: async () => ({ data: rows }) }
    return q
  },
})
const row = { key_encrypted: 'enc', key_storage_ref: 'ref' }
const decryptOk = () => 'sk-user'
const decryptBad = () => { throw new Error('bad key') }

test('no integration: platform key when configured', async () => {
  const r = await resolveAnthropicKey(fakeSupabase([]), 'u', { decrypt: decryptOk, platformKey: 'sk-platform' })
  assert.deepEqual(r, { apiKey: 'sk-platform', keySource: 'platform' })
})
test('no integration and no platform key: null', async () => {
  assert.equal(await resolveAnthropicKey(fakeSupabase([]), 'u', { decrypt: decryptOk, platformKey: undefined }), null)
})
test('working integration: its own key, even if a platform key exists', async () => {
  const r = await resolveAnthropicKey(fakeSupabase([row]), 'u', { decrypt: decryptOk, platformKey: 'sk-platform' })
  assert.deepEqual(r, { apiKey: 'sk-user', keySource: 'byok' })
})
test('undecryptable integration: error, never the platform key', async () => {
  await assert.rejects(
    resolveAnthropicKey(fakeSupabase([row]), 'u', { decrypt: decryptBad, platformKey: 'sk-platform' }),
    (e) => e instanceof ConnectedKeyError && e.status === 422 && e.code === 'connected_key_unusable',
  )
})
test('integration with missing or empty key: error, never the platform key', async () => {
  for (const [rows, decrypt] of [[[{ key_encrypted: null, key_storage_ref: null }], decryptOk], [[row], () => '']]) {
    await assert.rejects(
      resolveAnthropicKey(fakeSupabase(rows), 'u', { decrypt, platformKey: 'sk-platform' }),
      ConnectedKeyError,
    )
  }
})
test('undecryptable integration and no platform key: still an error', async () => {
  await assert.rejects(
    resolveAnthropicKey(fakeSupabase([row]), 'u', { decrypt: decryptBad, platformKey: undefined }),
    ConnectedKeyError,
  )
})
