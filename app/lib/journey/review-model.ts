// M09 W6 — Step B view model: one extraction-review shape for every entry
// path (catalog template, URL proposal, pasted text, uploaded file). PURE:
// no network, no storage, no DOM. Relative imports only so node's type
// stripping can run it in tests.
//
// Rules this module enforces:
//   - Corrections never overwrite: the extracted wording / limits / flags
//     stay as `original_*` and every change is appended to `corrections`.
//   - Removing or merging a question only marks it; restore is possible
//     until activation.
//   - Private and uncertain items are display-only. Nothing here sends data
//     anywhere; the public candidate is the server-built one, untouched.

import { buildExtractionProposal, type ExtractionProposal, type ProgramMatch, type ProgramRow, type CycleRow } from '../catalog/proposal.ts'
import { parseDeadline, type DeadlineHint, type ExtractionResult } from '../catalog/extract.ts'
import type { CatalogQuestion, CatalogVariant, MatchResult } from '../catalog/match.ts'
import type { PublicCandidate, Visibility } from '../catalog/classify.ts'

// ─── public catalog shape handed to the journey (read-only) ─────────────────

export interface JourneyCatalogQuestion {
  /** public program_questions.id — the occurrence id for catalog-backed instances */
  id: string
  /** archived_questions.id (canonical question), when linked */
  canonical_question_id: string | null
  canonical_text: string | null
  asked_as: string
  word_limit: number | null
  char_limit: number | null
  required: boolean
  order_index: number
  section: string | null
}

export interface JourneyCatalogProgram {
  id: string
  slug: string
  name: string
  organization: string | null
  apply_url: string | null
  deadline_at: string | null
  cycle: { cycle_id: string; cycle_name: string; opens_at: string | null; closes_at: string | null; apply_url: string | null } | null
  questions: JourneyCatalogQuestion[]
}

export interface JourneyCatalog {
  programs: JourneyCatalogProgram[]
  /** true when the catalog could not be read (journey still works for local imports) */
  unavailable?: boolean
}

// ─── review model ────────────────────────────────────────────────────────────

export type JourneySourceKind = 'catalog' | 'url' | 'paste' | 'file'
export type JourneyMethod = 'catalog_template' | 'url_fetch' | 'paste' | 'file'

export interface ReviewMatch {
  tier: string
  canonical_question_id: string | null
  matched_text: string | null
  confidence: number
  needs_review: boolean
  reasons: string[]
}

export interface ReviewQuestion {
  key: string
  order_index: number
  /** exact wording as extracted; null when the server withheld it (private) */
  original_text: string | null
  /** effective wording (corrected, else original) */
  text: string | null
  corrected: boolean
  section: string | null
  word_limit: number | null
  char_limit: number | null
  original_word_limit: number | null
  original_char_limit: number | null
  required: boolean
  /** required flag as stated by the source (null = not stated) */
  original_required: boolean | null
  /** time framing / qualifiers detected in the prompt (display chips) */
  requirement_flags: string[]
  field_kind: string
  visibility: Visibility
  visibility_reasons: string[]
  has_private_context: boolean
  match: ReviewMatch | null
  match_cleared: boolean
  /** key of the earlier question this one duplicates, if detected */
  duplicate_of: string | null
  status: 'active' | 'removed' | 'merged'
  merged_into: string | null
}

export interface DeadlineView {
  text: string
  date: string | null
  time: string | null
  timezone: string | null
  ambiguous: boolean
}

export interface ProgramMatchView {
  program_id: string
  slug: string
  name: string
  basis: string
  confidence: number
  cycle_name: string | null
}

export interface Correction {
  /** question key (null = application-level field) */
  key: string | null
  field: 'wording' | 'required' | 'word_limit' | 'char_limit' | 'removed' | 'restored' | 'merged' | 'question_match' | 'program_match' | 'title' | 'organization' | 'deadline' | 'template_choice'
  from: string | number | boolean | null
  to: string | number | boolean | null
  at: string
}

