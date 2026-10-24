// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// LF-09 — encrypted backup export/import.
//   - Export: all domain records (bodies decrypted) → canonical JSON →
//     AES-GCM-256 under a fresh PBKDF2 salt/iv from the SAME user secret →
//     portable JSON envelope.
//   - Import: envelope decrypt (wrong secret / tampered → refuse),
//     format-version migration guard, per-version sha256 verification,
//     dedup by id across every store, and an `imports` ledger entry.
//
// v5 / BACKUP_FORMAT_VERSION 2 — adds app_instances, facts, evidence,
// reviews, comments, suggestions. Their free-text fields are already
// `*_enc` ciphertext under the vault secret; the backup secret IS the vault
// secret (restore requires assertVaultSecretCompatible), so they travel
// as-is inside the encrypted envelope. v1 backups (no v5 arrays) restore
// unchanged. On restore, records that carry DECISIONS are marked
// `restored_from_backup` (approvals, signoffs as before; reviews and
// suggestions in v5) and reviews lose their imported `seq`, so a file can
// never outrank or satisfy a fresh local decision.

import {
  canonicalJson,
  decryptText,
  encryptText,
  newId,
  nowIso,
  sha256Hex,
} from './crypto.ts'
import { VaultDecryptError, decryptField } from './crypto.ts'
import { checkHistoryMetaHash } from './history.ts'
import type { VaultStorage } from './vault.ts'
import type {
  AnswerRecord,
  AppInstanceRecord,
  ApprovalRecord,
  CatalogCacheRecord,
  CommentRecord,
  EventRecord,
  EvidenceRecord,
  FactRecord,
  ImportRecord,
  PacketRecord,
  PacketStateRecord,
  ProvenanceRecord,
  ReviewRecord,
  SignoffRecord,
  StoreName,
  SuggestionRecord,
  VersionRecord,
} from './schema.ts'

export const BACKUP_FORMAT_VERSION = 2

export class VaultTamperError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultTamperError'
  }
}

export class VaultBackupVersionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultBackupVersionError'
  }
}

interface BackupPayload {
  format_version: number
  exported_at: string
  answers: AnswerRecord[]
  versions: Array<Omit<VersionRecord, 'body' | 'title' | 'title_enc'> & { title_plaintext: string; body_plaintext: string; title?: string }>
  approvals: ApprovalRecord[]
  packets: PacketRecord[]
  provenance: ProvenanceRecord[]
  imports: ImportRecord[]
  signoffs: SignoffRecord[]
  packet_states?: PacketStateRecord[]
  catalog_cache: CatalogCacheRecord[]
  /** LF-18 audit ledger — portable so a restored vault keeps its receipts. */
  events?: EventRecord[]
  // v2 (vault v5) — absent in v1 files
  app_instances?: AppInstanceRecord[]
  facts?: FactRecord[]
  evidence?: EvidenceRecord[]
  reviews?: ReviewRecord[]
  comments?: CommentRecord[]
  suggestions?: SuggestionRecord[]
  /** M09 hardening: account fingerprint INSIDE the encrypted (authenticated)
      payload — HMAC-SHA256 of the vault uid keyed by the vault secret.
      Absent on older backups (= account unknown). */
  account_fp?: string
  account_fp_scheme?: typeof BACKUP_ACCOUNT_FP_SCHEME
}

// ---------------------------------------------------------------------------
// Account fingerprint (M09 hardening)
// ---------------------------------------------------------------------------
// Lets a consumer of the backup (aqua-companion import-backup) bind a
// workspace to the account automatically, and refuse another account's
// backup, without the account id ever appearing in the file: the value is
// keyed by the vault secret, so it cannot be computed or correlated without
// it, and it sits inside the AES-GCM payload, so it cannot be swapped.

export const BACKUP_ACCOUNT_FP_SCHEME = 'hmac-sha256:vault-secret:v1'
const ACCOUNT_FP_PREFIX = 'aqua-vault-account:v1:'

