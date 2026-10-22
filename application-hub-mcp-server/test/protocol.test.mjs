// MCP protocol conformance: initialize + version negotiation, ping, the
// initialize gate, tools/resources/prompts list/call/read/get, error codes,
// batches, notifications, and real stdio framing in a child process.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { INIT, req, runServer } from './helpers.mjs'
import { SUPPORTED_PROTOCOL_VERSIONS } from '../src/catalog/protocol.mjs'

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'aqua-mcp-server.mjs')

test('initialize echoes every supported version and falls back to the newest', async () => {
  for (const v of SUPPORTED_PROTOCOL_VERSIONS) {
    const r = await runServer([], [INIT(1, v)])
    const res = r.responses.get(1).result
    assert.equal(res.protocolVersion, v)
    assert.equal(res.serverInfo.name, 'aqua-mcp-server')
    assert.equal(res.serverInfo.version, '2.0.0')
    assert.deepEqual(Object.keys(res.capabilities).sort(), ['prompts', 'resources', 'tools'])
    assert.equal(typeof res.instructions, 'string')
  }
  const r = await runServer([], [INIT(1, '1999-01-01')])
  assert.equal(r.responses.get(1).result.protocolVersion, SUPPORTED_PROTOCOL_VERSIONS[0])
})

test('requests before initialize are refused; ping always works', async () => {
  const r = await runServer([], [req(1, 'tools/list'), req(2, 'ping'), INIT(3), req(4, 'tools/list')])
  assert.equal(r.responses.get(1).error.code, -32600)
  assert.deepEqual(r.responses.get(2).result, {})
  assert.ok(r.responses.get(4).result.tools.length > 0)
})

test('tools/list shape depends on the negotiated version', async () => {
  const old = await runServer([], [INIT(1, '2024-11-05'), req(2, 'tools/list')])
  const t0 = old.responses.get(2).result.tools[0]
  assert.deepEqual(Object.keys(t0).sort(), ['description', 'inputSchema', 'name'])
  const neu = await runServer([], [INIT(1, '2025-11-25'), req(2, 'tools/list')])
  for (const t of neu.responses.get(2).result.tools) {
    assert.ok(t.title && t.annotations && t._meta['aqua/tier'], t.name)
    assert.equal(t.inputSchema.type, 'object')
    assert.equal(t.inputSchema.additionalProperties, false)
    assert.equal(t.annotations.destructiveHint, false)
  }
})

test('tools/call: structuredContent from 2025-06-18; unknown tool is -32602; bad args are a tool error', async () => {
  const msgs = [req(2, 'tools/call', { name: 'locate_workspace', arguments: {} }), req(3, 'tools/call', { name: 'nope', arguments: {} }), req(4, 'tools/call', { name: 'hub_search_programs', arguments: { limit: 'x', bogus: 1 } }), req(5, 'tools/call', {})]
  const modern = await runServer([], [INIT(1, '2025-06-18'), ...msgs])
  const ok = modern.responses.get(2).result
  assert.equal(ok.structuredContent.tool, 'locate_workspace')
  assert.equal(ok.structuredContent.tier, 'read')
  assert.equal(JSON.parse(ok.content[0].text).tool, 'locate_workspace')
  assert.equal(modern.responses.get(3).error.code, -32602)
  const bad = modern.responses.get(4).result
  assert.equal(bad.isError, true)
  assert.equal(bad.structuredContent.status, 'invalid_arguments')
  assert.equal(modern.responses.get(5).error.code, -32602)
  const older = await runServer([], [INIT(1, '2025-03-26'), msgs[0]])
  assert.equal(older.responses.get(2).result.structuredContent, undefined)
})

