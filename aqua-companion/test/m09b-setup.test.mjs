// M09b — the server starts with no workspace; locate_workspace /
// init_workspace (elicitation, requires_human fallback, passphrase never
// through the model); the createAquaToolRegistry + SETUP_TOOLS hooks.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { PASS, VAULT, readManifest, scratch } from './helpers.mjs'
import { startServer } from './mcp-helpers.mjs'
import { SETUP_TOOLS, TIER, TOOLS } from '../src/mcp-tools.mjs'
import { createAquaToolRegistry, createSetupContext, UnknownToolError } from '../src/registry.mjs'

const ELICIT = { elicitation: {} }

test('the server starts without a workspace: setup tools work, workspace tools say workspace_not_initialized', async () => {
  const dir = scratch('m09b-noinit')
  const target = path.join(dir, 'nowhere-yet')
  const c = startServer(target, { cwd: dir })
  try {
    const init = await c.initialize()
    assert.equal(init.result.serverInfo.name, 'aqua-companion')
    assert.match(init.result.instructions, /workspace_not_initialized/)
    const names = (await c.request('tools/list')).result.tools.map((t) => t.name)
    for (const n of ['locate_workspace', 'init_workspace', 'doctor', 'import_history', 'sync_from_vault_export']) assert.ok(names.includes(n), n)
    const d = await c.call('discover_applications', {})
    assert.equal(d.status, 'workspace_not_initialized')
    assert.equal(d.__isError, true)
    assert.ok(d.next_steps.some((s) => s.includes(`aqua-companion init --path ${target}`)))
    assert.ok(d.next_steps.some((s) => /Never ask the user for the passphrase/.test(s)))
    const loc = await c.call('locate_workspace')
    assert.equal(loc.status, 'workspace_not_initialized')
    assert.equal(loc.suggested_init_command, `aqua-companion init --path ${target}`)
    assert.ok(loc.candidates.some((x) => x.path === target && !x.is_workspace))
    const doc = await c.call('doctor')
    assert.equal(doc.status, 'ok')
    assert.ok(doc.checks.find((x) => x.name === 'workspace').status === 'warn')
  } finally {
    assert.equal(await c.close(), 0)
  }
  assert.match(c.stderr, /no workspace open yet/)
  assert.equal(fs.existsSync(target), false, 'nothing was created')
})

test('init_workspace without client elicitation returns requires_human with the exact init command; nothing is created', async () => {
  const dir = scratch('m09b-noelicit')
  const c = startServer(path.join(dir, 'ws'), { cwd: dir })
  try {
    await c.initialize('2025-06-18', {})
    const r = await c.call('init_workspace', {})
    assert.equal(r.status, 'requires_human')
    assert.equal(r.tier, TIER.HUMAN_CONSENT)
    assert.equal(r.command, `aqua-companion init --path ${path.join(dir, 'ws')}`)
    assert.ok(r.how.some((h) => /Never ask the user for the passphrase/.test(h)))
    assert.equal(c.serverRequests.length, 0)
  } finally {
    await c.close()
  }
  assert.equal(fs.existsSync(path.join(dir, 'ws')), false)
})

test('init_workspace with elicitation: the user confirms folder + consent in the client UI, then the session opens the new workspace', async () => {
  const dir = scratch('m09b-elicit')
  const chosen = path.join(dir, 'chosen-folder')
  const c = startServer(path.join(dir, 'suggested'), { cwd: dir })
  c.onServerRequest = (msg) => {
    assert.equal(msg.method, 'elicitation/create')
    return { action: 'accept', content: { folder: chosen, consent: true } }
  }
  try {
    await c.initialize('2025-06-18', ELICIT)
    const r = await c.call('init_workspace', {})
    assert.equal(r.status, 'initialized', JSON.stringify(r))
    assert.equal(r.created, true)
    assert.equal(r.workspace_root, fs.realpathSync(path.join(chosen, 'AQUA')))
    assert.deepEqual(r.consent, { via: 'elicitation', confirmed_folder: chosen })
    // the elicitation asked only for folder + consent: never a secret
    const req = c.serverRequests[0]
    assert.deepEqual(Object.keys(req.params.requestedSchema.properties).sort(), ['consent', 'folder'])
    assert.equal(req.params.requestedSchema.properties.folder.default, path.join(dir, 'suggested'))
    assert.doesNotMatch(JSON.stringify(req.params), new RegExp(PASS))
    for (const k of Object.keys(req.params.requestedSchema.properties)) assert.doesNotMatch(k, /pass|secret|token|key/i)
    // the session now serves the new workspace
    const d = await c.call('discover_applications', {})
    assert.equal(d.status, 'ok')
    const loc = await c.call('locate_workspace')
    assert.equal(loc.status, 'ready')
    assert.equal(loc.workspace_id, r.workspace_id)
    const again = await c.call('init_workspace', {})
    assert.equal(again.status, 'already_initialized')
  } finally {
    await c.close()
  }
  const m = readManifest(path.join(chosen, 'AQUA'))
  assert.equal(m.workspace_id.startsWith('WS-'), true)
  assert.ok(!fs.readFileSync(path.join(chosen, 'AQUA', 'workspace.json'), 'utf8').includes(PASS), 'passphrase never stored')
})

