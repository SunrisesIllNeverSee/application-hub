// M09 W5 — evidence-based review interface: PURE view-model derivation.
//
// Everything the review card, the review board and the HTML review export
// render comes from these functions, so the in-app card and the offline file
// can never disagree about what a version's status, hash or evidence is.
// No storage, no crypto, no clock (callers pass `now`). Relative imports only
// so node type-stripping can run the tests (tests/review-ui.test.mjs).
//
// Separation rule (directive §7): the four signals below are NEVER merged
// into one badge —
//   status          derived question status (status.ts deriveQuestionStatus)
//   recommendation  agent/system advice (Direct/Adapt/Gap, suggestions)
//   human review    latest human review decision on the displayed version
//   approval        live, hash-bound human approval of the displayed version

import { approvalGate, REOPENING_REVIEW_DECISIONS } from '../aqua-local/status.ts'
import type { QuestionStatus, QuestionStatusKind } from '../aqua-local/status.ts'
import { charCount, wordCount } from '../aqua-local/classify.ts'
import type { ReuseClassification, ReuseReason } from '../aqua-local/classify.ts'
import { similarityScore } from '../aqua-local/match.ts'
import type {
  ApprovalRecord,
  EvidenceVerification,
  ReviewDecision,
  ReviewRecord,
  VersionMethod,
  VersionRecord,
} from '../aqua-local/schema.ts'
import type { EvidenceView, FactView } from '../aqua-local/knowledge.ts'
import type { CommentView, SuggestionView } from '../aqua-local/review-ledger.ts'

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export type Tone = 'neutral' | 'info' | 'warning' | 'danger' | 'success'

export const STATUS_LABEL: Record<QuestionStatusKind, string> = {
  gap: 'Gap — no answer yet',
  suggested: 'Suggested',
  needs_evidence: 'Needs evidence',
  needs_revision: 'Needs revision',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  superseded: 'Superseded',
  included_in_packet: 'Included in packet',
}

export const STATUS_TONE: Record<QuestionStatusKind, Tone> = {
  gap: 'danger',
  suggested: 'info',
  needs_evidence: 'warning',
  needs_revision: 'warning',
  under_review: 'neutral',
  approved: 'success',
  rejected: 'danger',
  superseded: 'neutral',
  included_in_packet: 'success',
}

export const REVIEW_DECISION_LABEL: Record<ReviewDecision, string> = {
  under_review: 'Under review',
  needs_evidence: 'Needs evidence',
  needs_revision: 'Needs revision',
  rejected: 'Rejected',
  superseded: 'Superseded',
  evidence_requested: 'Evidence requested',
  help_requested: 'Help requested',
}

export const METHOD_LABEL: Record<VersionMethod, string> = {
  manual: 'Written by you',
  byok: 'AI draft · your key',
  app_provider: 'AI draft · hosted provider',
  imported: 'Imported',
}

/** M09 hardening (W8): drafts the companion's agent tool wrote are stored as
    method 'byok' with an 'agent: drafted through aqua-companion …' provenance
    note — label them for what they are, not as the user's own AI draft. */
export const AGENT_DRAFT_LABEL = 'Drafted by agent (companion)'
export function isCompanionAgentDraft(v: Pick<VersionRecord, 'method' | 'provenance'>): boolean {
  const p = typeof v.provenance === 'string' ? v.provenance.trim() : ''
  return v.method === 'byok' && (/^agent:/i.test(p) || /aqua-companion/i.test(p))
}
export function versionMethodLabel(v: Pick<VersionRecord, 'method' | 'provenance'>): string {
  if (isCompanionAgentDraft(v)) return AGENT_DRAFT_LABEL
  return METHOD_LABEL[v.method] ?? v.method
}

/** M09 hardening M2/M3: where a comment came from, when it is not this browser's own. */
export const COMMENT_SOURCE_LABEL = {
  decision_file: 'Imported from decision file',
  companion: 'From companion — review',
} as const
export function commentSource(c: { via?: string | null; actor_class: string }): keyof typeof COMMENT_SOURCE_LABEL | null {
  if (c.via === 'decision_file') return 'decision_file'
  if (c.via === 'companion' || c.actor_class === 'agent') return 'companion'
  return null
}

export const VERIFICATION_LABEL: Record<EvidenceVerification, string> = {
  unverified: 'Unverified',
  user_confirmed: 'Confirmed by you',
  source_checked: 'Source checked',
}

