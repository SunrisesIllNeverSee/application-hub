// Workspace mode delegates to the aqua-companion's own Session: the full
// tiered tool set, private writes refused under --read-only, human_only
// tools never mutate the workspace, aqua://workspace/status, and a wrong
// passphrase stops startup. Real (synthetic) workspaces in scratch folders.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { main as companionMain } from '../src/vendor/companion/src/cli.mjs'
import { TOOLS as COMPANION_TOOLS } from '../src/vendor/companion/src/mcp-tools.mjs'
import { INIT, PASS, interactive, req, runServer, sc, scratch } from './helpers.mjs'
import { PUBLIC_TOOLS } from '../src/catalog/tools.mjs'

const sink = () => ({ buf: '', write(s) { this.buf += s; return true } })

async function makeWorkspace(label) {
  const dir = scratch(label)
  const code = await companionMain(['init', '--path', dir, '--yes'], { env: { AQUA_PASSPHRASE: PASS }, cwd: dir, stdin: { isTTY: false }, stdout: sink(), stderr: sink() })
  assert.equal(code, 0)
  const root = path.join(dir, 'AQUA')
  fs.mkdirSync(path.join(root, 'inbox'), { recursive: true })
  fs.writeFileSync(path.join(root, 'inbox', 'form.md'), '# Synthetic Program Application\n\nDeadline: 2030-01-15\n\n1. What problem are you solving? (200 words)\n\n2. Tell us about your team. (max 1000 characters)\n')
  return root
}

/** Every file's bytes except the audit log folder (tool calls are audited by design). */
function snapshot(root) {
  const out = {}
  const visit = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      const rel = path.relative(root, p)
      if (rel === 'audit' || rel.startsWith(`audit${path.sep}`)) continue
      if (e.isDirectory()) visit(p)
      else out[rel] = fs.readFileSync(p).toString('base64')
    }
  }
  visit(root)
  return out
}

const env = { AQUA_PASSPHRASE: PASS }

test('workspace mode serves the companion tool set plus the public catalog tools', async () => {
  const root = await makeWorkspace('ws-list')
  const r = await runServer(['--workspace', root], [INIT(1, '2025-11-25'), req(2, 'tools/list')], { env })
  assert.equal(r.code, 0, r.err)
  const tools = r.responses.get(2).result.tools
  const names = tools.map((t) => t.name)
  assert.equal(names.length, COMPANION_TOOLS.length + PUBLIC_TOOLS.length)
  for (const t of [...COMPANION_TOOLS, ...PUBLIC_TOOLS]) assert.ok(names.includes(t.name), t.name)
  const tierOf = Object.fromEntries(tools.map((t) => [t.name, t._meta['aqua/tier']]))
  for (const t of COMPANION_TOOLS) assert.equal(tierOf[t.name], t.tier, `${t.name} tier comes from the companion`)
  assert.match(r.err, /stdio-workspace; 37 tools/)
})

test('private writes are allowed normally and refused under --read-only, before the handler runs', async () => {
  const root = await makeWorkspace('ws-ro')
  const before = snapshot(root)
  const ro = await runServer(['--workspace', root, '--read-only'], [INIT(1), req(2, 'tools/call', { name: 'import_local_application', arguments: { file: 'form.md' } }), req(3, 'tools/call', { name: 'create_draft_version', arguments: { parent_version_id: 'x', body: 'y' } })], { env })
  for (const id of [2, 3]) {
    const res = sc(ro.responses.get(id))
    assert.deepEqual([res.status, res.reason], ['refused', 'read_only'])
    assert.equal(ro.responses.get(id).result.isError, true)
  }
  assert.deepEqual(snapshot(root), before, '--read-only changed nothing')
  const rw = await runServer(['--workspace', root], [INIT(1), req(2, 'tools/call', { name: 'import_local_application', arguments: { file: 'form.md' } }), req(3, 'resources/read', { uri: 'aqua://workspace/status' })], { env })
  const imp = sc(rw.responses.get(2))
  assert.equal(imp.status, 'ok', JSON.stringify(imp).slice(0, 400))
  assert.notDeepEqual(snapshot(root), before)
  const status = JSON.parse(rw.responses.get(3).result.contents[0].text)
  assert.equal(status.status, 'ok')
  assert.equal(status.application_count, 1)
  assert.equal(status.applications[0].tool, 'read_review_status')
})

test('human_only tools never mutate the workspace and only return steps', async () => {
  const root = await makeWorkspace('ws-human')
  await runServer(['--workspace', root], [INIT(1), req(2, 'tools/call', { name: 'import_local_application', arguments: { file: 'form.md' } })], { env })
  const before = snapshot(root)
  const human = COMPANION_TOOLS.filter((t) => t.tier === 'human_only')
  assert.deepEqual(human.map((t) => t.name).sort(), ['approve_answer', 'attest_submission', 'export_packet', 'sign_packet', 'submit_catalog_candidate'])
  const args = { approve_answer: { version_id: 'v1' }, sign_packet: { packet_id: 'p1' }, export_packet: { application_id: 'a1' }, attest_submission: { packet_id: 'p1' }, submit_catalog_candidate: { source_url: 'https://example.invalid/apply' } }
  const r = await runServer(['--workspace', root], [INIT(1), ...human.map((t, i) => req(10 + i, 'tools/call', { name: t.name, arguments: args[t.name] }))], { env })
  human.forEach((t, i) => {
    const res = sc(r.responses.get(10 + i))
    assert.equal(res.status, 'requires_human', t.name)
    assert.equal(res.tier, 'human_only')
    assert.ok(Array.isArray(res.how) && res.how.length > 0, t.name)
  })
  assert.deepEqual(snapshot(root), before, 'human_only tools changed workspace files')
  const log = fs.readFileSync(path.join(root, 'audit', 'agent.jsonl'), 'utf8')
  assert.ok(log.includes('approve_answer'), 'calls are audited by the companion')
})

