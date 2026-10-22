// M09 hardening pass: companion-side checks for L3 (post-open realpath),
// L4 (PBKDF2 iteration cap), M4 (env-secret warning) and (a) automatic
// account binding from the in-payload backup fingerprint. Synthetic data only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  decryptText, deriveWorkspaceKeys, encryptText, newSaltB64, vaultAccountFingerprint, DecryptError, KdfParamsError, MAX_PBKDF2_ITERATIONS, PBKDF2_ITERATIONS,
} from '../src/crypto.mjs'
import { openConfined, readInside, writeNewInside, appendInside, PathSafetyError } from '../src/fsafe.mjs'
import { agentEnvMarkers, envSecretWarning, warnEnvSecret } from '../src/io.mjs'
import { decideAccountBinding } from '../src/commands.mjs'
import { ACCOUNT, PASS, VAULT, buildVault, initWorkspace, loadApp, mutateEnvelope, readManifest, run, scratch, writeFile } from './helpers.mjs'

// ---------------------------------------------------------------- L4
test('L4: 210k stays the written iteration count; untrusted counts above 1,000,000 are refused, not run', async () => {
  assert.equal(PBKDF2_ITERATIONS, 210_000)
  assert.equal(MAX_PBKDF2_ITERATIONS, 1_000_000)
  const blob = await encryptText(VAULT, 'synthetic')
  assert.equal(blob.iters, 210_000)
  assert.equal(await decryptText(VAULT, blob), 'synthetic')
  for (const iters of [1_000_001, 2_000_000, 2 ** 31, -5, 0, 1.5, Number.NaN]) {
    const t0 = Date.now()
    await assert.rejects(() => decryptText(VAULT, { ...blob, iters }), DecryptError, `iters ${iters}`)
    assert.ok(Date.now() - t0 < 2000, 'refused before any expensive derivation')
  }
  await assert.rejects(() => deriveWorkspaceKeys(PASS, newSaltB64(), 5_000_000), KdfParamsError)
  // a hostile manifest kdf.iters cannot pin the CPU either
  const dir = scratch('m09-l4')
  const root = await initWorkspace(dir)
  const mPath = path.join(root, 'workspace.json')
  const m = JSON.parse(fs.readFileSync(mPath, 'utf8'))
  m.kdf.iters = 50_000_000
  fs.writeFileSync(mPath, JSON.stringify(m))
  const r = await run(['verify', '--workspace', root])
  assert.notEqual(r.code, 0)
  assert.match(r.err, /iteration count out of range|integrity|manifest/i)
})

// ---------------------------------------------------------------- L3
test('L3: confined opens refuse a file whose realpath leaves the root (symlink swapped in after the check)', () => {
  const dir = scratch('m09-l3')
  const root = fs.realpathSync(fs.mkdtempSync(path.join(dir, 'root-')))
  const outside = fs.realpathSync(fs.mkdtempSync(path.join(dir, 'outside-')))
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'outside content')
  fs.mkdirSync(path.join(root, 'sub'))
  fs.writeFileSync(path.join(root, 'sub', 'ok.txt'), 'inside')
  assert.equal(readInside(root, 'sub/ok.txt').toString(), 'inside')
  // Simulate the race: the directory component becomes a symlink AFTER resolveInside ran.
  fs.rmSync(path.join(root, 'sub'), { recursive: true })
  fs.symlinkSync(outside, path.join(root, 'sub'))
  const abs = path.join(root, 'sub', 'secret.txt')
  assert.throws(() => openConfined(root, abs, fs.constants.O_RDONLY), PathSafetyError)
  // the ordinary helpers refuse too (pre-open lstat walk + post-open check)
  assert.throws(() => readInside(root, 'sub/secret.txt'), PathSafetyError)
  assert.throws(() => writeNewInside(root, 'sub/new.txt', 'x'), PathSafetyError)
  assert.equal(fs.existsSync(path.join(outside, 'new.txt')), false, 'nothing created outside the root')
  // a final-component symlink is refused by O_NOFOLLOW / the realpath check
  fs.rmSync(path.join(root, 'sub'))
  fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'link.txt'))
  assert.throws(() => openConfined(root, path.join(root, 'link.txt'), fs.constants.O_RDONLY))
  assert.throws(() => appendInside(root, 'link.txt', 'x'), PathSafetyError)
  assert.equal(fs.readFileSync(path.join(outside, 'secret.txt'), 'utf8'), 'outside content')
})