export const CLASSIFICATION_LABEL = {
  direct: 'Direct — an approved answer already fits',
  adapt: 'Adapt — related answer needs revision',
  gap: 'Gap — no suitable answer in your bank',
} as const

export const STATUS_REASON_LABEL: Record<string, string> = {
  no_version: 'No answer has been written for this question.',
  evidence_gap_suggested: 'An evidence gap was flagged for this answer.',
  suggestion_without_version: 'A suggestion exists but no answer version yet.',
  newer_version_not_approved: 'An older version is approved; the newest version is not.',
  human_rejected: 'You rejected this version.',
  approval_not_latest_decision: 'A later decision overrides the approval.',
  human_under_review: 'You marked this version as under review.',
  human_needs_evidence: 'You asked for evidence on this version.',
  human_needs_revision: 'You asked for a revision of this version.',
  human_superseded: 'You marked this version as superseded.',
  human_evidence_requested: 'You requested supporting evidence.',
  human_help_requested: 'You asked for help or an explanation.',
  agent_needs_evidence: 'An agent review flagged missing evidence (advisory).',
  agent_needs_revision: 'An agent review suggested revision (advisory).',
  agent_under_review: 'An agent review is pending (advisory).',
  agent_superseded: 'An agent marked this as superseded (advisory).',
  agent_evidence_requested: 'An agent requested evidence (advisory).',
  agent_help_requested: 'An agent requested help (advisory).',
  agent_rejected: 'An agent flagged this version (advisory).',
  evidence_required_none_linked: 'Evidence is required and none is linked.',
  agent_recommended: 'An agent recommended this version — not a human approval.',
  provider_generated: 'Drafted by an AI provider — needs your review.',
  reused_from_other_answer: 'Reused from another answer — needs your review.',
  named_by_suggestion: 'Proposed by a suggestion — needs your review.',
  awaiting_human_decision: 'Waiting for your decision.',
}

export function shaPrefix(sha: string | null | undefined, n = 12): string {
  return sha ? sha.slice(0, n) : ''
}

// ---------------------------------------------------------------------------
// Counting / limits
// ---------------------------------------------------------------------------

export interface LimitCheck {
  word_count: number
  char_count: number
  word_limit: number | null
  char_limit: number | null
  over_word_by: number
  over_char_by: number
  over_limit: boolean
}

export function checkLimits(body: string, wordLimit: number | null | undefined, charLimit: number | null | undefined): LimitCheck {
  const word_count = wordCount(body)
  const char_count = charCount(body)
  const wl = wordLimit ?? null
  const cl = charLimit ?? null
  const over_word_by = wl != null && word_count > wl ? word_count - wl : 0
  const over_char_by = cl != null && char_count > cl ? char_count - cl : 0
  return { word_count, char_count, word_limit: wl, char_limit: cl, over_word_by, over_char_by, over_limit: over_word_by > 0 || over_char_by > 0 }
}

export function requirementsOf(q: {
  required?: boolean
  word_limit?: number | null
  char_limit?: number | null
}): string[] {
  const out: string[] = [q.required ? 'Required' : 'Optional']
  if (q.word_limit) out.push(`Max ${q.word_limit} words`)
  if (q.char_limit) out.push(`Max ${q.char_limit} characters`)
  if (!q.word_limit && !q.char_limit) out.push('No stated length limit')
  return out
}

/** Paragraphs for readable rendering (blank-line separated; single newlines kept). */
export function paragraphsOf(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000)
}

export function freshnessLabel(checkedAt: string | null, now: string): { label: string; stale: boolean } {
  if (!checkedAt) return { label: 'Never checked', stale: true }
  const d = daysBetween(checkedAt, now)
  if (d <= 0) return { label: 'Checked today', stale: false }
  if (d === 1) return { label: 'Checked yesterday', stale: false }
  return { label: `Checked ${d} days ago`, stale: d > 180 }
}

export function deadlineLabel(deadline: string | null | undefined, now: string): string | null {
  if (!deadline) return null
  const t = Date.parse(deadline)
  if (!Number.isFinite(t)) return deadline
  const d = Math.ceil((t - Date.parse(now)) / 86_400_000)
  const date = deadline.slice(0, 10)
  if (d < 0) return `${date} (passed)`
  if (d === 0) return `${date} (today)`
  return `${date} (${d} day${d === 1 ? '' : 's'} left)`
}

// ---------------------------------------------------------------------------
// Fact conflicts (heuristic, local, advisory)
// ---------------------------------------------------------------------------

