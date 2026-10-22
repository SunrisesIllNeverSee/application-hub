// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// v5 (M09 W4) — review status derivation. PURE: no storage, no crypto, no
// clock. Two exports matter:
//
//   approvalGate(version, approvals, reviews)
//     The ONE definition of "this exact version is human-approved", shared by
//     the packet freeze gate (packets.ts) and status derivation, so the board
//     can never show `approved` for a version freeze would refuse.
//
//   deriveQuestionStatus(input)
//     Status for one question occurrence from its versions + approvals +
//     reviews + suggestions + packet inclusion. See STATUS PRECEDENCE below.
//
// STATUS PRECEDENCE (first match wins; the LATEST version governs):
//   0. no versions:  evidence_gap suggestion → needs_evidence
//                    any non-gap suggestion   → suggested
//                    otherwise                → gap
//   1. governing version passes approvalGate:
//                    included in a frozen packet → included_in_packet
//                    otherwise                   → approved
//   2. latest HUMAN governing decision on the governing version
//      (human approvals-ledger rows + human "reopening" review decisions,
//      hash-bound, not restored, seq-ordered):
//                    rejected (approval or review) → rejected
//                    superseded                    → superseded
//                    needs_revision                → needs_revision
//                    needs_evidence                → needs_evidence
//                    under_review                  → under_review
//                    approved-but-gate-failed      → under_review
//   3. latest HUMAN request (evidence_requested → needs_evidence,
//      help_requested → under_review). Requests never reopen an approval.
//   4. latest AGENT review decision (advisory; never approved/rejected):
//                    needs_evidence / evidence_requested → needs_evidence
//                    needs_revision / rejected           → needs_revision
//                    superseded                          → superseded
//                    under_review / help_requested       → under_review
//   5. evidence_gap suggestion, or evidence_required with no evidence → needs_evidence
//   6. legacy agent-class approval row, agent/provider-written or derived
//      (reused) version, or a suggestion naming it                → suggested
//   7. otherwise (human-authored draft awaiting a decision)        → under_review
//
// An approval of an OLDER version never makes the question approved: the
// newer version governs and `approved_version_id` reports the older one.

import type {
  ApprovalRecord,
  ReviewDecision,
  ReviewRecord,
  SuggestionRecord,
  VersionRecord,
} from './schema.ts'

export type QuestionStatusKind =
  | 'gap'
  | 'suggested'
  | 'needs_evidence'
  | 'needs_revision'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'superseded'
  | 'included_in_packet'

/** Human review decisions that reopen review (block/override an earlier
    approval). Requests (evidence_requested / help_requested) do not. */
export const REOPENING_REVIEW_DECISIONS: readonly ReviewDecision[] = [
  'under_review',
  'needs_evidence',
  'needs_revision',
  'rejected',
  'superseded',
]

/** Shared ordering for decision rows from the approvals and reviews
    ledgers: both allocate `seq` from the same events ledger, so seq is a
    total order across them. Seq-less (legacy / restored) rows sort before
    seq'd rows, then by (at, id) — mirrors compareApprovals. */
function compareDecisionRows(
  a: { seq?: number; at: string; id: string },
  b: { seq?: number; at: string; id: string },
): number {
  if (a.seq != null && b.seq != null) return a.seq - b.seq
  if (a.seq != null) return 1
  if (b.seq != null) return -1
  return a.at.localeCompare(b.at) || a.id.localeCompare(b.id)
}

const approvalKey = (a: ApprovalRecord) => ({ seq: a.seq, at: a.at, id: a.id })
const reviewKey = (r: ReviewRecord) => ({ seq: r.seq, at: r.at, id: r.review_id })

export interface ApprovalGate {
  /** Latest approvals-ledger row for the version IF it is a live, hash-bound,
      human row (else null) — exactly what pre-v5 freeze treated as "the
      latest decision". */
  approval: ApprovalRecord | null
  /** A later human reopening review decision that blocks the approval. */
  blocked_by_review: ReviewRecord | null
  /** approval is 'approved' and nothing later reopened it. */
  approved: boolean
}

/**
 * The freeze gate. Rules (fail closed):
 *   - the LATEST approvals row for the version decides (seq order);
 *   - it must be actor_class 'human', not restored_from_backup, and its
 *     version_sha256 must equal the stored version sha256 (F-V1);
 *   - v5: a later HUMAN, hash-bound, non-restored review decision in
 *     REOPENING_REVIEW_DECISIONS blocks it (review reopened ⇒ re-approve).
 * Agent-class review decisions and suggestions can never satisfy or
 * block this gate.
 */
/** M09b: a `history_attestation` approval counts only with its submission
    date and the user's encrypted statement (repo.ts recordHistoryAttestation
    always writes both); a row missing either is not a human approval. */
