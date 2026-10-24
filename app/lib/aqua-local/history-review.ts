// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// M09b — read model + action helper for the browser "Confirm submitted
// history" screen (app/(app)/history). Lists the submitted-history records a
// Restore brought in (companion `import-history` → `export-backup`), grouped
// by application and submission date, and confirms the ones the user selects
// through repo.ts recordHistoryAttestation — the vault write that enforces
// the hash binding and the placeholder rule. Nothing here approves on its
// own; nothing is preselected.
//
// Not vendored into the companion (it reads the browser vault stores).

import { decryptField } from './crypto.ts'
import { readVersion, listApprovals, recordHistoryAttestation, verifyHistoryMeta, VaultPlaceholderError, VaultApprovalMismatchError, VaultHistoryMetaMismatchError } from './repo.ts'
import { approvalGate } from './status.ts'
import { describePlaceholders, findPlaceholders, normalizeEffectiveAt, HISTORY_META_MISMATCH_REASON, type HistoryMeta, type HistoryMetaHashStatus, type HistoryParseConfidence } from './history.ts'
import type { AnswerRecord, AppInstanceRecord, ReviewRecord, VersionRecord } from './schema.ts'
import type { VaultStorage } from './vault.ts'

export const DATE_UNKNOWN_REASON =
  'Submission date unknown: re-run aqua-companion import-history with --date YYYY-MM-DD'

export const DEFAULT_ATTESTATION_STATEMENT =
  'I confirm that I submitted each selected answer, exactly as shown, on the date listed next to it.'

const EXCERPT_CHARS = 280

export interface HistoryItem {
  version_id: string
  sha256: string
  application_id: string | null
  question: string
  title: string
  body: string
  excerpt: string
  submitted_at: string | null
  date_source: HistoryMeta['date_source']
  flags: string[]
  /** Recomputed from the decrypted body (the importer's scan is not trusted). */
  placeholder_markers: string[]
  source_file: string | null
  /** Importer's split confidence; null for imports that predate it. */
  parse_confidence: HistoryParseConfidence | null
  parse_notes: string[]
  /** G18: 'verified' = metadata hash matches; 'legacy' = imported before hashing (flagged, still confirmable); 'mismatch' = tampered (never confirmable). */
  meta_hash_status: HistoryMetaHashStatus
  /** Low confidence: the user must mark the item as reviewed before it can be selected. */
  needs_review: boolean
  /** null = selectable; otherwise why it cannot be confirmed. */
  disabled_reason: string | null
  status: 'pending' | 'confirmed'
  /** effective_at of the live confirmation, when status is confirmed. */
  confirmed_effective_at: string | null
}

export interface HistoryGroup {
  key: string
  application_id: string | null
  program: string
  submitted_at: string | null
  items: HistoryItem[]
}

function excerptOf(body: string): string {
  const t = body.replace(/\s+/g, ' ').trim()
  return t.length <= EXCERPT_CHARS ? t : `${t.slice(0, EXCERPT_CHARS)}…`
}

async function programOf(storage: VaultStorage, secret: string, appId: string | null, cache: Map<string, string | null>): Promise<string | null> {
  if (!appId) return null
  if (cache.has(appId)) return cache.get(appId) ?? null
  let title: string | null = null
  const all = await storage.getAll<AppInstanceRecord>('app_instances')
  const inst = all.find((i) => i.application_id === appId || i.instance_id === appId)
  if (inst?.local_template_enc) {
    try {
      title = (JSON.parse(await decryptField(secret, inst.local_template_enc)) as { title?: string }).title ?? null
    } catch {
      title = null
    }
  }
  cache.set(appId, title)
  return title
}

/**
 * Every submitted-history record in the vault, grouped by application and
 * submission date (newest date first; unknown dates last). Placeholders are
 * re-scanned on the decrypted body; items with placeholders or without a
 * valid submission date carry a `disabled_reason`.
 */
