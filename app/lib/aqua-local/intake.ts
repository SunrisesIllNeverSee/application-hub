// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// AM-0017 — local-first intake adapter. The hosted `/api/hub/ingest` path
// persists pasted application text to intake_submissions + canonical staging
// — private-content egress that refuses under local-first. This adapter
// performs the SAME deterministic extraction (lib/intake/manual-intake —
// shared, pure, no server dependency) entirely on-device and materializes
// the result as:
//   1. a vault `catalog_cache` record (`intake:<id>`) holding the extracted
//      entity/application/questions + source provenance — metadata-class,
//      NOT the raw pasted text (which is never stored);
//   2. one AnswerRecord per extracted question, scoped to the intake
//      application — the questions then behave like any vault-scoped
//      question slot: editable, versioned, approvable, packet-selectable.
//
// Boundary: an intake application is vault-local by construction. It can
// never claim canonical status (canonical IDs are hosted-canonical-hub
// artifacts) — scope ids are namespaced `local-intake-*` so no collision
// with hosted application UUIDs is possible, and no hosted writer is
// duplicated or impersonated. Public program ingestion continues via
// /api/import/submit-url + /api/import/program unchanged.

import { newId, nowIso, sha256Hex } from './crypto.ts'
import { createAnswer } from './repo.ts'
import type { VaultStorage } from './vault.ts'
import type {
  AnswerRecord,
  CatalogCacheRecord,
  EventRecord,
} from './schema.ts'

export interface LocalIntakeInput {
  source_type: 'manual_paste' | 'manual_url' | 'manual_markdown'
  source_url?: string | null
  source_title?: string | null
  vertical?: string | null
}

export interface LocalIntakeResult {
  intake_id: string
  application_id: string
  entity_name: string
  vertical: string
  question_count: number
  question_occurrence_ids: string[]
}

/**
 * Minimal shapes copied from lib/intake/manual-intake so this module stays
 * importable without pulling the full intake contract — the caller passes
 * the extraction produced by `extractManualIntake` (client-side).
 */
export interface IntakeQuestionLike {
  question_text: string
  normalized_text: string
  order_index: number
  is_required: boolean
  word_limit: number | null
  char_limit: number | null
}

export interface IntakeExtractionLike {
  entity: { name: string; slug: string; host_domain: string | null; entity_type: string | null; vertical: string }
  application: { title: string; vertical: string; deadline_at: string | null; source_url: string | null }
  questions: IntakeQuestionLike[]
}

/**
 * Deterministic scope ids: `local-intake-<slug>-<short>` keeps intake
 * applications distinct from hosted application UUIDs and from each other,
 * and question_occurrence ids remain stable across a re-import of the same
 * extraction (idempotent re-run produces the same occurrences).
 */
export async function intakeApplicationId(entitySlug: string, questions: IntakeQuestionLike[]): Promise<string> {
  // Content fingerprint via truncated sha256 — a 32-bit JS string hash has
  // non-trivial collision probability; silently merging two distinct
  // applications pastes under one id would lose data boundaries.
  const sig = questions.map((q) => q.normalized_text).join('|')
  const h = await sha256Hex(sig)
  return `local-intake-${entitySlug}-${h.slice(0, 16)}`
}

export async function importLocalIntake(
  storage: VaultStorage,
  extraction: IntakeExtractionLike,
  input: LocalIntakeInput,
): Promise<LocalIntakeResult> {
  if (!extraction.questions.length) {
    throw new Error('intake extraction produced no questions')
  }
  const applicationId = await intakeApplicationId(extraction.entity.slug, extraction.questions)
  const intakeId = `intake-${newId().slice(0, 12)}`
  const now = nowIso()

  // Answers are scoped slots — body written later by the user. Only create
  // when absent (re-import must not clobber an answered slot).
  const existingAnswers = await storage.getAll<AnswerRecord>('answers')
  const occurrenceIds: string[] = []
  for (const q of extraction.questions) {
    const occ = `${applicationId}-q${q.order_index}`
    occurrenceIds.push(occ)
    const exists = existingAnswers.some(
      (a) => a.scope.application_id === applicationId && a.scope.question_occurrence_id === occ,
    )
    if (!exists) {
      await createAnswer(storage, {
        application_id: applicationId,
        question_occurrence_id: occ,
      })
    }
  }

  const record: CatalogCacheRecord = {
    key: `intake:${applicationId}`,
    blob: {
      intake_id: intakeId,
      application_id: applicationId,
      imported_at: now,
      source: {
        type: input.source_type,
        url: input.source_url ?? extraction.application.source_url ?? null,
        title: input.source_title ?? extraction.application.title ?? null,
      },
      entity: extraction.entity,
      application: {
        title: extraction.application.title,
        vertical: extraction.application.vertical,
        deadline_at: extraction.application.deadline_at,
      },
      questions: extraction.questions.map((q, i) => ({
        occurrence_id: occurrenceIds[i],
        text: q.question_text,
        order_index: q.order_index,
        is_required: q.is_required,
        word_limit: q.word_limit,
        char_limit: q.char_limit,
      })),
      custody: 'vault-local — raw pasted text was never stored or transmitted',
    },
    fetched_at: now,
  }
  await storage.put('catalog_cache', record)

  // Event seq allocated inside a tx over ['events'] — same monotonicity
  // contract as approveVersion; concurrent imports must not duplicate seq.
  await storage.tx(['events'], async (tx) => {
    const events = await tx.getAll<EventRecord>('events')
    const seq = events.reduce((m, e) => Math.max(m, e.seq), 0) + 1
    const ev: EventRecord = {
      id: newId(),
      seq,
      kind: 'local_intake_import',
      entity: 'application',
      entity_id: applicationId,
      payload: {
        intake_id: intakeId,
        question_count: extraction.questions.length,
        vertical: extraction.entity.vertical,
        source_type: input.source_type,
      },
      at: now,
    }
    await tx.put('events', ev)
  })

  return {
    intake_id: intakeId,
    application_id: applicationId,
    entity_name: extraction.entity.name,
    vertical: extraction.entity.vertical,
    question_count: extraction.questions.length,
    question_occurrence_ids: occurrenceIds,
  }
}

