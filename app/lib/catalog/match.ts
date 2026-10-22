// M09 W2 — tiered QU occurrence matcher. PURE module.
//
// M09 §4 matching rules, in order:
//   exact       folded raw wording equal to a canonical text or a known
//               occurrence wording (variant)              → may auto-link
//   normalized  equal normalized token sequence (limit / required
//               markers and numbering removed)              → may auto-link
//   semantic    similarity ≥ threshold (injected scorer, else deterministic
//               token overlap)                              → ALWAYS review
//   novel       nothing close enough                        → new canonical
//
// "Semantic similarity is evidence of possible equivalence, not proof of
// identity." Only exact/normalized can auto-link, and even then the
// occurrence's own limits / time context / qualifiers are compared and any
// difference is reported so the occurrence context is preserved.

import { foldText, normalizeQuestion, tokenSimilarity, type Requirements } from './normalize.ts'

export type MatchTier = 'exact' | 'normalized' | 'semantic' | 'novel'

export interface CatalogVariant {
  /** A previously recorded occurrence wording (program_questions.asked_as). */
  text: string
  word_limit?: number | null
  char_limit?: number | null
  sentence_limit?: number | null
}

export interface CatalogQuestion {
  /** canonical id (archived_questions.id) */
  id: string
  /** canonical text (archived_questions.text) */
  text: string
  variants?: Array<string | CatalogVariant>
  word_limit?: number | null
  char_limit?: number | null
  sentence_limit?: number | null
}

export interface OccurrenceInput {
  /** exact wording as asked */
  asked_as: string
  /** limits known from structure (e.g. HTML maxlength); merged over text-parsed ones */
  requirements?: Partial<Requirements>
}

export interface MatchDifferences {
  limits_changed: boolean
  /** human-readable, e.g. "word_limit: 200 → 250" */
  limit_changes: string[]
  qualifiers_added: string[]
  qualifiers_removed: string[]
  time_context_changed: boolean
}

export interface MatchCandidateScore { id: string; score: number }

export interface MatchResult {
  tier: MatchTier
  canonical_question_id?: string
  /** the catalog wording the occurrence was compared against */
  matched_text?: string
  /** decision confidence in [0,1] */
  confidence: number
  /** safe to link without a human (exact/normalized, unambiguous) */
  auto_link: boolean
  needs_review: boolean
  reasons: string[]
  differences: MatchDifferences
  /** top alternatives for the review UI */
  candidates: MatchCandidateScore[]
}

export interface MatchOptions {
  /**
   * Optional semantic scorer (e.g. precomputed embedding cosine). Return
   * undefined to fall back to the deterministic token score for that pair.
   */
  semanticScore?: (occurrenceText: string, candidate: CatalogQuestion) => number | undefined
  /** semantic threshold; default 0.72 with a scorer (hosted RPC parity), 0.6 for token fallback */
  threshold?: number
  /** novel results within this margin below threshold are flagged near-miss for review (default 0.12) */
  nearMissMargin?: number
  /** max candidates returned (default 3) */
  maxCandidates?: number
}

type Limits = { word_limit?: number; char_limit?: number; sentence_limit?: number }

function limitsOf(req: Partial<Requirements> | undefined): Limits {
  return {
    word_limit: req?.word_limit ?? undefined,
    char_limit: req?.char_limit ?? undefined,
    sentence_limit: req?.sentence_limit ?? undefined,
  }
}

function mergeLimits(base: Limits, over: { word_limit?: number | null; char_limit?: number | null; sentence_limit?: number | null } | undefined): Limits {
  return {
    word_limit: over?.word_limit ?? base.word_limit,
    char_limit: over?.char_limit ?? base.char_limit,
    sentence_limit: over?.sentence_limit ?? base.sentence_limit,
  }
}

function diffLimits(occ: Limits, can: Limits): string[] {
  const out: string[] = []
  for (const k of ['word_limit', 'char_limit', 'sentence_limit'] as const) {
    if ((occ[k] ?? null) !== (can[k] ?? null)) out.push(`${k}: ${can[k] ?? 'none'} → ${occ[k] ?? 'none'}`)
  }
  return out
}

function setDiff(a: string[], b: string[]): string[] {
  const bk = new Set(b.map(foldText))
  return a.filter((x) => !bk.has(foldText(x)))
}

const EMPTY_DIFF: MatchDifferences = {
  limits_changed: false, limit_changes: [], qualifiers_added: [], qualifiers_removed: [], time_context_changed: false,
}

interface Form { text: string; folded: string; normalized: string; req: Requirements; limits: Limits }

