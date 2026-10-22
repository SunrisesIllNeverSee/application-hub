// v5 (M09 W4) — client review API over app/lib/aqua-local. The UI and the
// companion layer call THESE functions (with a handle from session.ts
// getStorage() and the unlocked secret held in React state); domain rules
// live in the vault lib — this adapter only assembles reads and forwards
// writes. Relative imports only, so node type-stripping can run it in tests.
//
// Authority recap (see docs/aqua-local-vault-v5.md):
//   approveAsHuman      → the ONLY approval path (human, hash-bound)
//   recordReview        → review decisions (never approval)
//   recordAgentSuggestion / recordClassificationSuggestion
//                       → agent/system recommendations (never approval)
//   editAsChildVersion  → edits = new child version, approval not carried

import {
  addComment,
  addEvidence,
  approvalGate,
  classifyReuse,
  createAnswer,
  createAppInstance,
  createChildVersion,
  createFact,
  createVersion,
  decryptVersionTitle,
  deriveQuestionStatus,
  evidenceIdsFor,
  factHistory,
  instanceScope,
  linkEvidence,
  listAppInstances,
  listComments,
  listEvidenceFor,
  listFacts,
  listPackets,
  listApprovals,
  listReviews,
  listSuggestions,
  loadPacket,
  readAppInstance,
  readReviewRationale,
  readSuggestion,
  readVersion,
  recordHumanApproval,
  recordHumanRevocation,
  recordReviewDecision,
  recordSuggestion,
  retractFact,
  reviseFact,
  setEvidenceVerification,
  suggestionFromClassification,
  VaultNotFoundError,
} from '../aqua-local/index.ts'
import type {
  AnswerRecord,
  AppInstanceRecord,
  AppInstanceView,
  ApprovalRecord,
  ChildVersionInput,
  ClassifyOptions,
  CommentInput,
  CommentRecord,
  CommentView,
  CreateAppInstanceInput,
  EvidenceLink,
  EvidenceRecord,
  EvidenceVerification,
  EvidenceView,
  FactKind,
  FactRecord,
  FactView,
  QuestionStatus,
  ReuseCandidate,
  ReuseClassification,
  ReviewDecisionInput,
  ProvenanceRecord,
  ReviewRecord,
  SuggestionInput,
  SuggestionRecord,
  SuggestionView,
  VaultStorage,
  VersionMethod,
  VersionRecord,
} from '../aqua-local/index.ts'

export type {
  AppInstanceRecord,
  AppInstanceView,
  CommentView,
  EvidenceView,
  FactView,
  QuestionStatus,
  ReuseClassification,
  SuggestionRecord,
  SuggestionView,
}

/** Actor id used when no signed-in uid is available (vault-local user). */
export const LOCAL_ACTOR_ID = 'local-user'

// ---------------------------------------------------------------------------
// Application instances
// ---------------------------------------------------------------------------

export function createInstance(
  storage: VaultStorage,
  secret: string,
  input: CreateAppInstanceInput,
): Promise<AppInstanceRecord> {
  return createAppInstance(storage, secret, input)
}

export function listInstances(storage: VaultStorage): Promise<AppInstanceRecord[]> {
  return listAppInstances(storage)
}

export function getInstance(storage: VaultStorage, secret: string, instanceId: string): Promise<AppInstanceView> {
  return readAppInstance(storage, secret, instanceId)
}

/** Public question metadata supplied by the caller for catalog-backed
    instances (the vault lib never fetches the catalog itself). */
export interface PublicOccurrence {
  question_occurrence_id: string
  text: string
  canonical_question_id?: string | null
  word_limit?: number | null
  char_limit?: number | null
  required?: boolean
  section_id?: string | null
}

export interface ListInstanceQuestionsOptions {
  /** Public catalog questions (catalog-backed instances). */
  catalog_questions?: PublicOccurrence[]
  /** Program / org name for catalog-backed instances (local templates carry their own). */
  program_name?: string | null
  org_name?: string | null
  cycle_year?: number | null
  deadline?: string | null
  /** application_id → program name for answers outside instances (e.g. legacy program_id scopes). */
  program_names_by_application?: Record<string, string>
  known_program_names?: string[]
  /** Extra public question wording keyed by occurrence id (for candidate answers). */
  question_texts?: Record<string, { text: string; canonical_question_id?: string | null }>
  now?: string
  /** Default true. False skips decryption-heavy reuse classification. */
  classify?: boolean
  /** When true, a governing version with no evidence reads needs_evidence. */
  evidence_required?: boolean
}