/** Read all vault-local intake applications (newest first). */
export async function listLocalIntakes(
  storage: VaultStorage,
): Promise<Array<Record<string, unknown>>> {
  const all = await storage.getAll<CatalogCacheRecord>('catalog_cache')
  return all
    .filter((r) => r.key.startsWith('intake:'))
    .map((r) => r.blob as Record<string, unknown>)
    .sort((a, b) => String(b.imported_at ?? '').localeCompare(String(a.imported_at ?? '')))
}

// ---------------------------------------------------------------------------
// Legacy Q&A import (AM-0009/0010/0102/0122/0123) — parsed pairs → vault
// ---------------------------------------------------------------------------

export interface ImportedPairLike {
  question_text: string
  answer_text: string
  theme: string
  confidence: string
}

export interface LegacyImportResult {
  batch_id: string
  created_answers: number
  added_versions: number
  skipped_short: number
}

/** Deterministic occurrence id for an imported pair — stable so a re-import
    of the same Q&A adds a version rather than a duplicate answer.
    IR-031: hash the FULL normalized text (never a truncated prefix — two
    distinct questions sharing a 280-char head must not collapse), and
    mix in the pair's batch position so a literal-duplicate question in the
    same import still gets its own slot. */
async function importOccurrenceId(questionText: string, batchIndex: number): Promise<string> {
  const norm = questionText.replace(/\s+/g, ' ').trim().toLowerCase()
  // truncated sha256 — the previous 32-bit JS hash had non-trivial
  // collision probability; two distinct questions must never share a slot.
  const h = await sha256Hex(`${norm}::${batchIndex}`)
  return `import-${h.slice(0, 16)}`
}

/**
 * Write parsed Q&A pairs into the vault Answer Bank. Each pair becomes (or
 * extends) a bank-scoped answer whose first/next version carries the
 * imported body — method 'imported', provenance records the paste source.
 * The raw pasted text is never stored; only the pair-level structure lands.
 */
export async function importLegacyQAPairs(
  storage: VaultStorage,
  secret: string,
  pairs: ImportedPairLike[],
  source: { label: string; source_url?: string | null },
): Promise<LegacyImportResult> {
  const { createVersion } = await import('./repo.ts')
  const batchId = newId()
  const answers = await storage.getAll<AnswerRecord>('answers')
  const byOccurrence = new Map(
    answers.map((a) => [`${a.scope.application_id}::${a.scope.question_occurrence_id}`, a]),
  )

  let created = 0
  let versions = 0
  let skipped = 0
  for (let idx = 0; idx < pairs.length; idx++) {
    const p = pairs[idx]
    if (p.answer_text.trim().length < 10) { skipped++; continue }
    // IR-031b: a pair with no real question binds the answer to nothing —
    // skip rather than collapse every such pair into one slot.
    if (p.question_text.trim().length < 8) { skipped++; continue }
    const occ = await importOccurrenceId(p.question_text, idx)
    const key = `answer-bank::${occ}`
    let answer = byOccurrence.get(key)
    if (!answer) {
      answer = await createAnswer(storage, {
        application_id: 'answer-bank',
        question_occurrence_id: occ,
      })
      byOccurrence.set(key, answer)
      created++
    }
    await createVersion(storage, secret, {
      answer_id: answer.id,
      title: p.question_text.slice(0, 80),
      body: p.answer_text,
      method: 'imported',
      provenance: `imported:${source.label}`,
      observed_flags: { deterministic_parse: true },
    })
    versions++
  }

  await storage.tx(['events'], async (tx) => {
    const events = await tx.getAll<EventRecord>('events')
    const seq = events.reduce((m, e) => Math.max(m, e.seq), 0) + 1
    const ev: EventRecord = {
      id: newId(),
      seq,
      kind: 'legacy_qa_import',
      entity: 'batch',
      entity_id: batchId,
      payload: {
        source: source.label,
        pairs_in: pairs.length,
        created_answers: created,
        added_versions: versions,
        skipped_short: skipped,
      },
      at: nowIso(),
    }
    await tx.put('events', ev)
  })
  return { batch_id: batchId, created_answers: created, added_versions: versions, skipped_short: skipped }
}