function formsOf(q: CatalogQuestion): Form[] {
  const base = (text: string, lim?: { word_limit?: number | null; char_limit?: number | null; sentence_limit?: number | null }): Form => {
    const n = normalizeQuestion(text)
    return { text, folded: foldText(text), normalized: n.normalized, req: n.requirements, limits: mergeLimits(limitsOf(n.requirements), lim) }
  }
  const forms = [base(q.text, q)]
  for (const v of q.variants ?? []) {
    if (typeof v === 'string') forms.push(base(v))
    else if (v && typeof v.text === 'string') forms.push(base(v.text, v))
  }
  return forms
}

function differencesFor(occReq: Requirements, occLimits: Limits, form: Form): MatchDifferences {
  const limit_changes = diffLimits(occLimits, form.limits)
  const tA = occReq.time_context.map(foldText).sort().join('|')
  const tB = form.req.time_context.map(foldText).sort().join('|')
  return {
    limits_changed: limit_changes.length > 0,
    limit_changes,
    qualifiers_added: setDiff(occReq.qualifiers, form.req.qualifiers),
    qualifiers_removed: setDiff(form.req.qualifiers, occReq.qualifiers),
    time_context_changed: tA !== tB,
  }
}

// Time framing is compared separately (differences.time_context_changed), so
// it must not dilute the token-overlap score.
function withoutTime(core: string, req: Requirements): string {
  let out = core
  for (const t of req.time_context) out = out.split(t).join(' ')
  return out
}

/** Match one application question occurrence against catalog candidates. */
export function matchOccurrence(occurrence: OccurrenceInput, catalog: CatalogQuestion[], opts: MatchOptions = {}): MatchResult {
  const asked = occurrence.asked_as ?? ''
  const occN = normalizeQuestion(asked)
  const occReq: Requirements = { ...occN.requirements, ...(occurrence.requirements ?? {}),
    time_context: occurrence.requirements?.time_context ?? occN.requirements.time_context,
    qualifiers: occurrence.requirements?.qualifiers ?? occN.requirements.qualifiers,
    limit_clauses: occurrence.requirements?.limit_clauses ?? occN.requirements.limit_clauses }
  const occLimits = mergeLimits(limitsOf(occN.requirements), limitsOf(occurrence.requirements))
  const occFolded = foldText(asked)
  const maxCandidates = opts.maxCandidates ?? 3

  if (!occFolded) {
    return { tier: 'novel', confidence: 0, auto_link: false, needs_review: true, reasons: ['empty occurrence wording'], differences: { ...EMPTY_DIFF }, candidates: [] }
  }

  const prepared = catalog.filter((c) => c && typeof c.id === 'string' && typeof c.text === 'string').map((c) => ({ c, forms: formsOf(c) }))

  // ── exact / normalized ──
  for (const tier of ['exact', 'normalized'] as const) {
    const hits: Array<{ c: CatalogQuestion; form: Form }> = []
    for (const { c, forms } of prepared) {
      const matching = forms.filter((f) => (tier === 'exact' ? f.folded === occFolded : f.normalized === occN.normalized && f.normalized.length > 0))
      if (!matching.length) continue
      // Compare against the most informative recorded form: one with the
      // same limits first, then any form that recorded limits (a previous
      // occurrence), then the bare canonical text.
      const rank = (f: Form) => (diffLimits(occLimits, f.limits).length === 0 ? 2 : (f.limits.word_limit ?? f.limits.char_limit ?? f.limits.sentence_limit) !== undefined ? 1 : 0)
      const form = matching.reduce((a, b) => (rank(b) > rank(a) ? b : a))
      hits.push({ c, form })
    }
    if (hits.length === 0) continue
    const ids = [...new Set(hits.map((h) => h.c.id))]
    const { c, form } = hits[0]
    const differences = differencesFor(occReq, occLimits, form)
    const reasons = [tier === 'exact'
      ? (form.text === c.text ? 'wording equals canonical text (folded)' : 'wording equals a recorded occurrence of this canonical question (folded)')
      : 'normalized wording equal (limit/required markers and numbering ignored)']
    if (differences.limits_changed) reasons.push(`occurrence limits differ from catalog (${differences.limit_changes.join('; ')}) — link canonical, keep occurrence limits`)
    const ambiguous = ids.length > 1
    if (ambiguous) reasons.push(`ambiguous: ${ids.length} canonical questions share this wording — review which one to link`)
    return {
      tier,
      canonical_question_id: c.id,
      matched_text: form.text,
      confidence: ambiguous ? 0.5 : tier === 'exact' ? 1 : 0.95,
      auto_link: !ambiguous,
      needs_review: ambiguous,
      reasons,
      differences,
      candidates: ids.slice(0, maxCandidates).map((id) => ({ id, score: tier === 'exact' ? 1 : 0.95 })),
    }
  }

  // ── semantic (or token fallback) ──
  const usingScorer = typeof opts.semanticScore === 'function'
  const threshold = opts.threshold ?? (usingScorer ? 0.72 : 0.6)
  const margin = opts.nearMissMargin ?? 0.12
  const scored: Array<{ c: CatalogQuestion; form: Form; score: number; source: 'scorer' | 'tokens' }> = []
  for (const { c, forms } of prepared) {
    let best: { form: Form; score: number; source: 'scorer' | 'tokens' } | null = null
    const injected = usingScorer ? opts.semanticScore!(asked, c) : undefined
    for (const f of forms) {
      const s = typeof injected === 'number' && Number.isFinite(injected)
        ? { score: injected, source: 'scorer' as const }
        : { score: tokenSimilarity(withoutTime(occN.core, occReq), withoutTime(normalizeQuestion(f.text).core, f.req)), source: 'tokens' as const }
      if (!best || s.score > best.score) best = { form: f, ...s }
    }
    if (best) scored.push({ c, ...best })
  }
  scored.sort((a, b) => b.score - a.score)
  const candidates = scored.slice(0, maxCandidates).map((s) => ({ id: s.c.id, score: Math.round(s.score * 1000) / 1000 }))
  const top = scored[0]

  if (top && top.score >= threshold) {
    const differences = differencesFor(occReq, occLimits, top.form)
    const reasons = [`${top.source === 'scorer' ? 'semantic' : 'token-overlap'} similarity ${top.score.toFixed(3)} ≥ ${threshold} — possible equivalence, not proof`]
    if (differences.qualifiers_added.length) reasons.push(`occurrence adds qualifier(s): ${differences.qualifiers_added.join('; ')}`)
    if (differences.qualifiers_removed.length) reasons.push(`occurrence drops qualifier(s): ${differences.qualifiers_removed.join('; ')}`)
    if (differences.time_context_changed) reasons.push('time context differs')
    if (differences.limits_changed) reasons.push(`limits differ (${differences.limit_changes.join('; ')})`)
    return {
      tier: 'semantic', canonical_question_id: top.c.id, matched_text: top.form.text,
      confidence: Math.round(top.score * 1000) / 1000, auto_link: false, needs_review: true,
      reasons, differences, candidates,
    }
  }

  const nearMiss = !!top && top.score >= threshold - margin
  return {
    tier: 'novel',
    confidence: Math.round((1 - (top?.score ?? 0)) * 1000) / 1000,
    auto_link: false,
    needs_review: nearMiss,
    reasons: nearMiss
      ? [`no match above ${threshold}; closest ${top!.score.toFixed(3)} is a near miss — review before creating a new canonical question`]
      : [top ? `no match above ${threshold} (closest ${top.score.toFixed(3)})` : 'no catalog candidates'],
    differences: { ...EMPTY_DIFF },
    candidates,
  }
}