function historyAttestationComplete(a: ApprovalRecord): boolean {
  if (a.via !== 'history_attestation') return true
  return (
    typeof a.effective_at === 'string' && /^\d{4}-\d{2}-\d{2}/.test(a.effective_at) &&
    typeof a.attestation_enc === 'string' && a.attestation_enc.length > 0
  )
}

export function approvalGate(
  version: Pick<VersionRecord, 'id' | 'sha256'>,
  approvals: ApprovalRecord[],
  reviews: ReviewRecord[] = [],
): ApprovalGate {
  const forVersion = approvals
    .filter((a) => a.version_id === version.id)
    .sort((a, b) => compareDecisionRows(approvalKey(a), approvalKey(b)))
  const latest = forVersion.at(-1) ?? null
  const live =
    latest &&
    !latest.restored_from_backup &&
    latest.actor_class === 'human' &&
    latest.version_sha256 === version.sha256 &&
    historyAttestationComplete(latest)
      ? latest
      : null
  if (!live) return { approval: null, blocked_by_review: null, approved: false }
  const reopen = reviews
    .filter(
      (r) =>
        r.version_id === version.id &&
        r.actor_class === 'human' &&
        !r.restored_from_backup &&
        r.version_sha256 === version.sha256 &&
        REOPENING_REVIEW_DECISIONS.includes(r.decision) &&
        compareDecisionRows(reviewKey(r), approvalKey(live)) > 0,
    )
    .sort((a, b) => compareDecisionRows(reviewKey(a), reviewKey(b)))
    .at(-1) ?? null
  return {
    approval: live,
    blocked_by_review: reopen,
    approved: live.decision === 'approved' && !reopen,
  }
}

export interface QuestionStatusInput {
  /** Every version bound to this question scope (any order). */
  versions: VersionRecord[]
  /** Approvals rows — may include unrelated versions (filtered here). */
  approvals: ApprovalRecord[]
  reviews: ReviewRecord[]
  /** Suggestions for this occurrence (caller filters by occurrence/instance). */
  suggestions: SuggestionRecord[]
  /** Version ids bound into frozen packets for this application. */
  packet_version_ids?: Iterable<string>
  /** Evidence ids attached to the governing version (version.evidence_ids ∪ links). */
  governing_evidence_ids?: string[]
  /** When true, a governing version with no evidence is needs_evidence. */
  evidence_required?: boolean
}

export interface QuestionStatus {
  status: QuestionStatusKind
  governing_version_id: string | null
  governing_version_sha256: string | null
  /** Newest version holding a live human approval (may be older than governing). */
  approved_version_id: string | null
  /** The governing version would pass the packet freeze approval gate. */
  freeze_eligible: boolean
  /** Which class of actor produced the governing signal. */
  decided_by: 'human' | 'agent' | 'system' | null
  /** Machine-readable explanation codes. */
  reasons: string[]
}

function sortVersions(versions: VersionRecord[]): VersionRecord[] {
  return [...versions].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  )
}

const HUMAN_DECISION_STATUS: Record<ReviewDecision, QuestionStatusKind> = {
  under_review: 'under_review',
  needs_evidence: 'needs_evidence',
  needs_revision: 'needs_revision',
  rejected: 'rejected',
  superseded: 'superseded',
  evidence_requested: 'needs_evidence',
  help_requested: 'under_review',
}

const AGENT_DECISION_STATUS: Record<ReviewDecision, QuestionStatusKind> = {
  under_review: 'under_review',
  needs_evidence: 'needs_evidence',
  needs_revision: 'needs_revision',
  rejected: 'needs_revision', // an agent cannot reject — advisory only
  superseded: 'superseded',
  evidence_requested: 'needs_evidence',
  help_requested: 'under_review',
}

