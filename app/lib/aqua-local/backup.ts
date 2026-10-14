// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// LF-09 — encrypted backup export/import.
//   - Export: all domain records (bodies decrypted) → canonical JSON →
//     AES-GCM-256 under a fresh PBKDF2 salt/iv from the SAME user secret →
//     portable JSON envelope.
//   - Import: envelope decrypt (wrong secret / tampered → refuse),
//     format-version migration guard, per-version sha256 verification,
//     dedup by id across every store, and an `imports` ledger entry.

import {
  canonicalJson,
  decryptText,
  encryptText,
  newId,
  nowIso,
  sha256Hex,
} from './crypto.ts'
import { VaultDecryptError } from './crypto.ts'
import type { VaultStorage } from './vault.ts'
import type {
  AnswerRecord,
  ApprovalRecord,
  CatalogCacheRecord,
  EventRecord,
  ImportRecord,
  PacketRecord,
  PacketStateRecord,
  ProvenanceRecord,
  SignoffRecord,
  StoreName,
  VersionRecord,
} from './schema.ts'

export const BACKUP_FORMAT_VERSION = 1

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
}

/** Export the full vault to a portable, encrypted JSON string. Requires the secret to decrypt bodies. */
export async function exportVault(storage: VaultStorage, secret: string): Promise<string> {
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

  // Version migration guard: refuse newer formats; older than supported also refused (none exist at v1).
  if (typeof payload.format_version !== 'number' || payload.format_version > BACKUP_FORMAT_VERSION) {
    throw new VaultBackupVersionError(
      `backup format_version ${payload.format_version} is newer than supported ${BACKUP_FORMAT_VERSION}`,
    )
  }
  if (payload.format_version < 1) {
    throw new VaultBackupVersionError(`backup format_version ${payload.format_version} unsupported`)
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
  ], ['title', 'title_plaintext'])
  requireList('approvals', payload.approvals, 'id', ['version_id'])
  requireList('packets', payload.packets, 'id')
  requireList('provenance', payload.provenance, 'version_id')
  requireList('imports', payload.imports, 'batch_id')
  requireList('signoffs', payload.signoffs, 'packet_id')
  requireList('packet_states', payload.packet_states, 'packet_id')
  requireList('catalog_cache', payload.catalog_cache, 'key')
  requireList('events', payload.events, 'id')

  // Integrity: recompute each version sha256 over canonical plaintext before writing anything.
  for (const v of payload.versions ?? []) {
    if (typeof v.title_plaintext !== 'string' && typeof v.title !== 'string') {
      throw new VaultTamperError(`version ${v.id} has no title field`)
    }
    const digest = await sha256Hex(canonicalJson({ title: v.title_plaintext ?? v.title, body: v.body_plaintext }))
    if (digest !== v.sha256) {
      throw new VaultTamperError(`version ${v.id} sha256 mismatch — refusing tampered backup`)
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
      | 'events',
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
  for (const p of payload.packets ?? []) {
    sourceIds.push(p.id)
    await dedupePut('packets', p.id, p)
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

  const batch: ImportRecord = {
    batch_id: newId(),
    source_ids: sourceIds,
    counts,
    at: nowIso(),
  }
  await storage.put('imports', batch)
  return { batch_id: batch.batch_id, counts, skipped_duplicates: skipped }
}
