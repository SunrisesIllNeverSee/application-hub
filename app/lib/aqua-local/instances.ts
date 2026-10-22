// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// v5 (M09 W4) — private application instances. A catalog-backed instance
// references the public template by id and carries NO public text; a
// local-only instance ('LA-' id) carries its full template encrypted, with
// stable local question ids ('LQ-') retained until an approved public
// mapping exists. Source refs (URL / file name) are encrypted.

import { decryptField, decryptOptionalField, encryptField, encryptOptionalField, newId, nowIso } from './crypto.ts'
import { isBlankBody, VaultNotFoundError, VaultScopeError } from './repo.ts'
import type { VaultStorage } from './vault.ts'
import type {
  AppInstanceRecord,
  AppInstanceSourceKind,
  InstanceQuestionRef,
  LocalAppTemplate,
} from './schema.ts'

export const LOCAL_APP_PREFIX = 'LA-'
export const CATALOG_APP_PREFIX = 'AI-'
export const LOCAL_QUESTION_PREFIX = 'LQ-'

const SOURCE_KINDS: readonly AppInstanceSourceKind[] = ['catalog', 'url', 'paste', 'file', 'existing']

export type LocalAppTemplateInput = Omit<LocalAppTemplate, 'questions'> & {
  questions: Array<
    Omit<LocalAppTemplate['questions'][number], 'question_occurrence_id' | 'order' | 'required'> & {
      question_occurrence_id?: string
      order?: number
      required?: boolean
    }
  >
}

export interface CreateAppInstanceInput {
  program_id?: string | null
  ap_serial?: string | null
  cycle_id?: string | null
  template_revision_sha?: string | null
  /** Required for local-only apps (no program_id); optional otherwise. */
  local_template?: LocalAppTemplateInput
  /** Catalog-backed question list (ids only) when no local_template. */
  question_refs?: InstanceQuestionRef[]
  source: { kind: AppInstanceSourceKind; ref?: string | null }
  /** Answer scope key override — e.g. adopt answers already scoped to a
      program_id by the pre-v5 workspace. Defaults to the instance_id. */
  application_id?: string
}

export interface AppInstanceView {
  record: AppInstanceRecord
  template: LocalAppTemplate | null
  source_ref: string | null
}

function normalizeTemplate(
  t: LocalAppTemplateInput,
  localOnly: boolean,
): LocalAppTemplate {
  if (!t || typeof t !== 'object') throw new VaultScopeError('local_template must be an object')
  if (typeof t.title !== 'string' || isBlankBody(t.title)) throw new VaultScopeError('local_template.title is required')
  if (!Array.isArray(t.questions) || t.questions.length === 0) {
    throw new VaultScopeError('local_template.questions must list at least one question')
  }
  const seen = new Set<string>()
  const questions = t.questions.map((q, i) => {
    if (typeof q.text !== 'string' || isBlankBody(q.text)) {
      throw new VaultScopeError(`local_template.questions[${i}].text is required (exact wording)`)
    }
    const occ = q.question_occurrence_id ?? `${LOCAL_QUESTION_PREFIX}${newId()}`
    if (localOnly && !occ.startsWith(LOCAL_QUESTION_PREFIX)) {
      throw new VaultScopeError(
        `local-only application questions must use '${LOCAL_QUESTION_PREFIX}' ids (got ${occ})`,
      )
    }
    if (seen.has(occ)) throw new VaultScopeError(`duplicate question_occurrence_id ${occ}`)
    seen.add(occ)
    for (const lim of ['word_limit', 'char_limit'] as const) {
      const v = q[lim]
      if (v != null && (!Number.isInteger(v) || v <= 0)) {
        throw new VaultScopeError(`local_template.questions[${i}].${lim} must be a positive integer`)
      }
    }
    return {
      question_occurrence_id: occ,
      canonical_question_id: q.canonical_question_id ?? null,
      text: q.text,
      word_limit: q.word_limit ?? null,
      char_limit: q.char_limit ?? null,
      required: q.required ?? false,
      section_id: q.section_id ?? null,
      order: q.order ?? i,
      // M09 W6: keep the extracted original only when it differs (a
      // recorded correction); absent otherwise so v5 templates are unchanged.
      ...(typeof q.original_text === 'string' && q.original_text !== q.text ? { original_text: q.original_text } : {}),
    }
  })
  return {
    title: t.title,
    org: t.org ?? '',
    cycle_year: t.cycle_year ?? null,
    deadline: t.deadline ?? null,
    sections: t.sections ?? [],
    questions: questions.sort((a, b) => a.order - b.order),
    ...(Array.isArray(t.corrections) && t.corrections.length ? { corrections: t.corrections.map((c) => ({ ...c })) } : {}),
    ...(t.import_meta ? { import_meta: { ...t.import_meta } } : {}),
  }
}

