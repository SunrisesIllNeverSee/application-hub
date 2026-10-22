// Agent interface, protocol level: the server is a real child process
// speaking newline-delimited JSON-RPC 2.0 over stdio.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initWorkspace, scratch } from './helpers.mjs'
import { startServer } from './mcp-helpers.mjs'
import { PRIVILEGED_ABSENT, TIER, TOOLS } from '../src/mcp-tools.mjs'
import { SERVER_INSTRUCTIONS, SUPPORTED_PROTOCOL_VERSIONS } from '../src/mcp-server.mjs'

const CAPABILITIES = [
  // directive section 10, in order
  'discover_applications', 'get_application_details', 'import_local_application', 'submit_catalog_candidate', 'inspect_extracted_questions',
  'match_canonical_questions', 'search_answer_bank', 'create_draft_version', 'request_evidence', 'present_review_decisions',
  'read_review_status', 'prepare_packet', 'export_packet', 'verify_packet', 'record_observed_submission',
]

test('initialize negotiates the protocol version; tools/list declares every tool with its tier', async () => {
  const root = await initWorkspace(scratch('mcp-proto'))
  const c = startServer(root)
  try {
    const init = await c.initialize('2025-06-18')
    assert.equal(init.result.protocolVersion, '2025-06-18')
    assert.deepEqual(init.result.capabilities, { tools: { listChanged: false } })
    assert.equal(init.result.serverInfo.name, 'aqua-companion')
    assert.equal(init.result.instructions, SERVER_INSTRUCTIONS)
    assert.match(init.result.instructions, /untrusted_content/)
    const ping = await c.request('ping')
    assert.deepEqual(ping.result, {})
    const list = (await c.request('tools/list')).result.tools
    assert.equal(list.length, TOOLS.length)
    const names = list.map((t) => t.name)
    for (const cap of CAPABILITIES) assert.ok(names.includes(cap), `capability ${cap} is exposed`)
    for (const extra of ['prepare_catalog_candidate', 'attach_evidence', 'attest_submission', 'approve_answer', 'sign_packet', 'refresh_catalog']) assert.ok(names.includes(extra), extra)
    for (const t of list) {
      const tier = t._meta['aqua/tier']
      assert.ok([TIER.READ, TIER.PRIVATE_WRITE, TIER.HUMAN_ONLY, TIER.HUMAN_CONSENT].includes(tier), `${t.name} tier ${tier}`)
      assert.ok(t.description.startsWith(`[tier: ${tier}]`), t.name)
      assert.equal(t.inputSchema.type, 'object')
      assert.equal(t.inputSchema.additionalProperties, false)
      assert.equal(t.annotations.readOnlyHint, tier === TIER.READ && !['refresh_catalog', 'discover_applications', 'get_application_details', 'match_canonical_questions', 'doctor'].includes(t.name))
      // no tool takes a secret, token or JWT
      for (const p of Object.keys(t.inputSchema.properties)) assert.doesNotMatch(p, /pass|secret|token|jwt|key|auth/i, `${t.name}.${p}`)
    }
    const tiers = Object.fromEntries(list.map((t) => [t.name, t._meta['aqua/tier']]))
    for (const h of ['submit_catalog_candidate', 'export_packet', 'attest_submission', 'approve_answer', 'sign_packet']) assert.equal(tiers[h], TIER.HUMAN_ONLY, h)
    for (const w of ['import_local_application', 'prepare_catalog_candidate', 'create_draft_version', 'request_evidence', 'attach_evidence', 'record_observed_submission']) assert.equal(tiers[w], TIER.PRIVATE_WRITE, w)
  } finally {
    assert.equal(await c.close(), 0)
  }
})

test('version negotiation: an unsupported version gets the newest; 2024-11-05 gets the old shapes', async () => {
  const root = await initWorkspace(scratch('mcp-proto-v'))
  const a = startServer(root)
  try {
    const init = await a.initialize('1999-01-01')
    assert.equal(init.result.protocolVersion, SUPPORTED_PROTOCOL_VERSIONS[0])
  } finally {
    await a.close()
  }
  const b = startServer(root)
  try {
    const init = await b.initialize('2024-11-05')
    assert.equal(init.result.protocolVersion, '2024-11-05')
    const tools = (await b.request('tools/list')).result.tools
    assert.deepEqual(Object.keys(tools[0]).sort(), ['description', 'inputSchema', 'name'])
    const m = await b.request('tools/call', { name: 'approve_answer', arguments: {} })
    assert.equal(m.result.structuredContent, undefined) // structuredContent only from 2025-06-18
    assert.equal(JSON.parse(m.result.content[0].text).status, 'requires_human')
  } finally {
    await b.close()
  }
})

test('privileged operations are absent; unknown methods, bad JSON and early calls are JSON-RPC errors', async () => {
  const root = await initWorkspace(scratch('mcp-proto-priv'))
  const c = startServer(root)
  try {
    const early = await c.request('tools/list')
    assert.equal(early.error.code, -32002)
    await c.initialize()
    const listed = (await c.request('tools/list')).result.tools.map((t) => t.name)
    for (const p of [...PRIVILEGED_ABSENT.map((x) => x.name), 'publish_catalog', 'apply_migration', 'execute_sql', 'set_service_role']) {
      assert.equal(listed.includes(p), false, p)
      const m = await c.request('tools/call', { name: p, arguments: {} })
      assert.equal(m.error.code, -32602, p)
      assert.match(m.error.message, /Unknown tool/)
    }
    assert.equal((await c.request('resources/list')).error.code, -32601)
    const parse = await c.sendAndWait('{not json', null)
    assert.equal(parse.error.code, -32700)
    // notifications get no response; the next request still works
    c.notify('notifications/cancelled', { requestId: 99 })
    assert.deepEqual((await c.request('ping')).result, {})
    const bad = await c.call('read_review_status', { application_id: 'x', extra: 1 })
    assert.equal(bad.status, 'invalid_arguments')
    assert.equal(bad.__isError, true)
  } finally {
    await c.close()
  }
  // stdout carried nothing but JSON-RPC
  for (const line of c.raw) assert.doesNotThrow(() => JSON.parse(line))
})

test('the server refuses to start without a passphrase, and with a wrong one', async () => {
  const root = await initWorkspace(scratch('mcp-proto-secret'))
  const none = startServer(root, { passphrase: null })
  assert.notEqual(await none.exited, 0)
  assert.match(none.stderr, /AQUA_PASSPHRASE|--keychain/)
  const wrong = startServer(root, { passphrase: 'not-the-passphrase-123' })
  assert.equal(await wrong.exited, 4)
  assert.match(wrong.stderr, /Wrong passphrase/)
})