export interface ExtractionReviewModel {
  source: {
    kind: JourneySourceKind
    method: JourneyMethod
    /** URL or file name — private to this device; never sent anywhere */
    ref: string | null
    reuse: 'allowed' | 'unknown' | 'disallowed' | null
    reuse_signals: string[]
    final_url: string | null
    fetched_at: string | null
    content_sha256: string | null
    file_format: string | null
  }
  program: { title: string | null; organization: string | null; original_title: string | null; original_organization: string | null }
  program_match: ProgramMatchView | null
  program_candidates: ProgramMatchView[]
  program_needs_review: boolean
  /** catalog path, or an import whose matched program template the user chose */
  use_catalog_template: boolean
  cycle: { name: string | null; deadline: DeadlineView | null; original_deadline: DeadlineView | null; deadlines: DeadlineView[]; source: 'catalog' | 'extracted' | 'none' }
  questions: ReviewQuestion[]
  duplicates: Array<{ keys: string[]; tier: string }>
  uncertain: Array<{ kind: string; value: string; reasons: string[]; key?: string }>
  private_summary: { count: number; kinds: Record<string, number> }
  warnings: string[]
  corrections: Correction[]
  public_candidate: PublicCandidate | null
  public_candidate_refused: string[] | null
  catalog_lookup: 'ok' | 'unavailable' | 'local'
  extracted_at: string
}

