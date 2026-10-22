// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// v5 (M09 W4) — review ledger: review decisions, version-bound comments,
// and agent/system suggestions. Three DISTINCT record kinds, none of which
// is an approval:
//   reviews     — append-only decisions (under_review, needs_evidence, …).
//                 'approved' is not a review decision; approval goes ONLY
//                 through repo.ts recordHumanApproval.
//   comments    — discussion bound to an exact version + hash.
//   suggestions — recommendations (reuse / draft / recommendation /
//                 evidence_gap). Writing one never touches approvals,
//                 reviews, or versions.
// Every free-text field is encrypted; ledger events carry ids/enums only.

import { decryptField, decryptOptionalField, encryptField, encryptOptionalField, newId, nowIso, sha256Hex } from './crypto.ts'
import { appendLedgerEvent, isBlankBody, VaultApprovalMismatchError, VaultNotFoundError, VaultScopeError } from './repo.ts'
import type { VaultStorage } from './vault.ts'
import {
  REVIEW_DECISIONS,
  COMMENT_VIAS,
  type ActorClass,
  type CommentRecord,
  type CommentVia,
  type EventRecord,
  type ReuseClassificationKind,
  type ReviewDecision,
  type ReviewRecord,
  type SuggestionKind,
  type SuggestionRecord,
  type VersionRecord,
} from './schema.ts'
import type { ReuseClassification } from './classify.ts'

const ACTOR_CLASSES: readonly ActorClass[] = ['human', 'agent']
const SUGGESTION_KINDS: readonly SuggestionKind[] = ['reuse', 'draft', 'recommendation', 'evidence_gap']
const CLASSIFICATIONS: readonly ReuseClassificationKind[] = ['direct', 'adapt', 'gap']

function assertActor(actor_class: ActorClass, actor_id: string): void {
  if (!ACTOR_CLASSES.includes(actor_class)) throw new VaultScopeError(`actor_class must be human|agent`)
  if (typeof actor_id !== 'string' || isBlankBody(actor_id)) throw new VaultScopeError('actor_id is required')
}

