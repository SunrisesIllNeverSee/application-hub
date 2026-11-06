// PostHog LLM analytics helper. No real network: Anthropic and PostHog both get stub fetches.
// Run: node --test tests/posthog-server.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PostHog } from 'posthog-node'
import { gunzipSync } from 'node:zlib'

delete process.env.NEXT_PUBLIC_POSTHOG_KEY
const { getPostHogServer, createPlatformAnthropic, createTrackedAnthropic, captureChatGeneration, analyticsUserId, sanitizeAiEvent } = await import('../lib/posthog/server.ts')

const SECRET = 'SSN 123-45-6789 jane@example.com'
const ANTHROPIC_OK = {
  id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-test',
  content: [{ type: 'text', text: 'COMPLETION ' + SECRET }],
  stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 11, output_tokens: 7 },
}
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// A PostHog client built like the real one (privacyMode + before_send) but with a stub transport.
function harness(anthropicHandler) {
  const sent = []
  const phFetch = async (_url, opts) => {
    sent.push(...JSON.parse(typeof opts.body === 'string' ? opts.body : gunzipSync(opts.body).toString()).batch ?? [])
    return { status: 200, text: async () => '{}', json: async () => ({}) }
  }
  const ph = new PostHog('phc_test', { host: 'http://ph.invalid', flushAt: 1, flushInterval: 0, privacyMode: true, before_send: sanitizeAiEvent, fetch: phFetch })
  const afterTasks = []
  const after = (t) => { afterTasks.push(t) }
  const client = createPlatformAnthropic('sk-ant-test', '/api/test', { posthog: ph, after, fetch: anthropicHandler })
  return { client, ph, sent, afterTasks }
}
const drain = async (h) => { for (const t of h.afterTasks) await t(); await h.ph.flush() }
const body = { model: 'claude-test', max_tokens: 10, system: 'SYSTEM ' + SECRET, messages: [{ role: 'user', content: 'PROMPT ' + SECRET }] }

test('no project key: PostHog server client is null and the client is plain', () => {
  assert.equal(getPostHogServer(), null)
  const c = createPlatformAnthropic('sk-ant-test', '/api/test')
  assert.equal(typeof c.messages.create, 'function')
  assert.equal(c.phClient, undefined)
})

test('captured event has no content, even if the caller tries posthogPrivacyMode:false; response unchanged', async () => {
  const h = harness(async () => json(200, ANTHROPIC_OK))
  const res = await h.client.messages.create({ ...body, posthogPrivacyMode: false })
  assert.equal(res.content[0].text, 'COMPLETION ' + SECRET)
  assert.equal(res.usage.input_tokens, 11)
  await drain(h)
  const ev = h.sent.find((e) => e.event === '$ai_generation')
  assert.ok(ev, 'generation event captured')
  assert.equal(ev.properties.route, '/api/test')
  assert.equal(ev.properties.$ai_input_tokens, 11)
  assert.equal(ev.properties.$ai_output_tokens, 7)
  assert.equal(ev.properties.$process_person_profile, false)
  for (const k of ['$ai_input', '$ai_output_choices', '$ai_input_state', '$ai_output_state']) assert.equal(k in ev.properties, false, k)
  assert.equal(JSON.stringify(h.sent).includes('123-45-6789'), false)
  assert.equal(JSON.stringify(h.sent).includes('jane@example.com'), false)
})

test('$ai_error is reduced to a class name; error still propagates', async () => {
  const echoed = { type: 'error', error: { type: 'invalid_request_error', message: 'bad: ' + SECRET } }
  const h = harness(async () => json(400, echoed))
  await assert.rejects(() => h.client.messages.create(body), (e) => e.status === 400)
  await drain(h)
  const ev = h.sent.find((e) => e.event === '$ai_generation')
  assert.ok(ev)
  assert.equal(ev.properties.$ai_is_error, true)
  assert.equal(ev.properties.$ai_http_status, 400)
  assert.match(ev.properties.$ai_error, /^[A-Za-z]*Error$/)
  assert.equal(JSON.stringify(h.sent).includes('123-45-6789'), false)
})

