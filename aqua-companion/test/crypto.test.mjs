// Encryption at rest: same primitives as app crypto.ts, proven both ways.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  canonicalJson, decryptText, decryptWithKeys, deriveWorkspaceKeys, encryptText, encryptWithKeys, macHex, newSaltB64, sha256Hex,
  PBKDF2_ITERATIONS, DecryptError,
} from '../src/crypto.mjs'
import { PASS, initWorkspace, loadApp, readManifest, run, scratch } from './helpers.mjs'

test('encrypt/decrypt round trip; wrong passphrase and tampering are refused', async () => {
  const keys = await deriveWorkspaceKeys('synthetic-pass', newSaltB64())
  const blob = await encryptWithKeys(keys, 'synthetic text')
  assert.equal(blob.iters, PBKDF2_ITERATIONS)
  assert.equal(await decryptWithKeys(keys, blob), 'synthetic text')
  const wrong = await deriveWorkspaceKeys('other-pass', blob.salt_b64)
  await assert.rejects(() => decryptWithKeys(wrong, blob), DecryptError)
  const ct = Buffer.from(blob.ct_b64, 'base64')
  ct[0] ^= 1
  await assert.rejects(() => decryptWithKeys(keys, { ...blob, ct_b64: ct.toString('base64') }), DecryptError)
})

test('companion blobs decrypt with the app crypto.ts, and app blobs decrypt with the companion', async () => {
  const app = await loadApp()
  const ours = await encryptText('synthetic-secret', 'from companion')
  assert.equal(await app.decryptText('synthetic-secret', ours), 'from companion')
  const theirs = await app.encryptText('synthetic-secret', 'from app')
  assert.equal(await decryptText('synthetic-secret', theirs), 'from app')
  // field helpers (the *_enc format)
  assert.equal(await app.decryptField('s3cret-value', JSON.stringify(await encryptText('s3cret-value', 'field'))), 'field')
  // the workspace key is the same AES key crypto.ts derives for that salt
  const salt = newSaltB64()
  const keys = await deriveWorkspaceKeys('synthetic-secret', salt)
  const viaWorkspaceKey = await encryptWithKeys(keys, 'workspace record')
  assert.equal(await app.decryptText('synthetic-secret', viaWorkspaceKey), 'workspace record')
  // canonical JSON identical to the app's
  const sample = { b: [3, { z: 1, a: null }], a: 'x', u: undefined }
  assert.equal(canonicalJson(sample), app.canonicalJson(sample))
})

test('record files: same blob layout, bound to their id by AES-GCM additional data; key check opens with the app', async () => {
  const app = await loadApp()
  const dir = scratch('crypto')
  const root = await initWorkspace(dir)
  for (const t of ['Synthetic title A', 'Synthetic title B']) {
    const r = await run(['add-evidence', '--title', t, '--workspace', root, '--yes'])
    assert.equal(r.code, 0, r.err)
  }
  const m = readManifest(root)
  const [[ka, a], [kb, b]] = Object.entries(m.records).filter(([, x]) => x.kind === 'evidence')
  const fa = JSON.parse(fs.readFileSync(path.join(root, a.path), 'utf8'))
  const fb = JSON.parse(fs.readFileSync(path.join(root, b.path), 'utf8'))
  assert.equal(fa.enc.alg, 'AES-GCM-256')
  assert.equal(fa.enc.aad, 1)
  const keys = await deriveWorkspaceKeys(PASS, m.kdf.salt_b64, m.kdf.iters)
  const { recordAad } = await import('../src/workspace.mjs')
  assert.equal(JSON.parse(await decryptWithKeys(keys, fa.enc, recordAad(fa))).title.startsWith('Synthetic title'), true)
  // moving B's ciphertext into A's file (and fixing the unkeyed self-checksum) is detected
  const { sha256: _s, ...head } = fa
  head.enc = fb.enc
  head.sha256 = await sha256Hex(canonicalJson(head))
  fs.writeFileSync(path.join(root, a.path), JSON.stringify(head))
  const shown = await run(['show', ka, '--reveal', '--workspace', root])
  assert.equal(shown.code, 4)
  const v = await run(['verify', '--workspace', root])
  assert.match(v.out, new RegExp(`${ka}: (cannot be read|checksum mismatch)`))
  void kb
  // manifest key-check is a plain crypto.ts blob
  assert.equal(await app.decryptText(PASS, m.key_check), `aqua-companion-key-check:v1:${m.workspace_id}`)
})

test('content MACs are keyed (equal data -> equal MAC under one key, different under another)', async () => {
  const k1 = await deriveWorkspaceKeys('p1-synthetic', newSaltB64())
  const k2 = await deriveWorkspaceKeys('p2-synthetic', newSaltB64())
  const a = await macHex(k1, 'x')
  assert.equal(a, await macHex(k1, 'x'))
  assert.notEqual(a, await macHex(k2, 'x'))
})