export async function listHistoryCandidates(storage: VaultStorage, secret: string): Promise<HistoryGroup[]> {
  const versions = (await storage.getAll<VersionRecord>('versions')).filter((v) => v.history === true)
  if (!versions.length) return []
  const approvals = await listApprovals(storage)
  // A later human reopening review (needs_revision / needs_evidence) blocks
  // the approval in the freeze gate, so it must here too (M09 review, LOW).
  const reviews = await storage.getAll<ReviewRecord>('reviews')
  const answers = new Map((await storage.getAll<AnswerRecord>('answers')).map((a) => [a.id, a]))
  const programCache = new Map<string, string | null>()
  const groups = new Map<string, HistoryGroup>()
  for (const v of versions) {
    const verified = await verifyHistoryMeta(secret, v)
    const metaStatus = verified.status
    // tampered metadata is never displayed as if it were the import's details
    const meta = metaStatus === 'mismatch' ? null : verified.meta
    const { title, body } = await readVersion(storage, secret, v.id)
    const appId = answers.get(v.answer_id)?.scope.application_id ?? null
    const program = meta?.program || (await programOf(storage, secret, appId, programCache)) || 'Unnamed application'
    const submitted = typeof meta?.submitted_at === 'string' && normalizeEffectiveAt(meta.submitted_at) ? meta.submitted_at : null
    const markers = findPlaceholders(body)
    // For a history version the gate already requires a live attestation.
    const gate = approvalGate(v, approvals, reviews)
    const confirmed = gate.approved
    const attestation = confirmed
      ? approvals.filter((a) => a.version_id === v.id && a.via === 'history_attestation' && !a.restored_from_backup && a.version_sha256 === v.sha256).at(-1) ?? null
      : null
    const disabled_reason = confirmed
      ? 'Already confirmed as submitted.'
      : metaStatus === 'mismatch'
        ? HISTORY_META_MISMATCH_REASON
        : markers.length
          ? describePlaceholders(markers)
          : !submitted
            ? DATE_UNKNOWN_REASON
            : null
    const item: HistoryItem = {
      version_id: v.id,
      sha256: v.sha256,
      application_id: appId,
      question: typeof meta?.question === 'string' && meta.question ? meta.question : title,
      title,
      body,
      excerpt: excerptOf(body),
      submitted_at: submitted,
      date_source: meta?.date_source ?? null,
      flags: Array.isArray(meta?.flags) ? meta!.flags!.filter((f) => typeof f === 'string') : [],
      placeholder_markers: markers,
      source_file: typeof meta?.source_file === 'string' ? meta.source_file : null,
      parse_confidence: null,
      parse_notes: [],
      meta_hash_status: metaStatus,
      needs_review: false,
      disabled_reason,
      status: confirmed ? 'confirmed' : 'pending',
      confirmed_effective_at: attestation?.effective_at ?? null,
    }
    item.parse_confidence = meta?.parse_confidence === 'high' || meta?.parse_confidence === 'medium' || meta?.parse_confidence === 'low' ? meta.parse_confidence : null
    item.parse_notes = Array.isArray(meta?.parse_notes) ? meta!.parse_notes!.filter((n) => typeof n === 'string') : []
    item.needs_review = item.parse_confidence === 'low' && item.status === 'pending' && !item.disabled_reason
    const key = `${appId ?? program}|${submitted ?? 'unknown'}`
    const g = groups.get(key) ?? { key, application_id: appId, program, submitted_at: submitted, items: [] }
    g.items.push(item)
    groups.set(key, g)
  }
  return [...groups.values()].sort((a, b) => {
    if (a.submitted_at === b.submitted_at) return a.program.localeCompare(b.program)
    if (!a.submitted_at) return 1
    if (!b.submitted_at) return -1
    return b.submitted_at.localeCompare(a.submitted_at)
  })
}

/** Items the user could still confirm (no placeholder, known date, not yet confirmed). */
export async function countPendingHistory(storage: VaultStorage, secret: string): Promise<number> {
  const groups = await listHistoryCandidates(storage, secret)
  return groups.reduce((n, g) => n + g.items.filter((i) => i.status === 'pending' && !i.disabled_reason).length, 0)
}

/** Records with `history: true` (no decryption) — used after a Restore. */
export async function countHistoryRecords(storage: VaultStorage): Promise<number> {
  return (await storage.getAll<VersionRecord>('versions')).filter((v) => v.history === true).length
}

/** The screen's gate: something selected, the attestation ticked, a statement typed. */
export function canConfirm(input: { selected: ReadonlySet<string> | string[]; attested: boolean; statement: string }): boolean {
  const n = Array.isArray(input.selected) ? input.selected.length : input.selected.size
  return n > 0 && input.attested === true && input.statement.trim().length > 0
}

export interface ConfirmResult {
  version_id: string
  ok: boolean
  approval_id?: string
  error?: string
}

/**
 * Confirm the selected items as submitted. Each goes through
 * recordHistoryAttestation (hash-bound, placeholder rule enforced in the
 * vault write); per-item refusals are reported, never hidden.
 */
export async function confirmHistorySelection(
  storage: VaultStorage,
  secret: string,
  input: { items: Pick<HistoryItem, 'version_id' | 'sha256' | 'submitted_at'>[]; attested: boolean; statement: string; actor_id: string },
): Promise<ConfirmResult[]> {
  if (!canConfirm({ selected: input.items.map((i) => i.version_id), attested: input.attested, statement: input.statement })) {
    throw new Error('Select at least one answer, tick the attestation and keep a statement before confirming.')
  }
  const out: ConfirmResult[] = []
  for (const item of input.items) {
    try {
      if (!item.submitted_at) throw new Error(DATE_UNKNOWN_REASON)
      const a = await recordHistoryAttestation(storage, secret, {
        version_id: item.version_id,
        expected_sha256: item.sha256,
        effective_at: item.submitted_at,
        statement: input.statement.trim(),
        actor_id: input.actor_id,
      })
      out.push({ version_id: item.version_id, ok: true, approval_id: a.id })
    } catch (e) {
      const msg =
        e instanceof VaultPlaceholderError
          ? describePlaceholders(e.markers)
          : e instanceof VaultHistoryMetaMismatchError
            ? HISTORY_META_MISMATCH_REASON
          : e instanceof VaultApprovalMismatchError
            ? 'The answer changed since it was shown; reload and check it again.'
            : e instanceof Error
              ? e.message
              : String(e)
      out.push({ version_id: item.version_id, ok: false, error: msg })
    }
  }
  return out
}