export interface FactConflict {
  fact_key: string
  fact_value: string
  kind: 'number_mismatch' | 'value_not_stated'
  sentence: string
  message: string
}

const KEY_NOISE = new Set(['org', 'organization', 'personal', 'project', 'company', 'my', 'the', 'of', 'in', 'count', 'num', 'number', 'total'])

function keyTerms(key: string): string[] {
  return key
    .toLowerCase()
    .split(/[._:-]+/)
    .filter((t) => t.length >= 3 && !KEY_NOISE.has(t))
}

function sentencesOf(body: string): string[] {
  return body
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function escapeRegExp(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Plain numbers in a sentence; percentages are rates, not counts — skipped. */
function numbersIn(s: string): string[] {
  return [...s.matchAll(/\d[\d,]*(?:\.\d+)?(?!\s*%|[\d.,])/g)].map((m) => m[0].replace(/,/g, ''))
}

/**
 * Compare the answer against the user's recorded facts. A fact `key` like
 * `org.employees` contributes the term "employees"; a sentence mentioning a
 * term but stating a different number (or not stating the recorded value)
 * is reported. Advisory only — shown under "Agent recommendation".
 */
export function detectFactConflicts(body: string, facts: FactView[]): FactConflict[] {
  const out: FactConflict[] = []
  const sentences = sentencesOf(body)
  for (const f of facts) {
    if (f.retracted || !f.value) continue
    const value = f.value.trim()
    if (!value || value.length > 80) continue
    const terms = keyTerms(f.key)
    if (terms.length === 0) continue
    const valueNorm = value.toLowerCase()
    const valueNum = /^\d[\d,]*(?:\.\d+)?$/.test(value) ? value.replace(/,/g, '') : null
    for (const s of sentences) {
      const lower = s.toLowerCase()
      const term = terms.find((t) => new RegExp('\\b' + escapeRegExp(t), 'i').test(lower))
      if (!term) continue
      if (lower.includes(valueNorm)) continue
      if (valueNum) {
        const isYear = (n: string) => /^(19|20)\d\d$/.test(n)
        const nums = [...new Set(numbersIn(s))].filter((n) => isYear(valueNum) || !isYear(n))
        if (nums.length > 0 && !nums.includes(valueNum)) {
          out.push({
            fact_key: f.key,
            fact_value: value,
            kind: 'number_mismatch',
            sentence: s,
            message: `Mentions "${term}" with ${nums.join(', ')}, but your fact ${f.key} = ${value}.`,
          })
          break
        }
      } else {
        out.push({
          fact_key: f.key,
          fact_value: value,
          kind: 'value_not_stated',
          sentence: s,
          message: `Mentions "${term}" but not your recorded value for ${f.key} ("${value}").`,
        })
        break
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Card view model
// ---------------------------------------------------------------------------

export interface CardQuestionInput {
  question_occurrence_id: string
  canonical_question_id: string | null
  /** Exact wording as presented by this application (asked_as). */
  text: string | null
  /** Canonical question wording, when known and matched. */
  canonical_text?: string | null
  word_limit: number | null
  char_limit: number | null
  required: boolean
  section_id?: string | null
}

export interface CardInput {
  instance_id: string
  program_name: string | null
  org_name: string | null
  deadline: string | null
  question: CardQuestionInput
  /** Versions in this scope, any order. */
  versions: VersionRecord[]
  approvals: ApprovalRecord[]
  reviews: ReviewRecord[]
  /** Decrypted rationales keyed by review_id. */
  review_notes?: Record<string, string | null>
  provenance?: Record<string, { provider: string | null; model: string | null } | undefined>
  /** Decrypted governing version (null when there are no versions). */
  governing: { title: string; body: string } | null
  /** Cross-question source of the governing version, when derived. */
  derived_source?: {
    version_id: string
    version_sha256: string
    question_occurrence_id: string | null
    application_id: string | null
    title: string | null
    found: boolean
  } | null
  evidence: EvidenceView[]
  missing_evidence_ids?: string[]
  suggestions: SuggestionView[]
  comments: CommentView[]
  facts: FactView[]
  status: QuestionStatus
  /** Bank reuse classification for this question (advisory). */
  classification: ReuseClassification | null
  /** Classifier run on the CURRENT body against this question (weaknesses). */
  self_check?: ReuseClassification | null
  now: string
}

export interface ApprovalVM {
  state: 'approved' | 'approved_older' | 'revoked' | 'restored_only' | 'not_approved' | 'no_version'
  label: string
  detail: string
  /** Hash prefix the live approval is bound to (approved state only). */
  bound_sha_prefix: string | null
  approved_version_number: number | null
  at: string | null
  via: string | null
}

export interface VersionHistoryVM {
  id: string
  number: number
  sha256: string
  sha_prefix: string
  created_at: string
  method: VersionMethod
  method_label: string
  parent_version_id: string | null
  parent_number: number | null
  derived_from_version_id: string | null
  is_governing: boolean
  approved: boolean
  decisions: Array<{
    kind: 'approval' | 'revocation' | 'review'
    label: string
    actor_class: string
    at: string
    via: string | null
    restored: boolean
    hash_matches: boolean
    note: string | null
  }>
}

export interface EvidenceItemVM {
  evidence_id: string
  kind: string
  title: string
  excerpt: string | null
  url: string | null
  verification: EvidenceVerification
  verification_label: string
  freshness_label: string
  stale: boolean
  captured_at: string
  content_sha_prefix: string
}

export interface CommentVM {
  comment_id: string
  thread_id: string
  parent_comment_id: string | null
  body: string
  actor_class: string
  at: string
  version_id: string
  version_number: number | null
  on_label: string
  on_current_version: boolean
  /** null = written in this browser; otherwise imported (decision file) or staged by the companion. */
  source: keyof typeof COMMENT_SOURCE_LABEL | null
  source_label: string | null
}

export interface ReviewCardVM {
  instance_id: string
  question_occurrence_id: string
  context: {
    program_name: string | null
    org_name: string | null
    original_question: string | null
    canonical_question_id: string | null
    canonical_text: string | null
    requirements: string[]
    word_limit: number | null
    char_limit: number | null
    deadline: string | null
    deadline_label: string | null
    section_id: string | null
  }
  answer: null | {
    version_id: string
    sha256: string
    sha_prefix: string
    version_number: number
    version_count: number
    title: string
    body: string
    paragraphs: string[]
    limits: LimitCheck
    method: VersionMethod
    method_label: string
    provider: string | null
    model: string | null
    created_at: string
    parent_version_id: string | null
  }
  status: { kind: QuestionStatusKind; label: string; tone: Tone; reasons: string[]; decided_by: string | null }
  approval: ApprovalVM
  human_review: { decision: ReviewDecision | null; label: string; at: string | null; note: string | null }
  recommendation_badge: { classification: 'direct' | 'adapt' | 'gap' | null; label: string }
  evidence: {
    items: EvidenceItemVM[]
    missing_ids: string[]
    gap: boolean
    uncertain_claims: Array<{ text: string; source: 'agent' | 'challenge' }>
    lineage: VersionHistoryVM[]
    derived_from: CardInput['derived_source'] | null
  }
  recommendation: {
    classification: 'direct' | 'adapt' | 'gap' | null
    classification_label: string
    classification_reasons: string[]
    candidate: { version_id: string; similarity: number } | null
    why: string[]
    closeness: { score: number; label: string } | null
    weaknesses: string[]
    missing_evidence: string[]
    fact_conflicts: FactConflict[]
    improvements: string[]
    agent_notes: Array<{ kind: string; explanation: string; provider: string | null; model: string | null; created_at: string }>
  }
  comments: { threads: Array<{ thread_id: string; comments: CommentVM[] }>; total: number }
}

function sortVersions(vs: VersionRecord[]): VersionRecord[] {
  return [...vs].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

function seqOrder(a: { seq?: number; at: string }, b: { seq?: number; at: string }): number {
  if (a.seq != null && b.seq != null) return a.seq - b.seq
  if (a.seq != null) return 1
  if (b.seq != null) return -1
  return a.at.localeCompare(b.at)
}

function reasonText(r: ReuseReason): string {
  return r.message
}

function improvementFor(r: ReuseReason): string | null {
  switch (r.code) {
    case 'over_word_limit':
      return `Trim about ${r.over_by} word${r.over_by === 1 ? '' : 's'} to fit the ${r.limit}-word limit.`
    case 'over_char_limit':
      return `Cut about ${r.over_by} character${r.over_by === 1 ? '' : 's'} to fit the ${r.limit}-character limit.`
    case 'mentions_other_program':
      return `Remove or replace references to ${(r.names ?? []).join(', ') || 'another program'}.`
    case 'dated_year':
      return `Update dated year references (${(r.years ?? []).join(', ')}).`
    case 'different_question_qualifier':
      return `Address the question's extra qualifiers: ${(r.qualifiers ?? []).join(', ')}.`
    case 'different_question':
      return 'Re-check that the answer responds to this exact question.'
    default:
      return null
  }
}

export function buildCardViewModel(input: CardInput): ReviewCardVM {
  const versions = sortVersions(input.versions)
  const numberOf = new Map(versions.map((v, i) => [v.id, i + 1]))
  const governing = versions.at(-1) ?? null
  const notes = input.review_notes ?? {}

  // ---- version history / lineage ------------------------------------------
  const lineage: VersionHistoryVM[] = versions.map((v) => {
    const gate = approvalGate(v, input.approvals, input.reviews)
    const decisions: VersionHistoryVM['decisions'] = [
      ...input.approvals
        .filter((a) => a.version_id === v.id)
        .map((a) => ({
          row: a as { seq?: number; at: string },
          d: {
            kind: (a.decision === 'approved' ? 'approval' : 'revocation') as 'approval' | 'revocation',
            label:
              a.decision === 'approved'
                ? a.actor_class === 'human'
                  ? 'Approved by human'
                  : 'Agent approval row (advisory, never counts)'
                : a.actor_class === 'human'
                  ? 'Approval revoked / rejected by human'
                  : 'Agent rejection (advisory)',
            actor_class: a.actor_class,
            at: a.at,
            via: a.via ?? null,
            restored: a.restored_from_backup === true,
            hash_matches: a.version_sha256 === v.sha256,
            note: null,
          },
        })),
      ...input.reviews
        .filter((r) => r.version_id === v.id)
        .map((r) => ({
          row: r as { seq?: number; at: string },
          d: {
            kind: 'review' as const,
            label: `${REVIEW_DECISION_LABEL[r.decision]}${r.actor_class === 'agent' ? ' (agent, advisory)' : ''}`,
            actor_class: r.actor_class,
            at: r.at,
            via: null,
            restored: r.restored_from_backup === true,
            hash_matches: r.version_sha256 === v.sha256,
            note: notes[r.review_id] ?? null,
          },
        })),
    ]
      .sort((a, b) => seqOrder(a.row, b.row))
      .map((x) => x.d)
    return {
      id: v.id,
      number: numberOf.get(v.id)!,
      sha256: v.sha256,
      sha_prefix: shaPrefix(v.sha256),
      created_at: v.created_at,
      method: v.method,
      method_label: versionMethodLabel(v),
      parent_version_id: v.parent_version_id,
      parent_number: v.parent_version_id ? numberOf.get(v.parent_version_id) ?? null : null,
      derived_from_version_id: v.derived_from?.version_id ?? null,
      is_governing: governing?.id === v.id,
      approved: gate.approved,
      decisions,
    }
  })

  // ---- approval -------------------------------------------------------------
  let approval: ApprovalVM
  if (!governing) {
    approval = { state: 'no_version', label: 'Nothing to approve', detail: 'No answer version exists yet.', bound_sha_prefix: null, approved_version_number: null, at: null, via: null }
  } else {
    const gate = approvalGate(governing, input.approvals, input.reviews)
    const older = [...lineage].reverse().find((l) => !l.is_governing && l.approved) ?? null
    const governingHumanRows = input.approvals
      .filter((a) => a.version_id === governing.id && a.actor_class === 'human')
      .sort(seqOrder)
    const latestHuman = governingHumanRows.at(-1) ?? null
    if (gate.approved && gate.approval) {
      approval = {
        state: 'approved',
        label: `Approved by you — v${numberOf.get(governing.id)}`,
        detail: `Bound to sha256 ${shaPrefix(gate.approval.version_sha256)}… — any edit creates a new version that needs a new approval.`,
        bound_sha_prefix: shaPrefix(gate.approval.version_sha256),
        approved_version_number: numberOf.get(governing.id)!,
        at: gate.approval.at,
        via: gate.approval.via ?? null,
      }
    } else if (latestHuman && latestHuman.decision === 'rejected' && !latestHuman.restored_from_backup) {
      approval = { state: 'revoked', label: 'Not approved — revoked / rejected', detail: 'Your latest approval decision on this version is a rejection.', bound_sha_prefix: null, approved_version_number: null, at: latestHuman.at, via: latestHuman.via ?? null }
    } else if (older) {
      approval = {
        state: 'approved_older',
        label: `Not approved — v${older.number} was approved, v${numberOf.get(governing.id)} is not`,
        detail: `The approval of v${older.number} (sha256 ${older.sha_prefix}…) does not carry over to edited versions.`,
        bound_sha_prefix: null,
        approved_version_number: older.number,
        at: null,
        via: null,
      }
    } else if (governingHumanRows.some((a) => a.restored_from_backup)) {
      approval = { state: 'restored_only', label: 'Not approved — restored decision only', detail: 'A decision restored from a backup never counts. Approve again to bind it on this device.', bound_sha_prefix: null, approved_version_number: null, at: null, via: null }
    } else if (gate.blocked_by_review) {
      approval = { state: 'not_approved', label: 'Not approved — review reopened', detail: 'A later review decision reopened this version; approve again if it is ready.', bound_sha_prefix: null, approved_version_number: null, at: null, via: null }
    } else {
      approval = { state: 'not_approved', label: 'Not approved', detail: 'Only your explicit approval of this exact version counts.', bound_sha_prefix: null, approved_version_number: null, at: null, via: null }
    }
  }

  // ---- human review ---------------------------------------------------------
  const humanReviews = governing
    ? input.reviews
        .filter((r) => r.version_id === governing.id && r.actor_class === 'human' && !r.restored_from_backup && r.version_sha256 === governing.sha256)
        .sort(seqOrder)
    : []
  const lastReview = humanReviews.at(-1) ?? null
  const human_review = lastReview
    ? { decision: lastReview.decision, label: REVIEW_DECISION_LABEL[lastReview.decision], at: lastReview.at, note: notes[lastReview.review_id] ?? null }
    : { decision: null, label: 'No human review decision yet', at: null, note: null }

  // ---- evidence -------------------------------------------------------------
  const items: EvidenceItemVM[] = input.evidence.map((e) => {
    const fresh = freshnessLabel(e.freshness_checked_at, input.now)
    return {
      evidence_id: e.evidence_id,
      kind: e.kind,
      title: e.title,
      excerpt: e.excerpt,
      url: e.url,
      verification: e.verification,
      verification_label: VERIFICATION_LABEL[e.verification] ?? e.verification,
      freshness_label: fresh.label,
      stale: fresh.stale,
      captured_at: e.captured_at,
      content_sha_prefix: shaPrefix(e.content_sha256),
    }
  })
  const forGoverning = input.suggestions.filter((s) => !s.candidate_version_id || s.candidate_version_id === governing?.id)
  const uncertain: ReviewCardVM['evidence']['uncertain_claims'] = []
  for (const s of forGoverning) {
    for (const line of (s.unsupported_claims ?? '').split('\n').map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean)) {
      uncertain.push({ text: line, source: 'agent' })
    }
  }
  for (const r of humanReviews) {
    const note = notes[r.review_id]
    if (r.decision === 'evidence_requested' && note && /^challenged claim:/i.test(note)) {
      uncertain.push({ text: note.replace(/^challenged claim:\s*/i, ''), source: 'challenge' })
    }
  }

  // ---- recommendation -------------------------------------------------------
  const cls = input.classification
  const why: string[] = []
  const weaknesses: string[] = []
  const improvements: string[] = []
  const missing_evidence: string[] = []
  if (governing) {
    if (governing.derived_from) why.push('Started from another answer in your bank (provenance recorded, approval not transferred).')
    if (governing.method === 'byok' || governing.method === 'app_provider') why.push('Drafted by an AI provider at your request.')
    if (governing.method === 'manual' && !governing.derived_from) why.push('Written or edited by you.')
  }
  for (const s of forGoverning) {
    if (s.kind === 'recommendation' || s.kind === 'draft') why.push(s.explanation)
    if (s.weaknesses) weaknesses.push(...s.weaknesses.split('\n').map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean))
  }
  const self = input.self_check
  if (self) {
    for (const r of self.reasons) {
      if (r.code === 'unapproved' || r.code === 'no_related_answer') continue
      weaknesses.push(reasonText(r))
      const imp = improvementFor(r)
      if (imp) improvements.push(imp)
    }
  }
  let closeness: ReviewCardVM['recommendation']['closeness'] = null
  if (governing && input.governing && input.question.text) {
    const score = similarityScore(input.question.text, input.governing.body)
    closeness = {
      score,
      label: `${Math.round(score * 100)}% term overlap with the question (${score >= 0.55 ? 'high' : score >= 0.3 ? 'medium' : 'low'}). Local word-overlap check, not AI and not a quality score — good answers often use different words.`,
    }
  }
  if (governing && items.length === 0) {
    missing_evidence.push('No evidence linked to this version.')
    improvements.push('Attach a note, link, passage or file excerpt that supports the key claims.')
  }
  const unverified = items.filter((i) => i.verification === 'unverified').length
  if (unverified > 0) missing_evidence.push(`${unverified} linked evidence item${unverified === 1 ? ' is' : 's are'} unverified.`)
  const staleCount = items.filter((i) => i.stale).length
  if (staleCount > 0) missing_evidence.push(`${staleCount} evidence item${staleCount === 1 ? ' has' : 's have'} not been checked recently.`)
  for (const s of forGoverning.filter((x) => x.kind === 'evidence_gap')) missing_evidence.push(s.explanation)
  if (uncertain.length > 0) missing_evidence.push(`${uncertain.length} claim${uncertain.length === 1 ? '' : 's'} flagged as unsupported or challenged.`)
  if ((input.missing_evidence_ids ?? []).length > 0) missing_evidence.push(`${input.missing_evidence_ids!.length} cited evidence record(s) are missing from the vault.`)

  const fact_conflicts = input.governing ? detectFactConflicts(input.governing.body, input.facts) : []
  for (const c of fact_conflicts) improvements.push(`Reconcile with your fact ${c.fact_key} (${c.fact_value}).`)

  const limits = input.governing ? checkLimits(input.governing.body, input.question.word_limit, input.question.char_limit) : null

  // ---- comments -------------------------------------------------------------
  const threads = new Map<string, CommentVM[]>()
  for (const c of [...input.comments].sort((a, b) => a.seq - b.seq)) {
    const n = numberOf.get(c.version_id) ?? null
    const vm: CommentVM = {
      comment_id: c.comment_id,
      thread_id: c.thread_id,
      parent_comment_id: c.parent_comment_id,
      body: c.body,
      actor_class: c.actor_class,
      at: c.at,
      version_id: c.version_id,
      version_number: n,
      on_label: n ? `on v${n}` : 'on an unknown version',
      on_current_version: c.version_id === governing?.id,
      source: commentSource(c),
      source_label: (() => { const k = commentSource(c); return k ? COMMENT_SOURCE_LABEL[k] : null })(),
    }
    threads.set(c.thread_id, [...(threads.get(c.thread_id) ?? []), vm])
  }

  const statusKind = input.status.status
  return {
    instance_id: input.instance_id,
    question_occurrence_id: input.question.question_occurrence_id,
    context: {
      program_name: input.program_name,
      org_name: input.org_name,
      original_question: input.question.text,
      canonical_question_id: input.question.canonical_question_id,
      canonical_text: input.question.canonical_text ?? null,
      requirements: requirementsOf(input.question),
      word_limit: input.question.word_limit,
      char_limit: input.question.char_limit,
      deadline: input.deadline,
      deadline_label: deadlineLabel(input.deadline, input.now),
      section_id: input.question.section_id ?? null,
    },
    answer:
      governing && input.governing && limits
        ? {
            version_id: governing.id,
            sha256: governing.sha256,
            sha_prefix: shaPrefix(governing.sha256),
            version_number: numberOf.get(governing.id)!,
            version_count: versions.length,
            title: input.governing.title,
            body: input.governing.body,
            paragraphs: paragraphsOf(input.governing.body),
            limits,
            method: governing.method,
            method_label: versionMethodLabel(governing),
            provider: input.provenance?.[governing.id]?.provider ?? null,
            model: input.provenance?.[governing.id]?.model ?? null,
            created_at: governing.created_at,
            parent_version_id: governing.parent_version_id,
          }
        : null,
    status: {
      kind: statusKind,
      label: STATUS_LABEL[statusKind],
      tone: STATUS_TONE[statusKind],
      reasons: input.status.reasons.map((r) => STATUS_REASON_LABEL[r] ?? r),
      decided_by: input.status.decided_by,
    },
    approval,
    human_review,
    recommendation_badge: {
      classification: cls?.classification ?? null,
      label: cls ? `Agent recommendation: ${cls.classification === 'direct' ? 'Direct' : cls.classification === 'adapt' ? 'Adapt' : 'Gap'}` : 'No agent recommendation',
    },
    evidence: {
      items,
      missing_ids: input.missing_evidence_ids ?? [],
      gap: items.length === 0,
      uncertain_claims: uncertain,
      lineage,
      derived_from: input.derived_source ?? null,
    },
    recommendation: {
      classification: cls?.classification ?? null,
      classification_label: cls ? CLASSIFICATION_LABEL[cls.classification] : 'Not classified (question wording unavailable)',
      classification_reasons: cls ? cls.reasons.map(reasonText) : [],
      candidate: cls?.candidate_version_id ? { version_id: cls.candidate_version_id, similarity: cls.similarity } : null,
      why: [...new Set(why)],
      closeness,
      weaknesses: [...new Set(weaknesses)],
      missing_evidence: [...new Set(missing_evidence)],
      fact_conflicts,
      improvements: [...new Set(improvements)],
      agent_notes: forGoverning.map((s) => ({ kind: s.kind, explanation: s.explanation, provider: s.provider ?? null, model: s.model ?? null, created_at: s.created_at })),
    },
    comments: {
      threads: [...threads.entries()].map(([thread_id, comments]) => ({ thread_id, comments })),
      total: input.comments.length,
    },
  }
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export type FilterKey = 'all' | 'attention' | 'gaps' | 'ready' | 'approved' | 'in_packet'

export const FILTER_LABEL: Record<FilterKey, string> = {
  all: 'All',
  attention: 'Needs attention',
  gaps: 'Gaps',
  ready: 'Ready',
  approved: 'Approved',
  in_packet: 'In packet',
}

const ATTENTION: QuestionStatusKind[] = ['suggested', 'needs_evidence', 'needs_revision', 'under_review', 'rejected', 'superseded']

export interface BoardRowInput {
  question_occurrence_id: string
  order: number
  text: string | null
  required: boolean
  word_limit: number | null
  char_limit: number | null
  status: QuestionStatus
  classification: ReuseClassification | null
  evidence_ids: string[]
  versions: Array<Pick<VersionRecord, 'id' | 'sha256'>>
}

export interface BoardRowVM {
  question_occurrence_id: string
  order: number
  text: string | null
  required: boolean
  status: QuestionStatusKind
  status_label: string
  tone: Tone
  classification: 'direct' | 'adapt' | 'gap' | null
  word_count: number | null
  char_count: number | null
  word_limit: number | null
  char_limit: number | null
  over_limit: boolean
  evidence_count: number
  version_count: number
  approved: boolean
  freeze_eligible: boolean
  categories: FilterKey[]
}

export function boardRowVM(row: BoardRowInput, counts?: { words: number; chars: number } | null): BoardRowVM {
  const s = row.status.status
  const over =
    counts != null &&
    ((row.word_limit != null && counts.words > row.word_limit) || (row.char_limit != null && counts.chars > row.char_limit))
  const categories: FilterKey[] = ['all']
  if (ATTENTION.includes(s) || (over && (s === 'approved' || s === 'included_in_packet'))) categories.push('attention')
  if (s === 'gap' || (s === 'needs_evidence' && row.versions.length === 0)) categories.push('gaps')
  if (row.status.freeze_eligible && !over) categories.push('ready')
  if (s === 'approved' || s === 'included_in_packet') categories.push('approved')
  if (s === 'included_in_packet') categories.push('in_packet')
  return {
    question_occurrence_id: row.question_occurrence_id,
    order: row.order,
    text: row.text,
    required: row.required,
    status: s,
    status_label: STATUS_LABEL[s],
    tone: STATUS_TONE[s],
    classification: row.classification?.classification ?? null,
    word_count: counts?.words ?? null,
    char_count: counts?.chars ?? null,
    word_limit: row.word_limit,
    char_limit: row.char_limit,
    over_limit: over,
    evidence_count: row.evidence_ids.length,
    version_count: row.versions.length,
    approved: s === 'approved' || s === 'included_in_packet',
    freeze_eligible: row.status.freeze_eligible,
    categories,
  }
}

export interface ProgressSummary {
  total: number
  approved: number
  in_packet: number
  ready: number
  attention: number
  gaps: number
  required_total: number
  required_approved: number
  counts: Record<FilterKey, number>
}

export function progressSummary(rows: BoardRowVM[]): ProgressSummary {
  const counts = { all: 0, attention: 0, gaps: 0, ready: 0, approved: 0, in_packet: 0 } as Record<FilterKey, number>
  for (const r of rows) for (const c of r.categories) counts[c]++
  const required = rows.filter((r) => r.required)
  return {
    total: rows.length,
    approved: counts.approved,
    in_packet: counts.in_packet,
    ready: counts.ready,
    attention: counts.attention,
    gaps: counts.gaps,
    required_total: required.length,
    required_approved: required.filter((r) => r.approved).length,
    counts,
  }
}

/** Reopening decisions re-exported for UI copy ("does this reopen review?"). */
export const REOPENING = REOPENING_REVIEW_DECISIONS