test('L3: a file created by a confined write that fails the post-open check is removed', () => {
  const dir = scratch('m09-l3b')
  const root = fs.realpathSync(fs.mkdtempSync(path.join(dir, 'root-')))
  const outside = fs.realpathSync(fs.mkdtempSync(path.join(dir, 'outside-')))
  fs.symlinkSync(outside, path.join(root, 'evil'))
  const target = path.join(root, 'evil', 'created.txt')
  assert.throws(() => openConfined(root, target, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600, { created: true }), PathSafetyError)
  assert.equal(fs.existsSync(path.join(outside, 'created.txt')), false)
})

// ---------------------------------------------------------------- M4
test('M4: env passphrase under CI / an agent prints a stderr warning (never the secret); quiet otherwise', async () => {
  assert.deepEqual(agentEnvMarkers({}), [])
  assert.deepEqual(agentEnvMarkers({ CI: 'true', CLAUDECODE: '1', GITHUB_ACTIONS: 'false' }), ['CI', 'CLAUDECODE'])
  assert.equal(envSecretWarning({}, 'AQUA_PASSPHRASE'), null)
  const w = envSecretWarning({ CLAUDECODE: '1' }, 'AQUA_PASSPHRASE')
  assert.match(w, /AQUA_PASSPHRASE was read from the environment while running under CLAUDECODE/)
  assert.match(w, /--keychain/)
  let buf = ''
  const ctx = { env: { CI: '1', AQUA_PASSPHRASE: PASS }, cache: {}, stderr: { write: (s) => { buf += s } } }
  warnEnvSecret(ctx, 'AQUA_PASSPHRASE')
  warnEnvSecret(ctx, 'AQUA_PASSPHRASE')
  assert.equal(buf.split('\n').filter(Boolean).length, 1, 'once per process')
  assert.ok(!buf.includes(PASS), 'the secret is never printed')

  const dir = scratch('m09-m4')
  const root = await initWorkspace(dir)
  const agent = await run(['verify', '--workspace', root], { env: { CLAUDECODE: '1' } })
  assert.equal(agent.code, 0, agent.err)
  assert.match(agent.err, /warning: AQUA_PASSPHRASE was read from the environment/)
  assert.ok(!agent.err.includes(PASS) && !agent.out.includes(PASS))
  assert.ok(!agent.out.includes('warning'), 'stdout stays clean')
  const plain = await run(['verify', '--workspace', root])
  assert.doesNotMatch(plain.err, /warning: AQUA_PASSPHRASE/)
})

// ---------------------------------------------------------------- (a) account fingerprint
const UID = '00000000-0000-4000-8000-0000000000a7'
const OTHER_UID = '00000000-0000-4000-8000-0000000000b8'

async function exportFor(uid) {
  const v = await buildVault()
  return v.app.exportVault(v.storage, VAULT, { account_uid: uid })
}

test('(a) companion and app compute the same in-payload account fingerprint', async () => {
  const app = await loadApp()
  assert.equal(await vaultAccountFingerprint(VAULT, UID), await app.backupAccountFingerprint(VAULT, UID))
})

test('(a) import-backup binds automatically from the backup fingerprint; another account is refused unless --allow-account-mismatch', async () => {
  const dir = scratch('m09-acct')
  const root = await initWorkspace(dir)
  const mine = writeFile(dir, 'mine.json', await exportFor(UID))
  let r = await run(['import-backup', mine, '--workspace', root, '--yes'])
  assert.equal(r.code, 0, r.err)
  assert.match(r.out + r.err, /bind this workspace to the AQUA account this backup was exported from/)
  const m = readManifest(root)
  assert.equal(m.account_binding.bound, true)
  assert.ok(!JSON.stringify(m).includes(UID), 'uid not stored in plaintext')
  // same account again: no --account needed
  r = await run(['import-backup', mine, '--workspace', root, '--yes'])
  assert.equal(r.code, 0, r.err)
  // another account's backup is refused…
  const theirs = writeFile(dir, 'theirs.json', await exportFor(OTHER_UID))
  r = await run(['import-backup', theirs, '--workspace', root, '--yes'])
  assert.equal(r.code, 5)
  assert.match(r.err, /different AQUA account/)
  // …even when --account names the bound account (the authenticated fingerprint decides)
  r = await run(['import-backup', theirs, '--workspace', root, '--account', UID, '--yes'])
  assert.equal(r.code, 5)
  r = await run(['import-backup', theirs, '--workspace', root, '--allow-account-mismatch', '--yes'])
  assert.equal(r.code, 0, r.err)
  assert.equal(readManifest(root).imports.length, 3)
})

