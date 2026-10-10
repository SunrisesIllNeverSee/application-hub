// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// LF-21 — packet user sign-off. Real WebCrypto ECDSA P-256 signatures over
// the manifest digest, plus an honest unsigned state.
//
// Rules (LF-Packet-Provenance-Spec):
//   - sign-off is optional-but-honest: an unsigned packet carries the
//     manifest hash only — never a fabricated signature
//   - signing REQUIRES an explicit user acknowledgement flag
//   - PACKET-05: an unsupported/invalid key degrades to TRUTHFUL UNSIGNED,
//     never to a forged or malformed signature
//   - the signoff record carries timestamp + signer pubkey (b64 SPKI)
//   - signer_class is 'authenticated-account' | 'local-only' — a claim about
//     identity backing, not about signature validity

import { b64decode, b64encode } from './crypto.ts'
import type { VaultStorage } from './vault.ts'
import type { SignerClass, SignoffRecord } from './schema.ts'
import { signPacket as recordSignoff, VaultNotFoundError } from './repo.ts'
import { advancePacketState, getPacketState, PacketStateError } from './packets.ts'

export class SignoffAckError extends Error {
  constructor(message = 'packet sign-off refused: explicit user acknowledgement (user_ack: true) is required') {
    super(message)
    this.name = 'SignoffAckError'
  }
}

const te = new TextEncoder()

function subtleOrNull(): SubtleCrypto | null {
  return globalThis.crypto?.subtle ?? null
}

export interface SignerKeyPair {
  privateKey: CryptoKey
  /** Base64 SPKI — travels inside the packet signoff + export. */
  pubkey_b64: string
}

/** Generate a vault-local ECDSA P-256 signing keypair. */
export async function generateSignerKeyPair(): Promise<SignerKeyPair> {
  const subtle = subtleOrNull()
  if (!subtle) throw new Error('WebCrypto is not available in this environment')
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])
  const spki = await subtle.exportKey('spki', pair.publicKey)
  return { privateKey: pair.privateKey, pubkey_b64: b64encode(new Uint8Array(spki)) }
}

/** Sign the manifest digest hex string (UTF-8 bytes of the hex digest). */
export async function signManifestDigest(
  privateKey: CryptoKey,
  manifestSha256Hex: string,
): Promise<string> {
  const subtle = subtleOrNull()
  if (!subtle) throw new Error('WebCrypto is not available in this environment')
  const sig = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    te.encode(manifestSha256Hex),
  )
  return b64encode(new Uint8Array(sig))
}

/** Verify a signature over the manifest digest against a base64 SPKI pubkey. */
export async function verifyManifestSignature(
  pubkeyB64: string,
  manifestSha256Hex: string,
  signatureB64: string,
): Promise<boolean> {
  const subtle = subtleOrNull()
  if (!subtle) return false
  try {
    const key = await subtle.importKey(
      'spki',
      b64decode(pubkeyB64) as BufferSource,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
    return await subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      b64decode(signatureB64) as BufferSource,
      te.encode(manifestSha256Hex),
    )
  } catch {
    return false
  }
}

export interface AttestPacketInput {
  packet_id: string
  signer_class: SignerClass
  /** MUST be exactly true — the user's explicit acknowledgement. */
  user_ack: boolean
  /**
   * Optional signing material. When absent, or when the key is unusable
   * (PACKET-05), the signoff is recorded as truthful unsigned.
   */
  privateKey?: CryptoKey | null
  pubkey_b64?: string | null
  /** Required to compute the signature — the packet's manifest_sha256. */
  manifest_sha256: string
}

/**
 * Record a packet sign-off. One signoff per packet (enforced downstream).
 * Advances state prepared → signed. Returns the stored SignoffRecord;
 * `signature_b64` is null in the honest-unsigned case.
 */
export async function attestPacket(
  storage: VaultStorage,
  input: AttestPacketInput,
): Promise<SignoffRecord> {
  if (input.user_ack !== true) throw new SignoffAckError()

  const state = await getPacketState(storage, input.packet_id)
  if (!state) throw new VaultNotFoundError(`packet not found: ${input.packet_id}`)
  if (state.state === 'exported') {
    throw new PacketStateError('cannot sign an already-exported packet — freeze a new packet instead')
  }

  let signatureB64: string | null = null
  let pubkeyB64: string | null = null
  if (input.privateKey && input.pubkey_b64) {
    try {
      signatureB64 = await signManifestDigest(input.privateKey, input.manifest_sha256)
      pubkeyB64 = input.pubkey_b64
    } catch {
      // PACKET-05 — unsupported/invalid key → truthful unsigned, never forged.
      signatureB64 = null
      pubkeyB64 = null
    }
  }

  const record = await recordSignoff(storage, {
    packet_id: input.packet_id,
    signer_class: input.signer_class,
    signature_b64: signatureB64,
    pubkey_b64: pubkeyB64,
  })
  await advancePacketState(storage, input.packet_id, 'signed')
  return record
}
