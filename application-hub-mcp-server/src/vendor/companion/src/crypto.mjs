// VENDORED from aqua-companion/src/crypto.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// Companion cryptography. Same primitives as app/lib/aqua-local/crypto.ts:
// AES-GCM-256 with keys from PBKDF2-SHA256 (210k iterations), random 12-byte
// IV, 16-byte salt, and the same serialized `EncryptedBlob` shape. A blob
// written here decrypts with the app's `decryptText(passphrase, blob)` and
// vice versa (proven in test/crypto.test.mjs).
//
// Workspace records use ONE workspace salt so the key is derived once per
// run. PBKDF2 is asked for 512 bits: the first 256 bits are exactly the
// AES-GCM key that `crypto.ts` deriveKey() would produce for that salt (the
// first PBKDF2-SHA256 output block), the second 256 bits are an HMAC-SHA256
// key used for content MACs (equality checks without plaintext hashes).
// Keys are non-extractable and never persisted; the passphrase is never
// written anywhere.

import { webcrypto } from 'node:crypto'

const subtle = webcrypto.subtle
const te = new TextEncoder()
const td = new TextDecoder()

export const PBKDF2_ITERATIONS = 210_000
export const SALT_BYTES = 16
export const IV_BYTES = 12
// M09 hardening L4: iteration counts arrive inside UNTRUSTED blobs and
// manifests. 210k stays the only value we write (vault-envelope
// compatibility); anything outside [1, 1,000,000] is refused outright instead
// of being run (or silently clamped), so a hostile file cannot pin the CPU.
export const MAX_PBKDF2_ITERATIONS = 1_000_000
const MAX_ITERS = MAX_PBKDF2_ITERATIONS

export class DecryptError extends Error {
  constructor(message = 'decryption failed: wrong passphrase or tampered data') {
    super(message)
    this.name = 'DecryptError'
  }
}

export function randomBytes(n) {
  const out = new Uint8Array(n)
  webcrypto.getRandomValues(out)
  return out
}

export function b64encode(bytes) {
  return Buffer.from(bytes).toString('base64')
}

