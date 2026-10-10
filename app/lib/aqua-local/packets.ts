// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// LF-20 — packet freeze. Binds exact APPROVED versions to each
// question_occurrence of one application; produces a canonical manifest
// (sorted keys, no whitespace) + per-answer sha256 + manifest_sha256.
// Frozen packets are immutable: corrections produce a NEW packet. Freeze
// NEVER mutates source versions — this module only reads them.
//
// PACKET-02 refusal set (fail closed, every reason reported):
//   missing question coverage — a question_occurrence with stored answers in
//     this application has no selection
//   unexplained skip          — a selection with no version_id and no
//     skip_reason
//   unapproved selection      — selected version's LATEST approval decision
//     is not 'approved'
//   foreign scope             — selected version's answer scope does not
//     match the claimed (application_id, question_occurrence_id)
//   tampered version          — recomputed plaintext sha256 ≠ stored sha256
//
// LF-22 — exportPacket: portable JSON (packet + manifest + signatures,
// plaintext — NOT the encrypted vault-backup format). Verify offline with
// verify-packet.mjs.
//
// LF-23 — submission boundary. State machine prepared→signed→exported.
// `submitted_external_observed` exists in the PacketState enum but is
// UNREACHABLE: advancePacketState rejects it unconditionally and no other
// code path writes packet state. Export is copy/download only — there is no
// transport, no POST, no provider submission.

import {
  canonicalJson,
  decryptText,
  nowIso,
  sha256Hex,
} from './crypto.ts'
import type { VaultStorage } from './vault.ts'
import type {
  AnswerRecord,
  ApprovalRecord,
  PacketRecord,
  PacketState,
  PacketStateRecord,
  ProvenanceRecord,
  SignoffRecord,
  VersionRecord,
} from './schema.ts'
import { isBlankBody, VaultNotFoundError } from './repo.ts'

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** One packet refusal can carry several independent reasons — all reported. */
export class PacketFreezeError extends Error {
  readonly reasons: string[]
  constructor(reasons: string[]) {
    super(`packet freeze refused: ${reasons.join('; ')}`)
    this.name = 'PacketFreezeError'
    this.reasons = reasons
  }
}

export class PacketStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PacketStateError'
  }
}

// ---------------------------------------------------------------------------
// Packet object shape (LF-Packet-Provenance-Spec)
// ---------------------------------------------------------------------------

export interface PacketQuestionEntry {
  question_occurrence_id: string
  question_text_snapshot: string
  version_id: string | null
  answer_title: string | null
  /** Plaintext answer body — required so the standalone verifier can rehash. */
  answer_body: string | null
  answer_sha256: string | null
  approved: boolean
  skipped: boolean
  skip_reason: string | null
}

export interface PacketProvenanceEntry {
  version_id: string
  method: string
  provider: string | null
  model: string | null
  /** Declared labels asserted by the caller (never trusted as observed). */
  declared: string[]
  /** Claims the system actually observed (from the provenance receipt). */
  observed: string[]
}

export interface PacketAttachment {
  name: string
  sha256: string
}

export interface PacketSignoff {
  signer_class: string | null
  timestamp: string | null
  signature_b64: string | null
  pubkey_b64: string | null
}

export interface FrozenPacket {
  packet_id: string // "PK-" + manifest_sha256[:16]
  application_id: string
  bank_revision?: string
  created_at: string
  questions: PacketQuestionEntry[]
  provenance: PacketProvenanceEntry[]
  attachments: PacketAttachment[]
  signoff: PacketSignoff
}

export const PACKET_EXPORT_FORMAT = 'aqua-local-packet'
export const PACKET_SPEC_VERSION = '1'

export interface PacketExport {
  format: typeof PACKET_EXPORT_FORMAT
  spec_version: string
  packet: FrozenPacket
  manifest_json: string
  manifest_sha256: string
}

// ---------------------------------------------------------------------------
// Selection input
// ---------------------------------------------------------------------------

export interface PacketQuestionSelection {
  question_occurrence_id: string
  /** Exact version to bind; omit/null ONLY together with skip_reason. */
  version_id?: string | null
  /** Explanation required when no version is selected. */
  skip_reason?: string | null
  /** Question text as presented at freeze time (snapshot for the packet). */
  question_text_snapshot: string
}

