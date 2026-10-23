// M09 W5 — review UI data assembly over the v5 client review API.
//
// Reads go through app/lib/aqua-local-client/review.ts; this module only
// gathers what one card or one board page needs and hands it to the pure
// view-model. Decryption is LAZY (≈21 ms per field): the board decrypts
// only the governing bodies of the visible page, and a card decrypts its
// own details when it is opened.
//
// The only writes here are applyDecisionPlan (decision-file import) — and
// they go through the same hash-bound APIs the in-app controls use
// (approveAsHuman via 'decision_file', recordReview, addVersionComment).
// Relative imports only (node type-stripping tests).

import {
  addVersionComment,
  approveAsHuman,
  getInstance,
  listFactViews,
  listInstances,
  listInstanceQuestions,
  listVersionComments,
  listVersionEvidence,
  readReviewCardVersion,
  readReviewNote,
  readSuggestionView,
  readVersionProvenance,
  recordReview,
  versionTitle,
} from '../aqua-local-client/review.ts'
import type { InstanceQuestionRow, PublicOccurrence } from '../aqua-local-client/review.ts'
import { approvalGate } from '../aqua-local/status.ts'
import { classifyReuse } from '../aqua-local/classify.ts'
import type { ReuseClassification } from '../aqua-local/classify.ts'
import type { AnswerRecord, ApprovalRecord, ReviewRecord, VersionRecord } from '../aqua-local/schema.ts'
import type { VaultStorage } from '../aqua-local/vault.ts'
import type { AppInstanceView } from '../aqua-local/instances.ts'
import { buildCardViewModel } from './view-model.ts'
import type { CardInput, ReviewCardVM } from './view-model.ts'
import type { CurrentQuestionState, DecisionFileOrigin, ImportPlan, PlanItem } from './decision-file.ts'
import { consumeReviewExportNonce, isKnownReviewExportNonce, newReviewExportNonce, recordReviewExport } from '../aqua-local/review-ledger.ts'

export interface ReviewContext {
  program_name: string | null
  org_name: string | null
  deadline: string | null
  cycle_year: number | null
  /** Public catalog questions for catalog-backed instances. */
  catalog_questions?: PublicOccurrence[]
  /** Canonical question wording keyed by canonical_question_id (public). */
  canonical_texts?: Record<string, string>
  known_program_names?: string[]
}

export interface BoardData {
  view: AppInstanceView
  rows: InstanceQuestionRow[]
  context: ReviewContext
}

/** Resolve the display context: a local template carries its own; a
    catalog-backed instance uses the public data the caller supplied. */
export function contextFor(view: AppInstanceView, supplied: Partial<ReviewContext> = {}): ReviewContext {
  const t = view.template
  return {
    program_name: t?.title ?? supplied.program_name ?? null,
    org_name: t?.org || supplied.org_name || null,
    deadline: t?.deadline ?? supplied.deadline ?? null,
    cycle_year: t?.cycle_year ?? supplied.cycle_year ?? null,
    catalog_questions: supplied.catalog_questions,
    canonical_texts: supplied.canonical_texts,
    known_program_names: supplied.known_program_names,
  }
}

export async function loadBoard(
  storage: VaultStorage,
  secret: string,
  instanceId: string,
  supplied: Partial<ReviewContext> = {},
  opts: { classify?: boolean; now?: string } = {},
): Promise<BoardData> {
  const view = await getInstance(storage, secret, instanceId)
  const context = contextFor(view, supplied)
  // Other applications' names flag "mentions another program" in answers.
  // One template decrypt per OTHER local instance (titles are encrypted).
  const known = new Set(context.known_program_names ?? [])
  for (const inst of await listInstances(storage)) {
    if (inst.instance_id === instanceId || !inst.local_template_enc) continue
    try {
      const t = (await getInstance(storage, secret, inst.instance_id)).template
      if (t?.title) known.add(t.title)
      if (t?.org) known.add(t.org)
    } catch {
      // template under another secret — cannot inform the check
    }
  }
  for (const n of [context.program_name, context.org_name]) if (n) known.delete(n)
  context.known_program_names = [...known]
  const rows = await listInstanceQuestions(storage, secret, instanceId, {
    catalog_questions: context.catalog_questions,
    program_name: context.program_name,
    org_name: context.org_name,
    cycle_year: context.cycle_year,
    deadline: context.deadline,
    known_program_names: context.known_program_names,
    classify: opts.classify ?? false,
    now: opts.now,
  })
  return { view, rows, context }
}

/** Word / char counts of the given versions (decrypts each body once). */
export async function loadBodyCounts(
  storage: VaultStorage,
  secret: string,
  versionIds: string[],
): Promise<Record<string, { words: number; chars: number }>> {
  const out: Record<string, { words: number; chars: number }> = {}
  for (const id of versionIds) {
    try {
      const v = await readReviewCardVersion(storage, secret, id)
      out[id] = { words: v.word_count, chars: v.char_count }
    } catch {
      // undecryptable — leave the count unknown rather than guessing
    }
  }
  return out
}

