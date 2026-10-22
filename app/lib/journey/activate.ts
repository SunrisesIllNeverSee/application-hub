// M09 W6 — Step C: turn a reviewed extraction into ONE private application
// instance. Building the input is pure; activation performs exactly one
// vault write (createInstance) and refuses before writing when anything
// blocks — so a failed or abandoned journey never leaves a partial instance.

import { canonicalJson, sha256Hex } from '../aqua-local/crypto.ts'
import { createAppInstance, listAppInstances, type CreateAppInstanceInput, type LocalAppTemplateInput } from '../aqua-local/instances.ts'
import type { AppInstanceRecord, LocalTemplateCorrection } from '../aqua-local/schema.ts'
import type { VaultStorage } from '../aqua-local/vault.ts'
import {
  activationBlockers,
  activeQuestions,
  cycleYearOf,
  templateDeadline,
  type ActivationBlocker,
  type ExtractionReviewModel,
  type JourneyCatalog,
  type JourneyCatalogProgram,
} from './review-model.ts'

export class JourneyActivationError extends Error {
  readonly blockers: ActivationBlocker[]
  constructor(blockers: ActivationBlocker[]) {
    super(`instance not created: ${blockers.map((b) => b.message).join('; ')}`)
    this.name = 'JourneyActivationError'
    this.blockers = blockers
  }
}

/** Stable reference to the public template revision the instance was
    created from: sha256 over the public question ids, wording, limits and
    required flags (no private data). */
export async function templateRevisionSha(program: JourneyCatalogProgram): Promise<string> {
  const qs = [...program.questions]
    .sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id))
    .map((q) => ({ id: q.id, canonical: q.canonical_question_id, text: q.asked_as, word_limit: q.word_limit, char_limit: q.char_limit, required: q.required }))
  return sha256Hex(canonicalJson({ program_id: program.id, cycle_id: program.cycle?.cycle_id ?? null, questions: qs }))
}

function sectionsOf(model: ExtractionReviewModel): { sections: Array<{ section_id: string; title: string }>; idFor: (label: string | null) => string | null } {
  const ids = new Map<string, string>()
  for (const q of activeQuestions(model)) {
    if (q.section && !ids.has(q.section)) ids.set(q.section, `S${ids.size + 1}`)
  }
  return {
    sections: [...ids.entries()].map(([title, section_id]) => ({ section_id, title })),
    idFor: (label) => (label ? ids.get(label) ?? null : null),
  }
}

/**
 * Build the createInstance input. Catalog-backed instances carry ids only
 * (program, cycle, template revision, question refs) — no public text is
 * copied. Imports carry their reviewed template (exact wording, corrections
 * with originals, limits, required flags) encrypted in the vault.
 */
export async function buildInstanceInput(model: ExtractionReviewModel, catalog?: JourneyCatalog | null): Promise<CreateAppInstanceInput> {
  const blockers = activationBlockers(model, catalog)
  if (blockers.length) throw new JourneyActivationError(blockers)

  const program = model.program_match ? catalog?.programs.find((p) => p.id === model.program_match!.program_id) ?? null : null

  if (model.use_catalog_template) {
    if (!program) throw new JourneyActivationError([{ key: null, code: 'catalog_template_empty', message: 'The matched program is not in the catalog.' }])
    return catalogInstanceInput(program, { kind: model.source.kind === 'catalog' ? 'catalog' : model.source.kind, ref: model.source.ref }, await templateRevisionSha(program))
  }

  const { sections, idFor } = sectionsOf(model)
  const indexOf = new Map(model.questions.map((q, i) => [q.key, i]))
  const corrections: LocalTemplateCorrection[] = model.corrections.map((c) => ({
    question_index: c.key ? indexOf.get(c.key) ?? null : null,
    field: c.field,
    from: c.from,
    to: c.to,
    at: c.at,
  }))
  const template: LocalAppTemplateInput = {
    title: (model.program.title ?? '').trim(),
    org: (model.program.organization ?? '').trim(),
    cycle_year: cycleYearOf(model),
    deadline: templateDeadline(model.cycle.deadline),
    sections,
    questions: activeQuestions(model).map((q, i) => ({
      text: q.text as string,
      original_text: q.corrected ? q.original_text : null,
      canonical_question_id: !q.match_cleared && q.match && q.match.tier !== 'novel' ? q.match.canonical_question_id : null,
      word_limit: q.word_limit,
      char_limit: q.char_limit,
      required: q.required,
      section_id: idFor(q.section),
      order: i,
    })),
    corrections,
    import_meta: model.source.kind === 'catalog'
      ? null
      : {
          method: model.source.method as 'url_fetch' | 'paste' | 'file',
          content_sha256: model.source.content_sha256,
          reuse: model.source.reuse,
          file_format: model.source.file_format,
          extracted_at: model.extracted_at,
          question_count_extracted: model.questions.length,
          linked_program_id: program?.id ?? null,
          linked_cycle_id: program?.cycle?.cycle_id ?? null,
        },
  }
  // Imports stay local-only ('LA-') even when linked to a catalog program:
  // the link lives in the encrypted import_meta, so the program keeps ONE
  // catalog-backed instance (the one the workspace / review board use).
  return {
    program_id: null,
    cycle_id: null,
    template_revision_sha: null,
    local_template: template,
    source: { kind: model.source.kind as 'url' | 'paste' | 'file', ref: model.source.ref },
  }
}

/**
 * Catalog-backed instance input — the SAME convention the workspace review
 * link (W5) uses, so a program has one instance whichever surface starts
 * it: answers scope to `application_id = program_id` and each occurrence id
 * is the question's archived_question_id (session.ts scopeForQuestion).
 * Ids only; no public text is copied.
 */
export function catalogInstanceInput(
  program: JourneyCatalogProgram,
  source: CreateAppInstanceInput['source'],
  templateSha: string | null,
): CreateAppInstanceInput {
  return {
    program_id: program.id,
    application_id: program.id,
    cycle_id: program.cycle?.cycle_id ?? null,
    template_revision_sha: templateSha,
    question_refs: [...program.questions]
      .sort((a, b) => a.order_index - b.order_index)
      .map((q, i) => ({ question_occurrence_id: catalogOccurrenceId(q), canonical_question_id: q.canonical_question_id ?? null, order: i })),
    source,
  }
}

/** Occurrence id for a catalog question: archived_question_id (workspace convention). */
export function catalogOccurrenceId(q: { id: string; canonical_question_id: string | null }): string {
  return q.canonical_question_id ?? q.id
}

/** The program's existing catalog-backed instance (metadata only), if any. */
export async function findCatalogInstance(storage: VaultStorage, programId: string): Promise<AppInstanceRecord | null> {
  const all = await listAppInstances(storage)
  return all.find((i) => i.program_id === programId && !i.local_template_enc) ?? null
}

/**
 * Step C — create the private instance. At most one vault write; any
 * blocker or build failure throws before it, leaving the vault unchanged.
 * A catalog-backed start reuses the program's existing instance instead of
 * creating a duplicate (`reused: true`, nothing written).
 */
export async function activateInstance(
  storage: VaultStorage,
  secret: string,
  model: ExtractionReviewModel,
  catalog?: JourneyCatalog | null,
): Promise<AppInstanceRecord & { reused?: boolean }> {
  const input = await buildInstanceInput(model, catalog)
  if (input.program_id && !input.local_template) {
    const existing = await findCatalogInstance(storage, input.program_id)
    if (existing) return { ...existing, reused: true }
  }
  return createAppInstance(storage, secret, input)
}
