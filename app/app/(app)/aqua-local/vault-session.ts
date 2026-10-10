// Thin page-level adapter over app/lib/aqua-local (LF-10/11/15).
// UI code calls ONLY this adapter + repo functions re-exported here; it owns
// no domain logic of its own. The vault lib is the authority — do not patch
// around it. The user secret is held in React state only (never persisted).

import {
  openVaultStorage,
  createAnswer,
  createVersion,
  readVersion,
  approveVersion,
  exportVault,
  VaultDecryptError,
  VaultBlankBodyError,
  VaultScopeError,
  VaultNotFoundError,
} from '@/lib/aqua-local'
import type {
  VaultStorage,
  AnswerRecord,
  ApprovalRecord,
  ProvenanceRecord,
  VersionRecord,
  VersionMethod,
} from '@/lib/aqua-local'

export { VaultDecryptError, VaultBlankBodyError, VaultScopeError, VaultNotFoundError }
export type { VaultStorage, VersionMethod }

/** Reserved scope for LF-12 local onboarding answers. */
export const ONBOARDING_APPLICATION_ID = 'local-onboarding'

/** A version row enriched with its latest approval + provenance receipt. */
export interface BankVersion {
  record: VersionRecord
  approval: 'approved' | 'rejected' | null
  provenance: ProvenanceRecord | null
}

export interface BankEntry {
  answer: AnswerRecord
  versions: BankVersion[] // ascending by created_at — last is newest
}

let storagePromise: Promise<VaultStorage> | null = null

/**
 * Open the IndexedDB vault (memoized per page session). F-UI1: the DB name is
 * keyed to the authenticated user id so two accounts sharing a browser
 * profile get isolated vaults; anonymous fallback keeps a shared vault.
 */
export async function getStorage(): Promise<VaultStorage> {
  if (!storagePromise) {
    storagePromise = (async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const { data } = await createClient().auth.getUser()
        const uid = data.user?.id
        return openVaultStorage(uid ? `aqua-local-${uid}` : 'aqua-local')
      } catch {
        return openVaultStorage('aqua-local')
      }
    })()
  }
  return storagePromise
}

/**
 * Attempt unlock. The vault has no stored verifier by design — correctness is
 * proven by decrypting a real version. Empty vault → any secret is accepted
 * (it becomes the vault secret). Wrong secret → VaultDecryptError.
 */
export async function tryUnlock(storage: VaultStorage, secret: string): Promise<'ok' | 'empty'> {
  const versions = await storage.getAll<VersionRecord>('versions')
  if (versions.length === 0) return 'empty'
  // Deterministic probe: oldest version.
  const sorted = [...versions].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  )
  await readVersion(storage, secret, sorted[0].id) // throws VaultDecryptError on wrong secret
  return 'ok'
}

/** Load the whole Answer Bank: answers + versions + latest approval + provenance. */
export async function loadBank(storage: VaultStorage): Promise<BankEntry[]> {
  const [answers, versions, approvals, provenance] = await Promise.all([
    storage.getAll<AnswerRecord>('answers'),
    storage.getAll<VersionRecord>('versions'),
    storage.getAll<ApprovalRecord>('approvals'),
    storage.getAll<ProvenanceRecord>('provenance'),
  ])

  // Latest approval wins per version (records are append-only).
  const approvalByVersion = new Map<string, ApprovalRecord>()
  for (const a of approvals.sort((x, y) => x.at.localeCompare(y.at) || x.id.localeCompare(y.id))) {
    approvalByVersion.set(a.version_id, a)
  }
  const provenanceByVersion = new Map<string, ProvenanceRecord>()
  for (const p of provenance) provenanceByVersion.set(p.version_id, p)

  const byAnswer = new Map<string, BankVersion[]>()
  for (const v of versions) {
    // F-UI2: an approval only displays when its pinned sha matches the stored
    // version — a swapped version row must not still look "Approved".
    const ap = approvalByVersion.get(v.id)
    const bv: BankVersion = {
      record: v,
      approval: ap && ap.version_sha256 === v.sha256 ? ap.decision : null,
      provenance: provenanceByVersion.get(v.id) ?? null,
    }
    const list = byAnswer.get(v.answer_id) ?? []
    list.push(bv)
    byAnswer.set(v.answer_id, list)
  }

  return answers
    .map((answer) => ({
      answer,
      versions: (byAnswer.get(answer.id) ?? []).sort(
        (a, b) =>
          a.record.created_at.localeCompare(b.record.created_at) ||
          a.record.id.localeCompare(b.record.id),
      ),
    }))
    .sort((a, b) => {
      const at = a.versions.at(-1)?.record.created_at ?? a.answer.created_at
      const bt = b.versions.at(-1)?.record.created_at ?? b.answer.created_at
      return bt.localeCompare(at)
    })
}

export interface SaveVersionInput {
  /** Existing answer id, or null to create a new answer under `scope`. */
  answer_id: string | null
  scope?: { application_id: string; question_occurrence_id: string }
  parent_version_id?: string | null
  title: string
  body: string
  method?: VersionMethod
  provenance?: string | null
}

/**
 * Save = always a new immutable version. Editing an approved version produces
 * a child version (parent link set); the prior approval stays attached to the
 * parent's sha256 — approvals never transfer forward silently.
 */
export async function saveVersion(
  storage: VaultStorage,
  secret: string,
  input: SaveVersionInput,
): Promise<VersionRecord> {
  let answerId = input.answer_id
  if (!answerId) {
    const scope = input.scope
    if (!scope?.application_id || !scope.question_occurrence_id) {
      throw new VaultScopeError('new answer requires application_id and question_occurrence_id')
    }
    const answer = await createAnswer(storage, scope)
    answerId = answer.id
  }
  return createVersion(storage, secret, {
    answer_id: answerId,
    parent_version_id: input.parent_version_id ?? null,
    title: input.title,
    body: input.body,
    method: input.method ?? 'manual',
    provenance: input.provenance ?? null,
  })
}

/** Decrypt a version body for editing/preview. Throws VaultDecryptError. */
export function readBody(
  storage: VaultStorage,
  secret: string,
  versionId: string,
): Promise<{ title: string; body: string }> {
  return readVersion(storage, secret, versionId).then(({ title, body }) => ({ title, body }))
}

export function approve(
  storage: VaultStorage,
  versionId: string,
  decision: 'approved' | 'rejected',
): Promise<ApprovalRecord> {
  return approveVersion(storage, { version_id: versionId, decision, actor_class: 'human' })
}

/** LF-15 backup-reminder bookkeeping — a localStorage timestamp, nothing private. */
const LAST_BACKUP_KEY = 'aqua-local:last-backup-at'
export const BACKUP_REMINDER_MS = 7 * 24 * 60 * 60 * 1000

export function lastBackupAt(): number | null {
  if (typeof localStorage === 'undefined') return null
  const v = localStorage.getItem(LAST_BACKUP_KEY)
  const t = v ? Date.parse(v) : NaN
  return Number.isFinite(t) ? t : null
}

/** Export an encrypted backup and trigger a user-initiated file download. */
export async function downloadBackup(storage: VaultStorage, secret: string): Promise<string> {
  const json = await exportVault(storage, secret)
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `aqua-local-backup-${stamp}.json`
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString())
  return filename
}