/** Assemble one review card (decrypts only this question's data). */
export async function loadCard(
  storage: VaultStorage,
  secret: string,
  args: { instance_id: string; row: InstanceQuestionRow; context: ReviewContext; now: string },
): Promise<ReviewCardVM> {
  const { row, context } = args
  const versions = row.versions
  const ids = new Set(versions.map((v) => v.id))
  const governing = versions.at(-1) ?? null
  const [allApprovals, allReviews, facts] = await Promise.all([
    storage.getAll<ApprovalRecord>('approvals'),
    storage.getAll<ReviewRecord>('reviews'),
    listFactViews(storage, secret),
  ])
  const approvals = allApprovals.filter((a) => ids.has(a.version_id))
  const reviews = allReviews.filter((r) => ids.has(r.version_id))

  const review_notes: Record<string, string | null> = {}
  for (const r of reviews) {
    if (!r.rationale_enc) continue
    try {
      review_notes[r.review_id] = await readReviewNote(secret, r)
    } catch {
      review_notes[r.review_id] = null
    }
  }
  const provenance: CardInput['provenance'] = {}
  for (const v of versions) {
    const p = await readVersionProvenance(storage, v.id)
    if (p) provenance[v.id] = { provider: p.provider, model: p.model }
  }

  let plain: { title: string; body: string } | null = null
  let evidence: CardInput['evidence'] = []
  let missing: string[] = []
  let derived_source: CardInput['derived_source'] = null
  if (governing) {
    const r = await readReviewCardVersion(storage, secret, governing.id)
    plain = { title: r.title, body: r.body }
    const ev = await listVersionEvidence(storage, secret, governing.id)
    evidence = ev.evidence
    missing = ev.missing
    const seed = [...versions].reverse().find((v) => v.derived_from)?.derived_from ?? null
    if (seed) {
      const src = await storage.get<VersionRecord>('versions', seed.version_id)
      const answer = src ? await storage.get<AnswerRecord>('answers', src.answer_id) : undefined
      let title: string | null = null
      if (src) title = await versionTitle(secret, src).catch(() => null)
      derived_source = {
        version_id: seed.version_id,
        version_sha256: seed.version_sha256,
        question_occurrence_id: answer?.scope.question_occurrence_id ?? null,
        application_id: answer?.scope.application_id ?? null,
        title,
        found: !!src,
      }
    }
  }

  const suggestions = []
  for (const s of row.suggestions) {
    try {
      suggestions.push(await readSuggestionView(secret, s))
    } catch {
      // undecryptable suggestion — omit (advisory data only)
    }
  }

  const answerIds = [...new Set(versions.map((v) => v.answer_id))]
  const comments = (
    await Promise.all(answerIds.map((answer_id) => listVersionComments(storage, secret, { answer_id })))
  ).flat()

  let self_check: ReuseClassification | null = null
  if (governing && plain && row.text) {
    self_check = classifyReuse(
      {
        text: row.text,
        canonical_question_id: row.canonical_question_id,
        word_limit: row.word_limit,
        char_limit: row.char_limit,
        program_name: context.program_name,
        org_name: context.org_name,
        cycle_year: context.cycle_year,
        deadline: context.deadline,
      },
      [
        {
          version_id: governing.id,
          version_sha256: governing.sha256,
          body: plain.body,
          title: plain.title,
          question_text: row.text,
          scope: row.scope,
          canonical_question_id: row.canonical_question_id,
          approved: approvalGate(governing, approvals, reviews).approved,
          created_at: governing.created_at,
          program_name: context.program_name,
          org_name: context.org_name,
        },
      ],
      { known_program_names: context.known_program_names, now: args.now },
    )
  }

  return buildCardViewModel({
    instance_id: args.instance_id,
    program_name: context.program_name,
    org_name: context.org_name,
    deadline: context.deadline,
    question: {
      question_occurrence_id: row.question_occurrence_id,
      canonical_question_id: row.canonical_question_id,
      text: row.text,
      canonical_text: row.canonical_question_id ? context.canonical_texts?.[row.canonical_question_id] ?? null : null,
      word_limit: row.word_limit,
      char_limit: row.char_limit,
      required: row.required,
      section_id: row.section_id,
    },
    versions,
    approvals,
    reviews,
    review_notes,
    provenance,
    governing: plain,
    derived_source,
    evidence,
    missing_evidence_ids: missing,
    suggestions,
    comments,
    facts,
    status: row.status,
    classification: row.classification,
    self_check,
    now: args.now,
  })
}