test('resources: list, templates, read, not found', async () => {
  const r = await runServer([], [INIT(1), req(2, 'resources/list'), req(3, 'resources/templates/list'), req(4, 'resources/read', { uri: 'aqua://programs' }), req(5, 'resources/read', { uri: 'aqua://nope' }), req(6, 'resources/read', { uri: 'aqua://programs/..%2F..' }), req(7, 'resources/read', {})])
  assert.deepEqual(r.responses.get(2).result.resources.map((x) => x.uri), ['aqua://programs'])
  assert.deepEqual(r.responses.get(3).result.resourceTemplates.map((x) => x.uriTemplate), ['aqua://programs/{slug}', 'aqua://questions/{id}'])
  const c = r.responses.get(4).result.contents[0]
  assert.equal(c.uri, 'aqua://programs')
  assert.equal(c.mimeType, 'application/json')
  assert.equal(JSON.parse(c.text).status, 'unavailable') // offline: not configured
  assert.equal(r.responses.get(5).error.code, -32002)
  assert.equal(r.responses.get(6).error.code, -32002)
  assert.equal(r.responses.get(7).error.code, -32602)
})

test('prompts: list and get; missing required argument; unknown prompt', async () => {
  const r = await runServer([], [INIT(1), req(2, 'prompts/list'), req(3, 'prompts/get', { name: 'start-application', arguments: { program: 'yc-summer-2026' } }), req(4, 'prompts/get', { name: 'start-application', arguments: {} }), req(5, 'prompts/get', { name: 'nope' }), req(6, 'prompts/get', { name: 'reuse-my-answers' }), req(7, 'prompts/get', { name: 'get-ready-to-export' })])
  assert.deepEqual(r.responses.get(2).result.prompts.map((p) => p.name), ['start-application', 'reuse-my-answers', 'get-ready-to-export'])
  const msg = r.responses.get(3).result.messages[0]
  assert.equal(msg.role, 'user')
  assert.match(msg.content.text, /yc-summer-2026/)
  assert.match(msg.content.text, /AQUA browser app/)
  assert.equal(r.responses.get(4).error.code, -32602)
  assert.equal(r.responses.get(5).error.code, -32602)
  for (const id of [6, 7]) assert.match(r.responses.get(id).result.messages[0].content.text, /no workspace/)
})

test('JSON-RPC edges: parse error, invalid request, unknown method, notifications, responses, batches', async () => {
  const r = await runServer([], ['{not json', JSON.stringify({ id: 9, method: 'x' }), INIT(1), req(2, 'no/such'), { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 77, result: {} }, [req(3, 'ping'), req(4, 'ping')], '[]'])
  assert.equal(r.out[0].error.code, -32700)
  assert.equal(r.out[1].error.code, -32600)
  assert.equal(r.responses.get(2).error.code, -32601)
  const batch = r.out.find((m) => Array.isArray(m))
  assert.deepEqual(batch.map((m) => m.id), [3, 4])
  assert.equal(r.out.at(-1).error.code, -32600) // empty batch
  assert.equal(r.out.length, 6) // nothing for the notification or the stray response
})

test('stdio framing in a real process: one JSON line per response, logs on stderr only', async () => {
  const child = spawn(process.execPath, [BIN, '--offline'], { env: { PATH: process.env.PATH }, stdio: ['pipe', 'pipe', 'pipe'] })
  let out = ''
  let err = ''
  child.stdout.on('data', (d) => { out += d })
  child.stderr.on('data', (d) => { err += d })
  child.stdin.write(`${JSON.stringify(INIT(1))}\n${JSON.stringify(req(2, 'tools/list'))}\n`)
  child.stdin.end()
  const code = await new Promise((resolve) => child.on('exit', resolve))
  assert.equal(code, 0)
  const lines = out.trim().split('\n')
  assert.equal(lines.length, 2)
  for (const l of lines) assert.equal(JSON.parse(l).jsonrpc, '2.0')
  assert.match(err, /stdio-catalog .*; 14 tools/)
})

test('--version and --help', async () => {
  const v = await runServer(['--version'], [])
  assert.equal(v.code, 0)
  const h = await runServer(['--help'], [])
  assert.equal(h.code, 0)
})