/** The JSON body returned by POST /api/catalog/extract-url (200). */
export type ExtractUrlResponse = ExtractionProposal & {
  catalog_lookup?: 'ok' | 'unavailable'
  source: {
    requested_url: string
    final_url: string
    status?: number
    fetched_at: string
    content_type?: string
    bytes?: number
    content_sha256: string
    redirects?: string[]
    reuse: 'allowed' | 'unknown' | 'disallowed'
    reuse_signals?: string[]
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const keyOf = (i: number) => `q${i}`

function toDeadlineView(d: DeadlineHint): DeadlineView {
  return { text: d.text, date: d.date ?? null, time: d.time ?? null, timezone: d.timezone ?? null, ambiguous: !!d.ambiguous }
}

function catalogDeadline(iso: string | null | undefined): DeadlineView | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const d = new Date(t).toISOString()
  return { text: `${d.slice(0, 10)} ${d.slice(11, 16)} UTC`, date: d.slice(0, 10), time: d.slice(11, 16), timezone: 'UTC', ambiguous: false }
}

function bestDeadline(ds: DeadlineView[]): DeadlineView | null {
  return ds.find((d) => d.date && !d.ambiguous) ?? ds.find((d) => d.date) ?? ds[0] ?? null
}

function programView(m: ProgramMatch): ProgramMatchView {
  return { program_id: m.program_id, slug: m.slug, name: m.name, basis: m.basis, confidence: m.confidence, cycle_name: m.cycle?.cycle_name ?? null }
}

function matchView(m: MatchResult | undefined | null): ReviewMatch | null {
  if (!m) return null
  return {
    tier: m.tier,
    canonical_question_id: m.canonical_question_id ?? null,
    matched_text: m.matched_text ?? null,
    confidence: m.confidence,
    needs_review: m.needs_review,
    reasons: [...m.reasons],
  }
}

function flagsOf(req: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const t of (req.time_context as string[] | undefined) ?? []) out.push(`time: ${t}`)
  for (const q of (req.qualifiers as string[] | undefined) ?? []) out.push(`asks: ${q}`)
  if (typeof req.sentence_limit === 'number') out.push(`≤ ${req.sentence_limit} sentences`)
  if (typeof req.word_min === 'number') out.push(`≥ ${req.word_min} words`)
  if (typeof req.char_min === 'number') out.push(`≥ ${req.char_min} chars`)
  return out
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Programs + cycles + canonical questions in the shapes the W2 matchers take. */
export function catalogMatchInputs(catalog: JourneyCatalog | null | undefined): { programs: ProgramRow[]; cycles: CycleRow[]; questions: CatalogQuestion[] } {
  const programs: ProgramRow[] = []
  const cycles: CycleRow[] = []
  const byCanonical = new Map<string, CatalogQuestion>()
  for (const p of catalog?.programs ?? []) {
    programs.push({ id: p.id, slug: p.slug, name: p.name, organization: p.organization, apply_url: p.apply_url })
    if (p.cycle) cycles.push({ program_id: p.id, cycle_name: p.cycle.cycle_name, apply_url: p.cycle.apply_url, closes_at: p.cycle.closes_at })
    for (const q of p.questions) {
      if (!q.canonical_question_id) continue
      const entry = byCanonical.get(q.canonical_question_id) ?? { id: q.canonical_question_id, text: q.canonical_text ?? q.asked_as, variants: [] as CatalogVariant[] }
      ;(entry.variants as CatalogVariant[]).push({ text: q.asked_as, word_limit: q.word_limit, char_limit: q.char_limit })
      byCanonical.set(q.canonical_question_id, entry)
    }
  }
  return { programs, cycles, questions: [...byCanonical.values()] }
}

function fromProposal(
  proposal: ExtractionProposal,
  ctx: {
    source: ExtractionReviewModel['source']
    /** full local extraction (paste/file): wording is the user's own, shown even when private */
    extraction: ExtractionResult | null
    catalog_lookup: ExtractionReviewModel['catalog_lookup']
    now: string
  },
): ExtractionReviewModel {
  const ex = ctx.extraction
  const questions: ReviewQuestion[] = proposal.questions.map((pq, i) => {
    const occ = ex?.occurrences[i]
    const original = occ ? occ.asked_as : pq.asked_as
    const r = (occ?.requirements ?? pq.requirements) as unknown as Record<string, unknown>
    const wl = num(r.word_limit)
    const cl = num(r.char_limit)
    const req = r.required === true ? true : r.optional === true || r.required === false ? false : null
    const dupIdx = (pq.match as { duplicate_of?: number }).duplicate_of
    return {
      key: keyOf(i),
      order_index: pq.order_index,
      original_text: original,
      text: original,
      corrected: false,
      section: occ ? occ.section : pq.section,
      word_limit: wl,
      char_limit: cl,
      original_word_limit: wl,
      original_char_limit: cl,
      required: req === true,
      original_required: req,
      requirement_flags: flagsOf(r),
      field_kind: pq.field_kind,
      visibility: pq.visibility,
      visibility_reasons: [...pq.visibility_reasons],
      has_private_context: pq.has_private_context,
      match: matchView(pq.match),
      match_cleared: false,
      duplicate_of: typeof dupIdx === 'number' ? keyOf(dupIdx) : null,
      status: 'active',
      merged_into: null,
    }
  })

  const cand = proposal.public_candidate
  const uncertainOf = (kind: string) => proposal.uncertain.find((u) => u.kind === kind)?.value ?? null
  const title = ex?.program.title ?? cand?.program.title ?? uncertainOf('program.title')
  const org = ex?.program.organization ?? cand?.program.organization ?? uncertainOf('program.organization')
  const hints: DeadlineHint[] = ex
    ? ex.program.deadlines
    : [...(cand?.deadlines ?? []), ...proposal.uncertain.filter((u) => u.kind === 'deadline').map((u) => parseDeadline(u.value) ?? { text: u.value })]
  const deadlines = hints.map(toDeadlineView)
  const deadline = bestDeadline(deadlines)
  const pm = proposal.program_match ? programView(proposal.program_match) : null

  return {
    source: ctx.source,
    program: { title: title ?? null, organization: org ?? null, original_title: title ?? null, original_organization: org ?? null },
    program_match: pm,
    program_candidates: proposal.program_candidates.map(programView),
    program_needs_review: proposal.program_needs_review,
    use_catalog_template: false,
    cycle: { name: pm?.cycle_name ?? null, deadline, original_deadline: deadline, deadlines, source: deadline ? 'extracted' : 'none' },
    questions,
    duplicates: proposal.duplicates.map((d) => ({ keys: d.indices.map(keyOf), tier: d.tier })),
    uncertain: proposal.uncertain.map((u) => ({ kind: u.kind, value: u.value, reasons: [...u.reasons], ...(u.occurrence_index !== undefined ? { key: keyOf(u.occurrence_index) } : {}) })),
    private_summary: { count: proposal.private_summary.count, kinds: { ...proposal.private_summary.kinds } },
    warnings: [...proposal.warnings],
    corrections: [],
    public_candidate: cand ? structuredClone(cand) : null,
    public_candidate_refused: proposal.public_candidate_refused ? [...proposal.public_candidate_refused] : null,
    catalog_lookup: ctx.catalog_lookup,
    extracted_at: ctx.now,
  }
}

// ─── builders (one per entry path) ───────────────────────────────────────────

/** (a) catalog template: a summary of the public template (no extraction). */
export function modelFromCatalogProgram(program: JourneyCatalogProgram, now: string = new Date().toISOString()): ExtractionReviewModel {
  const deadline = catalogDeadline(program.cycle?.closes_at ?? program.deadline_at)
  const questions: ReviewQuestion[] = [...program.questions]
    .sort((a, b) => a.order_index - b.order_index)
    .map((q, i) => ({
      key: keyOf(i),
      order_index: q.order_index,
      original_text: q.asked_as,
      text: q.asked_as,
      corrected: false,
      section: q.section,
      word_limit: q.word_limit,
      char_limit: q.char_limit,
      original_word_limit: q.word_limit,
      original_char_limit: q.char_limit,
      required: q.required,
      original_required: q.required,
      requirement_flags: [],
      field_kind: 'textarea',
      visibility: 'public',
      visibility_reasons: [],
      has_private_context: false,
      match: q.canonical_question_id
        ? { tier: 'exact', canonical_question_id: q.canonical_question_id, matched_text: q.canonical_text, confidence: 1, needs_review: false, reasons: ['catalog occurrence'] }
        : null,
      match_cleared: false,
      duplicate_of: null,
      status: 'active',
      merged_into: null,
    }))
  return {
    source: { kind: 'catalog', method: 'catalog_template', ref: `catalog:${program.slug}`, reuse: null, reuse_signals: [], final_url: null, fetched_at: null, content_sha256: null, file_format: null },
    program: { title: program.name, organization: program.organization, original_title: program.name, original_organization: program.organization },
    program_match: { program_id: program.id, slug: program.slug, name: program.name, basis: 'catalog', confidence: 1, cycle_name: program.cycle?.cycle_name ?? null },
    program_candidates: [],
    program_needs_review: false,
    use_catalog_template: true,
    cycle: { name: program.cycle?.cycle_name ?? null, deadline, original_deadline: deadline, deadlines: deadline ? [deadline] : [], source: deadline ? 'catalog' : 'none' },
    questions,
    duplicates: [],
    uncertain: [],
    private_summary: { count: 0, kinds: {} },
    warnings: [],
    corrections: [],
    public_candidate: null,
    public_candidate_refused: null,
    catalog_lookup: 'ok',
    extracted_at: now,
  }
}

/** (b) URL import: the read-only proposal from POST /api/catalog/extract-url. */
export function modelFromUrlProposal(res: ExtractUrlResponse, requestedUrl: string, now: string = new Date().toISOString()): ExtractionReviewModel {
  return fromProposal(res, {
    source: {
      kind: 'url',
      method: 'url_fetch',
      ref: requestedUrl,
      reuse: res.source?.reuse ?? 'unknown',
      reuse_signals: [...(res.source?.reuse_signals ?? [])],
      final_url: res.source?.final_url ?? null,
      fetched_at: res.source?.fetched_at ?? null,
      content_sha256: res.source?.content_sha256 ?? null,
      file_format: null,
    },
    extraction: null,
    catalog_lookup: res.catalog_lookup ?? 'ok',
    now,
  })
}

/**
 * (c)/(d) paste or file: everything runs on this device. The proposal is
 * assembled locally (W2 buildExtractionProposal) against the public catalog
 * already downloaded for the page — no request carries the user's text.
 */
export function modelFromLocalExtraction(
  extraction: ExtractionResult,
  opts: { kind: 'paste' | 'file'; fileName?: string | null; fileFormat?: string | null; catalog?: JourneyCatalog | null; now?: string },
): ExtractionReviewModel {
  const inputs = catalogMatchInputs(opts.catalog)
  const proposal = buildExtractionProposal({
    extraction,
    source: { provenance: 'local_import' },
    programs: inputs.programs,
    cycles: inputs.cycles,
    catalog: inputs.questions,
  })
  return fromProposal(proposal, {
    source: {
      kind: opts.kind,
      method: opts.kind,
      ref: opts.kind === 'file' ? opts.fileName ?? null : null,
      reuse: null,
      reuse_signals: [],
      final_url: null,
      fetched_at: null,
      content_sha256: null,
      file_format: opts.fileFormat ?? null,
    },
    extraction,
    catalog_lookup: 'local',
    now: opts.now ?? new Date().toISOString(),
  })
}

// ─── corrections (every op returns a NEW model; originals are kept) ─────────

function stamp(now?: string): string {
  return now ?? new Date().toISOString()
}

function updateQ(model: ExtractionReviewModel, key: string, fn: (q: ReviewQuestion) => ReviewQuestion): ExtractionReviewModel {
  if (!model.questions.some((q) => q.key === key)) throw new Error(`unknown question ${key}`)
  return { ...model, questions: model.questions.map((q) => (q.key === key ? fn(q) : q)) }
}

function log(model: ExtractionReviewModel, c: Omit<Correction, 'at'>, now?: string): ExtractionReviewModel {
  return { ...model, corrections: [...model.corrections, { ...c, at: stamp(now) }] }
}

/** Record a wording correction. The original wording is kept untouched;
    reverting to the original clears the correction flag. */
export function correctWording(model: ExtractionReviewModel, key: string, text: string, now?: string): ExtractionReviewModel {
  const q = model.questions.find((x) => x.key === key)
  if (!q) throw new Error(`unknown question ${key}`)
  const next = text.replace(/\s+$/g, '')
  if (!next.trim()) throw new Error('wording cannot be blank — remove the question instead')
  if (next === q.text) return model
  const m = updateQ(model, key, (x) => ({ ...x, text: next, corrected: next !== x.original_text }))
  return log(m, { key, field: 'wording', from: q.text, to: next }, now)
}

export function setRequired(model: ExtractionReviewModel, key: string, required: boolean, now?: string): ExtractionReviewModel {
  const q = model.questions.find((x) => x.key === key)
  if (!q) throw new Error(`unknown question ${key}`)
  if (q.required === required) return model
  return log(updateQ(model, key, (x) => ({ ...x, required })), { key, field: 'required', from: q.required, to: required }, now)
}

export function setLimits(
  model: ExtractionReviewModel,
  key: string,
  limits: { word_limit?: number | null; char_limit?: number | null },
  now?: string,
): ExtractionReviewModel {
  let m = model
  for (const field of ['word_limit', 'char_limit'] as const) {
    if (!(field in limits)) continue
    const v = limits[field] ?? null
    if (v !== null && (!Number.isInteger(v) || v <= 0)) throw new Error(`${field} must be a positive whole number`)
    const q = m.questions.find((x) => x.key === key)
    if (!q) throw new Error(`unknown question ${key}`)
    if (q[field] === v) continue
    m = log(updateQ(m, key, (x) => ({ ...x, [field]: v })), { key, field, from: q[field], to: v }, now)
  }
  return m
}

export function removeQuestion(model: ExtractionReviewModel, key: string, now?: string): ExtractionReviewModel {
  const q = model.questions.find((x) => x.key === key)
  if (!q) throw new Error(`unknown question ${key}`)
  if (q.status === 'removed') return model
  return log(updateQ(model, key, (x) => ({ ...x, status: 'removed', merged_into: null })), { key, field: 'removed', from: q.status, to: 'removed' }, now)
}

export function restoreQuestion(model: ExtractionReviewModel, key: string, now?: string): ExtractionReviewModel {
  const q = model.questions.find((x) => x.key === key)
  if (!q) throw new Error(`unknown question ${key}`)
  if (q.status === 'active') return model
  return log(updateQ(model, key, (x) => ({ ...x, status: 'active', merged_into: null })), { key, field: 'restored', from: q.status, to: 'active' }, now)
}

/** Merge a duplicate into another question: the duplicate leaves the active
    list; the surviving question keeps the stricter limits and required flag. */
export function mergeDuplicate(model: ExtractionReviewModel, key: string, intoKey: string, now?: string): ExtractionReviewModel {
  if (key === intoKey) throw new Error('cannot merge a question into itself')
  const dup = model.questions.find((x) => x.key === key)
  const into = model.questions.find((x) => x.key === intoKey)
  if (!dup || !into) throw new Error('unknown question')
  if (into.status !== 'active') throw new Error('merge target is not active')
  const minLimit = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.min(a, b))
  let m = updateQ(model, key, (x) => ({ ...x, status: 'merged', merged_into: intoKey }))
  m = log(m, { key, field: 'merged', from: null, to: intoKey }, now)
  const wl = minLimit(into.word_limit, dup.word_limit)
  const cl = minLimit(into.char_limit, dup.char_limit)
  if (wl !== into.word_limit || cl !== into.char_limit) m = setLimits(m, intoKey, { word_limit: wl, char_limit: cl }, now)
  if (dup.required && !into.required) m = setRequired(m, intoKey, true, now)
  return m
}

