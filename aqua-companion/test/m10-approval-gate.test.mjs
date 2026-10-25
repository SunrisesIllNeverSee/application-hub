// The hosted approve endpoint writes approval records whose version_sha256
// must bind the CONTENT hash (sha256(canonicalJson({title,body})) — the value
// inside the version record's decrypted data.sha256), NOT the file-bytes sha.
// This test proves a record written in exactly the endpoint's shape satisfies
// approvalGate — the semantic that makes a hosted approval count.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initWorkspace, PASS } from './helpers.mjs'
import { Workspace } from '../src/workspace.mjs'
import { sha256Hex, canonicalJson } from '../src/crypto.mjs'
import { approvalGate } from '../vendor/lib/aqua-local/status.mjs'

const ctx = (root) => ({ env: { AQUA_PASSPHRASE: PASS }, cwd: root, flags: { workspace: root }, stderr: { write: () => true }, cache: {} })

test('an approval record carrying the content hash satisfies approvalGate', async () => {
  const dir = await initWorkspace(await import('./helpers.mjs').then((h) => h.scratch('m10-gate')))
  const w = await Workspace.open(ctx(dir))
  await w.unlock(PASS)

  // a version record: data.sha256 IS the content hash (the value the human reviewed)
  const title = 'Q', body = 'the approved answer'
  const contentSha = await sha256Hex(canonicalJson({ title, body }))
  const vEntry = await w.writeRecord({ kind: 'version', key: 'v1', authority: 'staging', data: { title, body, sha256: contentSha } })
  w.manifest.records[`version:v1`] = vEntry

  // the approval record the endpoint writes: version_sha256 = content hash,
  // id/at/seq present (ApprovalRecord shape), decision/actor_class set
  const aEntry = await w.writeRecord({
    kind: 'approval', key: 'v1', authority: 'projection',
    data: { id: 'ap-1', version_id: 'version:v1', version_sha256: contentSha, decision: 'approved', actor_class: 'human', at: '2026-10-30T00:00:00.000Z', seq: 1, actor_id: 'u', via: 'hosted_review' },
  })
  w.manifest.records[`approval:v1`] = aEntry
  await w.saveManifest()

  // decode + gate, exactly the way loadModel feeds approvalGate
  const version = { id: 'version:v1', sha256: contentSha, ...(await w.decodeEntry('version:v1')).data }
  const approvals = [{ ...(await w.decodeEntry('approval:v1')).data }]
  const gate = approvalGate(version, approvals, [])
  assert.equal(gate.approved, true, 'a hosted approval bound to the content hash counts')
})