test('sanitizeAiEvent strips content and non-$ai_ events (backstop)', () => {
  const out = sanitizeAiEvent({ distinctId: 'x', event: '$ai_generation', properties: { $ai_input: [1], $ai_output_choices: [2], $ai_error: 'BadRequestError: ' + SECRET, $ai_model: 'm' } })
  assert.deepEqual(out.properties, { $ai_error: 'BadRequestError', $ai_model: 'm' })
  assert.equal(sanitizeAiEvent({ distinctId: 'x', event: '$exception', properties: {} }), null)
})

test('a throwing after() or flush does not break the request', async () => {
  const ph = new PostHog('phc_test', { host: 'http://ph.invalid', flushAt: 1, flushInterval: 0, fetchRetryCount: 0, privacyMode: true, before_send: sanitizeAiEvent, fetch: async () => { throw new Error('network down') } })
  const c1 = createPlatformAnthropic('k', '/r', { posthog: ph, after: () => { throw new Error('outside request scope') }, fetch: async () => json(200, ANTHROPIC_OK) })
  assert.equal((await c1.messages.create(body)).id, 'msg_1')
  const tasks = []
  const c2 = createPlatformAnthropic('k', '/r', { posthog: ph, after: (t) => tasks.push(t), fetch: async () => json(200, ANTHROPIC_OK) })
  assert.equal((await c2.messages.create(body)).id, 'msg_1')
  for (const t of tasks) await assert.doesNotReject(t())
})

// ── BYOK (user's own key) ────────────────────────────────────────────────────

function phHarness() {
  const sent = []
  const phFetch = async (_url, opts) => {
    sent.push(...JSON.parse(typeof opts.body === 'string' ? opts.body : gunzipSync(opts.body).toString()).batch ?? [])
    return { status: 200, text: async () => '{}', json: async () => ({}) }
  }
  const ph = new PostHog('phc_test', { host: 'http://ph.invalid', flushAt: 1, flushInterval: 0, privacyMode: true, before_send: sanitizeAiEvent, fetch: phFetch })
  const afterTasks = []
  return { ph, sent, afterTasks, after: (t) => { afterTasks.push(t) } }
}
const drainPh = async (h) => { for (const t of h.afterTasks) await t(); await h.ph.flush() }
const USER_ID = '6f1c2a9e-0000-4000-8000-00000000abcd'
const BYOK_KEY = 'sk-ant-USER-OWN-KEY-do-not-leak'

test('analyticsUserId is a stable one-way hash, never the raw id', () => {
  const a = analyticsUserId(USER_ID)
  assert.equal(a, analyticsUserId(USER_ID))
  assert.match(a, /^aqua_[0-9a-f]{32}$/)
  assert.equal(a.includes(USER_ID), false)
  assert.equal(analyticsUserId(null), undefined)
})

test('BYOK Anthropic: event tagged byok with the hashed user, no content and no key', async () => {
  const h = phHarness()
  const client = createTrackedAnthropic(BYOK_KEY, '/api/draft', { keySource: 'byok', userId: USER_ID }, { posthog: h.ph, after: h.after, fetch: async () => json(200, ANTHROPIC_OK) })
  const res = await client.messages.create(body)
  assert.equal(res.content[0].text, 'COMPLETION ' + SECRET)
  await drainPh(h)
  const ev = h.sent.find((e) => e.event === '$ai_generation')
  assert.ok(ev)
  assert.equal(ev.properties.ai_key_source, 'byok')
  assert.equal(ev.properties.route, '/api/draft')
  assert.equal(ev.distinct_id, analyticsUserId(USER_ID))
  assert.equal(ev.properties.$process_person_profile, false)
  assert.equal(ev.properties.$ai_input_tokens, 11)
  const all = JSON.stringify(h.sent)
  for (const leak of [BYOK_KEY, USER_ID, '123-45-6789', 'jane@example.com']) assert.equal(all.includes(leak), false, leak)
})

