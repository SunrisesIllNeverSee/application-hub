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

import { signManifestDigest, verifyManifestSignature } from './crypto.ts'
export { generateSignerKeyPair, signManifestDigest, verifyManifestSignature } from './crypto.ts'
export type { SignerKeyPair } from './crypto.ts'
import type { VaultStorage } from './vault.ts'
import { nowIso } from './crypto.ts'
import type { SignerClass, SignoffRecord } from './schema.ts'
import { VaultNotFoundError, VaultImmutableError } from './repo.ts'
import { advancePacketState, getPacketState, PacketStateError } from './packets.ts'

export class SignoffAckError extends Error {
  constructor(message = 'packet sign-off refused: explicit user acknowledgement (user_ack: true) is required') {
    super(message)
    this.name = 'SignoffAckError'
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
  // IR-028/IR-029: allowlist the writeable states BEFORE any write — a
  // packet in ANY terminal or unreachable state (exported, discarded,
  // submitted_external_observed — e.g. arriving via a restored backup)
  // must refuse before a signoff row can be written, never after.
  if (state.state !== 'prepared' && state.state !== 'signed') {
    throw new PacketStateError(
      `cannot sign a packet in state '${state.state}' — freeze a new packet instead`,
    )
  }

  // IR-020: check the EXISTING signoff before writing — when it is a
  // backup-restored claim, a fresh attestation overwrites it WITHOUT a
  // state transition (state is already 'signed'). Only when the stored
  // signoff is live does signed→signed remain illegal.
  const priorSignoff = await storage.get<SignoffRecord>('signoffs', input.packet_id)
  const isReattest = Boolean(priorSignoff?.restored_from_backup)
  if (state.state === 'signed' && !isReattest) {
    throw new PacketStateError('packet already signed — freeze a new packet for corrections')
  }

  // IR-005: sign the STORED packet's manifest digest — never trust the
  // caller's manifest_sha256. A foreign digest would produce a 'signed'
  // packet whose signature cannot verify against the real manifest.
  const packet = await storage.get<{ manifest_sha256: string }>('packets', input.packet_id)
  if (!packet) throw new VaultNotFoundError(`packet not found: ${input.packet_id}`)
  if (input.manifest_sha256 !== packet.manifest_sha256) {
    throw new SignoffAckError(
      `manifest digest mismatch: caller claimed ${input.manifest_sha256}, stored packet has ${packet.manifest_sha256}`,
    )
  }
  const manifestSha256 = packet.manifest_sha256

  let signatureB64: string | null = null
  let pubkeyB64: string | null = null
  if (input.privateKey && input.pubkey_b64) {
    try {
      signatureB64 = await signManifestDigest(input.privateKey, manifestSha256)
      pubkeyB64 = input.pubkey_b64
    } catch {
      // PACKET-05 — unsupported/invalid key → truthful unsigned, never forged.
      signatureB64 = null
      pubkeyB64 = null
    }
  }

  // IR-003: a signoff restored from a backup is a file claim, not a fresh
  // attestation — a real sign-off may overwrite it (putIfAbsent would
  // otherwise block re-signing a restored packet forever).
  // Signoff + state advance commit in ONE tx — a crash between them would
  // otherwise leave 'prepared' + a live signoff, which wedges the packet
  // permanently (next attest hits putIfAbsent with no restored escape).
  // IR-024 + tx-safety: the signature is verified BEFORE the transaction —
  // verifyManifestSignature is WebCrypto and must not run inside an IDB tx
  // (auto-commit → putIfAbsent throws TransactionInactiveError). We pass the
  // digest we verified against; signPacket cross-checks it against the
  // packet's real manifest inside the tx without re-running crypto.
  let verifiedManifest: string | undefined
  if (signatureB64 && pubkeyB64) {
    const ok = await verifyManifestSignature(pubkeyB64, manifestSha256, signatureB64)
    if (!ok) {
      // A signature WE just computed failing to verify means the key pair
      // is broken — refuse honestly rather than write unverifiable bytes.
      throw new Error('signature could not be verified against this packet manifest')
    }
    verifiedManifest = manifestSha256
  }

  const record = await storage.tx(['signoffs', 'packet_states', 'packets'], async (s) => {
    // Re-check STATE inside the tx — a concurrent discard between the
    // outer read and this write must still refuse before any write, or a
    // fresh signoff would land on a terminal packet.
    const txState = await getPacketState(s, input.packet_id)
    if (!txState || (txState.state !== 'prepared' && txState.state !== 'signed')) {
      throw new PacketStateError(
        `cannot sign a packet in state '${txState?.state ?? 'missing'}' — freeze a new packet instead`,
      )
    }
    // Re-read INSIDE the tx — a concurrent attest between the outer read
    // and this write could have landed a live signoff; deleting a live
    // signoff as if restored would silently erase a real attestation.
    const txPrior = await s.get<SignoffRecord>('signoffs', input.packet_id)
    if (txPrior?.restored_from_backup) {
      await s.delete('signoffs', input.packet_id)
    }
    // The signoff row is written here (not via repo.signPacket) because the
    // signature was already verified pre-tx — signPacket's crypto verify
    // cannot run inside an IDB transaction. signature_verified is the value
    // attestPacket itself computed against the stored manifest digest.
    const rec: SignoffRecord = {
      packet_id: input.packet_id,
      signer_class: input.signer_class,
      timestamp: nowIso(),
      signature_b64: signatureB64,
      pubkey_b64: pubkeyB64,
      signature_verified: verifiedManifest === manifestSha256,
    }
    const inserted = await s.putIfAbsent('signoffs', rec.packet_id, rec)
    if (!inserted) throw new VaultImmutableError(`packet already signed: ${input.packet_id}`)
    // IR-020/IR-029b: a re-attestation of a restored signoff replaces the
    // record — but the state transition is skipped ONLY when the packet is
    // already 'signed' AT TX TIME (txState, not the outer read — a racing
    // restore could have regressed signed→prepared between them; skipping
    // the advance on that stale read would wedge the packet as
    // 'prepared' + live signoff). Advance prepared→signed in that edge.
    if (!isReattest || txState.state !== 'signed') {
      await advancePacketState(s, input.packet_id, 'signed')
    }
    return rec
  })
  return record
}