test('(a) a forged fingerprint cannot be planted: it lives inside the authenticated payload', async () => {
  const dir = scratch('m09-acct-forge')
  const root = await initWorkspace(dir)
  assert.equal((await run(['import-backup', writeFile(dir, 'mine.json', await exportFor(UID)), '--workspace', root, '--yes'])).code, 0)
  // an outer (unauthenticated) field is ignored; the inner one is what counts
  const theirs = JSON.parse(await exportFor(OTHER_UID))
  theirs.account_fp = await vaultAccountFingerprint(VAULT, UID)
  const r = await run(['import-backup', writeFile(dir, 'outer.json', JSON.stringify(theirs)), '--workspace', root, '--yes'])
  assert.equal(r.code, 5)
})

test('(a) older backups (no fingerprint) keep the --account flow; legacy bindings learn the fingerprint', async () => {
  const v = await buildVault()
  const dir = scratch('m09-acct-legacy')
  const root = await initWorkspace(dir)
  const legacy = writeFile(dir, 'legacy.json', v.envelope)
  let r = await run(['import-backup', legacy, '--workspace', root, '--yes'])
  assert.equal(r.code, 5)
  assert.match(r.err, /First import/)
  r = await run(['import-backup', legacy, '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.equal(r.code, 0, r.err)
  // a fingerprinted backup into the legacy (email-bound) workspace still needs the matching --account once…
  const fresh = writeFile(dir, 'fresh.json', await v.app.exportVault(v.storage, VAULT, { account_uid: UID }))
  r = await run(['import-backup', fresh, '--workspace', root, '--yes'])
  assert.equal(r.code, 5)
  r = await run(['import-backup', fresh, '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.equal(r.code, 0, r.err)
  // …and from then on binds by fingerprint: no flag needed, other accounts refused
  r = await run(['import-backup', fresh, '--workspace', root, '--yes'])
  assert.equal(r.code, 0, r.err)
  const theirs = writeFile(dir, 'theirs.json', await v.app.exportVault(v.storage, VAULT, { account_uid: OTHER_UID }))
  r = await run(['import-backup', theirs, '--workspace', root, '--account', ACCOUNT, '--yes'])
  assert.equal(r.code, 5)
})

test('(a) decideAccountBinding: pure decision table', () => {
  const fpA = 'a'.repeat(64)
  const fpB = 'b'.repeat(64)
  const uidFlag = (vaultFp) => ({ fp: 'f'.repeat(64), vaultFp, isUid: true })
  assert.deepEqual(decideAccountBinding({ binding: null, payloadFp: fpA, flag: null, allowMismatch: false }).bind, { account_fp: null, vault_account_fp: fpA })
  assert.equal(decideAccountBinding({ binding: null, payloadFp: fpA, flag: uidFlag(fpB), allowMismatch: false }).ok, false, '--account uid contradicts the backup')
  assert.equal(decideAccountBinding({ binding: null, payloadFp: null, flag: null, allowMismatch: false }).ok, false)
  const auto = { account_fp: null, vault_account_fp: fpA }
  assert.equal(decideAccountBinding({ binding: auto, payloadFp: fpA, flag: null, allowMismatch: false }).check, 'match')
  assert.equal(decideAccountBinding({ binding: auto, payloadFp: fpB, flag: null, allowMismatch: false }).ok, false)
  assert.equal(decideAccountBinding({ binding: auto, payloadFp: fpB, flag: null, allowMismatch: true }).check, 'mismatch_allowed')
  assert.equal(decideAccountBinding({ binding: auto, payloadFp: null, flag: null, allowMismatch: false }).ok, false, 'old backup into auto-bound workspace')
  assert.equal(decideAccountBinding({ binding: auto, payloadFp: null, flag: uidFlag(fpA), allowMismatch: false }).check, 'match')
})

test('(a) mutateEnvelope helper still round-trips fingerprinted payloads', async () => {
  const text = await exportFor(UID)
  const changed = await mutateEnvelope(text, (p) => { p.exported_at = '2026-10-22T00:00:00.000Z' })
  const app = await loadApp()
  assert.equal(await app.backupAccountStatus(VAULT, changed, UID), 'match')
})