test('platform helper still tags platform', async () => {
  const h = phHarness()
  const client = createPlatformAnthropic('sk-ant-test', '/api/test', { posthog: h.ph, after: h.after, fetch: async () => json(200, ANTHROPIC_OK) })
  await client.messages.create(body)
  await drainPh(h)
  assert.equal(h.sent.find((e) => e.event === '$ai_generation').properties.ai_key_source, 'platform')
})

test('OpenAI-compatible (Ollama/OpenAI) call: model, tokens, latency, no base URL', async () => {
  const h = phHarness()
  captureChatGeneration({ route: '/api/draft', keySource: 'byok', userId: USER_ID, provider: 'ollama', model: 'llama3.1:8b', latencyMs: 1500, inputTokens: 40, outputTokens: 90, httpStatus: 200 }, { posthog: h.ph, after: h.after })
  await drainPh(h)
  const ev = h.sent.find((e) => e.event === '$ai_generation')
  assert.ok(ev)
  assert.equal(ev.properties.$ai_provider, 'ollama')
  assert.equal(ev.properties.$ai_model, 'llama3.1:8b')
  assert.equal(ev.properties.$ai_input_tokens, 40)
  assert.equal(ev.properties.$ai_output_tokens, 90)
  assert.equal(ev.properties.$ai_latency, 1.5)
  assert.equal(ev.properties.ai_key_source, 'byok')
  assert.equal(ev.distinct_id, analyticsUserId(USER_ID))
  assert.equal(ev.properties.$ai_base_url ?? '', '')
  assert.equal(JSON.stringify(h.sent).includes(USER_ID), false)
})

test('OpenAI-compatible failure: recorded as an error class only, never throws', async () => {
  const h = phHarness()
  assert.doesNotThrow(() => captureChatGeneration({ route: '/api/draft', keySource: 'byok', provider: 'openai', model: 'gpt-4o-mini', latencyMs: 20, httpStatus: 401, errorClass: 'ProviderHttpError' }, { posthog: h.ph, after: () => { throw new Error('outside request scope') } }))
  await h.ph.flush()
  const ev = h.sent.find((e) => e.event === '$ai_generation')
  assert.ok(ev)
  assert.equal(ev.properties.$ai_is_error, true)
  assert.equal(ev.properties.$ai_error, 'ProviderHttpError')
  assert.equal(ev.properties.$ai_http_status, 401)
  assert.doesNotThrow(() => captureChatGeneration({ route: '/r', keySource: 'byok', provider: 'openai', model: 'm', latencyMs: 1 }, { posthog: null }))
})

test('a failed OpenAI-compatible call carries no token counts', async () => {
  const h = phHarness()
  captureChatGeneration({ route: '/api/draft', keySource: 'byok', provider: 'ollama', model: 'm', latencyMs: 5, errorClass: 'NetworkError' }, { posthog: h.ph, after: h.after })
  await drainPh(h)
  const ev = h.sent.find((e) => e.event === '$ai_generation')
  assert.ok(ev)
  assert.equal(ev.properties.$ai_input_tokens ?? null, null)
  assert.equal(ev.properties.$ai_output_tokens ?? null, null)
})

test('immediate capture is scoped the same way', async () => {
  const h = phHarness()
  const client = createTrackedAnthropic(BYOK_KEY, '/api/draft', { keySource: 'byok', userId: USER_ID }, { posthog: h.ph, after: h.after, fetch: async () => json(200, ANTHROPIC_OK) })
  await client.messages.create({ ...body, posthogCaptureImmediate: true })
  await drainPh(h)
  const ev = h.sent.find((e) => e.event === '$ai_generation')
  assert.ok(ev)
  assert.equal(ev.properties.ai_key_source, 'byok')
  assert.equal(ev.distinct_id, analyticsUserId(USER_ID))
})