export function b64decode(b64) {
  if (typeof b64 !== 'string') throw new DecryptError('malformed base64 field')
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

export function newUuid() {
  return webcrypto.randomUUID()
}

export function nowIso() {
  return new Date().toISOString()
}

/** Deterministic JSON: keys sorted recursively, undefined dropped (matches crypto.ts). */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const keys = Object.keys(value).sort()
  const parts = keys
    .filter((k) => value[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
  return `{${parts.join(',')}}`
}

export async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? te.encode(data) : data
  const digest = await subtle.digest('SHA-256', bytes)
  return Buffer.from(digest).toString('hex')
}

export class KdfParamsError extends Error {
  constructor(message) {
    super(message)
    this.name = 'KdfParamsError'
  }
}

/** Validate an (untrusted) PBKDF2 iteration count; returns it unchanged. */
function clampIters(iters) {
  if (typeof iters !== 'number' || !Number.isInteger(iters) || iters < 1 || iters > MAX_ITERS) {
    throw new KdfParamsError(`PBKDF2 iteration count out of range (1..${MAX_ITERS}): refusing to derive`)
  }
  return iters
}

async function pbkdf2Bits(secret, salt, iters, bits) {
  const base = await subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(
    await subtle.deriveBits({ name: 'PBKDF2', salt, iterations: clampIters(iters), hash: 'SHA-256' }, base, bits),
  )
}

/**
 * Derive the workspace key set from the passphrase and the workspace salt.
 * Returns { aesKey, macKey, salt_b64, iters }.
 */
export async function deriveWorkspaceKeys(passphrase, salt_b64, iters = PBKDF2_ITERATIONS) {
  if (typeof passphrase !== 'string' || passphrase.length === 0) throw new Error('passphrase is required')
  const salt = b64decode(salt_b64)
  const bits = await pbkdf2Bits(passphrase, salt, iters, 512)
  try {
    const aesKey = await subtle.importKey('raw', bits.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
    const macKey = await subtle.importKey('raw', bits.slice(32, 64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return { aesKey, macKey, salt_b64, iters: clampIters(iters) }
  } finally {
    bits.fill(0)
  }
}

export function newSaltB64() {
  return b64encode(randomBytes(SALT_BYTES))
}

/**
 * Encrypt under a derived workspace key set. Output is a crypto.ts
 * EncryptedBlob. With `aad`, the string is bound as AES-GCM additional data
 * (record files bind their id/kind/workspace so a ciphertext cannot be moved
 * to another record); such blobs carry `aad: 1` and need the same aad to open.
 */
export async function encryptWithKeys(keys, plaintext, aad = null) {
  const iv = randomBytes(IV_BYTES)
  const params = { name: 'AES-GCM', iv }
  if (aad !== null) params.additionalData = te.encode(aad)
  const ct = await subtle.encrypt(params, keys.aesKey, te.encode(plaintext))
  const blob = {
    v: 1,
    alg: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iters: keys.iters,
    salt_b64: keys.salt_b64,
    iv_b64: b64encode(iv),
    ct_b64: b64encode(new Uint8Array(ct)),
  }
  if (aad !== null) blob.aad = 1
  return blob
}

export function assertBlobShape(blob) {
  if (!blob || typeof blob !== 'object' || blob.v !== 1 || blob.alg !== 'AES-GCM-256' || blob.kdf !== 'PBKDF2-SHA256') {
    throw new DecryptError('unsupported encrypted blob format')
  }
  for (const f of ['salt_b64', 'iv_b64', 'ct_b64']) {
    if (typeof blob[f] !== 'string') throw new DecryptError(`encrypted blob missing ${f}`)
  }
  if (typeof blob.iters !== 'number') throw new DecryptError('encrypted blob missing iters')
  if (!Number.isInteger(blob.iters) || blob.iters < 1 || blob.iters > MAX_ITERS) {
    throw new DecryptError(`encrypted blob iteration count out of range (1..${MAX_ITERS})`)
  }
}

export class KeyMismatchError extends DecryptError {
  constructor() {
    super('blob was encrypted under a different workspace key')
    this.name = 'KeyMismatchError'
  }
}

/** Decrypt a blob with an already-derived workspace key set (salt must match). */
export async function decryptWithKeys(keys, blob, aad = null) {
  assertBlobShape(blob)
  if (blob.salt_b64 !== keys.salt_b64 || clampIters(blob.iters) !== keys.iters) throw new KeyMismatchError()
  if ((blob.aad === 1) !== (aad !== null)) throw new DecryptError('blob additional-data binding does not match')
  try {
    const params = { name: 'AES-GCM', iv: b64decode(blob.iv_b64) }
    if (aad !== null) params.additionalData = te.encode(aad)
    const pt = await subtle.decrypt(params, keys.aesKey, b64decode(blob.ct_b64))
    return td.decode(pt)
  } catch {
    throw new DecryptError()
  }
}

/** HMAC-SHA256 (hex) under the workspace MAC key. */
export async function macHex(keys, text) {
  const sig = await subtle.sign('HMAC', keys.macKey, te.encode(text))
  return Buffer.from(sig).toString('hex')
}

/** crypto.ts encryptText: fresh salt + iv per call (used for vault-secret envelopes and *_enc fields). */
export async function encryptText(secret, plaintext) {
  const salt = randomBytes(SALT_BYTES)
  const keys = await deriveWorkspaceKeys(secret, b64encode(salt), PBKDF2_ITERATIONS)
  return encryptWithKeys(keys, plaintext)
}

/** crypto.ts decryptText: derive from the blob's own salt/iters. */
export async function decryptText(secret, blob) {
  assertBlobShape(blob)
  let keys
  try {
    keys = await deriveWorkspaceKeys(secret, blob.salt_b64, blob.iters)
  } catch {
    throw new DecryptError()
  }
  return decryptWithKeys(keys, blob)
}

/** crypto.ts encryptField / decryptField: a `*_enc` field is a serialized blob. */
export async function encryptField(secret, plaintext) {
  return JSON.stringify(await encryptText(secret, plaintext))
}

/**
 * Field encrypter for one export run: derives ONE key (fresh salt) and uses a
 * fresh IV per field. Output fields are ordinary crypto.ts blobs, so the app's
 * decryptField opens each one; it just avoids a PBKDF2 run per field.
 */
export async function fieldEncrypter(secret) {
  const keys = await deriveWorkspaceKeys(secret, b64encode(randomBytes(SALT_BYTES)), PBKDF2_ITERATIONS)
  return async (plaintext) => JSON.stringify(await encryptWithKeys(keys, plaintext))
}

export async function decryptField(secret, enc) {
  let blob
  try {
    blob = JSON.parse(enc)
  } catch {
    throw new DecryptError('encrypted field is not a serialized blob')
  }
  return decryptText(secret, blob)
}

/** Stable identity fingerprint for an AQUA account id (uid or email). */
/**
 * M09 hardening: the account fingerprint the browser puts INSIDE the
 * encrypted backup payload (app/lib/aqua-local/backup.ts
 * backupAccountFingerprint): HMAC-SHA256 keyed by the vault secret over
 * 'aqua-vault-account:v1:' + lowercased uid. Same bytes on both sides.
 */
export const BACKUP_ACCOUNT_FP_SCHEME = 'hmac-sha256:vault-secret:v1'
export async function vaultAccountFingerprint(vaultSecret, uid) {
  const norm = String(uid ?? '').trim().toLowerCase()
  if (!norm) throw new Error('account uid is empty')
  const key = await subtle.importKey('raw', te.encode(vaultSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await subtle.sign('HMAC', key, te.encode(`aqua-vault-account:v1:${norm}`))
  return Buffer.from(sig).toString('hex')
}

export async function accountFingerprint(accountId) {
  const norm = String(accountId ?? '').trim().toLowerCase()
  if (!norm) throw new Error('account id is empty')
  return sha256Hex(`aqua-account:v1:${norm}`)
}
