// M09 W6 — Step F: prepare-application validation. PURE: the caller reads
// the vault (approval gate, decrypted approved body, re-hash) and passes the
// facts in; this module only decides. Blockers must be fixed before the
// packet freeze; warnings are shown but do not block.

import type { QuestionStatusKind } from '../aqua-local/status.ts'

export interface PrepareApproved {
  version_id: string
  /** sha256 stored on the version record (what the approval is bound to) */
  recorded_sha256: string
  /** sha256 recomputed from the decrypted title + body; null = could not decrypt */
  recomputed_sha256: string | null
  word_count: number
  char_count: number
  /** the approved version is also the newest version */
  is_governing: boolean
}

export interface PrepareQuestionInput {
  question_occurrence_id: string
  text: string | null
  required: boolean
  word_limit: number | null
  char_limit: number | null
  has_versions: boolean
  status: QuestionStatusKind
  /** newest version with a live human, hash-bound approval (approvalGate) */
  approved: PrepareApproved | null
  /** reason for leaving an optional question unanswered */
  skip_reason?: string | null
}

export type PrepareIssueCode =
  | 'required_missing'
  | 'missing_approval'
  | 'required_skip_refused'
  | 'unexplained_skip'
  | 'over_word_limit'
  | 'over_char_limit'
  | 'sha_mismatch'
  | 'undecryptable'
  | 'newer_draft_unapproved'

export interface PrepareIssue {
  question_occurrence_id: string
  code: PrepareIssueCode
  severity: 'blocker' | 'warning'
  message: string
  /** where the fix happens: draft (Step D), review (Step E), edit (new child version), skip_reason (here) */
  fix: 'draft' | 'review' | 'edit' | 'skip_reason'
}

export interface PrepareResult {
  ready: boolean
  blockers: PrepareIssue[]
  warnings: PrepareIssue[]
  per_question: Record<string, { state: 'ready' | 'skipped' | 'blocked'; issues: PrepareIssue[] }>
  counts: { total: number; ready: number; skipped: number; blocked: number }
}

export function validatePrepare(questions: PrepareQuestionInput[]): PrepareResult {
  const blockers: PrepareIssue[] = []
  const warnings: PrepareIssue[] = []
  const per: PrepareResult['per_question'] = {}
  const n = (i: number) => `Question ${i + 1}`

  questions.forEach((q, i) => {
    const issues: PrepareIssue[] = []
    const add = (code: PrepareIssueCode, severity: 'blocker' | 'warning', message: string, fix: PrepareIssue['fix']) => {
      const issue = { question_occurrence_id: q.question_occurrence_id, code, severity, message, fix }
      issues.push(issue)
      ;(severity === 'blocker' ? blockers : warnings).push(issue)
    }
    const skip = (q.skip_reason ?? '').trim()
    let state: 'ready' | 'skipped' | 'blocked' = 'ready'

    if (!q.approved) {
      if (q.required) {
        if (skip) add('required_skip_refused', 'blocker', `${n(i)} is required and cannot be skipped.`, q.has_versions ? 'review' : 'draft')
        if (!q.has_versions) add('required_missing', 'blocker', `${n(i)} is required and has no answer yet.`, 'draft')
        else add('missing_approval', 'blocker', `${n(i)} is required and has no human-approved version.`, 'review')
      } else if (skip) {
        state = 'skipped'
      } else if (q.has_versions) {
        add('unexplained_skip', 'blocker', `${n(i)} has an unapproved draft — approve it, or explain why you are leaving it out.`, 'review')
      } else {
        add('unexplained_skip', 'blocker', `${n(i)} is optional and unanswered — explain the skip.`, 'skip_reason')
      }
    } else {
      const a = q.approved
      if (a.recomputed_sha256 === null) add('undecryptable', 'blocker', `${n(i)}: the approved version could not be decrypted on this device.`, 'edit')
      else if (a.recomputed_sha256 !== a.recorded_sha256) add('sha_mismatch', 'blocker', `${n(i)}: the approved text no longer matches its recorded hash — re-review it.`, 'review')
      if (q.word_limit != null && a.word_count > q.word_limit) {
        add('over_word_limit', 'blocker', `${n(i)} is ${a.word_count - q.word_limit} word(s) over the ${q.word_limit}-word limit.`, 'edit')
      }
      if (q.char_limit != null && a.char_count > q.char_limit) {
        add('over_char_limit', 'blocker', `${n(i)} is ${a.char_count - q.char_limit} character(s) over the ${q.char_limit}-character limit.`, 'edit')
      }
      if (!a.is_governing) add('newer_draft_unapproved', 'warning', `${n(i)} has a newer draft that is not approved; the older approved version will be used.`, 'review')
    }
    if (issues.some((x) => x.severity === 'blocker')) state = 'blocked'
    per[q.question_occurrence_id] = { state, issues }
  })

  const states = Object.values(per).map((p) => p.state)
  return {
    ready: blockers.length === 0 && questions.length > 0,
    blockers,
    warnings,
    per_question: per,
    counts: {
      total: questions.length,
      ready: states.filter((s) => s === 'ready').length,
      skipped: states.filter((s) => s === 'skipped').length,
      blocked: states.filter((s) => s === 'blocked').length,
    },
  }
}

/** Word / character counts used for limits (same rules as the review card). */
export function measure(body: string): { word_count: number; char_count: number } {
  return { word_count: body.split(/\s+/).filter(Boolean).length, char_count: [...body].length }
}
