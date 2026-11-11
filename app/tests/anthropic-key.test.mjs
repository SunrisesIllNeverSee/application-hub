// Run: node --test tests/anthropic-key.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAnthropicKey, ConnectedKeyError, connectedKeyFailure, nonAnthropicIntegrations } from '../lib/anthropic-key.ts'

// Applies .eq() filters so provider/status filtering is exercised like the real query.
const fakeSupabase = (rows) => ({
  from: () => {
    const filters = {}
    const q = {
      select: () => q,
      eq: (k, v) => { filters[k] = v; return q },
      limit: async () => ({ data: rows.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === undefined || r[k] === v)).slice(0, 1) }),
    }
    return q
  },
})
const row = { id: 'i1', provider: 'anthropic', status: 'active', key_encrypted: 'enc', key_storage_ref: 'ref' }
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
  for (const [rows, decrypt] of [[[{ id: 'i2', provider: 'anthropic', status: 'active', key_encrypted: null, key_storage_ref: null }], decryptOk], [[row], () => '']]) {
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

test('a failing OpenAI row does not affect a working Anthropic row', async () => {
  const openai = { id: 'o1', provider: 'openai', status: 'active', key_encrypted: 'bad', key_storage_ref: 'bad' }
  const decrypt = (enc) => { if (enc === 'bad') throw new Error('bad key'); return 'sk-user' }
  const r = await resolveAnthropicKey(fakeSupabase([openai, row]), 'u', { decrypt, platformKey: 'sk-platform' })
  assert.deepEqual(r, { apiKey: 'sk-user', keySource: 'byok' })
})
test('a failing OpenAI or Ollama row alone is not a connected-Anthropic error', async () => {
  for (const provider of ['openai', 'ollama']) {
    const other = { id: 'x', provider, status: 'active', key_encrypted: 'bad', key_storage_ref: 'bad' }
    const r = await resolveAnthropicKey(fakeSupabase([other]), 'u', { decrypt: decryptBad, platformKey: undefined })
    assert.equal(r, null)
  }
})
test('nonAnthropicIntegrations: excludes anthropic, openai before ollama, unknown last', () => {
  const rows = [{ provider: 'mystery' }, { provider: 'ollama' }, { provider: 'anthropic' }, { provider: 'openai' }]
  assert.deepEqual(nonAnthropicIntegrations(rows).map((r) => r.provider), ['openai', 'ollama', 'mystery'])
})
test('connectedKeyFailure maps only ConnectedKeyError to a 422 body', () => {
  const f = connectedKeyFailure(new ConnectedKeyError())
  assert.equal(f.status, 422)
  assert.equal(f.body.code, 'connected_key_unusable')
  assert.equal(connectedKeyFailure(new Error('x')), null)
})
test('failure log never contains key material or the error message', async () => {
  const logs = []
  const orig = console.error
  console.error = (...a) => logs.push(JSON.stringify(a))
  try {
    await assert.rejects(resolveAnthropicKey(fakeSupabase([row]), 'u', { decrypt: () => { throw new Error('SECRET-KEY-MATERIAL') }, platformKey: 'sk-platform' }), ConnectedKeyError)
  } finally { console.error = orig }
  assert.ok(logs.join().includes('i1'))
  assert.equal(logs.join().includes('SECRET'), false)
})