export function clearQuestionMatch(model: ExtractionReviewModel, key: string, now?: string): ExtractionReviewModel {
  const q = model.questions.find((x) => x.key === key)
  if (!q) throw new Error(`unknown question ${key}`)
  if (q.match_cleared || !q.match) return model
  return log(updateQ(model, key, (x) => ({ ...x, match_cleared: true })), { key, field: 'question_match', from: q.match?.canonical_question_id ?? null, to: null }, now)
}

export function restoreQuestionMatch(model: ExtractionReviewModel, key: string, now?: string): ExtractionReviewModel {
  const q = model.questions.find((x) => x.key === key)
  if (!q || !q.match_cleared) return model
  return log(updateQ(model, key, (x) => ({ ...x, match_cleared: false })), { key, field: 'question_match', from: null, to: q.match?.canonical_question_id ?? null }, now)
}

/** Pick (or switch) the program this import belongs to — from the match
    candidates or from the catalog list. */
export function pickProgramMatch(model: ExtractionReviewModel, program: JourneyCatalogProgram, now?: string): ExtractionReviewModel {
  if (model.source.kind === 'catalog') throw new Error('the catalog path is already bound to its program')
  const prev = model.program_match?.program_id ?? null
  if (prev === program.id) return model
  const fromCandidates = model.program_candidates.find((c) => c.program_id === program.id)
  const view: ProgramMatchView = fromCandidates ?? { program_id: program.id, slug: program.slug, name: program.name, basis: 'user', confidence: 1, cycle_name: program.cycle?.cycle_name ?? null }
  const m: ExtractionReviewModel = { ...model, program_match: view, cycle: { ...model.cycle, name: model.cycle.name ?? program.cycle?.cycle_name ?? null } }
  return log(m, { key: null, field: 'program_match', from: prev, to: program.id }, now)
}

