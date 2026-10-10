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
  ImportRecord,
  PacketRecord,
  ProvenanceRecord,
  SignoffRecord,
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
  versions: Array<Omit<VersionRecord, 'body'> & { body_plaintext: string }>
  approvals: ApprovalRecord[]
  packets: PacketRecord[]
  provenance: ProvenanceRecord[]
  imports: ImportRecord[]
  signoffs: SignoffRecord[]
  catalog_cache: CatalogCacheRecord[]
}

/** Export the full vault to a portable, encrypted JSON string. Requires the secret to decrypt bodies. */
export async function exportVault(storage: VaultStorage, secret: string): Promise<string> {
  const versions = await storage.getAll<VersionRecord>('versions')
  const plainVersions = [] as BackupPayload['versions']
  for (const v of versions) {
    const bodyPlaintext = await decryptText(secret, JSON.parse(v.body))
    const { body: _enc, ...rest } = v
    plainVersions.push({ ...rest, body_plaintext: bodyPlaintext })
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
    catalog_cache: await storage.getAll<CatalogCacheRecord>('catalog_cache'),
  }
  const blob = await encryptText(secret, canonicalJson(payload))
  return JSON.stringify({ format: 'aqua-local-backup', ...blob }, null, 2)
}

export interface ImportResult {
  batch_id: string
  counts: Record<string, number>
  skipped_duplicates: number
}

/** Import an encrypted backup. Refuses wrong secret, wrong format version, and tampered data. */
export async function importVault(
  storage: VaultStorage,
  secret: string,
  exportedJson: string,
): Promise<ImportResult> {
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

  // Integrity: recompute each version sha256 over canonical plaintext before writing anything.
  for (const v of payload.versions ?? []) {
    const digest = await sha256Hex(canonicalJson({ title: v.title, body: v.body_plaintext }))
    if (digest !== v.sha256) {
      throw new VaultTamperError(`version ${v.id} sha256 mismatch — refusing tampered backup`)
    }
  }

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
      | 'catalog_cache',
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
    const { body_plaintext, ...rest } = v
    const blob = await encryptText(secret, body_plaintext)
    const record: VersionRecord = { ...rest, body: JSON.stringify(blob), immutable: true }
    await dedupePut('versions', v.id, record)
  }
  for (const a of payload.approvals ?? []) {
    sourceIds.push(a.id)
    await dedupePut('approvals', a.id, a)
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
    await dedupePut('signoffs', s.packet_id, s)
  }
  for (const c of payload.catalog_cache ?? []) {
    await dedupePut('catalog_cache', c.key, c)
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