export interface FreezePacketInput {
  application_id: string
  bank_revision?: string
  selections: PacketQuestionSelection[]
  attachments?: PacketAttachment[]
  /** Injectable for determinism tests; defaults to nowIso(). */
  created_at?: string
}

// ---------------------------------------------------------------------------
// Manifest layout
//
// manifestContent = packet fields EXCLUDING packet_id and signoff
// (packet_id is *derived from* manifest_sha256, so it cannot be inside the
// manifest; signoff is attached after freeze). The verifier strips the same
// two keys and recomputes.
// ---------------------------------------------------------------------------

function manifestContentOf(packet: FrozenPacket): Record<string, unknown> {
  const { packet_id: _id, signoff: _so, ...rest } = packet
  return rest
}

export function canonicalManifestOf(packet: FrozenPacket): string {
  return canonicalJson(manifestContentOf(packet))
}

// ---------------------------------------------------------------------------
// LF-20 freeze
// ---------------------------------------------------------------------------

async function latestApproval(
  storage: VaultStorage,
  versionId: string,
): Promise<ApprovalRecord | null> {
  const all = await storage.getAll<ApprovalRecord>('approvals')
  const forVersion = all
    .filter((a) => a.version_id === versionId)
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
  return forVersion.length ? forVersion[forVersion.length - 1] : null
}

/**
 * Freeze an application packet. Throws PacketFreezeError with ALL refusal
 * reasons on failure; returns the stored PacketRecord + the FrozenPacket on
 * success. Source versions are read-only here — nothing is mutated.
 */