/** HMAC-SHA256(key = vault secret, msg = 'aqua-vault-account:v1:' + lowercased uid), hex. */
export async function backupAccountFingerprint(secret: string, uid: string): Promise<string> {
  const norm = String(uid ?? '').trim().toLowerCase()
  if (!norm) throw new Error('account uid is empty')
  const enc = new TextEncoder()
  const key = await globalThis.crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(ACCOUNT_FP_PREFIX + norm)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 'match' / 'mismatch' when the backup carries an account fingerprint,
 * 'unknown' when it does not (older backups). Decrypts + verifies the file.
 */
export async function backupAccountStatus(
  secret: string,
  exportedJson: string,
  uid: string | null,
): Promise<'match' | 'mismatch' | 'unknown'> {
  const payload = await decryptBackupPayload(secret, exportedJson)
  if (!payload.account_fp || payload.account_fp_scheme !== BACKUP_ACCOUNT_FP_SCHEME || !uid) return 'unknown'
  return payload.account_fp === (await backupAccountFingerprint(secret, uid)) ? 'match' : 'mismatch'
}

/**
 * Export the full vault to a portable, encrypted JSON string. Requires the
 * secret to decrypt bodies. With `account_uid` (the signed-in vault uid) the
 * payload carries the account fingerprint above.
 */
export async function exportVault(
  storage: VaultStorage,
  secret: string,
  opts: { account_uid?: string | null } = {},
): Promise<string> {
  const versions = await storage.getAll<VersionRecord>('versions')
  const plainVersions = [] as BackupPayload['versions']
  for (const v of versions) {
    const bodyPlaintext = await decryptText(secret, JSON.parse(v.body))
    const titlePlaintext = v.title_enc
      ? await decryptText(secret, JSON.parse(v.title))
      : v.title
    const { body: _enc, title: _t, title_enc: _te, ...rest } = v
    plainVersions.push({ ...rest, title_plaintext: titlePlaintext, body_plaintext: bodyPlaintext })
  }
  const payload: BackupPayload = {
    format_version: BACKUP_FORMAT_VERSION,
    exported_at: nowIso(),
    answers: await storage.getAll<AnswerRecord>('answers'),
    versions: plainVersions,
    approvals: await storage.getAll<ApprovalRecord>('approvals'),
    packets: await storage.getAll<PacketRecord>('packets'),
    provenance: await storage.getAll<ProvenanceRecord>('provenance'),
    imports: await storage.getAll<ImportRecord>('imports'),
    signoffs: await storage.getAll<SignoffRecord>('signoffs'),
    packet_states: await storage.getAll<PacketStateRecord>('packet_states'),
    catalog_cache: await (async () => {
      const rows = await storage.getAll<CatalogCacheRecord>('catalog_cache')
      return Promise.all(rows.map(async (r) => {
        if (!r.blob_enc) return r
        const plain = JSON.parse(await decryptText(secret, JSON.parse(r.blob_enc))) as unknown
        const { blob_enc: _b, ...rest } = r
        return { ...rest, blob: plain }
      }))
    })(),
    events: await storage.getAll<EventRecord>('events'),
    app_instances: await storage.getAll<AppInstanceRecord>('app_instances'),
    facts: await storage.getAll<FactRecord>('facts'),
    evidence: await storage.getAll<EvidenceRecord>('evidence'),
    reviews: await storage.getAll<ReviewRecord>('reviews'),
    comments: await storage.getAll<CommentRecord>('comments'),
    suggestions: await storage.getAll<SuggestionRecord>('suggestions'),
  }
  if (opts.account_uid) {
    payload.account_fp = await backupAccountFingerprint(secret, opts.account_uid)
    payload.account_fp_scheme = BACKUP_ACCOUNT_FP_SCHEME
  }
  const blob = await encryptText(secret, canonicalJson(payload))
  return JSON.stringify({ format: 'aqua-local-backup', ...blob }, null, 2)
}

export interface ImportResult {
  batch_id: string
  counts: Record<string, number>
  skipped_duplicates: number
}

/**
 * Shared parse/decrypt/verify for import + preview. Every refusal happens
 * here, before any storage write: wrong secret, non-backup JSON, format
 * version, and per-version sha256 integrity.
 */
async function decryptBackupPayload(secret: string, exportedJson: string): Promise<BackupPayload> {
  let envelope: { format?: string; format_version?: number } & Record<string, unknown>
  try {
    envelope = JSON.parse(exportedJson)
  } catch {
    throw new VaultTamperError('backup is not valid JSON')
  }
  if (envelope.format !== 'aqua-local-backup') {
    throw new VaultTamperError('not an aqua-local backup envelope')
  }

  let payload: BackupPayload
  try {
    payload = JSON.parse(await decryptText(secret, envelope as never)) as BackupPayload
  } catch (err) {
    if (err instanceof VaultDecryptError) throw err
    throw new VaultTamperError('backup payload failed to decrypt/parse')
  }

  // Version migration guard: refuse newer formats; v1 and v2 are accepted
  // (v1 simply has no v5 store arrays).
  if (typeof payload.format_version !== 'number' || payload.format_version > BACKUP_FORMAT_VERSION) {
    throw new VaultBackupVersionError(
      `backup format_version ${payload.format_version} is newer than supported ${BACKUP_FORMAT_VERSION}`,
    )
  }
  if (payload.format_version < 1) {
    throw new VaultBackupVersionError(`backup format_version ${payload.format_version} unsupported`)
  }
  if (payload.account_fp !== undefined && !(typeof payload.account_fp === 'string' && /^[0-9a-f]{64}$/.test(payload.account_fp))) {
    throw new VaultTamperError('backup account_fp is malformed')
  }

  // Structural validation (FB7R-07): every store must be an array of objects
  // carrying its dedupe key field with the right types — before ANY write.
  // A malformed backup refuses wholesale instead of partially importing.
  const requireList = (
    store: string,
    list: unknown,
    keyField: string,
    extraFields: string[] = [],
    stringOnlyFields: string[] = [],
  ) => {
    if (list === undefined || list === null) return
    if (!Array.isArray(list)) {
      throw new VaultTamperError(`backup ${store} is not an array`)
    }
    for (const [i, rec] of list.entries()) {
      if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
        throw new VaultTamperError(`backup ${store}[${i}] is not an object`)
      }
      const r = rec as Record<string, unknown>
      for (const f of [keyField, ...extraFields]) {
        if (typeof r[f] !== 'string' || (r[f] as string).length === 0) {
          throw new VaultTamperError(`backup ${store}[${i}] missing/invalid field: ${f}`)
        }
      }
      for (const f of stringOnlyFields) {
        if (r[f] !== undefined && typeof r[f] !== 'string') {
          throw new VaultTamperError(`backup ${store}[${i}] field must be a string: ${f}`)
        }
      }
    }
  }
  requireList('answers', payload.answers, 'id')
  // title_plaintext is required to be a string but may be EMPTY — a saved
  // version can legitimately carry a blank title. The per-version sha256
  // check below still refuses tampered content.
  requireList('versions', payload.versions, 'id', [
    'answer_id',
    'sha256',
    'body_plaintext',
  ], ['title', 'title_plaintext', 'history_enc'])
  // M09b: history_attestation approvals carry effective_at + attestation_enc
  // (ciphertext under the vault secret — travels as-is, like other *_enc).
  requireList('approvals', payload.approvals, 'id', ['version_id'], ['via', 'effective_at', 'attestation_enc'])
  requireList('packets', payload.packets, 'id')
  requireList('provenance', payload.provenance, 'version_id')
  requireList('imports', payload.imports, 'batch_id')
  requireList('signoffs', payload.signoffs, 'packet_id')
  requireList('packet_states', payload.packet_states, 'packet_id')
  requireList('catalog_cache', payload.catalog_cache, 'key')
  requireList('events', payload.events, 'id')
  // v2 stores — encrypted fields must be strings when present.
  requireList('app_instances', payload.app_instances, 'instance_id', ['application_id'], ['local_template_enc'])
  requireList('facts', payload.facts, 'fact_version_id', ['fact_id', 'kind', 'key', 'value_enc'])
  requireList('evidence', payload.evidence, 'evidence_id', ['kind', 'title_enc', 'content_sha256'], ['excerpt_enc', 'url_enc'])
  requireList('reviews', payload.reviews, 'review_id', ['version_id', 'version_sha256', 'decision', 'actor_class'], ['rationale_enc'])
  requireList('comments', payload.comments, 'comment_id', ['version_id', 'version_sha256', 'thread_id', 'body_enc'])
  requireList('suggestions', payload.suggestions, 'suggestion_id', ['question_occurrence_id', 'kind', 'explanation_enc'], ['weaknesses_enc', 'unsupported_claims_enc'])

  // Integrity: recompute each version sha256 over canonical plaintext before writing anything.
  for (const v of payload.versions ?? []) {
    if (typeof v.title_plaintext !== 'string' && typeof v.title !== 'string') {
      throw new VaultTamperError(`version ${v.id} has no title field`)
    }
    const digest = await sha256Hex(canonicalJson({ title: v.title_plaintext ?? v.title, body: v.body_plaintext }))
    if (digest !== v.sha256) {
      throw new VaultTamperError(`version ${v.id} sha256 mismatch — refusing tampered backup`)
    }
    // G18: hashed history metadata must still match (unhashed legacy passes).
    if (v.history_enc) {
      let meta: unknown
      try {
        meta = JSON.parse(await decryptField(secret, v.history_enc))
      } catch {
        throw new VaultTamperError(`version ${v.id} history metadata could not be read — refusing tampered backup`)
      }
      if ((await checkHistoryMetaHash(meta as never, { version_id: v.id, version_sha256: v.sha256 })) === 'mismatch') {
        throw new VaultTamperError(`version ${v.id} history metadata hash mismatch — refusing tampered backup`)
      }
    }
  }
  return payload
}

