// Provider adapter contract verification — request construction, auth
// headers, endpoint pinning, response/error handling, consent receipts.
// Contract-level verification (mock fetch); Ollama gets live verification
// via the browser journey harness separately.
// Run: node lib/aqua-local/run-provider-contract-tests.mjs
import assert from 'node:assert/strict'
import { createMemoryStorage } from './vault.ts'
import {
  createAnthropicAdapter, createOpenAiAdapter, createGoogleAdapter,
  createOllamaAdapter, adapterForProvider, storeProviderKey,
  generateWithConsent, listProviderConsents,
} from './providers.ts'

const SECRET = 'correct-horse-battery-staple'
let passed = 0
async function t(name, fn) {
  try { await fn(); passed++; console.log('PASS', name) }
  catch (e) { process.exitCode = 1; console.log('FAIL', name + ':', e.message) }
}

function captureFetch(body, status = 200) {
  const calls = []
  const f = async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(body), { status })
  }
  return { calls, f }
}

await t('anthropic: request shape, auth header, pinned endpoint', async () => {
  const s = createMemoryStorage()
  await storeProviderKey(s, SECRET, 'anthropic', 'sk-ant-test')
  const { calls, f } = captureFetch({ content: [{ type: 'text', text: 'draft text' }], model: 'claude-haiku-4-5-20251001' })
  const adapter = createAnthropicAdapter({ model: 'claude-haiku-4-5-20251001' })
  assert.equal(adapter.endpoint, 'https://api.anthropic.com/v1/messages')
  const { result, consent } = await generateWithConsent(
    s, adapter, { prompt: 'write it', system: 'sys', model: 'claude-haiku-4-5-20251001' },
    { userConsent: true, secret: SECRET, fetchImpl: f })
  assert.equal(result.text, 'draft text')
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages')
  const headers = calls[0].init.headers
  assert.equal(headers['x-api-key'], 'sk-ant-test')
  assert.equal(headers['anthropic-dangerous-direct-browser-access'], 'true')
  const sent = JSON.parse(calls[0].init.body)
  assert.equal(sent.system, 'sys')
  assert.equal(sent.messages[0].role, 'user')
  assert.equal(consent.endpoint, 'https://api.anthropic.com/v1/messages')
})

await t('openai: bearer auth, pinned endpoint, model passthrough', async () => {
  const s = createMemoryStorage()
  await storeProviderKey(s, SECRET, 'openai', 'sk-oai-test')
  const { calls, f } = captureFetch({ choices: [{ message: { content: 'gpt out' } }], model: 'gpt-4o-mini' })
  const adapter = adapterForProvider('openai', { model_preference: 'gpt-4o-mini' })
  const { result } = await generateWithConsent(
    s, adapter, { prompt: 'p', model: 'gpt-4o-mini' },
    { userConsent: true, secret: SECRET, fetchImpl: f })
  assert.equal(result.text, 'gpt out')
  assert.equal(calls[0].url, 'https://api.openai.com/v1/chat/completions')
  assert.equal(calls[0].init.headers['authorization'], 'Bearer sk-oai-test')
})

await t('openai: error body surfaces honestly', async () => {
  const s = createMemoryStorage()
  await storeProviderKey(s, SECRET, 'openai', 'sk-bad')
  const { f } = captureFetch({ error: 'unauthorized' }, 401)
  const adapter = adapterForProvider('openai', {})
  await assert.rejects(
    () => generateWithConsent(s, adapter, { prompt: 'p' }, { userConsent: true, secret: SECRET, fetchImpl: f }),
    /401/,
  )
})

await t('google: key in x-goog-api-key header, canonical path, consent records endpoint', async () => {
  const s = createMemoryStorage()
  await storeProviderKey(s, SECRET, 'google', 'goog-key')
  const { calls, f } = captureFetch({ candidates: [{ content: { parts: [{ text: 'gemini out' }] } }], modelVersion: 'gemini-2.0-flash' })
  const adapter = createGoogleAdapter({ model: 'gemini-2.0-flash' })
  const { result, consent } = await generateWithConsent(
    s, adapter, { prompt: 'p', model: 'gemini-2.0-flash' },
    { userConsent: true, secret: SECRET, fetchImpl: f })
  assert.equal(result.text, 'gemini out')
  assert.ok(calls[0].url.startsWith('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash'))
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'goog-key')
  assert.ok(consent.endpoint.includes('generativelanguage.googleapis.com'))
})

await t('ollama: no key required, caller base_url honored for ollama only, no ngrok header locally', async () => {
  const s = createMemoryStorage()
  await storeProviderKey(s, SECRET, 'ollama', '', { base_url: 'http://localhost:11434' })
  const { calls, f } = captureFetch({ message: { content: 'local out' } })
  const adapter = createOllamaAdapter({ base_url: 'http://localhost:11434', model: 'qwen3:0.6b' })
  assert.equal(adapter.requiresKey, false)
  const { result, consent } = await generateWithConsent(
    s, adapter, { prompt: 'p' }, { userConsent: true, secret: SECRET, fetchImpl: f })
  assert.equal(result.text, 'local out')
  assert.equal(calls[0].url, 'http://localhost:11434/api/chat')
  // no API-key headers on a local endpoint
  assert.equal(calls[0].init.headers?.['x-api-key'], undefined)
  assert.equal(calls[0].init.headers?.['Authorization'], undefined)
  // and no tunnel-only header on localhost
  assert.equal(calls[0].init.headers?.['ngrok-skip-browser-warning'], undefined)
  assert.equal(consent.endpoint, 'http://localhost:11434/api/chat')
})

await t('consent receipts: one per call, sha covers snapshot', async () => {
  const s = createMemoryStorage()
  await storeProviderKey(s, SECRET, 'ollama', '', { base_url: 'http://localhost:11434' })
  const adapter = adapterForProvider('ollama', { base_url: 'http://localhost:11434' })
  const { f } = captureFetch({ message: { content: 'x' } })
  await generateWithConsent(s, adapter, { prompt: 'a' }, { userConsent: true, secret: SECRET, fetchImpl: f })
  await generateWithConsent(s, adapter, { prompt: 'b' }, { userConsent: true, secret: SECRET, fetchImpl: f })
  const consents = await listProviderConsents(s)
  assert.equal(consents.length, 2)
  assert.notEqual(consents[0].request_sha256, consents[1].request_sha256)
})

await t('anthropic: no key → ProviderKeyError, no egress attempt', async () => {
  const s = createMemoryStorage()
  const { calls, f } = captureFetch({})
  const adapter = createAnthropicAdapter({})
  await assert.rejects(
    () => generateWithConsent(s, adapter, { prompt: 'p' }, { userConsent: true, secret: SECRET, fetchImpl: f }),
    /key/i,
  )
  assert.equal(calls.length, 0, 'no fetch without key')
})

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`)
