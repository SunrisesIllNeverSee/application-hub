// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// LF-06 — vault cryptography. AES-GCM-256 over answer bodies; keys are
// derived per record via PBKDF2 (>=210k iterations) from the user secret
// with a per-record salt + IV. The derived key is NEVER persisted — only
// salt/iv/iterations travel with the ciphertext. Wrong secret → AES-GCM
// auth failure → clean refusal via VaultDecryptError.
//
// WebCrypto only — works in browsers and Node >=20 (globalThis.crypto).

export const PBKDF2_ITERATIONS = 210_000
export const SALT_BYTES = 16
export const IV_BYTES = 12

export class VaultDecryptError extends Error {
  constructor(message = 'decryption failed — wrong secret or tampered data') {
    super(message)
    this.name = 'VaultDecryptError'
  }
}

export interface EncryptedBlob {
  v: 1
  alg: 'AES-GCM-256'
  kdf: 'PBKDF2-SHA256'
  iters: number
  salt_b64: string
  iv_b64: string
  ct_b64: string
}

const te = new TextEncoder()
const td = new TextDecoder()

function getCrypto(): Crypto {
  const c = globalThis.crypto
  if (!c || !c.subtle) throw new Error('WebCrypto is not available in this environment')
  return c
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n)
  getCrypto().getRandomValues(out)
  return out
}

export function b64encode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export function b64decode(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export function newId(): string {
  return getCrypto().randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** Derive an AES-GCM-256 key from the user secret. Key is extractable=false and never stored. */
export async function deriveKey(
  secret: string,
  salt: Uint8Array,
  iters: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const subtle = getCrypto().subtle
  const base = await subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveKey'])
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: iters, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptText(secret: string, plaintext: string): Promise<EncryptedBlob> {
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = await deriveKey(secret, salt, PBKDF2_ITERATIONS)
  const ct = await getCrypto().subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    te.encode(plaintext),
  )
  return {
    v: 1,
    alg: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iters: PBKDF2_ITERATIONS,
    salt_b64: b64encode(salt),
    iv_b64: b64encode(iv),
    ct_b64: b64encode(new Uint8Array(ct)),
  }
}

export async function decryptText(secret: string, blob: EncryptedBlob): Promise<string> {
  if (!blob || blob.v !== 1 || blob.alg !== 'AES-GCM-256') {
    throw new VaultDecryptError('unsupported encrypted blob format')
  }
  try {
    const key = await deriveKey(secret, b64decode(blob.salt_b64), blob.iters)
    const pt = await getCrypto().subtle.decrypt(
      { name: 'AES-GCM', iv: b64decode(blob.iv_b64) as BufferSource },
      key,
      b64decode(blob.ct_b64) as BufferSource,
    )
    return td.decode(pt)
  } catch (err) {
    if (err instanceof VaultDecryptError) throw err
    throw new VaultDecryptError()
  }
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await getCrypto().subtle.digest('SHA-256', te.encode(text))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Deterministic JSON: object keys sorted recursively, no whitespace. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  const parts = keys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
  return `{${parts.join(',')}}`
}