/** Per-store preview line: what a restore would insert vs skip as duplicates. */
export interface BackupPreviewStore {
  total: number
  insert: number
  skip: number
}

export interface BackupPreview {
  format_version: number
  exported_at: string
  /** Per-store insert/skip counts keyed by store name. */
  stores: Record<string, BackupPreviewStore>
  total_insert: number
  total_skip: number
  /** Answer titles from the backup (decrypted) for user-facing preview. */
  version_titles: string[]
}

/**
 * Dry-run of importVault: decrypts + verifies the backup with `secret` and
 * computes what would be inserted vs skipped against the CURRENT vault —
 * without writing anything. Same refusals as importVault.
 */
export async function previewVaultImport(
  storage: VaultStorage,
  secret: string,
  exportedJson: string,
): Promise<BackupPreview> {
  const payload = await decryptBackupPayload(secret, exportedJson)

  const stores: Record<string, BackupPreviewStore> = {}
  const seenInFile = new Set<string>()
  const track = async (store: StoreName, key: string) => {
    const s = (stores[store] ??= { total: 0, insert: 0, skip: 0 })
    s.total++
    // In-file duplicates are skips — import's putIfAbsent writes the first
    // occurrence and skips the rest; preview reports the same outcome.
    const dedupeKey = `${store}:${key}`
    if (seenInFile.has(dedupeKey)) {
      s.skip++
      return
    }
    seenInFile.add(dedupeKey)
    const existing = await storage.get(store, key)
    if (existing === undefined) s.insert++
    else s.skip++
  }

  for (const a of payload.answers ?? []) await track('answers', a.id)
  for (const v of payload.versions ?? []) await track('versions', v.id)
  for (const a of payload.approvals ?? []) await track('approvals', a.id)
  for (const p of payload.packets ?? []) await track('packets', p.id)
  for (const p of payload.provenance ?? []) await track('provenance', p.version_id)
  for (const i of payload.imports ?? []) await track('imports', i.batch_id)
  for (const s of payload.signoffs ?? []) await track('signoffs', s.packet_id)
  for (const ps of payload.packet_states ?? []) await track('packet_states', ps.packet_id)
  for (const c of payload.catalog_cache ?? []) await track('catalog_cache', c.key)
  for (const e of payload.events ?? []) await track('events', e.id)
  for (const r of payload.app_instances ?? []) await track('app_instances', r.instance_id)
  for (const r of payload.facts ?? []) await track('facts', r.fact_version_id)
  for (const r of payload.evidence ?? []) await track('evidence', r.evidence_id)
  for (const r of payload.reviews ?? []) await track('reviews', r.review_id)
  for (const r of payload.comments ?? []) await track('comments', r.comment_id)
  for (const r of payload.suggestions ?? []) await track('suggestions', r.suggestion_id)

  const all = Object.values(stores)
  return {
    format_version: payload.format_version,
    exported_at: payload.exported_at,
    stores,
    total_insert: all.reduce((n, s) => n + s.insert, 0),
    total_skip: all.reduce((n, s) => n + s.skip, 0),
    version_titles: (payload.versions ?? []).map((v) => v.title_plaintext ?? v.title),
  }
}

