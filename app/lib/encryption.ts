// Server-side only — never import this in client components
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_HEX = process.env.INTEGRATION_ENCRYPTION_KEY ?? ''

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length < 64) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)')
  }
  return Buffer.from(KEY_HEX, 'hex')
}

export function encryptKey(plaintext: string): { encrypted: string; iv: string } {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Store as: authTag(16) + encrypted — both base64
  const payload = Buffer.concat([authTag, encrypted]).toString('base64')
  return { encrypted: payload, iv: iv.toString('hex') }
}

export function decryptKey(encrypted: string, ivHex: string): string {
  const key = getKey()
  const iv = Buffer.from(ivHex, 'hex')
  const payload = Buffer.from(encrypted, 'base64')
  const authTag = payload.subarray(0, 16)
  const ciphertext = payload.subarray(16)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

export function keyFingerprint(key: string): string {
  // Safe display: provider prefix + last 6 chars — e.g. "sk-ant-...a3f2b1"
  const trimmed = key.trim()
  return trimmed.length > 10 ? `...${trimmed.slice(-6)}` : '••••••'
}