export function clearProgramMatch(model: ExtractionReviewModel, now?: string): ExtractionReviewModel {
  if (model.source.kind === 'catalog') throw new Error('the catalog path is already bound to its program')
  if (!model.program_match) return model
  const m: ExtractionReviewModel = { ...model, program_match: null, use_catalog_template: false }
  return log(m, { key: null, field: 'program_match', from: model.program_match.program_id, to: null }, now)
}

/** For an import matched to a catalog program: answer AQUA's catalog template
    instead of the imported list (or switch back). */
export function setUseCatalogTemplate(model: ExtractionReviewModel, use: boolean, now?: string): ExtractionReviewModel {
  if (model.source.kind === 'catalog') return model
  if (use && !model.program_match) throw new Error('pick a program match first')
  if (model.use_catalog_template === use) return model
  return log({ ...model, use_catalog_template: use }, { key: null, field: 'template_choice', from: model.use_catalog_template ? 'catalog' : 'imported', to: use ? 'catalog' : 'imported' }, now)
}

export function setProgramIdentity(model: ExtractionReviewModel, patch: { title?: string; organization?: string }, now?: string): ExtractionReviewModel {
  let m = model
  if (patch.title !== undefined && patch.title !== m.program.title) {
    m = log({ ...m, program: { ...m.program, title: patch.title } }, { key: null, field: 'title', from: m.program.title, to: patch.title }, now)
  }
  if (patch.organization !== undefined && patch.organization !== m.program.organization) {
    m = log({ ...m, program: { ...m.program, organization: patch.organization } }, { key: null, field: 'organization', from: m.program.organization, to: patch.organization }, now)
  }
  return m
}