export async function createAppInstance(
  storage: VaultStorage,
  secret: string,
  input: CreateAppInstanceInput,
): Promise<AppInstanceRecord> {
  if (!input?.source || !SOURCE_KINDS.includes(input.source.kind)) {
    throw new VaultScopeError(`source.kind must be one of ${SOURCE_KINDS.join('|')}`)
  }
  const localOnly = !input.program_id
  if (localOnly && !input.local_template) {
    throw new VaultScopeError('local-only application instance requires local_template')
  }
  const template = input.local_template ? normalizeTemplate(input.local_template, localOnly) : null

  let refs: InstanceQuestionRef[]
  if (template) {
    refs = template.questions.map((q) => ({
      question_occurrence_id: q.question_occurrence_id,
      canonical_question_id: q.canonical_question_id ?? null,
      order: q.order,
    }))
  } else {
    refs = (input.question_refs ?? []).map((r, i) => {
      if (!r?.question_occurrence_id) throw new VaultScopeError(`question_refs[${i}] missing question_occurrence_id`)
      return {
        question_occurrence_id: r.question_occurrence_id,
        canonical_question_id: r.canonical_question_id ?? null,
        order: r.order ?? i,
      }
    })
    const ids = new Set(refs.map((r) => r.question_occurrence_id))
    if (ids.size !== refs.length) throw new VaultScopeError('duplicate question_occurrence_id in question_refs')
  }

  const instanceId = `${localOnly ? LOCAL_APP_PREFIX : CATALOG_APP_PREFIX}${newId()}`
  const record: AppInstanceRecord = {
    instance_id: instanceId,
    application_id: input.application_id || instanceId,
    program_id: input.program_id ?? null,
    ap_serial: input.ap_serial ?? null,
    cycle_id: input.cycle_id ?? null,
    template_revision_sha: input.template_revision_sha ?? null,
    question_refs: refs.sort((a, b) => a.order - b.order),
    source: { kind: input.source.kind },
    created_at: nowIso(),
  }
  if (template) record.local_template_enc = await encryptField(secret, JSON.stringify(template))
  const refEnc = await encryptOptionalField(secret, input.source.ref ?? null)
  if (refEnc) record.source.ref_enc = refEnc

  const inserted = await storage.putIfAbsent('app_instances', record.instance_id, record)
  if (!inserted) throw new VaultScopeError(`instance id collision refused: ${record.instance_id}`)
  return record
}

export async function readAppInstance(
  storage: VaultStorage,
  secret: string,
  instanceId: string,
): Promise<AppInstanceView> {
  const record = await storage.get<AppInstanceRecord>('app_instances', instanceId)
  if (!record) throw new VaultNotFoundError(`application instance not found: ${instanceId}`)
  const template = record.local_template_enc
    ? (JSON.parse(await decryptField(secret, record.local_template_enc)) as LocalAppTemplate)
    : null
  const source_ref = await decryptOptionalField(secret, record.source.ref_enc)
  return { record, template, source_ref }
}

/** Metadata listing (no decryption), newest first. */
export async function listAppInstances(storage: VaultStorage): Promise<AppInstanceRecord[]> {
  const all = await storage.getAll<AppInstanceRecord>('app_instances')
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.instance_id.localeCompare(b.instance_id))
}

/** The answer scope for one question of an instance. */
export function instanceScope(
  instance: Pick<AppInstanceRecord, 'application_id'>,
  questionOccurrenceId: string,
): { application_id: string; question_occurrence_id: string } {
  return { application_id: instance.application_id, question_occurrence_id: questionOccurrenceId }
}