export function deriveQuestionStatus(input: QuestionStatusInput): QuestionStatus {
  const versions = sortVersions(input.versions)
  const reasons: string[] = []

  if (versions.length === 0) {
    const base = {
      governing_version_id: null,
      governing_version_sha256: null,
      approved_version_id: null,
      freeze_eligible: false,
    }
    if (input.suggestions.some((s) => s.kind === 'evidence_gap')) {
      return { ...base, status: 'needs_evidence', decided_by: 'system', reasons: ['evidence_gap_suggested'] }
    }
    if (input.suggestions.some((s) => s.classification !== 'gap')) {
      return { ...base, status: 'suggested', decided_by: 'agent', reasons: ['suggestion_without_version'] }
    }
    return { ...base, status: 'gap', decided_by: null, reasons: ['no_version'] }
  }

  const governing = versions[versions.length - 1]
  const reviewsFor = input.reviews.filter(
    (r) =>
      r.version_id === governing.id &&
      !r.restored_from_backup &&
      r.version_sha256 === governing.sha256,
  )

  // Newest version (any) holding a live approval.
  let approvedVersionId: string | null = null
  for (const v of versions) {
    if (approvalGate(v, input.approvals, input.reviews).approved) approvedVersionId = v.id
  }

  const out = (
    status: QuestionStatusKind,
    decided_by: QuestionStatus['decided_by'],
    freeze_eligible = false,
  ): QuestionStatus => ({
    status,
    governing_version_id: governing.id,
    governing_version_sha256: governing.sha256,
    approved_version_id: approvedVersionId,
    freeze_eligible,
    decided_by,
    reasons,
  })

  if (approvedVersionId && approvedVersionId !== governing.id) {
    reasons.push('newer_version_not_approved')
  }

  // 1 — gate
  const gate = approvalGate(governing, input.approvals, input.reviews)
  if (gate.approved) {
    const inPacket = new Set(input.packet_version_ids ?? [])
    if (inPacket.has(governing.id)) return out('included_in_packet', 'human', true)
    return out('approved', 'human', true)
  }

  // 2 — latest human governing decision
  type Row = { seq?: number; at: string; id: string; kind: 'approval' | 'review'; decision: string }
  const humanRows: Row[] = [
    ...input.approvals
      .filter(
        (a) =>
          a.version_id === governing.id &&
          a.actor_class === 'human' &&
          !a.restored_from_backup &&
          a.version_sha256 === governing.sha256,
      )
      .map((a) => ({ ...approvalKey(a), kind: 'approval' as const, decision: a.decision })),
    ...reviewsFor
      .filter((r) => r.actor_class === 'human' && REOPENING_REVIEW_DECISIONS.includes(r.decision))
      .map((r) => ({ ...reviewKey(r), kind: 'review' as const, decision: r.decision })),
  ].sort(compareDecisionRows)
  const latestHuman = humanRows.at(-1)
  if (latestHuman) {
    if (latestHuman.kind === 'approval') {
      if (latestHuman.decision === 'rejected') {
        reasons.push('human_rejected')
        return out('rejected', 'human')
      }
      // A human approval exists but the gate failed — the latest approvals
      // row is agent-class (legacy advisory) or otherwise not live.
      reasons.push('approval_not_latest_decision')
      return out('under_review', 'human')
    }
    reasons.push(`human_${latestHuman.decision}`)
    return out(HUMAN_DECISION_STATUS[latestHuman.decision as ReviewDecision], 'human')
  }

  // 3 — human requests
  const latestRequest = reviewsFor
    .filter((r) => r.actor_class === 'human' && !REOPENING_REVIEW_DECISIONS.includes(r.decision))
    .sort((a, b) => compareDecisionRows(reviewKey(a), reviewKey(b)))
    .at(-1)
  if (latestRequest) {
    reasons.push(`human_${latestRequest.decision}`)
    return out(HUMAN_DECISION_STATUS[latestRequest.decision], 'human')
  }

  // 4 — agent review (advisory)
  const latestAgent = reviewsFor
    .filter((r) => r.actor_class === 'agent')
    .sort((a, b) => compareDecisionRows(reviewKey(a), reviewKey(b)))
    .at(-1)
  if (latestAgent) {
    reasons.push(`agent_${latestAgent.decision}`)
    return out(AGENT_DECISION_STATUS[latestAgent.decision], 'agent')
  }

  // 5 — evidence gap
  const forGoverning = input.suggestions.filter(
    (s) => !s.candidate_version_id || s.candidate_version_id === governing.id,
  )
  if (forGoverning.some((s) => s.kind === 'evidence_gap')) {
    reasons.push('evidence_gap_suggested')
    return out('needs_evidence', 'system')
  }
  if (input.evidence_required && (input.governing_evidence_ids ?? governing.evidence_ids ?? []).length === 0) {
    reasons.push('evidence_required_none_linked')
    return out('needs_evidence', 'system')
  }

  // 6 — machine-originated / reused draft
  const agentApprovalRow = input.approvals.some(
    (a) => a.version_id === governing.id && a.actor_class === 'agent',
  )
  if (agentApprovalRow) {
    reasons.push('agent_recommended')
    return out('suggested', 'agent')
  }
  if (governing.method === 'byok' || governing.method === 'app_provider') {
    reasons.push('provider_generated')
    return out('suggested', 'agent')
  }
  if (governing.derived_from) {
    reasons.push('reused_from_other_answer')
    return out('suggested', 'system')
  }
  if (input.suggestions.some((s) => s.candidate_version_id === governing.id)) {
    reasons.push('named_by_suggestion')
    return out('suggested', 'agent')
  }

  // 7 — human draft awaiting decision
  reasons.push('awaiting_human_decision')
  return out('under_review', null)
}