export interface InstanceQuestionRow {
  question_occurrence_id: string
  canonical_question_id: string | null
  /** Exact wording, when known (local template or supplied catalog). */
  text: string | null
  word_limit: number | null
  char_limit: number | null
  required: boolean
  section_id: string | null
  order: number
  scope: { application_id: string; question_occurrence_id: string }
  answer_id: string | null
  /** Versions in this scope, oldest → newest (last governs). */
  versions: VersionRecord[]
  status: QuestionStatus
  /** Reuse classification against the REST of the vault (null when the
      question wording is unknown or classify=false). Advisory only. */
  classification: ReuseClassification | null
  evidence_ids: string[]
  suggestions: SuggestionRecord[]
}

function sortVersions(vs: VersionRecord[]): VersionRecord[] {
  return [...vs].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

async function packetVersionIds(storage: VaultStorage, secret: string, applicationId: string): Promise<Set<string>> {
  const ids = new Set<string>()
  for (const p of await listPackets(storage, applicationId)) {
    try {
      const packet = await loadPacket(storage, p.id, secret)
      for (const q of packet.questions) if (q.version_id) ids.add(q.version_id)
    } catch {
      // undecryptable/legacy-broken packet: cannot prove inclusion → omit
    }
  }
  return ids
}

/**
 * Review board rows for one instance: every question with its derived
 * status and (optionally) Direct/Adapt/Gap classification. Read-only.
 */
export async function listInstanceQuestions(
  storage: VaultStorage,
  secret: string,
  instanceId: string,
  opts: ListInstanceQuestionsOptions = {},
): Promise<InstanceQuestionRow[]> {
  const view = await readAppInstance(storage, secret, instanceId)
  const { record, template } = view
  const catalogById = new Map((opts.catalog_questions ?? []).map((q) => [q.question_occurrence_id, q]))
  const templateById = new Map((template?.questions ?? []).map((q) => [q.question_occurrence_id, q]))

  const [answers, versions, approvals, reviews, suggestions] = await Promise.all([
    storage.getAll<AnswerRecord>('answers'),
    storage.getAll<VersionRecord>('versions'),
    storage.getAll<ApprovalRecord>('approvals'),
    storage.getAll<ReviewRecord>('reviews'),
    listSuggestions(storage),
  ])
  const inPacket = await packetVersionIds(storage, secret, record.application_id)

  // Occurrence index across the vault (for candidate question wording,
  // canonical ids and program names) — instance templates + caller data.
  const occIndex = new Map<string, { text?: string; canonical?: string | null }>()
  const programByApp = new Map<string, { program?: string | null; org?: string | null }>()
  for (const [occ, q] of Object.entries(opts.question_texts ?? {})) {
    occIndex.set(occ, { text: q.text, canonical: q.canonical_question_id ?? null })
  }
  for (const [app, name] of Object.entries(opts.program_names_by_application ?? {})) {
    programByApp.set(app, { program: name })
  }
  if (opts.classify !== false) {
    for (const inst of await listAppInstances(storage)) {
      for (const r of inst.question_refs) {
        const prev = occIndex.get(r.question_occurrence_id) ?? {}
        occIndex.set(r.question_occurrence_id, { ...prev, canonical: prev.canonical ?? r.canonical_question_id ?? null })
      }
      if (inst.local_template_enc) {
        try {
          const t = inst.instance_id === record.instance_id ? template : (await readAppInstance(storage, secret, inst.instance_id)).template
          for (const q of t?.questions ?? []) {
            occIndex.set(q.question_occurrence_id, { text: q.text, canonical: q.canonical_question_id ?? null })
          }
          if (t) programByApp.set(inst.application_id, { program: t.title, org: t.org })
        } catch {
          // a template under another secret cannot inform matching — skip
        }
      }
    }
  }
  for (const q of opts.catalog_questions ?? []) {
    occIndex.set(q.question_occurrence_id, { text: q.text, canonical: q.canonical_question_id ?? null })
  }
  const ownProgram = template?.title ?? opts.program_name ?? null
  const ownOrg = template?.org ?? opts.org_name ?? null
  programByApp.set(record.application_id, { program: ownProgram, org: ownOrg })

  // Candidate cache: latest + latest-approved version of every answer.
  const versionsByAnswer = new Map<string, VersionRecord[]>()
  for (const v of versions) versionsByAnswer.set(v.answer_id, [...(versionsByAnswer.get(v.answer_id) ?? []), v])
  let candidatePool: Array<{ answer: AnswerRecord; version: VersionRecord; approved: boolean }> | null = null
  const decrypted = new Map<string, { title: string; body: string }>()
  const candidatesFor = async (excludeAnswerIds: Set<string>): Promise<ReuseCandidate[]> => {
    if (!candidatePool) {
      candidatePool = []
      for (const a of answers) {
        const vs = sortVersions(versionsByAnswer.get(a.id) ?? [])
        const latest = vs.at(-1)
        if (!latest) continue
        const approvedLatest = [...vs].reverse().find((v) => approvalGate(v, approvals, reviews).approved)
        const picks = new Map<string, VersionRecord>([[latest.id, latest]])
        if (approvedLatest) picks.set(approvedLatest.id, approvedLatest)
        for (const v of picks.values()) {
          candidatePool.push({ answer: a, version: v, approved: approvalGate(v, approvals, reviews).approved })
        }
      }
    }
    const out: ReuseCandidate[] = []
    for (const c of candidatePool) {
      if (excludeAnswerIds.has(c.answer.id)) continue
      let plain = decrypted.get(c.version.id)
      if (!plain) {
        try {
          const r = await readVersion(storage, secret, c.version.id)
          plain = { title: r.title, body: r.body }
          decrypted.set(c.version.id, plain)
        } catch {
          continue // undecryptable — cannot be a candidate
        }
      }
      const occ = occIndex.get(c.answer.scope.question_occurrence_id)
      const prog = programByApp.get(c.answer.scope.application_id)
      out.push({
        version_id: c.version.id,
        version_sha256: c.version.sha256,
        body: plain.body,
        title: plain.title,
        question_text: occ?.text ?? null,
        scope: c.answer.scope,
        canonical_question_id: occ?.canonical ?? null,
        approved: c.approved,
        created_at: c.version.created_at,
        program_name: prog?.program ?? null,
        org_name: prog?.org ?? null,
        evidence_ids: await evidenceIdsFor(storage, 'version', c.version.id),
      })
    }
    return out
  }

  const rows: InstanceQuestionRow[] = []
  for (const ref of record.question_refs) {
    const occ = ref.question_occurrence_id
    const meta = templateById.get(occ) ?? null
    const cat = catalogById.get(occ) ?? null
    const scope = instanceScope(record, occ)
    const scoped = answers.filter(
      (a) => a.scope.application_id === scope.application_id && a.scope.question_occurrence_id === occ,
    )
    const scopedIds = new Set(scoped.map((a) => a.id))
    const vs = sortVersions(versions.filter((v) => scopedIds.has(v.answer_id)))
    const sugg = suggestions.filter(
      (s) => s.question_occurrence_id === occ && (!s.instance_id || s.instance_id === record.instance_id),
    )
    const governing = vs.at(-1)
    const evidence_ids = governing ? await evidenceIdsFor(storage, 'version', governing.id) : []
    const status = deriveQuestionStatus({
      versions: vs,
      approvals,
      reviews,
      suggestions: sugg,
      packet_version_ids: inPacket,
      governing_evidence_ids: evidence_ids,
      evidence_required: opts.evidence_required,
    })
    const text = meta?.text ?? cat?.text ?? null
    const canonical = ref.canonical_question_id ?? meta?.canonical_question_id ?? cat?.canonical_question_id ?? null
    const word_limit = meta?.word_limit ?? cat?.word_limit ?? null
    const char_limit = meta?.char_limit ?? cat?.char_limit ?? null
    let classification: ReuseClassification | null = null
    if (opts.classify !== false && text) {
      const classifyOpts: ClassifyOptions = { known_program_names: opts.known_program_names, now: opts.now }
      classification = classifyReuse(
        {
          text,
          canonical_question_id: canonical,
          word_limit,
          char_limit,
          program_name: ownProgram,
          org_name: ownOrg,
          cycle_year: template?.cycle_year ?? opts.cycle_year ?? null,
          deadline: template?.deadline ?? opts.deadline ?? null,
        },
        await candidatesFor(scopedIds),
        classifyOpts,
      )
    }
    rows.push({
      question_occurrence_id: occ,
      canonical_question_id: canonical,
      text,
      word_limit,
      char_limit,
      required: meta?.required ?? cat?.required ?? false,
      section_id: meta?.section_id ?? cat?.section_id ?? null,
      order: ref.order,
      scope,
      answer_id: scoped[0]?.id ?? null,
      versions: vs,
      status,
      classification,
      evidence_ids,
      suggestions: sugg,
    })
  }
  return rows.sort((a, b) => a.order - b.order)
}

/** Status for one arbitrary answer scope (outside an instance board). */
export async function getQuestionStatus(
  storage: VaultStorage,
  secret: string,
  scope: { application_id: string; question_occurrence_id: string },
  opts: { instance_id?: string | null; evidence_required?: boolean } = {},
): Promise<QuestionStatus> {
  const [answers, versions, approvals, reviews] = await Promise.all([
    storage.getAll<AnswerRecord>('answers'),
    storage.getAll<VersionRecord>('versions'),
    storage.getAll<ApprovalRecord>('approvals'),
    storage.getAll<ReviewRecord>('reviews'),
  ])
  const ids = new Set(
    answers
      .filter((a) => a.scope.application_id === scope.application_id && a.scope.question_occurrence_id === scope.question_occurrence_id)
      .map((a) => a.id),
  )
  const vs = versions.filter((v) => ids.has(v.answer_id))
  const governing = sortVersions(vs).at(-1)
  const suggestions = (await listSuggestions(storage, { question_occurrence_id: scope.question_occurrence_id })).filter(
    (s) => !s.instance_id || !opts.instance_id || s.instance_id === opts.instance_id,
  )
  return deriveQuestionStatus({
    versions: vs,
    approvals,
    reviews,
    suggestions,
    packet_version_ids: await packetVersionIds(storage, secret, scope.application_id),
    governing_evidence_ids: governing ? await evidenceIdsFor(storage, 'version', governing.id) : [],
    evidence_required: opts.evidence_required,
  })
}

// ---------------------------------------------------------------------------
// Drafting / editing
// ---------------------------------------------------------------------------

/**
 * Save a draft for an instance question as a new immutable version in the
 * instance scope (creates the answer on first save; later saves are child
 * versions of the latest). `derived_from_version_id` records the reuse
 * source (provenance only — approval never transfers).
 */
export async function saveInstanceDraft(
  storage: VaultStorage,
  secret: string,
  instanceId: string,
  questionOccurrenceId: string,
  input: {
    title: string
    body: string
    method?: VersionMethod
    derived_from_version_id?: string | null
    evidence_ids?: string[]
    provider?: string | null
    model?: string | null
  },
): Promise<VersionRecord> {
  const instance = await storage.get<AppInstanceRecord>('app_instances', instanceId)
  if (!instance) throw new VaultNotFoundError(`application instance not found: ${instanceId}`)
  if (!instance.question_refs.some((r) => r.question_occurrence_id === questionOccurrenceId)) {
    throw new VaultNotFoundError(`question ${questionOccurrenceId} is not part of instance ${instanceId}`)
  }
  const scope = instanceScope(instance, questionOccurrenceId)
  let derived_from: { version_id: string; version_sha256: string } | null = null
  if (input.derived_from_version_id) {
    const src = await storage.get<VersionRecord>('versions', input.derived_from_version_id)
    if (!src) throw new VaultNotFoundError(`source version not found: ${input.derived_from_version_id}`)
    derived_from = { version_id: src.id, version_sha256: src.sha256 }
  }
  const answers = await storage.getAll<AnswerRecord>('answers')
  let answer =
    answers.find(
      (a) => a.scope.application_id === scope.application_id && a.scope.question_occurrence_id === scope.question_occurrence_id,
    ) ?? null
  if (!answer) answer = await createAnswer(storage, scope)
  const latest = sortVersions((await storage.getAll<VersionRecord>('versions')).filter((v) => v.answer_id === answer!.id)).at(-1)
  return createVersion(storage, secret, {
    answer_id: answer.id,
    parent_version_id: latest?.id ?? null,
    title: input.title,
    body: input.body,
    method: input.method ?? 'manual',
    provider: input.provider ?? null,
    model: input.model ?? null,
    derived_from,
    evidence_ids: input.evidence_ids,
  })
}

/** EDIT control: new child version; the parent and its decisions remain. */
export function editAsChildVersion(
  storage: VaultStorage,
  secret: string,
  input: ChildVersionInput,
): Promise<VersionRecord> {
  return createChildVersion(storage, secret, input)
}

/** Decrypt a version for the review card (title, body, counts). */
export async function readReviewCardVersion(
  storage: VaultStorage,
  secret: string,
  versionId: string,
): Promise<{ record: VersionRecord; title: string; body: string; word_count: number; char_count: number }> {
  const { record, title, body } = await readVersion(storage, secret, versionId)
  return {
    record,
    title,
    body,
    word_count: body.split(/\s+/).filter(Boolean).length,
    char_count: [...body].length,
  }
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

/**
 * APPROVE control — the human approves the displayed version EXACTLY as
 * presented. `expected_sha256` is the hash of the version the card showed;
 * a mismatch (row changed underneath) is refused. Pass `secret` to also
 * rehash the decrypted plaintext.
 */
export function approveAsHuman(
  storage: VaultStorage,
  input: {
    version_id: string
    expected_sha256: string
    actor_id?: string | null
    via?: 'review_ui' | 'decision_file'
    secret?: string
  },
): Promise<ApprovalRecord> {
  return recordHumanApproval(storage, {
    version_id: input.version_id,
    expected_sha256: input.expected_sha256,
    actor_id: input.actor_id || LOCAL_ACTOR_ID,
    via: input.via ?? 'review_ui',
    secret: input.secret,
  })
}

/** Human revocation of an approval (approvals-ledger 'rejected'). */
export function revokeAsHuman(
  storage: VaultStorage,
  input: { version_id: string; expected_sha256: string; actor_id?: string | null; via?: 'review_ui' | 'decision_file' },
): Promise<ApprovalRecord> {
  return recordHumanRevocation(storage, {
    version_id: input.version_id,
    expected_sha256: input.expected_sha256,
    actor_id: input.actor_id || LOCAL_ACTOR_ID,
    via: input.via ?? 'review_ui',
  })
}

/** Review decision (needs_evidence, needs_revision, …) — never an approval. */
export function recordReview(
  storage: VaultStorage,
  secret: string,
  input: ReviewDecisionInput,
): Promise<ReviewRecord> {
  return recordReviewDecision(storage, secret, input)
}

/** EVIDENCE / HELP control — a human request (not approval, not revocation). */
export function requestEvidenceOrHelp(
  storage: VaultStorage,
  secret: string,
  input: {
    version_id: string
    expected_sha256: string
    kind: 'evidence_requested' | 'help_requested'
    note?: string | null
    actor_id?: string | null
  },
): Promise<ReviewRecord> {
  return recordReviewDecision(storage, secret, {
    version_id: input.version_id,
    expected_sha256: input.expected_sha256,
    decision: input.kind,
    rationale: input.note ?? null,
    actor_class: 'human',
    actor_id: input.actor_id || LOCAL_ACTOR_ID,
  })
}

// ---------------------------------------------------------------------------
// Discussion
// ---------------------------------------------------------------------------

/** DISCUSS control — comment bound to the exact version + hash. */
export function addVersionComment(
  storage: VaultStorage,
  secret: string,
  input: CommentInput,
): Promise<CommentRecord> {
  return addComment(storage, secret, input)
}

export function listVersionComments(
  storage: VaultStorage,
  secret: string,
  filter: { version_id?: string; answer_id?: string; thread_id?: string },
): Promise<CommentView[]> {
  return listComments(storage, secret, filter)
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export function addEvidenceRecord(
  storage: VaultStorage,
  secret: string,
  input: Parameters<typeof addEvidence>[2],
): Promise<EvidenceRecord> {
  return addEvidence(storage, secret, input)
}

export function linkEvidenceRecord(storage: VaultStorage, evidenceId: string, link: EvidenceLink): Promise<EvidenceRecord> {
  return linkEvidence(storage, evidenceId, link)
}

export function setEvidenceStatus(
  storage: VaultStorage,
  evidenceId: string,
  input: { verification: EvidenceVerification; freshness_checked_at?: string | null },
): Promise<EvidenceRecord> {
  return setEvidenceVerification(storage, evidenceId, input)
}

export function listVersionEvidence(
  storage: VaultStorage,
  secret: string,
  versionId: string,
): Promise<{ evidence: EvidenceView[]; missing: string[] }> {
  return listEvidenceFor(storage, secret, 'version', versionId)
}

// ---------------------------------------------------------------------------
// Suggestions (agent / system — never approvals)
// ---------------------------------------------------------------------------

export function recordAgentSuggestion(
  storage: VaultStorage,
  secret: string,
  input: SuggestionInput,
): Promise<SuggestionRecord> {
  return recordSuggestion(storage, secret, input)
}

/** Persist a Direct/Adapt/Gap result as a suggestion (advisory). */
export function recordClassificationSuggestion(
  storage: VaultStorage,
  secret: string,
  questionOccurrenceId: string,
  result: ReuseClassification,
  extra: { instance_id?: string | null; provider?: string | null; model?: string | null } = {},
): Promise<SuggestionRecord> {
  return recordSuggestion(storage, secret, suggestionFromClassification(questionOccurrenceId, result, extra))
}

// ---------------------------------------------------------------------------
// Facts (versioned)
// ---------------------------------------------------------------------------

export function addFact(
  storage: VaultStorage,
  secret: string,
  input: { kind: FactKind; key: string; value: string; evidence_ids?: string[]; method?: VersionMethod },
): Promise<FactRecord> {
  return createFact(storage, secret, input)
}

export function updateFact(
  storage: VaultStorage,
  secret: string,
  input: { fact_id: string; value: string; evidence_ids?: string[]; method?: VersionMethod; expected_latest_version_id?: string },
): Promise<FactRecord> {
  return reviseFact(storage, secret, input)
}

export function removeFact(
  storage: VaultStorage,
  secret: string,
  input: { fact_id: string; expected_latest_version_id?: string },
): Promise<FactRecord> {
  return retractFact(storage, secret, input)
}

export function listFactViews(storage: VaultStorage, secret: string, filter: { kind?: FactKind } = {}): Promise<FactView[]> {
  return listFacts(storage, secret, filter)
}

export function getFactHistory(storage: VaultStorage, secret: string, factId: string): Promise<FactView[]> {
  return factHistory(storage, secret, factId)
}

/** Title of a version (decrypted) — convenience for card headers. */
export function versionTitle(secret: string, record: VersionRecord): Promise<string> {
  return decryptVersionTitle(secret, record)
}

// ---------------------------------------------------------------------------
// M09 W5 — read-only helpers for the review card (no writes, no new rules).
// ---------------------------------------------------------------------------

/** Decrypt a suggestion's explanation / weaknesses / unsupported claims. */
export function readSuggestionView(secret: string, rec: SuggestionRecord): Promise<SuggestionView> {
  return readSuggestion(secret, rec)
}

/** Approvals-ledger rows for a version (oldest → newest, seq order). */
export function listVersionApprovals(storage: VaultStorage, versionId: string): Promise<ApprovalRecord[]> {
  return listApprovals(storage, versionId)
}

/** Review decisions for a version or an answer (oldest → newest). */
export function listVersionReviews(
  storage: VaultStorage,
  filter: { version_id?: string; answer_id?: string },
): Promise<ReviewRecord[]> {
  return listReviews(storage, filter)
}

/** Decrypt a review decision's rationale (null when none was given). */
export function readReviewNote(secret: string, review: ReviewRecord): Promise<string | null> {
  return readReviewRationale(secret, review)
}

/** Generation provenance receipt for a version (method / provider / model). */
export async function readVersionProvenance(storage: VaultStorage, versionId: string): Promise<ProvenanceRecord | null> {
  return (await storage.get<ProvenanceRecord>('provenance', versionId)) ?? null
}
