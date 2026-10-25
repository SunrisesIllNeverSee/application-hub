// Store-backed workspace session (m10 hosted-MCP path): Session.init({store})
// over createFsStore — an async adapter over a real workspace root — must run
// the same tool surface the fs path serves: init + unlock, a content_base64
// import (no inbox filesystem), read_review_status, and a record read-back
// through Workspace.openStore. Filesystem-only inputs (inbox file paths,
// inbox folders, vault-backup import, exports writes) refuse with a named
// store_unsupported:<method> error — never silently fall back to fs.
// All content is synthetic; all filesystem work is in scratch folders.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { PASS, VAULT, initWorkspace, readManifest, scratch } from './helpers.mjs'
import { FORM_MD } from './mcp-helpers.mjs'
import { Session } from '../src/registry.mjs'
import { Workspace } from '../src/workspace.mjs'
import { createFsStore } from '../src/store/workspace-store.mjs'

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')
const sink = () => { let t = ''; return { write: (s) => { t += s; return true }, get text() { return t } } }
const ENV = { AQUA_PASSPHRASE: PASS, AQUA_VAULT_SECRET: VAULT, AQUA_CATALOG_OFFLINE: '1' }

async function storeSession(root, dir, { env = ENV } = {}) {
  const store = createFsStore(root)
  const session = await new Session({ env, cwd: dir, stderr: sink() }).init({ store, workspaceRef: 'test-row' })
  return { store, session }
}

test('store-backed session: init, unlock, content_base64 import, read_review_status, read back', async () => {
  const dir = scratch('m10-store-session')
  const root = await initWorkspace(dir)
  const { store, session } = await storeSession(root, dir)

  // init + unlock happened inside init({store})
  assert.equal(session.state().mode, 'ready')
  assert.ok(session.keys, 'workspace keys derived')
  assert.ok(session.workspaceId)

  // content-argument import — the hosted path (no inbox filesystem read)
  const imp = await session.callTool('import_local_application', { file_name: 'form.md', content_base64: b64(FORM_MD) })
  assert.equal(imp.isError, false, JSON.stringify(imp))
  assert.equal(imp.result.status, 'ok', JSON.stringify(imp.result))
  const instanceId = imp.result.instance_id
  assert.ok(instanceId?.startsWith('LA-'))
  assert.equal(imp.result.counts.questions, 3)

  // the records + manifest actually landed through the store
  const loaded = await store.loadManifest()
  const instRid = `app_instance:${instanceId}`
  assert.ok(loaded.manifest.records[instRid], 'manifest in the store carries the new instance')
  const entry = loaded.manifest.records[instRid]
  const fileBytes = await store.getFile(entry.path)
  assert.ok(fileBytes, `record file ${entry.path} is a store row`)
  assert.ok(!fileBytes.toString('utf8').includes('What problem are you solving'), 'the record file is ciphertext, not plaintext')

  // read_review_status over the store — decode + model path
  const st = await session.callTool('read_review_status', { application_id: instanceId })
  assert.equal(st.isError, false)
  assert.equal(st.result.status, 'ok', JSON.stringify(st.result))
  assert.equal(st.result.instance_id, instanceId)
  assert.equal(st.result.questions.length, 3)
  assert.ok(st.result.questions.every((q) => q.question_occurrence_id))

  // read back: a fresh store workspace decrypts the same record
  const ws = await Workspace.openStore(store, { env: ENV, cwd: dir })
  ws.keys = session.keys
  const rec = await ws.readRecord(instRid)
  assert.equal(rec.data.instance_id, instanceId)
  assert.equal(rec.data.local_template.questions.length, 3)

  // the per-call agent audit went through the store (hash-chained lines)
  const agentTail = await store.readLogTail('audit/agent.jsonl')
  assert.ok(agentTail.lastLine, 'agent audit line appended via the store')
  const last = JSON.parse(agentTail.lastLine)
  assert.equal(last.op, 'tool_call')
  assert.equal(last.tool, 'read_review_status')
  assert.ok(last.prev, 'hash chain links the audit lines')

  // a second session over the same store opens cleanly (re-open per call parity)
  const again = await new Session({ env: ENV, cwd: dir, stderr: sink() }).init({ store: createFsStore(root) })
  assert.equal(again.state().mode, 'ready')
  const st2 = await again.callTool('read_review_status', { application_id: instanceId })
  assert.equal(st2.result.status, 'ok')
})

test('store-backed session: fs-bound inputs refuse with named store_unsupported errors', async () => {
  const dir = scratch('m10-store-refusals')
  const root = await initWorkspace(dir)
  fs.mkdirSync(path.join(root, 'inbox'), { recursive: true })
  fs.writeFileSync(path.join(root, 'inbox', 'form.md'), FORM_MD)
  const { session } = await storeSession(root, dir)

  // inbox file reads: refused even though the file exists on the fs root —
  // the store path must not silently fall back to the filesystem
  const byFile = await session.callTool('import_local_application', { file: 'form.md' })
  assert.equal(byFile.isError, true)
  assert.equal(byFile.result.status, 'refused')
  assert.equal(byFile.result.reason, 'store_unsupported:confinedFile')

  // inbox folder walk
  const hist = await session.callTool('import_history', { folder: 'history' })
  assert.equal(hist.isError, true)
  assert.equal(hist.result.reason, 'store_unsupported:inboxFolderFiles')

  // vault-backup import is a filesystem command path
  const sync = await session.callTool('sync_from_vault_export', { file: 'backup.json' })
  assert.equal(sync.isError, true)
  assert.ok(String(sync.result.reason ?? sync.result.error ?? '').startsWith('store_unsupported'), JSON.stringify(sync.result))
})

test('store-backed session: manifest CAS refuses a moved-on store copy', async () => {
  const dir = scratch('m10-store-cas')
  const root = await initWorkspace(dir)
  const { store, session } = await storeSession(root, dir)
  // a stale workspace object (loaded before another writer saved)
  const stale = await Workspace.openStore(store, { env: ENV, cwd: dir })
  stale.keys = session.keys
  // another writer moves the manifest on
  const imp = await session.callTool('import_local_application', { file_name: 'form.md', content_base64: b64(FORM_MD) })
  assert.equal(imp.result.status, 'ok')
  // the stale ws still holds the pre-import manifest MAC; a save through it must refuse
  stale.records['version:stale'] = { kind: 'version', path: 'answers/drafts/version-stale.json', status: 'live' }
  await assert.rejects(stale.saveManifest(), /changed by another writer/i)
  // and the stored manifest was not overwritten
  assert.ok(!readManifest(root).records['version:stale'])
})