/** Current per-question version state for decision-file import planning. */
export function currentStates(rows: InstanceQuestionRow[]): CurrentQuestionState[] {
  return rows.map((r) => ({
    question_occurrence_id: r.question_occurrence_id,
    versions: r.versions.map((v) => ({ id: v.id, sha256: v.sha256 })),
    governing_version_id: r.versions.at(-1)?.id ?? null,
    governing_approved: r.status.freeze_eligible && r.status.governing_version_id === (r.versions.at(-1)?.id ?? null),
  }))
}

export interface ApplyResult {
  item: PlanItem
  ok: boolean
  wrote: string[]
  error: string | null
}

/**
 * Apply a CONFIRMED decision-file plan. Called only after the user confirms
 * the plan in-app. Each write is hash-bound and re-checked by the vault at
 * write time, so a version that changed between planning and confirming is
 * refused (reported, not retried). Never applies non-applicable items.
 */
export async function applyDecisionPlan(
  storage: VaultStorage,
  secret: string,
  plan: ImportPlan,
  actorId: string,
  selected: Set<string>,
  opts: {
    foreignConfirmed?: boolean
    /** The file's export nonce + instance: spent after a successful apply so
        the same nonce cannot pass as "this vault" again. */
    nonce?: string | null
    instanceId?: string
  } = {},
): Promise<ApplyResult[]> {
  // M2: a file this vault did not export needs an explicit extra confirmation.
  if (plan.origin !== 'this_vault' && opts.foreignConfirmed !== true) {
    throw new Error('This decision file was not exported by this vault — confirm the foreign-file warning before applying it.')
  }
  // Fail closed: only the rows the user ticked are applied. There is no
  // "apply everything" default (M09 review, LOW).
  if (!(selected instanceof Set)) {
    throw new Error('applyDecisionPlan requires the set of version ids the user selected')
  }
  const out: ApplyResult[] = []
  for (const item of plan.items) {
    if (!item.applicable) continue
    if (!selected.has(item.entry.version_id)) continue
    const { entry } = item
    const wrote: string[] = []
    try {
      if (item.writes_decision) {
        if (entry.decision === 'approve') {
          await approveAsHuman(storage, {
            version_id: entry.version_id,
            expected_sha256: entry.version_sha256,
            actor_id: actorId,
            via: 'decision_file',
            secret,
          })
          wrote.push('approval')
        } else if (entry.decision === 'needs_revision' || entry.decision === 'needs_evidence') {
          await recordReview(storage, secret, {
            version_id: entry.version_id,
            expected_sha256: entry.version_sha256,
            decision: entry.decision,
            rationale: entry.comment,
            actor_class: 'human',
            actor_id: actorId,
          })
          wrote.push('review')
        }
      }
      if (item.writes_comment && entry.comment) {
        await addVersionComment(storage, secret, {
          version_id: entry.version_id,
          expected_sha256: entry.version_sha256,
          body: entry.comment,
          actor_class: 'human',
          actor_id: actorId,
          via: 'decision_file', // M2: shown as "imported from decision file"
        })
        wrote.push('comment')
      }
      out.push({ item, ok: true, wrote, error: null })
    } catch (e) {
      out.push({ item, ok: false, wrote, error: e instanceof Error ? e.message : String(e) })
    }
  }
  if (plan.origin === 'this_vault' && opts.nonce && opts.instanceId && out.some((r) => r.ok)) {
    await consumeReviewExportNonce(storage, { instance_id: opts.instanceId, nonce: opts.nonce })
  }
  return out
}

// ---------------------------------------------------------------------------
// Decision-file import helpers (M09 hardening M2)
// ---------------------------------------------------------------------------

export const DECISION_EXCERPT_CHARS = 300

/**
 * Decrypt (locally) the first ~300 characters of each version a plan item
 * would approve, so the user sees WHAT they approve before ticking it.
 * Undecryptable / missing versions map to null.
 */
export async function readDecisionExcerpts(
  storage: VaultStorage,
  secret: string,
  versionIds: string[],
  max = DECISION_EXCERPT_CHARS,
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  for (const id of new Set(versionIds)) {
    try {
      const { body } = await readReviewCardVersion(storage, secret, id)
      const chars = [...body]
      out.set(id, chars.length > max ? `${chars.slice(0, max).join('')}…` : body)
    } catch {
      out.set(id, null)
    }
  }
  return out
}

/** Record a fresh review-export nonce in the vault and return it (embed it in the HTML). */
export async function issueReviewExportNonce(storage: VaultStorage, instanceId: string): Promise<string> {
  const nonce = newReviewExportNonce()
  await recordReviewExport(storage, { instance_id: instanceId, nonce })
  return nonce
}

/** 'this_vault' when the decision file's nonce was issued by this vault for this instance. */
export async function decisionFileOrigin(
  storage: VaultStorage,
  instanceId: string,
  nonce: string | null,
): Promise<DecisionFileOrigin> {
  return (await isKnownReviewExportNonce(storage, { instance_id: instanceId, nonce })) ? 'this_vault' : 'foreign'
}
