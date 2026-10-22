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
  encryptField,
  encryptText,
  newId,
  nowIso,
  sha256Hex,
  verifyManifestSignature,
} from './crypto.ts'
import type { VaultStorage } from './vault.ts'
import type {
  ActorClass,
  AnswerRecord,
  ApprovalRecord,
  ApprovalVia,
  EventRecord,
  PacketRecord,
  ProvenanceRecord,
  SignerClass,
  SignoffRecord,
  VersionMethod,
  VersionRecord,
} from './schema.ts'
import { HISTORY_VIA, describePlaceholders, findPlaceholders, normalizeEffectiveAt } from './history.ts'

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

/** v5: a human decision presented a hash that is not the stored version's —
    the user approved content that is not what the vault holds. Refused. */
export class VaultApprovalMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultApprovalMismatchError'
  }
}

/** M09b: a submitted-history confirmation was refused because the answer
    still carries an unfilled placeholder. `markers` = history.ts rule ids. */
export class VaultPlaceholderError extends Error {
  markers: string[]
  constructor(markers: string[]) {
    super(`history attestation refused: ${describePlaceholders(markers)}`)
    this.name = 'VaultPlaceholderError'
    this.markers = markers
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
  /** IR-026: provenance link to the source version this body was derived
      from (cross-scope reuse). Never implies approval transfer. */
  derived_from?: { version_id: string; version_sha256: string } | null
  /** v5: evidence cited by this version (metadata — not hashed). */
  evidence_ids?: string[]
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

  const { record, receipt } = await buildVersionPayload(secret, input, parent?.id ?? null)
  await insertVersion(storage, record, receipt)
  return record
}

/** Crypto + record assembly for a version — pure (no store access), so it is
    safe to call OUTSIDE a transaction. Do the puts via insertVersion (or a
    caller-managed tx) — WebCrypto awaits inside an IDB transaction risk
    auto-commit in real browsers. */
export async function buildVersionPayload(
  secret: string,
  input: Pick<CreateVersionInput, 'answer_id' | 'title' | 'body' | 'method' | 'provenance' | 'provider' | 'model' | 'observed_flags' | 'derived_from' | 'evidence_ids'>,
  parentVersionId: string | null = null,
): Promise<{ record: VersionRecord; receipt: ProvenanceRecord }> {
  // The canon blank-guard applies to EVERY version writer, not only the
  // createVersion path — a Cf-only body must never become an encrypted
  // version that could be approved + packet-bound.
  if (isBlankBody(input.body)) throw new VaultBlankBodyError()
  const sha256 = await sha256Hex(canonicalJson({ title: input.title, body: input.body }))
  const blob = await encryptText(secret, input.body)
  const titleBlob = await encryptText(secret, input.title)
  const record: VersionRecord = {
    id: newId(),
    answer_id: input.answer_id,
    parent_version_id: parentVersionId,
    title: JSON.stringify(titleBlob),
    title_enc: true,
    derived_from: input.derived_from ?? null,
    body: JSON.stringify(blob),
    sha256,
    method: input.method,
    provenance: input.provenance ?? null,
    created_at: nowIso(),
    immutable: true,
  }
  // v5: evidence ids are metadata outside the content hash; omitted when
  // empty so v4-shaped records stay byte-identical.
  const evidenceIds = [...new Set((input.evidence_ids ?? []).filter((e) => typeof e === 'string' && e))]
  if (evidenceIds.length) record.evidence_ids = evidenceIds
  const receipt: ProvenanceRecord = {
    version_id: record.id,
    method: input.method,
    provider: input.provider ?? null,
    model: input.model ?? null,
    observed_flags: input.observed_flags ?? {},
  }
  return { record, receipt }
}

/** Put a pre-built version record + provenance receipt. Inside a caller tx
    the same puts may be issued directly on the tx-scoped storage. */
async function insertVersion(
  storage: VaultStorage,
  record: VersionRecord,
  receipt: ProvenanceRecord,
): Promise<void> {
  await storage.tx(['versions', 'provenance'], async (s) => {
    const inserted = await s.putIfAbsent('versions', record.id, record)
    if (!inserted) throw new VaultImmutableError(`version id collision refused: ${record.id}`)
    await s.put('provenance', receipt)
  })
}

/** Decrypt a stored version. Throws VaultDecryptError on wrong secret. */
export async function decryptVersionTitle(secret: string, record: VersionRecord): Promise<string> {
  if (!record.title_enc) return record.title // legacy plaintext
  return decryptText(secret, JSON.parse(record.title))
}

export async function readVersion(
  storage: VaultStorage,
  secret: string,
  versionId: string,
): Promise<{ record: VersionRecord; title: string; body: string }> {
  const record = await storage.get<VersionRecord>('versions', versionId)
  if (!record) throw new VaultNotFoundError(`version not found: ${versionId}`)
  const body = await decryptText(secret, JSON.parse(record.body))
  const title = await decryptVersionTitle(secret, record)
  return { record, title, body }
}

/** IR-014 + IR-035 unlock-time migration: encrypts legacy plaintext
    version titles and intake catalog blobs in place. Runs after unlock —
    crypto happens outside write transactions; records stay readable as
    legacy plaintext if a run is interrupted mid-way. */
export async function runVaultPrivacyMigration(
  storage: VaultStorage,
  secret: string,
): Promise<{ titles_migrated: number; catalog_migrated: number }> {
  const versions = await storage.getAll<VersionRecord>('versions')
  const titleUpdates: VersionRecord[] = []
  for (const v of versions) {
    if (v.title_enc) continue
    const blob = await encryptText(secret, v.title)
    titleUpdates.push({ ...v, title: JSON.stringify(blob), title_enc: true })
  }
  if (titleUpdates.length) {
    await storage.tx(['versions'], async (s) => {
      for (const u of titleUpdates) await s.put('versions', u)
    })
  }
  const cats = await storage.getAll<import('./schema.ts').CatalogCacheRecord>('catalog_cache')
  const catUpdates: import('./schema.ts').CatalogCacheRecord[] = []
  for (const c of cats) {
    if (!c.key.startsWith('intake:') || c.blob_enc || c.blob === undefined) continue
    const enc = await encryptText(secret, JSON.stringify(c.blob))
    const { blob: _omit, ...rest } = c
    catUpdates.push({ ...rest, blob_enc: JSON.stringify(enc) })
  }
  if (catUpdates.length) {
    await storage.tx(['catalog_cache'], async (s) => {
      for (const u of catUpdates) await s.put('catalog_cache', u)
    })
  }
  return { titles_migrated: titleUpdates.length, catalog_migrated: catUpdates.length }
}

export async function listVersions(storage: VaultStorage, answerId: string): Promise<VersionRecord[]> {
  const all = await storage.getAll<VersionRecord>('versions')
  return all
    .filter((v) => v.answer_id === answerId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

/**
 * LF-18 / v5 — allocate the next ledger seq and append one event. MUST be
 * called inside a storage.tx that includes 'events' so the
 * read-max-then-write cannot interleave across tabs.
 */
export async function appendLedgerEvent(
  s: VaultStorage,
  event: Omit<EventRecord, 'id' | 'seq'>,
): Promise<EventRecord> {
  const events = await s.getAll<EventRecord>('events')
  const seq = events.reduce((max, e) => Math.max(max, e.seq), 0) + 1
  const record: EventRecord = { id: newId(), seq, ...event }
  await s.put('events', record)
  return record
}

/** Shared approvals-ledger writer (inside a tx over approvals + events). */
async function writeApprovalDecision(
  s: VaultStorage,
  version: VersionRecord,
  input: {
    decision: 'approved' | 'rejected'
    actor_class: ActorClass
    actor_id: string | null
    via: ApprovalVia
    /** history_attestation only */
    effective_at?: string
    attestation_enc?: string
  },
): Promise<ApprovalRecord> {
  const id = newId()
  const at = nowIso()
  const event = await appendLedgerEvent(s, {
    kind: 'approval_decision',
    entity: 'version',
    entity_id: version.id,
    payload: {
      approval_id: id,
      version_sha256: version.sha256,
      decision: input.decision,
      actor_class: input.actor_class,
      actor_id: input.actor_id,
      via: input.via,
      ...(input.effective_at ? { effective_at: input.effective_at } : {}),
    },
    at,
  })
  const record: ApprovalRecord = {
    id,
    version_id: version.id,
    version_sha256: version.sha256,
    decision: input.decision,
    actor_class: input.actor_class,
    at,
    seq: event.seq,
    actor_id: input.actor_id,
    via: input.via,
  }
  if (input.effective_at) record.effective_at = input.effective_at
  if (input.attestation_enc) record.attestation_enc = input.attestation_enc
  await s.put('approvals', record)
  return record
}

/**
 * LF-18 — record an approval decision AND its audit receipt atomically.
 * The `seq` is allocated from the events ledger inside the same
 * transaction (max(existing)+1), so two tabs racing on the same vault get
 * a strict total order instead of a wall-clock tie: IndexedDB serializes
 * readwrite transactions over the same object stores, and the in-memory
 * adapter is single-threaded. A revocation is a NEW decision row + NEW
 * event — never an update of the prior approval.
 */
/** @deprecated v5 — LEGACY primitive kept for pre-v5 callers/tests (rows
    are written with via:'legacy', actor_id:null). New code MUST use
    recordHumanApproval / recordHumanRevocation (hash-bound, human-only)
    for decisions and recordSuggestion for agent recommendations.
    actor_class is caller-asserted, not proven — the packet freeze gate
    (status.ts approvalGate) is the enforcement point: only the LATEST
    decision being a live, hash-bound, human 'approved' satisfies it. */
export async function approveVersion(
  storage: VaultStorage,
  input: { version_id: string; decision: 'approved' | 'rejected'; actor_class: ActorClass },
): Promise<ApprovalRecord> {
  const version = await storage.get<VersionRecord>('versions', input.version_id)
  if (!version) throw new VaultNotFoundError(`version not found: ${input.version_id}`)
  return storage.tx(['approvals', 'events'], (s) =>
    writeApprovalDecision(s, version, {
      decision: input.decision,
      actor_class: input.actor_class,
      actor_id: null,
      via: 'legacy',
    }),
  )
}

export interface HumanDecisionInput {
  version_id: string
  /** The sha256 of the content the human was SHOWN. Must equal the stored
      version's sha256 at write time, or the decision is refused. */
  expected_sha256: string
  /** Who decided — the signed-in uid or a vault-local user label. */
  actor_id: string
  via: Exclude<ApprovalVia, 'legacy' | 'history_attestation'>
  /** Optional: also decrypt + rehash the stored plaintext and require it to
      equal expected_sha256 (catches a tampered row whose stored sha256 was
      left intact). Crypto runs BEFORE the write transaction. */
  secret?: string
}

const HUMAN_VIA: ReadonlyArray<Exclude<ApprovalVia, 'legacy' | 'history_attestation'>> = ['review_ui', 'decision_file']

async function recordHumanDecision(
  storage: VaultStorage,
  input: HumanDecisionInput,
  decision: 'approved' | 'rejected',
): Promise<ApprovalRecord> {
  if (!input.version_id) throw new VaultNotFoundError('version_id is required')
  if (typeof input.expected_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(input.expected_sha256)) {
    throw new VaultApprovalMismatchError('expected_sha256 must be the 64-hex content hash the human reviewed')
  }
  if (typeof input.actor_id !== 'string' || isBlankBody(input.actor_id)) {
    throw new VaultScopeError('human decision requires actor_id')
  }
  if (!HUMAN_VIA.includes(input.via)) {
    throw new VaultScopeError(`human decision via must be one of ${HUMAN_VIA.join('|')}`)
  }
  if (input.secret) {
    const { title, body } = await readVersion(storage, input.secret, input.version_id)
    const recomputed = await sha256Hex(canonicalJson({ title, body }))
    if (recomputed !== input.expected_sha256) {
      throw new VaultApprovalMismatchError(
        `version ${input.version_id} plaintext does not hash to the reviewed sha256 — refused`,
      )
    }
  }
  return storage.tx(['versions', 'approvals', 'events'], async (s) => {
    // Re-read INSIDE the write transaction: the hash check and the write
    // are atomic, so a concurrent row swap cannot slip between them.
    const version = await s.get<VersionRecord>('versions', input.version_id)
    if (!version) throw new VaultNotFoundError(`version not found: ${input.version_id}`)
    if (version.sha256 !== input.expected_sha256) {
      throw new VaultApprovalMismatchError(
        `version ${input.version_id} sha256 is ${version.sha256.slice(0, 12)}…, ` +
          `reviewed ${input.expected_sha256.slice(0, 12)}… — decision refused`,
      )
    }
    return writeApprovalDecision(s, version, {
      decision,
      actor_class: 'human', // hardcoded — this API cannot write an agent row
      actor_id: input.actor_id,
      via: input.via,
    })
  })
}

/**
 * v5 — THE approval API. Re-reads the stored version, refuses on hash
 * mismatch, and writes an `actor_class: 'human'` approval bound to that
 * exact sha256. There is no actor_class parameter: agents recommend via
 * recordSuggestion and can never reach this writer's 'approved' row.
 */
export function recordHumanApproval(
  storage: VaultStorage,
  input: HumanDecisionInput,
): Promise<ApprovalRecord> {
  return recordHumanDecision(storage, input, 'approved')
}

/** v5 — human revocation / rejection on the approvals ledger (same hash
    binding as recordHumanApproval). */
export function recordHumanRevocation(
  storage: VaultStorage,
  input: HumanDecisionInput,
): Promise<ApprovalRecord> {
  return recordHumanDecision(storage, input, 'rejected')
}

export interface HistoryAttestationInput {
  version_id: string
  /** The sha256 of the answer the user was SHOWN on the confirm screen. */
  expected_sha256: string
  /** The submission date (YYYY-MM-DD or ISO date-time); not in the future. */
  effective_at: string
  /** The user's attestation statement (stored encrypted). */
  statement: string
  /** Who confirmed — the signed-in uid or a vault-local user label. */
  actor_id: string
}

/**
 * M09b — confirm an imported answer as ACTUALLY SUBMITTED (OWNER rule
 * 2026-10-22: submitted answers are approved as of their submission date).
 * Writes a human approval (`actor_class: 'human'`, `via:
 * 'history_attestation'`) bound to the exact version hash, carrying
 * `effective_at` (the submission date) and the user's statement encrypted
 * as `attestation_enc`.
 *
 * Refuses — before anything is written — when:
 *   - the version is not an imported history record (`history: true`);
 *   - the decrypted title+body does not hash to `expected_sha256`, or the
 *     stored row's sha256 differs (checked again inside the write tx);
 *   - the BODY contains an unfilled placeholder (history.ts
 *     findPlaceholders: [CONFIRM, [ASSET NEEDED, TODO, TBD, XXX, <…>, {{…}});
 *     this rule lives here, in the vault write, not only in the UI;
 *   - effective_at is not a real date or is in the future;
 *   - the statement or actor_id is blank.
 * All crypto runs before the write transaction (IndexedDB auto-commit).
 */
export async function recordHistoryAttestation(
  storage: VaultStorage,
  secret: string,
  input: HistoryAttestationInput,
): Promise<ApprovalRecord> {
  if (!input.version_id) throw new VaultNotFoundError('version_id is required')
  if (typeof input.expected_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(input.expected_sha256)) {
    throw new VaultApprovalMismatchError('expected_sha256 must be the 64-hex content hash the user confirmed')
  }
  if (typeof input.actor_id !== 'string' || isBlankBody(input.actor_id)) {
    throw new VaultScopeError('history attestation requires actor_id')
  }
  if (typeof input.statement !== 'string' || isBlankBody(input.statement)) {
    throw new VaultScopeError('history attestation requires the user\'s attestation statement')
  }
  if (input.statement.length > 4000) throw new VaultScopeError('attestation statement is too long (max 4000 characters)')
  const effectiveAt = normalizeEffectiveAt(input.effective_at)
  if (!effectiveAt) {
    throw new VaultScopeError('effective_at must be the submission date (YYYY-MM-DD or ISO date-time) and not in the future')
  }
  const { record, title, body } = await readVersion(storage, secret, input.version_id)
  if (record.history !== true) {
    throw new VaultScopeError(`version ${input.version_id} is not an imported submitted-history record`)
  }
  const recomputed = await sha256Hex(canonicalJson({ title, body }))
  if (recomputed !== input.expected_sha256 || record.sha256 !== input.expected_sha256) {
    throw new VaultApprovalMismatchError(
      `version ${input.version_id} does not hash to the confirmed sha256 — refused`,
    )
  }
  const markers = findPlaceholders(body)
  if (markers.length) throw new VaultPlaceholderError(markers)
  const attestation_enc = await encryptField(secret, input.statement)
  return storage.tx(['versions', 'approvals', 'events'], async (s) => {
    const version = await s.get<VersionRecord>('versions', input.version_id)
    if (!version) throw new VaultNotFoundError(`version not found: ${input.version_id}`)
    if (version.sha256 !== input.expected_sha256 || version.history !== true) {
      throw new VaultApprovalMismatchError(`version ${input.version_id} changed before the attestation was written — refused`)
    }
    return writeApprovalDecision(s, version, {
      decision: 'approved',
      actor_class: 'human',
      actor_id: input.actor_id,
      via: HISTORY_VIA,
      effective_at: effectiveAt,
      attestation_enc,
    })
  })
}

export interface ChildVersionInput {
  parent_version_id: string
  body: string
  /** Defaults to the parent's (decrypted) title. */
  title?: string
  method?: VersionMethod
  provenance?: string | null
  provider?: string | null
  model?: string | null
  observed_flags?: Record<string, boolean>
  evidence_ids?: string[]
}

/**
 * v5 — EDIT. Always a new immutable version on the parent's answer with
 * parent_version_id set. Approvals bind version ids, so nothing carries
 * forward: the child starts unapproved and the parent keeps its decisions.
 */
export async function createChildVersion(
  storage: VaultStorage,
  secret: string,
  input: ChildVersionInput,
): Promise<VersionRecord> {
  const parent = await storage.get<VersionRecord>('versions', input.parent_version_id)
  if (!parent) throw new VaultNotFoundError(`parent version not found: ${input.parent_version_id}`)
  const title = input.title ?? (await decryptVersionTitle(secret, parent))
  return createVersion(storage, secret, {
    answer_id: parent.answer_id,
    parent_version_id: parent.id,
    title,
    body: input.body,
    method: input.method ?? 'manual',
    provenance: input.provenance ?? null,
    provider: input.provider ?? null,
    model: input.model ?? null,
    observed_flags: input.observed_flags,
    derived_from: null,
    evidence_ids: input.evidence_ids,
  })
}

/**
 * LF-18 authoritative ordering for approval records: `seq` (storage-side
 * total order) when both records carry it; otherwise the legacy (at, id)
 * wall-clock order for pre-LF-18 rows. Mixed pairs also fall back to
 * (at, id) — there is no meaningful way to compare a ledger sequence
 * against a timestamp.
 */
export function compareApprovals(a: ApprovalRecord, b: ApprovalRecord): number {
  if (a.seq != null && b.seq != null) return a.seq - b.seq
  // Mixed pairs: seq-bearing rows post-date legacy rows by construction —
  // a legacy approval's wall-clock at can be skewed and must not outrank a
  // seq'd revocation (LF-APPROVAL-01).
  if (a.seq != null) return 1
  if (b.seq != null) return -1
  return a.at.localeCompare(b.at) || a.id.localeCompare(b.id)
}

/** All decisions for one version (or every version), oldest → newest. */
export async function listApprovals(
  storage: VaultStorage,
  versionId?: string,
): Promise<ApprovalRecord[]> {
  const all = await storage.getAll<ApprovalRecord>('approvals')
  return all.filter((a) => !versionId || a.version_id === versionId).sort(compareApprovals)
}

/** Audit ledger, oldest → newest. Optionally filter by event kind. */
export async function listEvents(
  storage: VaultStorage,
  kind?: string,
): Promise<EventRecord[]> {
  const all = await storage.getAll<EventRecord>('events')
  return all.filter((e) => !kind || e.kind === kind).sort((a, b) => a.seq - b.seq)
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

/** Sign a frozen packet. One signoff per packet; signature is optional
    (declared sign-off allowed).
    IR-024: a cryptographic signature is verified against the packet's
    stored manifest digest AT THIS BOUNDARY — the primitive itself.
    A signature that fails verification is refused outright; an absent
    signature is a legitimate unsigned acknowledgement.
    NOTE: this primitive awaits WebCrypto and therefore must NOT be called
    inside an IDB transaction (the tx auto-commits mid-call and later writes
    throw TransactionInactiveError). The governed path attestPacket writes
    its signoff inside its own tx with a signature it verified pre-tx. */
export async function signPacket(
  storage: VaultStorage,
  input: {
    packet_id: string
    signer_class: ActorClass | SignerClass
    signature_b64?: string | null
    pubkey_b64?: string | null
    // LF-PACKET-02: the primitive is public but still requires the explicit
    // ack — the governed wrapper (signoff.ts attestPacket) adds state checks.
    user_ack?: boolean
  },
): Promise<SignoffRecord> {
  if (input.user_ack !== true)
    throw new Error('packet sign-off requires explicit user acknowledgement')
  const packet = await storage.get<PacketRecord>('packets', input.packet_id)
  if (!packet) throw new VaultNotFoundError(`packet not found: ${input.packet_id}`)

  let signatureVerified = false
  if (input.signature_b64) {
    if (!input.pubkey_b64)
      throw new Error('signature presented without its verification key')
    const ok = await verifyManifestSignature(
      input.pubkey_b64,
      packet.manifest_sha256,
      input.signature_b64,
    )
    if (!ok)
      throw new Error('signature verification failed — forged or mismatched signature refused')
    signatureVerified = true
  }

  const record: SignoffRecord = {
    packet_id: input.packet_id,
    signer_class: input.signer_class,
    timestamp: nowIso(),
    signature_b64: input.signature_b64 ?? null,
    pubkey_b64: input.pubkey_b64 ?? null,
    signature_verified: signatureVerified,
  }
  const inserted = await storage.putIfAbsent('signoffs', record.packet_id, record)
  if (!inserted) throw new VaultImmutableError(`packet already signed: ${input.packet_id}`)
  return record
}
