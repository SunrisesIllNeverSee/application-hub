// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// LF-07 — domain repository. The only API the UI uses for private data.
// Guarantees:
//   - versions are immutable (edit = new child version w/ parent link)
//   - sha256 of canonical content is recorded per version
//   - versions bind an exact scope (application_id + question_occurrence_id);
//     a parent version from a different scope is REFUSED
//   - blank / whitespace-only / invisible-character-only bodies are REFUSED
//     (equivalent to the canon m04 guard: strip Unicode Cf + whitespace,
//     refuse if nothing remains)

import {
  canonicalJson,
  decryptText,
  encryptText,
  newId,
  nowIso,
  sha256Hex,
} from './crypto.ts'
import type { VaultStorage } from './vault.ts'
import type {
  ActorClass,
  AnswerRecord,
  ApprovalRecord,
  PacketRecord,
  ProvenanceRecord,
  SignoffRecord,
  VersionMethod,
  VersionRecord,
} from './schema.ts'

export class VaultScopeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultScopeError'
  }
}

export class VaultBlankBodyError extends Error {
  constructor(message = 'version body refused: empty, whitespace-only, or invisible-characters-only') {
    super(message)
    this.name = 'VaultBlankBodyError'
  }
}

export class VaultImmutableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultImmutableError'
  }
}

export class VaultNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultNotFoundError'
  }
}

/**
 * Canon m04 blank-guard equivalent: remove Unicode format chars (Cf —
 * ZWSP, BOM, word joiners, bidi controls) and all whitespace; refuse when
 * nothing visible remains.
 */
const INVISIBLE_RE = /[\p{Cf}\s]/gu

export function isBlankBody(body: string): boolean {
  return body.replace(INVISIBLE_RE, '').length === 0
}

export async function createAnswer(
  storage: VaultStorage,
  scope: { application_id: string; question_occurrence_id: string },
): Promise<AnswerRecord> {
  if (!scope.application_id || !scope.question_occurrence_id) {
    throw new VaultScopeError('answer scope requires application_id and question_occurrence_id')
  }
  const record: AnswerRecord = { id: newId(), scope, created_at: nowIso() }
  await storage.put('answers', record)
  return record
}

export interface CreateVersionInput {
  answer_id: string
  parent_version_id?: string | null
  title: string
  body: string
  method: VersionMethod
  provenance?: string | null
  provider?: string | null
  model?: string | null
  observed_flags?: Record<string, boolean>
}

export async function createVersion(
  storage: VaultStorage,
  secret: string,
  input: CreateVersionInput,
): Promise<VersionRecord> {
  if (isBlankBody(input.body)) throw new VaultBlankBodyError()

  const answer = await storage.get<AnswerRecord>('answers', input.answer_id)
  if (!answer) throw new VaultNotFoundError(`answer not found: ${input.answer_id}`)

  let parent: VersionRecord | null = null
  if (input.parent_version_id) {
    parent = (await storage.get<VersionRecord>('versions', input.parent_version_id)) ?? null
    if (!parent) throw new VaultNotFoundError(`parent version not found: ${input.parent_version_id}`)
    if (parent.answer_id !== input.answer_id) {
      throw new VaultScopeError(
        `cross-scope parent refused: parent belongs to answer ${parent.answer_id}, not ${input.answer_id}`,
      )
    }
  }

  const sha256 = await sha256Hex(canonicalJson({ title: input.title, body: input.body }))
  const blob = await encryptText(secret, input.body)

  const record: VersionRecord = {
    id: newId(),
    answer_id: input.answer_id,
    parent_version_id: parent?.id ?? null,
    title: input.title,
    body: JSON.stringify(blob),
    sha256,
    method: input.method,
    provenance: input.provenance ?? null,
    created_at: nowIso(),
    immutable: true,
  }

  await storage.tx(['versions', 'provenance'], async (s) => {
    const inserted = await s.putIfAbsent('versions', record.id, record)
    if (!inserted) throw new VaultImmutableError(`version id collision refused: ${record.id}`)
    const receipt: ProvenanceRecord = {
      version_id: record.id,
      method: input.method,
      provider: input.provider ?? null,
      model: input.model ?? null,
      observed_flags: input.observed_flags ?? {},
    }
    await s.put('provenance', receipt)
  })
  return record
}

/** Decrypt a stored version. Throws VaultDecryptError on wrong secret. */
export async function readVersion(
  storage: VaultStorage,
  secret: string,
  versionId: string,
): Promise<{ record: VersionRecord; title: string; body: string }> {
  const record = await storage.get<VersionRecord>('versions', versionId)
  if (!record) throw new VaultNotFoundError(`version not found: ${versionId}`)
  const body = await decryptText(secret, JSON.parse(record.body))
  return { record, title: record.title, body }
}

export async function listVersions(storage: VaultStorage, answerId: string): Promise<VersionRecord[]> {
  const all = await storage.getAll<VersionRecord>('versions')
  return all
    .filter((v) => v.answer_id === answerId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

export async function approveVersion(
  storage: VaultStorage,
  input: { version_id: string; decision: 'approved' | 'rejected'; actor_class: ActorClass },
): Promise<ApprovalRecord> {
  const version = await storage.get<VersionRecord>('versions', input.version_id)
  if (!version) throw new VaultNotFoundError(`version not found: ${input.version_id}`)
  const record: ApprovalRecord = {
    id: newId(),
    version_id: input.version_id,
    decision: input.decision,
    actor_class: input.actor_class,
    at: nowIso(),
  }
  await storage.put('approvals', record)
  return record
}

/** Freeze a packet: canonical manifest + digest. Frozen packets are immutable. */
export async function freezePacket(
  storage: VaultStorage,
  input: { application_id: string; manifest: unknown },
): Promise<PacketRecord> {
  if (!input.application_id) throw new VaultScopeError('packet requires application_id')
  const manifestJson = canonicalJson(input.manifest)
  const record: PacketRecord = {
    id: newId(),
    application_id: input.application_id,
    manifest_json: manifestJson,
    manifest_sha256: await sha256Hex(manifestJson),
    frozen_at: nowIso(),
  }
  const inserted = await storage.putIfAbsent('packets', record.id, record)
  if (!inserted) throw new VaultImmutableError(`packet id collision refused: ${record.id}`)
  return record
}

/** Sign a frozen packet. One signoff per packet; signature is optional (declared sign-off allowed). */
export async function signPacket(
  storage: VaultStorage,
  input: { packet_id: string; signer_class: ActorClass; signature_b64?: string | null },
): Promise<SignoffRecord> {
  const packet = await storage.get<PacketRecord>('packets', input.packet_id)
  if (!packet) throw new VaultNotFoundError(`packet not found: ${input.packet_id}`)
  const record: SignoffRecord = {
    packet_id: input.packet_id,
    signer_class: input.signer_class,
    timestamp: nowIso(),
    signature_b64: input.signature_b64 ?? null,
  }
  const inserted = await storage.putIfAbsent('signoffs', record.packet_id, record)
  if (!inserted) throw new VaultImmutableError(`packet already signed: ${input.packet_id}`)
  return record
}