export function setDeadline(model: ExtractionReviewModel, d: { date: string | null; time?: string | null; timezone?: string | null }, now?: string): ExtractionReviewModel {
  if (d.date && !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) throw new Error('deadline date must be YYYY-MM-DD')
  if (d.time && !/^\d{2}:\d{2}$/.test(d.time)) throw new Error('deadline time must be HH:MM')
  const next: DeadlineView | null = d.date
    ? { text: [d.date, d.time, d.timezone].filter(Boolean).join(' '), date: d.date, time: d.time ?? null, timezone: d.timezone ?? null, ambiguous: false }
    : null
  const prev = model.cycle.deadline
  if ((prev?.text ?? null) === (next?.text ?? null)) return model
  return log({ ...model, cycle: { ...model.cycle, deadline: next } }, { key: null, field: 'deadline', from: prev?.text ?? null, to: next?.text ?? null }, now)
}

// ─── derived views ───────────────────────────────────────────────────────────

export function activeQuestions(model: ExtractionReviewModel): ReviewQuestion[] {
  return model.questions.filter((q) => q.status === 'active')
}

/** Missing or unverified requirements, in plain language (informational). */
export function missingRequirements(model: ExtractionReviewModel): string[] {
  const out: string[] = []
  const d = model.cycle.deadline
  if (!d) out.push('No deadline found — check the program page.')
  else {
    if (!d.timezone) out.push('The deadline has no time zone — verify it against the source.')
    if (d.ambiguous) out.push('The deadline date format is ambiguous (day/month order) — verify it.')
    if (!d.time) out.push('The deadline has no time of day.')
  }
  const act = activeQuestions(model)
  const noLimit = act.filter((q) => q.word_limit == null && q.char_limit == null).length
  if (noLimit) out.push(`${noLimit} question(s) state no word or character limit.`)
  const unstated = act.filter((q) => q.original_required === null).length
  if (unstated && model.source.kind !== 'catalog') out.push(`${unstated} question(s) do not say whether they are required — defaulted to optional.`)
  if (model.source.kind !== 'catalog') {
    if (!model.program_match) out.push('Not matched to a program in the AQUA catalog (unverified).')
    else if (model.program_needs_review && model.program_match.basis !== 'user') out.push('The program match is a suggestion — confirm it.')
  }
  if (model.source.kind === 'url' && model.source.reuse === 'unknown') out.push('The page does not say whether its content may be reused.')
  const withheld = act.filter((q) => q.original_text == null).length
  if (withheld) out.push(`${withheld} question(s) contained private details and were withheld — retype or remove them.`)
  return out
}