test('workspace prompts and resources', async () => {
  const root = await makeWorkspace('ws-prompts')
  const r = await runServer(['--workspace', root], [INIT(1), req(2, 'resources/list'), req(3, 'prompts/get', { name: 'reuse-my-answers', arguments: {} }), req(4, 'prompts/get', { name: 'start-application', arguments: { program: 'https://example.invalid/apply' } })], { env })
  assert.deepEqual(r.responses.get(2).result.resources.map((x) => x.uri), ['aqua://workspace/status', 'aqua://programs'])
  assert.match(r.responses.get(3).result.messages[0].content.text, /create_draft_version/)
  assert.match(r.responses.get(4).result.messages[0].content.text, /import_local_application/)
})

test('a wrong passphrase stops startup; a missing workspace starts in setup mode', async () => {
  const root = await makeWorkspace('ws-bad')
  const bad = await runServer(['--workspace', root], [INIT(1)], { env: { AQUA_PASSPHRASE: 'wrong-passphrase-123' } })
  assert.notEqual(bad.code, 0)
  assert.equal(bad.out.length, 0)
  assert.ok(!bad.err.includes('wrong-passphrase-123'))
  const missing = await runServer(['--workspace', path.join(root, 'nope')], [INIT(1), req(2, 'tools/list')], { env })
  assert.equal(missing.code, 0)
  assert.match(missing.err, /stdio-catalog/)
  assert.equal(missing.responses.get(2).result.tools.length, 14)
})

test('the companion CLI is reachable through the package bin', async () => {
  const out = sink()
  const { main } = await import('../src/node/cli.mjs')
  const code = await main(['companion', '--version'], { env: {}, stdout: out, stderr: sink(), stdin: { isTTY: false } })
  assert.equal(code, 0)
  assert.match(out.buf, /^\d+\.\d+\.\d+/)
})

// init_workspace (human_consent): the companion asks the user through MCP
// elicitation; this server only wires the client's elicitation capability.
const ELICIT_INIT = { protocolVersion: '2025-11-25', capabilities: { elicitation: { form: {} } }, clientInfo: { name: 'test', version: '0' } }

test('init_workspace without client elicitation returns requires_human and creates nothing', async () => {
  const base = scratch('init-noelicit')
  const c = interactive([], { env, cwd: base })
  await c.request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 't', version: '0' } })
  const r = sc(await c.request('tools/call', { name: 'init_workspace', arguments: { folder: base } }))
  assert.equal(r.status, 'requires_human')
  assert.equal(r.tier, 'human_consent')
  assert.equal(c.serverRequests.length, 0)
  assert.equal(fs.existsSync(path.join(base, 'AQUA')), false)
  assert.equal(await c.close(), 0)
})

test('init_workspace under --read-only is refused before asking the user', async () => {
  const base = scratch('init-ro')
  const c = interactive(['--read-only'], { env, cwd: base, onRequest: () => assert.fail('must not elicit') })
  await c.request('initialize', ELICIT_INIT)
  const r = sc(await c.request('tools/call', { name: 'init_workspace', arguments: { folder: base } }))
  assert.deepEqual([r.status, r.reason], ['refused', 'read_only'])
  assert.equal(fs.existsSync(path.join(base, 'AQUA')), false)
  await c.close()
})

test('init_workspace: decline creates nothing; accept creates the workspace and switches modes with list_changed', async () => {
  const base = scratch('init-elicit')
  let answer = { action: 'decline' }
  const c = interactive([], { env, cwd: base, onRequest: async (m) => (m.method === 'elicitation/create' ? answer : {}) })
  const init = await c.request('initialize', ELICIT_INIT)
  assert.equal(init.result.capabilities.tools.listChanged, true)
  assert.equal((await c.request('tools/list')).result.tools.length, 14)
  const declined = sc(await c.request('tools/call', { name: 'init_workspace', arguments: { folder: base } }))
  assert.equal(declined.status, 'declined')
  assert.equal(c.serverRequests[0].method, 'elicitation/create')
  assert.equal(c.serverRequests[0].params.mode, 'form')
  assert.equal(fs.existsSync(path.join(base, 'AQUA')), false)
  assert.equal(c.notifications.length, 0)
  answer = { action: 'accept', content: { folder: base, consent: true } }
  const created = sc(await c.request('tools/call', { name: 'init_workspace', arguments: { folder: base } }))
  assert.equal(created.status, 'initialized', JSON.stringify(created).slice(0, 300))
  assert.ok(fs.existsSync(path.join(base, 'AQUA', 'workspace.json')))
  assert.deepEqual(c.notifications.map((n) => n.method), ['notifications/tools/list_changed', 'notifications/resources/list_changed'])
  const after = (await c.request('tools/list')).result.tools.map((t) => t.name)
  assert.equal(after.length, 37)
  assert.ok(after.includes('create_draft_version'))
  const res = (await c.request('resources/list')).result.resources.map((x) => x.uri)
  assert.ok(res.includes('aqua://workspace/status'))
  assert.equal(await c.close(), 0)
})