function sortBySeq<T extends { seq?: number; at: string }>(rows: T[], id: (r: T) => string): T[] {
  return rows.sort((a, b) => {
    if (a.seq != null && b.seq != null) return a.seq - b.seq
    if (a.seq != null) return 1
    if (b.seq != null) return -1
    return a.at.localeCompare(b.at) || id(a).localeCompare(id(b))
  })
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export interface ReviewDecisionInput {
  version_id: string
  /** Hash of the content reviewed; refused when it is not the stored hash. */
  expected_sha256: string
  decision: ReviewDecision
  rationale?: string | null
  actor_class: ActorClass
  actor_id: string
}

export async function recordReviewDecision(
  storage: VaultStorage,
  secret: string,
  input: ReviewDecisionInput,
): Promise<ReviewRecord> {
  if (!REVIEW_DECISIONS.includes(input.decision)) {
    // Includes 'approved' — approval is NOT a review decision.
    throw new VaultScopeError(
      `review decision must be one of ${REVIEW_DECISIONS.join('|')} (approval goes through recordHumanApproval)`,
    )
  }
  assertActor(input.actor_class, input.actor_id)
  const rationale_enc = await encryptOptionalField(secret, input.rationale)
  return storage.tx(['versions', 'reviews', 'events'], async (s) => {
    const version = await s.get<VersionRecord>('versions', input.version_id)
    if (!version) throw new VaultNotFoundError(`version not found: ${input.version_id}`)
    if (version.sha256 !== input.expected_sha256) {
      throw new VaultApprovalMismatchError(
        `review refused: version ${input.version_id} is not the content that was reviewed (sha256 mismatch)`,
      )
    }
    const review_id = newId()
    const at = nowIso()
    const ev = await appendLedgerEvent(s, {
      kind: 'review_decision',
      entity: 'version',
      entity_id: version.id,
      payload: {
        review_id,
        version_sha256: version.sha256,
        decision: input.decision,
        actor_class: input.actor_class,
        actor_id: input.actor_id,
      },
      at,
    })
    const record: ReviewRecord = {
      review_id,
      answer_id: version.answer_id,
      version_id: version.id,
      version_sha256: version.sha256,
      decision: input.decision,
      actor_class: input.actor_class,
      actor_id: input.actor_id,
      at,
      seq: ev.seq,
    }
    if (rationale_enc) record.rationale_enc = rationale_enc
    await s.put('reviews', record)
    return record
  })
}

export async function listReviews(
  storage: VaultStorage,
  filter: { version_id?: string; answer_id?: string } = {},
): Promise<ReviewRecord[]> {
  const all = await storage.getAll<ReviewRecord>('reviews')
  return sortBySeq(
    all.filter(
      (r) => (!filter.version_id || r.version_id === filter.version_id) && (!filter.answer_id || r.answer_id === filter.answer_id),
    ),
    (r) => r.review_id,
  )
}

export async function readReviewRationale(secret: string, review: ReviewRecord): Promise<string | null> {
  return decryptOptionalField(secret, review.rationale_enc)
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export interface CommentInput {
  version_id: string
  /** When given, must equal the stored version hash (comment on what was seen). */
  expected_sha256?: string
  body: string
  /** Reply to a comment on the same answer — joins its thread. */
  parent_comment_id?: string | null
  actor_class: ActorClass
  actor_id: string
  /** Surface the comment came through (absent = this browser's review UI). */
  via?: CommentVia
}

export interface CommentView {
  comment_id: string
  answer_id: string
  version_id: string
  version_sha256: string
  thread_id: string
  parent_comment_id: string | null
  body: string
  actor_class: ActorClass
  actor_id: string
  at: string
  seq: number
  /** Absent = written in this browser; see CommentVia. */
  via?: CommentVia
}

export async function addComment(
  storage: VaultStorage,
  secret: string,
  input: CommentInput,
): Promise<CommentRecord> {
  if (typeof input.body !== 'string' || isBlankBody(input.body)) throw new VaultScopeError('comment body is required')
  assertActor(input.actor_class, input.actor_id)
  if (input.via !== undefined && !COMMENT_VIAS.includes(input.via)) throw new VaultScopeError(`comment via must be ${COMMENT_VIAS.join('|')}`)
  const body_enc = await encryptField(secret, input.body)
  return storage.tx(['versions', 'comments', 'events'], async (s) => {
    const version = await s.get<VersionRecord>('versions', input.version_id)
    if (!version) throw new VaultNotFoundError(`version not found: ${input.version_id}`)
    if (input.expected_sha256 !== undefined && input.expected_sha256 !== version.sha256) {
      throw new VaultApprovalMismatchError(`comment refused: version ${input.version_id} sha256 mismatch`)
    }
    let thread_id = `TH-${newId()}`
    if (input.parent_comment_id) {
      const parent = await s.get<CommentRecord>('comments', input.parent_comment_id)
      if (!parent) throw new VaultNotFoundError(`parent comment not found: ${input.parent_comment_id}`)
      if (parent.answer_id !== version.answer_id) {
        throw new VaultScopeError('reply refused: parent comment belongs to a different answer')
      }
      thread_id = parent.thread_id
    }
    const comment_id = newId()
    const at = nowIso()
    const ev = await appendLedgerEvent(s, {
      kind: 'comment_added',
      entity: 'version',
      entity_id: version.id,
      payload: { comment_id, thread_id, version_sha256: version.sha256, actor_class: input.actor_class, actor_id: input.actor_id, ...(input.via ? { via: input.via } : {}) },
      at,
    })
    const record: CommentRecord = {
      comment_id,
      answer_id: version.answer_id,
      version_id: version.id,
      version_sha256: version.sha256,
      thread_id,
      parent_comment_id: input.parent_comment_id ?? null,
      body_enc,
      actor_class: input.actor_class,
      actor_id: input.actor_id,
      at,
      seq: ev.seq,
      ...(input.via ? { via: input.via } : {}),
    }
    await s.put('comments', record)
    return record
  })
}

export async function listComments(
  storage: VaultStorage,
  secret: string,
  filter: { version_id?: string; answer_id?: string; thread_id?: string } = {},
): Promise<CommentView[]> {
  const rows = sortBySeq(
    (await storage.getAll<CommentRecord>('comments')).filter(
      (c) =>
        (!filter.version_id || c.version_id === filter.version_id) &&
        (!filter.answer_id || c.answer_id === filter.answer_id) &&
        (!filter.thread_id || c.thread_id === filter.thread_id),
    ),
    (c) => c.comment_id,
  )
  const out: CommentView[] = []
  for (const c of rows) {
    const { body_enc, ...rest } = c
    out.push({ ...rest, parent_comment_id: c.parent_comment_id ?? null, body: await decryptField(secret, body_enc) })
  }
  return out
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

export interface SuggestionInput {
  instance_id?: string | null
  question_occurrence_id: string
  kind: SuggestionKind
  classification?: ReuseClassificationKind | null
  candidate_version_id?: string | null
  reason_codes?: string[]
  explanation: string
  weaknesses?: string | null
  unsupported_claims?: string | null
  evidence_ids?: string[]
  provider?: string | null
  model?: string | null
}

export interface SuggestionView extends Omit<SuggestionRecord, 'explanation_enc' | 'weaknesses_enc' | 'unsupported_claims_enc'> {
  explanation: string
  weaknesses: string | null
  unsupported_claims: string | null
}

/**
 * The ONLY write path for agent/system recommendations. Writes one row to
 * `suggestions` and nothing else — no approval, no review decision, no
 * version. A suggestion can never satisfy the packet freeze gate.
 */
export async function recordSuggestion(
  storage: VaultStorage,
  secret: string,
  input: SuggestionInput,
): Promise<SuggestionRecord> {
  if (!input.question_occurrence_id) throw new VaultScopeError('suggestion requires question_occurrence_id')
  if (!SUGGESTION_KINDS.includes(input.kind)) throw new VaultScopeError(`suggestion kind must be one of ${SUGGESTION_KINDS.join('|')}`)
  if (input.classification != null && !CLASSIFICATIONS.includes(input.classification)) {
    throw new VaultScopeError(`classification must be direct|adapt|gap`)
  }
  if (typeof input.explanation !== 'string' || isBlankBody(input.explanation)) {
    throw new VaultScopeError('suggestion explanation is required')
  }
  for (const code of input.reason_codes ?? []) {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(code)) throw new VaultScopeError(`reason code must be an identifier: ${code}`)
  }
  let candidateSha: string | null = null
  if (input.candidate_version_id) {
    const v = await storage.get<VersionRecord>('versions', input.candidate_version_id)
    if (!v) throw new VaultNotFoundError(`candidate version not found: ${input.candidate_version_id}`)
    candidateSha = v.sha256
  }
  const record: SuggestionRecord = {
    suggestion_id: newId(),
    instance_id: input.instance_id ?? null,
    question_occurrence_id: input.question_occurrence_id,
    kind: input.kind,
    classification: input.classification ?? null,
    candidate_version_id: input.candidate_version_id ?? null,
    candidate_version_sha256: candidateSha,
    reason_codes: [...new Set(input.reason_codes ?? [])],
    explanation_enc: await encryptField(secret, input.explanation),
    evidence_ids: [...new Set(input.evidence_ids ?? [])],
    provider: input.provider ?? null,
    model: input.model ?? null,
    created_at: nowIso(),
  }
  const w = await encryptOptionalField(secret, input.weaknesses)
  if (w) record.weaknesses_enc = w
  const u = await encryptOptionalField(secret, input.unsupported_claims)
  if (u) record.unsupported_claims_enc = u
  await storage.put('suggestions', record)
  return record
}

export async function listSuggestions(
  storage: VaultStorage,
  filter: { question_occurrence_id?: string; instance_id?: string | null } = {},
): Promise<SuggestionRecord[]> {
  const all = await storage.getAll<SuggestionRecord>('suggestions')
  return all
    .filter(
      (s) =>
        (!filter.question_occurrence_id || s.question_occurrence_id === filter.question_occurrence_id) &&
        (filter.instance_id === undefined || (s.instance_id ?? null) === filter.instance_id),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.suggestion_id.localeCompare(b.suggestion_id))
}

export async function readSuggestion(secret: string, rec: SuggestionRecord): Promise<SuggestionView> {
  const { explanation_enc, weaknesses_enc, unsupported_claims_enc, ...rest } = rec
  return {
    ...rest,
    explanation: await decryptField(secret, explanation_enc),
    weaknesses: await decryptOptionalField(secret, weaknesses_enc),
    unsupported_claims: await decryptOptionalField(secret, unsupported_claims_enc),
  }
}

/** Map a classifier result to a suggestion input (kind 'reuse'; a Gap with
    no candidate becomes kind 'evidence_gap' only when the caller asks). */
export function suggestionFromClassification(
  questionOccurrenceId: string,
  result: ReuseClassification,
  extra: { instance_id?: string | null; provider?: string | null; model?: string | null } = {},
): SuggestionInput {
  const label = result.classification.toUpperCase()
  const explanation = [
    `${label}${result.candidate_version_id ? ` (candidate ${result.candidate_version_id}, similarity ${result.similarity.toFixed(2)})` : ''}`,
    ...result.reasons.map((r) => `- ${r.message}`),
  ].join('\n')
  return {
    instance_id: extra.instance_id ?? null,
    question_occurrence_id: questionOccurrenceId,
    kind: 'reuse',
    classification: result.classification,
    candidate_version_id: result.candidate_version_id ?? null,
    reason_codes: result.reasons.map((r) => r.code),
    explanation,
    evidence_ids: result.evidence_ids,
    provider: extra.provider ?? null,
    model: extra.model ?? null,
  }
}

// ---------------------------------------------------------------------------
// Review export nonces (M09 hardening M2)
// ---------------------------------------------------------------------------
// Every offline review HTML export carries a fresh random nonce. The vault
// keeps only its sha256 (one append-only 'review_exported' ledger event), so
// a decision file can later be recognised as coming from an export THIS
// vault made. A file without a matching nonce is a "foreign file": still
// importable, but only after an extra explicit confirmation, and nothing in
// it is preselected.

const REVIEW_EXPORT_EVENT = 'review_exported'
const NONCE_RE = /^[0-9a-f]{32,128}$/

/** 32 random bytes, lowercase hex. */
export function newReviewExportNonce(): string {
  const b = new Uint8Array(32)
  globalThis.crypto.getRandomValues(b)
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

/** Record that a review export with `nonce` was made for `instance_id`. */
export async function recordReviewExport(
  storage: VaultStorage,
  input: { instance_id: string; nonce: string },
): Promise<void> {
  if (typeof input.instance_id !== 'string' || !input.instance_id) throw new VaultScopeError('review export requires instance_id')
  if (typeof input.nonce !== 'string' || !NONCE_RE.test(input.nonce)) throw new VaultScopeError('review export nonce must be lowercase hex')
  const nonce_sha256 = await sha256Hex(input.nonce)
  await storage.tx(['events'], async (s) => {
    await appendLedgerEvent(s, {
      kind: REVIEW_EXPORT_EVENT,
      entity: 'app_instance',
      entity_id: input.instance_id,
      payload: { nonce_sha256 },
      at: nowIso(),
    })
  })
}

/** True when `nonce` was issued by a review export of `instance_id` in this vault. */
export async function isKnownReviewExportNonce(
  storage: VaultStorage,
  input: { instance_id: string; nonce: string | null | undefined },
): Promise<boolean> {
  if (typeof input.nonce !== 'string' || !NONCE_RE.test(input.nonce)) return false
  const want = await sha256Hex(input.nonce)
  const events = await storage.getAll<EventRecord>('events')
  return events.some(
    (e) => e.kind === REVIEW_EXPORT_EVENT && e.entity_id === input.instance_id && (e.payload as { nonce_sha256?: unknown })?.nonce_sha256 === want,
  )
}
