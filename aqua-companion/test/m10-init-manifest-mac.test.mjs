// The hosted init route builds a manifest via newManifest() — which does NOT
// stamp manifest_mac. Without the stamp, Workspace.unlock() refuses the
// manifest forever ("changed outside the companion"). The route now computes
// manifest_mac itself; this test pins that an init-shaped manifest unlocks.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { newManifest, Workspace } from '../src/workspace.mjs'
import { macHex, canonicalJson } from '../src/crypto.mjs'
import { scratch, PASS } from './helpers.mjs'

const ctx = { env: {}, cwd: '/', flags: {}, stderr: { write: () => true } }

async function stampLikeRoute(manifest, keys) {
  const { manifest_mac: _omit, ...rest } = manifest
  manifest.manifest_mac = await macHex(keys, canonicalJson(rest))
  return manifest
}

test('an init-shaped manifest unlocks only when manifest_mac is stamped', async () => {
  const dir = await scratch('m10-mac')
  // stamped — the route's fix, including the hosted_consent field that the
  // init route stamps into the manifest BEFORE the MAC is computed
  {
    const { manifest, keys } = await newManifest(PASS)
    manifest.hosted_consent = { at: '2026-10-30T00:00:00.000Z', account_id: 'test' }
    await stampLikeRoute(manifest, keys)
    const root = `${dir}/ok`
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(`${root}/workspace.json`, JSON.stringify(manifest, null, 2))
    const w = await Workspace.open({ ...ctx, env: { AQUA_PASSPHRASE: PASS }, flags: { workspace: root } })
    await w.unlock(PASS) // must not throw
    assert.equal(w.records && typeof w.records, 'object')
  }
  // unstamped — the defect the fix closes
  {
    const { manifest } = await newManifest(PASS)
    const root = `${dir}/bad`
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(`${root}/workspace.json`, JSON.stringify(manifest, null, 2))
    const w = await Workspace.open({ ...ctx, env: { AQUA_PASSPHRASE: PASS }, flags: { workspace: root } })
    await assert.rejects(w.unlock(PASS), /integrity|changed outside|mac/i)
  }
})

test('a manifest stamped before hosted_consent was added fails unlock (the shipped regression)', async () => {
  const dir = await scratch('m10-mac-order')
  const { manifest, keys } = await newManifest(PASS)
  await stampLikeRoute(manifest, keys)
  manifest.hosted_consent = { at: '2026-10-30T00:00:00.000Z', account_id: 'test' } // merged AFTER the mac — the bug
  const root = `${dir}/bad`
  await fs.mkdir(root, { recursive: true })
  await fs.writeFile(`${root}/workspace.json`, JSON.stringify(manifest, null, 2))
  const w = await Workspace.open({ ...ctx, env: { AQUA_PASSPHRASE: PASS }, flags: { workspace: root } })
  await assert.rejects(w.unlock(PASS), /integrity|changed outside|mac/i)
})