export interface ActivationBlocker {
  key: string | null
  code: 'no_questions' | 'blank_wording' | 'invalid_limit' | 'no_title' | 'catalog_template_empty'
  message: string
}

/** Everything that must be fixed before the private instance can be created. */
export function activationBlockers(model: ExtractionReviewModel, catalog?: JourneyCatalog | null): ActivationBlocker[] {
  const out: ActivationBlocker[] = []
  if (model.use_catalog_template) {
    const p = catalog?.programs.find((x) => x.id === model.program_match?.program_id)
    if (!p || p.questions.length === 0) out.push({ key: null, code: 'catalog_template_empty', message: 'The catalog template for this program has no questions yet — keep the imported list instead.' })
    return out
  }
  const act = activeQuestions(model)
  if (!act.length) out.push({ key: null, code: 'no_questions', message: 'Keep at least one question.' })
  if (!(model.program.title ?? '').trim()) out.push({ key: null, code: 'no_title', message: 'Give this application a name.' })
  for (const q of act) {
    if (!(q.text ?? '').trim()) out.push({ key: q.key, code: 'blank_wording', message: `Question ${q.order_index + 1} has no wording — retype it or remove it.` })
    for (const lim of [q.word_limit, q.char_limit]) {
      if (lim != null && (!Number.isInteger(lim) || lim <= 0)) out.push({ key: q.key, code: 'invalid_limit', message: `Question ${q.order_index + 1} has an invalid limit.` })
    }
  }
  return out
}

/** Deadline as stored in the private template: "YYYY-MM-DD[ HH:MM][ TZ]". */
export function templateDeadline(d: DeadlineView | null): string | null {
  if (!d?.date) return null
  return [d.date, d.time, d.timezone].filter(Boolean).join(' ')
}

export function cycleYearOf(model: ExtractionReviewModel): number | null {
  const fromName = model.cycle.name?.match(/\b(20\d{2})\b/)
  if (fromName) return Number(fromName[1])
  const y = model.cycle.deadline?.date ? Number(model.cycle.deadline.date.slice(0, 4)) : NaN
  return Number.isFinite(y) ? y : null
}

/** Display label for the extraction method. */
export function methodLabel(m: JourneyMethod): string {
  return m === 'catalog_template' ? 'AQUA catalog template' : m === 'url_fetch' ? 'Fetched from a public URL' : m === 'paste' ? 'Pasted text (parsed on this device)' : 'Uploaded file (parsed on this device)'
}
