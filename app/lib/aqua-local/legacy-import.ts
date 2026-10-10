// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// LF-24 — user-initiated legacy hosted-answer import into the vault.
//
// Boundary: this module NEVER fetches. The caller (UI lane) performs the
// authenticated GET /api/answers/export and passes the payload in — either
// directly to `importLegacyAnswers`, or via an injected `fetchExport`
// function to `runLegacyImport` (mirrors catalog.ts: fetched elsewhere,
// stored here). The server export is strictly read-only; nothing here
// mutates hosted rows.
//
// Guarantees:
//   - one AnswerRecord per legacy row under a dedicated import scope;
//     dedup by source_id on re-import (same payload twice = no duplicates)
//   - per-row server sha256 is re-verified against the canonical content
//     before writing; mismatches are flagged and skipped, never imported
//   - each version is created via createVersion(method 'imported') with
//     provenance back to the hosted row id; original created_at preserved
//   - an `imports` ledger entry records batch_id, source_ids, and counts

import { canonicalJson, newId, nowIso, sha256Hex } from './crypto.ts'
import { createAnswer, createVersion, isBlankBody } from './repo.ts'
import type { VaultStorage } from './vault.ts'
import type { ImportRecord } from './schema.ts'

export const LEGACY_EXPORT_FORMAT = 'aqua-legacy-answers'
export const LEGACY_EXPORT_FORMAT_VERSION = 1
export const LEGACY_IMPORT_APPLICATION_ID = 'legacy-import'

export class LegacyExportShapeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LegacyExportShapeError'
  }
}

export class LegacyExportUserMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LegacyExportUserMismatchError'
  }
}

/** One row of GET /api/answers/export payload. */
export interface LegacyExportRow {
  source_id: string
  archived_question_id: string | null
  question_text: string
  answer_content: string
  version: number | null
  word_count: number | null
  confidence: string | null
  created_at: string
  last_updated: string | null
  sha256: string
}

/** Full payload returned by GET /api/answers/export. */
export interface LegacyAnswersExport {
  format: string
  format_version: number
  user_id: string
  exported_at: string
  answers: LegacyExportRow[]
}

/** Caller-supplied fetch of the caller's own export (auth via session). */
export type FetchLegacyExportFn = () => Promise<LegacyAnswersExport>

export interface LegacyImportResult {
  batch_id: string
  imported: number
  skipped_duplicates: number
  /** source_ids whose server sha256 did not match the content — flagged, not imported. */
  sha_mismatches: string[]
  /** source_ids whose bodies were blank — refused by the vault blank-guard. */
  blank_skipped: string[]
  counts: Record<string, number>
}

function assertExportShape(payload: unknown): asserts payload is LegacyAnswersExport {
  const p = payload as LegacyAnswersExport | null
  if (!p || typeof p !== 'object') throw new LegacyExportShapeError('export payload is not an object')
  if (p.format !== LEGACY_EXPORT_FORMAT) {
    throw new LegacyExportShapeError(`unexpected export format: ${String(p.format)}`)
  }
  if (typeof p.format_version !== 'number' || p.format_version > LEGACY_EXPORT_FORMAT_VERSION) {
    throw new LegacyExportShapeError(
      `export format_version ${p.format_version} is newer than supported ${LEGACY_EXPORT_FORMAT_VERSION}`,
    )
  }
  if (!Array.isArray(p.answers)) throw new LegacyExportShapeError('export payload missing answers[]')
}

/**
 * Import a previously-fetched legacy export into the vault.
 * `opts.expectedUserId` — when provided (the vault owner's hosted user id),
 * a payload claiming a different user is refused: belt-and-suspenders on
 * top of the server-side session scoping.
 */
export async function importLegacyAnswers(
  storage: VaultStorage,
  secret: string,
  payload: LegacyAnswersExport,
  opts?: { expectedUserId?: string },
): Promise<LegacyImportResult> {
  assertExportShape(payload)
  if (opts?.expectedUserId && payload.user_id !== opts.expectedUserId) {
    throw new LegacyExportUserMismatchError(
      `export belongs to ${payload.user_id}, not the vault owner — refusing cross-account import`,
    )
  }

  // Dedup index: source_id → existing vault answer under the import scope.
  const existing = await storage.getAll<{ id: string; scope: { application_id: string; question_occurrence_id: string } }>(
    'answers',
  )
  const bySource = new Map<string, string>()
  for (const a of existing) {
    if (a.scope?.application_id === LEGACY_IMPORT_APPLICATION_ID) {
      bySource.set(a.scope.question_occurrence_id, a.id)
    }
  }

  let imported = 0
  let skippedDuplicates = 0
  const shaMismatches: string[] = []
  const blankSkipped: string[] = []
  const sourceIds: string[] = []

  for (const row of payload.answers) {
    if (!row || typeof row.source_id !== 'string' || !row.source_id) continue
    sourceIds.push(row.source_id)

    if (bySource.has(row.source_id)) {
      skippedDuplicates++
      continue
    }

    const title = row.question_text ?? ''
    const body = row.answer_content ?? ''

    // Integrity: server sha must match the canonical content.
    if (typeof row.sha256 !== 'string' || (await sha256Hex(canonicalJson({ title, body }))) !== row.sha256) {
      shaMismatches.push(row.source_id)
      continue
    }

    if (isBlankBody(body)) {
      blankSkipped.push(row.source_id)
      continue
    }

    const answer = await createAnswer(storage, {
      application_id: LEGACY_IMPORT_APPLICATION_ID,
      question_occurrence_id: row.source_id,
    })
    const version = await createVersion(storage, secret, {
      answer_id: answer.id,
      title,
      body,
      method: 'imported',
      provenance: `legacy-import:${row.source_id}`,
      observed_flags: { server_sha256_verified: true },
    })

    // Provenance preservation: stamp the version with the hosted row's
    // original created_at. This is part of the creation event (import
    // provenance), not a post-hoc edit — `immutable` stays true and the
    // sha256 over canonical content is unchanged.
    if (row.created_at && row.created_at !== version.created_at) {
      await storage.put('versions', { ...version, created_at: row.created_at })
    }

    bySource.set(row.source_id, answer.id)
    imported++
  }

  const counts: Record<string, number> = {
    imported,
    skipped_duplicates: skippedDuplicates,
    sha_mismatch: shaMismatches.length,
    blank_skipped: blankSkipped.length,
  }
  const batch: ImportRecord = {
    batch_id: newId(),
    source_ids: sourceIds,
    counts,
    at: nowIso(),
  }
  await storage.put('imports', batch)

  return {
    batch_id: batch.batch_id,
    imported,
    skipped_duplicates: skippedDuplicates,
    sha_mismatches: shaMismatches,
    blank_skipped: blankSkipped,
    counts,
  }
}

/**
 * Full flow: fetch the caller's own export via the injected fetcher, then
 * import. The UI lane calls this AFTER the user confirms in the import
 * dialog — confirmation UX lives outside this module.
 *
 * Example (browser):
 *   const result = await runLegacyImport(storage, secret, async () => {
 *     const res = await fetch('/api/answers/export', { credentials: 'include' })
 *     if (!res.ok) throw new Error(`export failed: ${res.status}`)
 *     return res.json()
 *   }, { expectedUserId: hostedUserId })
 */
export async function runLegacyImport(
  storage: VaultStorage,
  secret: string,
  fetchExport: FetchLegacyExportFn,
  opts?: { expectedUserId?: string },
): Promise<LegacyImportResult> {
  const payload = await fetchExport()
  return importLegacyAnswers(storage, secret, payload, opts)
}