/** Import an encrypted backup. Refuses wrong secret, wrong format version, and tampered data. */
export async function importVault(
  storage: VaultStorage,
  secret: string,
  exportedJson: string,
): Promise<ImportResult> {
  const payload = await decryptBackupPayload(secret, exportedJson)

  const counts: Record<string, number> = {}
  let skipped = 0
  const sourceIds: string[] = []

  const dedupePut = async (
    store:
      | 'answers'
      | 'versions'
      | 'approvals'
      | 'packets'
      | 'provenance'
      | 'imports'
      | 'signoffs'
      | 'packet_states'
      | 'catalog_cache'
      | 'events'
      | 'app_instances'
      | 'facts'
      | 'evidence'
      | 'reviews'
      | 'comments'
      | 'suggestions',
    key: string,
    value: unknown,
  ) => {
    const inserted = await storage.putIfAbsent(store, key, value)
    if (inserted) counts[store] = (counts[store] ?? 0) + 1
    else skipped++
    return inserted
  }

  for (const a of payload.answers ?? []) {
    sourceIds.push(a.id)
    await dedupePut('answers', a.id, a)
  }
  for (const v of payload.versions ?? []) {
    sourceIds.push(v.id)
    const { body_plaintext, title_plaintext, title: legacyTitle, ...rest } = v
    const blob = await encryptText(secret, body_plaintext)
    const titleBlob = await encryptText(secret, title_plaintext ?? legacyTitle)
    const record: VersionRecord = { ...rest, title: JSON.stringify(titleBlob), title_enc: true, body: JSON.stringify(blob), immutable: true }
    await dedupePut('versions', v.id, record)
  }
  // IR-003: imported approvals are claims, not fresh evidence. Strip the
  // imported `seq` — a forged high seq would otherwise outrank a REAL local
  // revocation (compareApprovals: seq'd rows always post-date seq-less
  // ones, so stripping is ordering-safe: local decisions still win) — and
  // mark them restored so freeze requires a fresh local decision.
  for (const a of payload.approvals ?? []) {
    sourceIds.push(a.id)
    const { seq: _stripped, ...rest } = a
    await dedupePut('approvals', a.id, { ...rest, restored_from_backup: true })
  }
  // M09 review M3: a restored packet is a claim, like a restored approval.
  // Mark it so export/sign re-verify it against THIS vault first; drop any
  // verification bookkeeping the file carried.
  for (const p of payload.packets ?? []) {
    sourceIds.push(p.id)
    const { unverified: _u, verified_at: _v, ...rest } = p as PacketRecord
    await dedupePut('packets', p.id, { ...rest, restored_from_backup: true })
  }
  for (const p of payload.provenance ?? []) {
    sourceIds.push(p.version_id)
    await dedupePut('provenance', p.version_id, p)
  }
  for (const i of payload.imports ?? []) {
    sourceIds.push(i.batch_id)
    await dedupePut('imports', i.batch_id, i)
  }
  for (const s of payload.signoffs ?? []) {
    sourceIds.push(s.packet_id)
    await dedupePut('signoffs', s.packet_id, { ...s, restored_from_backup: true })
  }
  for (const ps of payload.packet_states ?? []) {
    await dedupePut('packet_states', ps.packet_id, ps)
  }
  for (const c of payload.catalog_cache ?? []) {
    // IR-035: restored intake blobs re-encrypt under the target vault secret.
    if (c.key.startsWith('intake:') && c.blob !== undefined && !c.blob_enc) {
      const enc = await encryptText(secret, JSON.stringify(c.blob))
      const { blob: _b, ...rest } = c
      await dedupePut('catalog_cache', c.key, { ...rest, blob_enc: JSON.stringify(enc) })
    } else {
      await dedupePut('catalog_cache', c.key, c)
    }
  }
  // LF-18: imported events keep their original seq — they are historical
  // receipts, and new local events allocate above max(existing seq), so a
  // restore can never collide with or overwrite the ledger.
  for (const e of payload.events ?? []) {
    await dedupePut('events', e.id, e)
  }

  // v2 (vault v5) stores. Ciphertext fields travel as-is (same secret).
  for (const r of payload.app_instances ?? []) {
    sourceIds.push(r.instance_id)
    await dedupePut('app_instances', r.instance_id, r)
  }
  for (const r of payload.facts ?? []) {
    sourceIds.push(r.fact_version_id)
    await dedupePut('facts', r.fact_version_id, r)
  }
  for (const r of payload.evidence ?? []) {
    sourceIds.push(r.evidence_id)
    await dedupePut('evidence', r.evidence_id, r)
  }
  // Review decisions are decisions: restored + seq stripped (like approvals)
  // so they never govern status or block/satisfy freeze.
  for (const r of payload.reviews ?? []) {
    sourceIds.push(r.review_id)
    const { seq: _stripped, ...rest } = r
    await dedupePut('reviews', r.review_id, { ...rest, restored_from_backup: true })
  }
  for (const r of payload.comments ?? []) {
    sourceIds.push(r.comment_id)
    await dedupePut('comments', r.comment_id, r)
  }
  for (const r of payload.suggestions ?? []) {
    sourceIds.push(r.suggestion_id)
    await dedupePut('suggestions', r.suggestion_id, { ...r, restored_from_backup: true })
  }

  const batch: ImportRecord = {
    batch_id: newId(),
    source_ids: sourceIds,
    counts,
    at: nowIso(),
  }
  await storage.put('imports', batch)
  return { batch_id: batch.batch_id, counts, skipped_duplicates: skipped }
}