test('init_workspace: decline, cancel or an unticked consent creates nothing; a missing server passphrase never prompts the model', async () => {
  const dir = scratch('m09b-decline')
  for (const answer of [{ action: 'decline' }, { action: 'cancel' }, { action: 'accept', content: { folder: path.join(dir, 'x'), consent: false } }]) {
    const c = startServer(path.join(dir, 'x'), { cwd: dir })
    c.onServerRequest = () => answer
    try {
      await c.initialize('2025-06-18', ELICIT)
      const r = await c.call('init_workspace', {})
      assert.equal(r.status, 'declined', JSON.stringify(answer))
      assert.equal(r.created, false)
    } finally {
      await c.close()
    }
    assert.equal(fs.existsSync(path.join(dir, 'x')), false)
  }
  const np = startServer(path.join(dir, 'y'), { cwd: dir, passphrase: null })
  np.onServerRequest = () => ({ action: 'accept', content: { folder: path.join(dir, 'y'), consent: true } })
  try {
    await np.initialize('2025-06-18', ELICIT)
    const r = await np.call('init_workspace', {})
    assert.equal(r.status, 'requires_human')
    assert.match(r.reason, /never travels through the agent/)
    assert.equal(np.serverRequests.length, 0, 'no elicitation without a server-side passphrase')
  } finally {
    await np.close()
  }
  assert.equal(fs.existsSync(path.join(dir, 'y')), false)
})

test('init_workspace refuses a non-empty folder and opens an existing workspace instead of overwriting it', async () => {
  const dir = scratch('m09b-exists')
  fs.mkdirSync(path.join(dir, 'busy', 'AQUA'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'busy', 'AQUA', 'note.txt'), 'synthetic')
  const c = startServer(path.join(dir, 'busy'), { cwd: dir })
  c.onServerRequest = () => ({ action: 'accept', content: { folder: path.join(dir, 'busy'), consent: true } })
  try {
    await c.initialize('2025-06-18', ELICIT)
    const r = await c.call('init_workspace', {})
    assert.equal(r.status, 'refused')
    assert.equal(r.reason, 'not_fresh')
  } finally {
    await c.close()
  }
  assert.deepEqual(fs.readdirSync(path.join(dir, 'busy', 'AQUA')), ['note.txt'])
})

test('createAquaToolRegistry: the stable hook for aqua-mcp-server 2.0; SETUP_TOOLS work with no workspace', async () => {
  const dir = scratch('m09b-registry')
  const sink = { write() { return true } }
  const reg = await createAquaToolRegistry({ workspace: path.join(dir, 'none'), env: { AQUA_PASSPHRASE: PASS, AQUA_VAULT_SECRET: VAULT, AQUA_CATALOG_OFFLINE: '1' }, cwd: dir, stderr: sink })
  assert.equal(reg.tools.length, TOOLS.length)
  for (const t of reg.tools) {
    assert.deepEqual(['name', 'tier', 'description', 'inputSchema', 'handler'].filter((k) => !(k in t)), [], t.name)
    assert.equal(typeof t.handler, 'function')
    assert.ok(t.description.startsWith(`[tier: ${t.tier}]`))
  }
  assert.equal(reg.state().mode, 'not_initialized')
  const r = await reg.dispatch('read_review_status', { application_id: 'LA-x' })
  assert.equal(r.result.status, 'workspace_not_initialized')
  const viaHandler = await reg.tools.find((t) => t.name === 'locate_workspace').handler({})
  assert.equal(viaHandler.result.status, 'workspace_not_initialized')
  await assert.rejects(() => reg.dispatch('publish_catalog_entry', {}), UnknownToolError)
  assert.deepEqual(SETUP_TOOLS.map((t) => t.name), ['locate_workspace', 'init_workspace', 'doctor'])
  for (const t of SETUP_TOOLS) assert.deepEqual(['name', 'tier', 'description', 'inputSchema', 'handler'].filter((k) => !(k in t)), [])
  // standalone: SETUP_TOOLS handlers with a setup context and no workspace
  const ctx = await createSetupContext({ workspace: path.join(dir, 'none'), env: { AQUA_PASSPHRASE: PASS, AQUA_CATALOG_OFFLINE: '1' }, cwd: dir, stderr: sink })
  const loc = await SETUP_TOOLS[0].handler(ctx, {})
  assert.equal(loc.status, 'workspace_not_initialized')
  const human = await SETUP_TOOLS[1].handler(ctx, {})
  assert.equal(human.status, 'requires_human', 'no elicitor -> the CLI command')
  // with an elicitor the same handler creates the workspace
  ctx.elicit = async () => ({ action: 'accept', content: { folder: path.join(dir, 'via-hook'), consent: true } })
  const made = await SETUP_TOOLS[1].handler(ctx, {})
  assert.equal(made.status, 'initialized')
  assert.equal(ctx.state().mode, 'ready')
  // read-only registry refuses human_consent before the handler runs
  const ro = await createAquaToolRegistry({ workspace: path.join(dir, 'none2'), readOnly: true, env: { AQUA_PASSPHRASE: PASS, AQUA_CATALOG_OFFLINE: '1' }, cwd: dir, stderr: sink })
  ro.setElicitor(async () => ({ action: 'accept', content: { folder: path.join(dir, 'none2'), consent: true } }))
  const refused = await ro.dispatch('init_workspace', {})
  assert.equal(refused.result.reason, 'read_only')
  assert.equal(fs.existsSync(path.join(dir, 'none2')), false)
})
