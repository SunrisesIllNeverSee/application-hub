// PostHog LLM analytics helper: no key => plain Anthropic client, no PostHog.
// Run: node --test tests/posthog-server.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'

delete process.env.NEXT_PUBLIC_POSTHOG_KEY
const { getPostHogServer, createPlatformAnthropic } = await import('../lib/posthog/server.ts')

test('no project key: PostHog server client is null', () => {
  assert.equal(getPostHogServer(), null)
})

test('no project key: createPlatformAnthropic returns a plain, unwrapped Anthropic client', () => {
  const client = createPlatformAnthropic('sk-ant-test-placeholder', '/api/test')
  assert.equal(client.constructor.name, 'Anthropic')
  assert.equal(typeof client.messages.create, 'function')
})