export async function freezeApplicationPacket(
  storage: VaultStorage,
  secret: string,
  input: FreezePacketInput,
): Promise<{ packet: FrozenPacket; record: PacketRecord; manifest_json: string }> {
  if (!input.application_id) throw new PacketFreezeError(['application_id is required'])

  const reasons: string[] = []
  const selections = input.selections ?? []
  const seen = new Set<string>()
  for (const sel of selections) {
    if (seen.has(sel.question_occurrence_id)) {
      reasons.push(`duplicate selection for question_occurrence ${sel.question_occurrence_id}`)
    }
    seen.add(sel.question_occurrence_id)
  }

  // Coverage: every question_occurrence that has answers in this application
  // must be covered by a selection.
  const answers = (await storage.getAll<AnswerRecord>('answers')).filter(
    (a) => a.scope.application_id === input.application_id,
  )
  const requiredOccurrences = new Set(answers.map((a) => a.scope.question_occurrence_id))
  for (const occ of [...requiredOccurrences].sort()) {
    if (!seen.has(occ)) {
      reasons.push(`missing question coverage: no selection for question_occurrence ${occ}`)
    }
  }

  const questions: PacketQuestionEntry[] = []
  const provenance: PacketProvenanceEntry[] = []

  const sortedSelections = [...selections].sort((a, b) =>
    a.question_occurrence_id.localeCompare(b.question_occurrence_id),
  )

  for (const sel of sortedSelections) {
    const occ = sel.question_occurrence_id
    if (!occ) {
      reasons.push('selection without question_occurrence_id')
      continue
    }

    if (!sel.version_id) {
      // Skipped question — must carry an explanation.
      if (!sel.skip_reason || isBlankBody(sel.skip_reason)) {
        reasons.push(`unexplained skip: question_occurrence ${occ} has no version and no skip_reason`)
        continue
      }
      questions.push({
        question_occurrence_id: occ,
        question_text_snapshot: sel.question_text_snapshot ?? '',
        version_id: null,
        answer_title: null,
        answer_body: null,
        answer_sha256: null,
        approved: false,
        skipped: true,
        skip_reason: sel.skip_reason,
      })
      continue
    }

    const version = await storage.get<VersionRecord>('versions', sel.version_id)
    if (!version) {
      reasons.push(`selected version not found: ${sel.version_id} (question_occurrence ${occ})`)
      continue
    }

    // Foreign scope: the version's answer must bind exactly this
    // (application_id, question_occurrence_id).
    const answer = await storage.get<AnswerRecord>('answers', version.answer_id)
    if (
      !answer ||
      answer.scope.application_id !== input.application_id ||
      answer.scope.question_occurrence_id !== occ
    ) {
      reasons.push(
        `foreign scope refused: version ${sel.version_id} is not bound to ` +
          `application ${input.application_id} / question_occurrence ${occ}`,
      )
      continue
    }

    // Approval: latest decision must be 'approved'.
    const approval = await latestApproval(storage, version.id)
    const approved = approval?.decision === 'approved'
    if (!approved) {
      reasons.push(
        `unapproved selection: version ${sel.version_id} latest decision is ` +
          `'${approval?.decision ?? 'none'}' (question_occurrence ${occ})`,
      )
      continue
    }

    // Decrypt + re-hash: refuses tampered ciphertext/plaintext digest drift.
    let body: string
    try {
      body = await decryptText(secret, JSON.parse(version.body))
    } catch {
      reasons.push(`version ${sel.version_id} cannot be decrypted under the provided secret`)
      continue
    }
    const recomputed = await sha256Hex(canonicalJson({ title: version.title, body }))
    if (recomputed !== version.sha256) {
      reasons.push(`tampered version refused: ${sel.version_id} stored sha256 does not match recomputed`)
      continue
    }

    questions.push({
      question_occurrence_id: occ,
      question_text_snapshot: sel.question_text_snapshot ?? '',
      version_id: version.id,
      answer_title: version.title,
      answer_body: body,
      answer_sha256: version.sha256,
      approved: true,
      skipped: false,
      skip_reason: null,
    })

    const receipt = await storage.get<ProvenanceRecord>('provenance', version.id)
    const declared = [`method:${version.method}`]
    if (receipt?.provider) declared.push(`provider:${receipt.provider}`)
    if (receipt?.model) declared.push(`model:${receipt.model}`)
    const observed = Object.entries(receipt?.observed_flags ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => k)
      .sort()
    provenance.push({
      version_id: version.id,
      method: receipt?.method ?? version.method,
      provider: receipt?.provider ?? null,
      model: receipt?.model ?? null,
      declared,
      observed,
    })
  }

  // Selections that cover occurrences with no answers in this application are
  // allowed only when they are explained skips — a selected version for an
  // occurrence outside the app's question set is foreign by definition. That
  // is already caught above via the scope check on the version's answer.

  if (reasons.length > 0) throw new PacketFreezeError(reasons)

  questions.sort((a, b) => a.question_occurrence_id.localeCompare(b.question_occurrence_id))
  provenance.sort((a, b) => a.version_id.localeCompare(b.version_id))

  const base: FrozenPacket = {
    packet_id: '', // derived below
    application_id: input.application_id,
    created_at: input.created_at ?? nowIso(),
    questions,
    provenance,
    attachments: [...(input.attachments ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    signoff: { signer_class: null, timestamp: null, signature_b64: null, pubkey_b64: null },
  }
  if (input.bank_revision !== undefined) base.bank_revision = input.bank_revision

  const manifestJson = canonicalManifestOf(base)
  const manifestSha = await sha256Hex(manifestJson)
  const packet: FrozenPacket = { ...base, packet_id: `PK-${manifestSha.slice(0, 16)}` }

  const record: PacketRecord = {
    id: packet.packet_id,
    application_id: input.application_id,
    manifest_json: manifestJson,
    manifest_sha256: manifestSha,
    frozen_at: packet.created_at,
  }
  const inserted = await storage.putIfAbsent('packets', record.id, record)
  if (!inserted) {
    throw new PacketFreezeError([
      `packet id collision: ${record.id} — an identical packet already exists; corrections produce a new packet`,
    ])
  }

  // LF-23: enter the state machine at 'prepared'.
  const now = nowIso()
  await storage.put('packet_states', {
    packet_id: record.id,
    state: 'prepared',
    history: [{ state: 'prepared', at: now }],
    updated_at: now,
  } satisfies PacketStateRecord)

  return { packet, record, manifest_json: manifestJson }
}

// ---------------------------------------------------------------------------
// LF-23 state machine
// ---------------------------------------------------------------------------

/**
 * Allowed transitions. `submitted_external_observed` appears in NO target
 * list — it is declared but unreachable (no transport exists to produce a
 * real external receipt). advancePacketState additionally rejects it
 * unconditionally as defence in depth.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<PacketState, readonly PacketState[]>> = {
  prepared: ['signed', 'exported'], // exported-direct allowed: unsigned export stays truthful
  signed: ['exported'],
  exported: [],
  submitted_external_observed: [],
}

export async function getPacketState(
  storage: VaultStorage,
  packetId: string,
): Promise<PacketStateRecord | null> {
  return (await storage.get<PacketStateRecord>('packet_states', packetId)) ?? null
}

export async function advancePacketState(
  storage: VaultStorage,
  packetId: string,
  target: PacketState,
): Promise<PacketStateRecord> {
  // LF-23 hard refusal — there is no code path that sets this state.
  if (target === 'submitted_external_observed') {
    throw new PacketStateError(
      'state submitted_external_observed is unreachable: no external submission transport exists',
    )
  }
  const rec = await storage.get<PacketStateRecord>('packet_states', packetId)
  if (!rec) throw new VaultNotFoundError(`packet state not found: ${packetId}`)
  if (!ALLOWED_TRANSITIONS[rec.state]?.includes(target)) {
    throw new PacketStateError(`illegal packet transition: ${rec.state} → ${target}`)
  }
  const now = nowIso()
  const next: PacketStateRecord = {
    packet_id: rec.packet_id,
    state: target,
    history: [...rec.history, { state: target, at: now }],
    updated_at: now,
  }
  await storage.put('packet_states', next)
  return next
}

// ---------------------------------------------------------------------------
// Packet materialization (record → full FrozenPacket incl. signoff)
// ---------------------------------------------------------------------------

export async function loadPacket(storage: VaultStorage, packetId: string): Promise<FrozenPacket> {
  const record = await storage.get<PacketRecord>('packets', packetId)
  if (!record) throw new VaultNotFoundError(`packet not found: ${packetId}`)
  const manifestContent = JSON.parse(record.manifest_json) as Record<string, unknown>
  const signoff = await storage.get<SignoffRecord>('signoffs', packetId)
  const packet: FrozenPacket = {
    packet_id: record.id,
    ...(manifestContent as Omit<FrozenPacket, 'packet_id' | 'signoff'>),
    signoff: signoff
      ? {
          signer_class: signoff.signer_class,
          timestamp: signoff.timestamp,
          signature_b64: signoff.signature_b64,
          pubkey_b64: signoff.pubkey_b64 ?? null,
        }
      : { signer_class: null, timestamp: null, signature_b64: null, pubkey_b64: null },
  }
  return packet
}

export async function listPackets(
  storage: VaultStorage,
  applicationId?: string,
): Promise<PacketRecord[]> {
  const all = await storage.getAll<PacketRecord>('packets')
  return all
    .filter((p) => !applicationId || p.application_id === applicationId)
    .sort((a, b) => a.frozen_at.localeCompare(b.frozen_at) || a.id.localeCompare(b.id))
}

// ---------------------------------------------------------------------------
// LF-22 export — portable plaintext JSON (distinct from encrypted vault backup)
// ---------------------------------------------------------------------------

/**
 * Produce the portable export document. Copy/download only — this returns a
 * string for the caller to save/share; nothing is transmitted anywhere.
 * Advances state prepared|signed → exported.
 */
export async function exportPacket(storage: VaultStorage, packetId: string): Promise<string> {
  const record = await storage.get<PacketRecord>('packets', packetId)
  if (!record) throw new VaultNotFoundError(`packet not found: ${packetId}`)
  const state = await getPacketState(storage, packetId)
  if (state && state.state === 'exported') {
    // Idempotent: re-export of the same packet returns an identical document.
  } else {
    await advancePacketState(storage, packetId, 'exported')
  }
  const packet = await loadPacket(storage, packetId)
  const doc: PacketExport = {
    format: PACKET_EXPORT_FORMAT,
    spec_version: PACKET_SPEC_VERSION,
    packet,
    manifest_json: record.manifest_json,
    manifest_sha256: record.manifest_sha256,
  }
  return JSON.stringify(doc, null, 2)
}