export interface BatchDuplicate {
  /** indices into the occurrences array, first is the primary */
  indices: number[]
  tier: 'exact' | 'normalized' | 'similar'
}

export interface BatchMatchResult {
  results: Array<MatchResult & { index: number; duplicate_of?: number }>
  duplicates: BatchDuplicate[]
}

/**
 * Match every occurrence of one application and detect questions that
 * appear more than once inside the same application. Later duplicates are
 * flagged needs_review (program_questions is unique per
 * (program_id, archived_question_id), so they cannot be stored twice).
 */
export function matchBatch(occurrences: OccurrenceInput[], catalog: CatalogQuestion[], opts: MatchOptions & { similarDuplicateThreshold?: number } = {}): BatchMatchResult {
  const duplicates: BatchDuplicate[] = []
  const primaryOf = new Map<number, number>()
  const folded = occurrences.map((o) => foldText(o.asked_as ?? ''))
  const normalized = occurrences.map((o) => normalizeQuestion(o.asked_as ?? '').normalized)
  const simT = opts.similarDuplicateThreshold ?? 0.9

  for (let i = 0; i < occurrences.length; i++) {
    if (primaryOf.has(i) || !folded[i]) continue
    const group: number[] = [i]
    let tier: BatchDuplicate['tier'] = 'exact'
    for (let j = i + 1; j < occurrences.length; j++) {
      if (primaryOf.has(j) || !folded[j]) continue
      if (folded[j] === folded[i]) group.push(j)
      else if (normalized[j] && normalized[j] === normalized[i]) { group.push(j); if (tier === 'exact') tier = 'normalized' }
      else if (tokenSimilarity(occurrences[i].asked_as, occurrences[j].asked_as) >= simT) { group.push(j); tier = 'similar' }
    }
    if (group.length > 1) {
      duplicates.push({ indices: group, tier })
      for (const j of group.slice(1)) primaryOf.set(j, i)
    }
  }

  const results = occurrences.map((o, index) => {
    const r = matchOccurrence(o, catalog, opts)
    const dup = primaryOf.get(index)
    if (dup === undefined) return { ...r, index }
    return {
      ...r,
      index,
      duplicate_of: dup,
      auto_link: false,
      needs_review: true,
      reasons: [...r.reasons, `duplicate of occurrence #${dup} in this application`],
    }
  })
  return { results, duplicates }
}
