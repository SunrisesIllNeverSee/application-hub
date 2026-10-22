// Catalog promotion — strict allowlisted candidate schema (M09 W3).
//
// A candidate is a PUBLIC catalog contribution: program identity, public
// requirements, exact question wording, source references. Anything not in
// the allowlist is rejected (unknown_key), every string is length-bounded,
// and every string is scanned for private data / secrets / answer prose.
// Errors carry a path and a code only — never the offending value.
//
// Pure and dependency-free (node --test with type stripping).

import { checkPublicUrl, scanText, SECRET_KINDS } from './privacy.ts'

export const OPPORTUNITY_KINDS = [
  'accelerator', 'vc', 'grant', 'fellowship', 'job_fulltime', 'job_internship', 'job_contract',
  'school_undergrad', 'school_grad', 'school_professional', 'other',
] as const
export const PROGRAM_TYPES = ['grant', 'accel', 'vc', 'corp', 'uni', 'job', 'fellowship', 'other'] as const
export const PROGRAM_STATUSES = ['upcoming', 'open', 'closed', 'results'] as const
export const DOMAINS = ['founder', 'jobs', 'education', 'grants', 'general'] as const
export const ENTITY_KINDS = ['accelerator', 'investor', 'company', 'foundation', 'government', 'university', 'other'] as const
export const RESPONSE_TYPES = [
  'text_short', 'text_long', 'multiple_choice', 'yes_no', 'number', 'url', 'file_upload', 'date',
] as const
export const MAPPING_TIERS = ['exact', 'normalized', 'semantic', 'novel', 'curator'] as const
export const SOURCE_REF_KINDS = ['application_form', 'program_page', 'faq', 'announcement', 'other'] as const
// url_fetch = the SERVER fetches the URL and records what it observed;
// the others are client-supplied evidence (lower trust).
export const SUBMITTER_CAPTURE_METHODS = ['url_fetch', 'public_paste', 'public_file'] as const
export const CURATOR_CAPTURE_METHODS = ['url_fetch', 'public_paste', 'public_file', 'curator_upload'] as const
export const SERVER_CAPTURE_METHODS: readonly string[] = ['url_fetch']

export const LIMITS = {
  name: 200, organization: 200, slug: 80, url: 500, description: 2000, tag: 60, tags: 10,
  cycleName: 80, timezone: 64, eligibility: 4000, requirements: 4000, sections: 50, sectionTitle: 200,
  questions: 200, askedAs: 1500, section: 200, timeContext: 200, qualifiers: 10, qualifier: 300,
  canonicalText: 1500, theme: 60, rationale: 2000, sourceRefs: 10, sourceUrl: 1000, note: 300,
  quote: 500, snapshot: 200_000, wordLimit: 100_000, charLimit: 1_000_000, orderIndex: 10_000,
} as const

export type CandidateQuestion = {
  asked_as: string
  order_index: number
  section?: string
  required?: boolean
  response_type?: (typeof RESPONSE_TYPES)[number]
  word_limit?: number
  char_limit?: number
  time_context?: string
  qualifiers?: string[]
  canonical_text?: string
  theme?: string
  mapping?: {
    canonical_question_id?: string
    tier: (typeof MAPPING_TIERS)[number]
    confidence?: number
    rationale?: string
  }
}

export type CandidatePayload = {
  program: {
    name: string
    organization: string
    kind: (typeof OPPORTUNITY_KINDS)[number]
    type?: (typeof PROGRAM_TYPES)[number]
    slug?: string
    url?: string
    apply_url: string
    description?: string
    status?: (typeof PROGRAM_STATUSES)[number]
    domain?: (typeof DOMAINS)[number]
    geo_focus?: string[]
    industry_tags?: string[]
  }
  entity?: { name: string; website?: string; kind?: (typeof ENTITY_KINDS)[number] }
  cycle?: { name?: string; opens_at?: string; closes_at?: string; timezone?: string; is_rolling?: boolean }
  eligibility?: string
  requirements?: string
  sections?: { title: string; order_index: number }[]
  questions: CandidateQuestion[]
  source_refs: { url: string; kind: (typeof SOURCE_REF_KINDS)[number]; note?: string }[]
  evidence?: { deadline_quote?: string; requirements_quote?: string }
}

export type SourceInput = {
  url: string
  /** client-supplied captures only (ignored for url_fetch) */
  final_url?: string
  capture_method: (typeof CURATOR_CAPTURE_METHODS)[number]
  snapshot_text?: string
}

export type ValidationError = { path: string; code: string }
export type Validated<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const THEME_RE = /^[a-z][a-z0-9_]*$/
const ISO_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

type Ctx = { errors: ValidationError[] }

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function allowKeys(ctx: Ctx, path: string, obj: Record<string, unknown>, keys: readonly string[]) {
  for (const k of Object.keys(obj)) if (!keys.includes(k)) ctx.errors.push({ path: path ? `${path}.${k}` : k, code: 'unknown_key' })
}

type StrOpts = { required?: boolean; max: number; contacts?: boolean; answerLike?: boolean; pattern?: RegExp }

function str(ctx: Ctx, path: string, v: unknown, o: StrOpts): string | undefined {
  if (v === undefined || v === null) {
    if (o.required) ctx.errors.push({ path, code: 'required' })
    return undefined
  }
  if (typeof v !== 'string') { ctx.errors.push({ path, code: 'invalid_type' }); return undefined }
  const s = v.replace(/\r\n?/g, '\n')
  if (o.required && s.trim() === '') { ctx.errors.push({ path, code: 'required' }); return undefined }
  if (s.length > o.max) { ctx.errors.push({ path, code: 'too_long' }); return undefined }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s)) { ctx.errors.push({ path, code: 'control_chars' }); return undefined }
  if (o.pattern && !o.pattern.test(s)) { ctx.errors.push({ path, code: 'invalid_format' }); return undefined }
  const findings = scanText(s, { contacts: o.contacts ?? true, answerLike: o.answerLike ?? true })
  if (findings.length) {
    for (const f of findings) ctx.errors.push({ path, code: `${SECRET_KINDS.has(f.kind) ? 'secret' : 'private_data'}:${f.kind}` })
    return undefined
  }
  return s
}

function url(ctx: Ctx, path: string, v: unknown, required: boolean, max: number = LIMITS.url): string | undefined {
  const s = str(ctx, path, v, { required, max, answerLike: false, contacts: false })
  if (s === undefined) return undefined
  const verdict = checkPublicUrl(s.trim())
  if (!verdict.ok) { ctx.errors.push({ path, code: verdict.kind }); return undefined }
  // emails / phones hidden in a URL path or query
  if (scanText(decodeURIComponentSafe(s)).some((f) => f.kind === 'email' || f.kind === 'phone')) {
    ctx.errors.push({ path, code: 'private_data:email_or_phone_in_url' })
    return undefined
  }
  return verdict.url.toString()
}

function decodeURIComponentSafe(s: string): string {
  try { return decodeURIComponent(s) } catch { return s }
}

function oneOf<T extends string>(ctx: Ctx, path: string, v: unknown, values: readonly T[], required = false): T | undefined {
  if (v === undefined || v === null) { if (required) ctx.errors.push({ path, code: 'required' }); return undefined }
  if (typeof v !== 'string' || !values.includes(v as T)) { ctx.errors.push({ path, code: 'invalid_enum' }); return undefined }
  return v as T
}

function int(ctx: Ctx, path: string, v: unknown, min: number, max: number, required = false): number | undefined {
  if (v === undefined || v === null) { if (required) ctx.errors.push({ path, code: 'required' }); return undefined }
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) { ctx.errors.push({ path, code: 'invalid_number' }); return undefined }
  return v
}

function bool(ctx: Ctx, path: string, v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'boolean') { ctx.errors.push({ path, code: 'invalid_type' }); return undefined }
  return v
}

function strArray(ctx: Ctx, path: string, v: unknown, maxItems: number, maxLen: number): string[] | undefined {
  if (v === undefined || v === null) return undefined
  if (!Array.isArray(v)) { ctx.errors.push({ path, code: 'invalid_type' }); return undefined }
  if (v.length > maxItems) { ctx.errors.push({ path, code: 'too_many' }); return undefined }
  const out: string[] = []
  v.forEach((x, i) => { const s = str(ctx, `${path}[${i}]`, x, { required: true, max: maxLen }); if (s !== undefined) out.push(s) })
  return out
}

function isoDate(ctx: Ctx, path: string, v: unknown): string | undefined {
  const s = str(ctx, path, v, { max: 40, contacts: false, answerLike: false })
  if (s === undefined) return undefined
  if (!ISO_RE.test(s) || Number.isNaN(Date.parse(s))) { ctx.errors.push({ path, code: 'invalid_date' }); return undefined }
  return s
}

export function isValidTimeZone(tz: string): boolean {
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(tz) && tz !== 'UTC') return false
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

function question(ctx: Ctx, path: string, v: unknown): CandidateQuestion | undefined {
  if (!isObj(v)) { ctx.errors.push({ path, code: 'invalid_type' }); return undefined }
  allowKeys(ctx, path, v, ['asked_as', 'order_index', 'section', 'required', 'response_type', 'word_limit', 'char_limit',
    'time_context', 'qualifiers', 'canonical_text', 'theme', 'mapping'])
  const asked_as = str(ctx, `${path}.asked_as`, v.asked_as, { required: true, max: LIMITS.askedAs })
  const order_index = int(ctx, `${path}.order_index`, v.order_index, 0, LIMITS.orderIndex, true)
  const q: CandidateQuestion = { asked_as: asked_as ?? '', order_index: order_index ?? 0 }
  const section = str(ctx, `${path}.section`, v.section, { max: LIMITS.section }); if (section !== undefined) q.section = section
  const required = bool(ctx, `${path}.required`, v.required); if (required !== undefined) q.required = required
  const rt = oneOf(ctx, `${path}.response_type`, v.response_type, RESPONSE_TYPES); if (rt) q.response_type = rt
  const wl = int(ctx, `${path}.word_limit`, v.word_limit, 1, LIMITS.wordLimit); if (wl !== undefined) q.word_limit = wl
  const cl = int(ctx, `${path}.char_limit`, v.char_limit, 1, LIMITS.charLimit); if (cl !== undefined) q.char_limit = cl
  const tc = str(ctx, `${path}.time_context`, v.time_context, { max: LIMITS.timeContext }); if (tc !== undefined) q.time_context = tc
  const quals = strArray(ctx, `${path}.qualifiers`, v.qualifiers, LIMITS.qualifiers, LIMITS.qualifier); if (quals) q.qualifiers = quals
  const ct = str(ctx, `${path}.canonical_text`, v.canonical_text, { max: LIMITS.canonicalText }); if (ct !== undefined) q.canonical_text = ct
  const theme = str(ctx, `${path}.theme`, v.theme, { max: LIMITS.theme, pattern: THEME_RE }); if (theme !== undefined) q.theme = theme
  if (v.mapping !== undefined && v.mapping !== null) {
    const m = v.mapping
    const mp = `${path}.mapping`
    if (!isObj(m)) ctx.errors.push({ path: mp, code: 'invalid_type' })
    else {
      allowKeys(ctx, mp, m, ['canonical_question_id', 'tier', 'confidence', 'rationale'])
      const tier = oneOf(ctx, `${mp}.tier`, m.tier, MAPPING_TIERS, true)
      const mapping: NonNullable<CandidateQuestion['mapping']> = { tier: tier ?? 'novel' }
      if (m.canonical_question_id !== undefined && m.canonical_question_id !== null) {
        if (typeof m.canonical_question_id !== 'string' || !UUID_RE.test(m.canonical_question_id)) ctx.errors.push({ path: `${mp}.canonical_question_id`, code: 'invalid_uuid' })
        else mapping.canonical_question_id = m.canonical_question_id.toLowerCase()
      }
      if (m.confidence !== undefined && m.confidence !== null) {
        if (typeof m.confidence !== 'number' || !(m.confidence >= 0 && m.confidence <= 1)) ctx.errors.push({ path: `${mp}.confidence`, code: 'invalid_number' })
        else mapping.confidence = m.confidence
      }
      const r = str(ctx, `${mp}.rationale`, m.rationale, { max: LIMITS.rationale }); if (r !== undefined) mapping.rationale = r
      if (tier === 'novel' && mapping.canonical_question_id) ctx.errors.push({ path: `${mp}.tier`, code: 'novel_with_canonical' })
      if (tier && tier !== 'novel' && !mapping.canonical_question_id) ctx.errors.push({ path: `${mp}.canonical_question_id`, code: 'required' })
      q.mapping = mapping
    }
  }
  return q
}

/** Validates and normalizes an untrusted candidate payload. */
export function validateCandidatePayload(input: unknown): Validated<CandidatePayload> {
  const ctx: Ctx = { errors: [] }
  if (!isObj(input)) return { ok: false, errors: [{ path: '', code: 'invalid_type' }] }
  allowKeys(ctx, '', input, ['program', 'entity', 'cycle', 'eligibility', 'requirements', 'sections', 'questions', 'source_refs', 'evidence'])

  // program
  const p = input.program
  let program: CandidatePayload['program'] | undefined
  if (!isObj(p)) ctx.errors.push({ path: 'program', code: p === undefined ? 'required' : 'invalid_type' })
  else {
    allowKeys(ctx, 'program', p, ['name', 'organization', 'kind', 'type', 'slug', 'url', 'apply_url', 'description', 'status', 'domain', 'geo_focus', 'industry_tags'])
    program = {
      name: str(ctx, 'program.name', p.name, { required: true, max: LIMITS.name }) ?? '',
      organization: str(ctx, 'program.organization', p.organization, { required: true, max: LIMITS.organization }) ?? '',
      kind: oneOf(ctx, 'program.kind', p.kind, OPPORTUNITY_KINDS, true) ?? 'other',
      apply_url: url(ctx, 'program.apply_url', p.apply_url, true) ?? '',
    }
    const type = oneOf(ctx, 'program.type', p.type, PROGRAM_TYPES); if (type) program.type = type
    const slug = str(ctx, 'program.slug', p.slug, { max: LIMITS.slug, pattern: SLUG_RE }); if (slug !== undefined) program.slug = slug
    const homepage = url(ctx, 'program.url', p.url, false); if (homepage) program.url = homepage
    const desc = str(ctx, 'program.description', p.description, { max: LIMITS.description }); if (desc !== undefined) program.description = desc
    const status = oneOf(ctx, 'program.status', p.status, PROGRAM_STATUSES); if (status) program.status = status
    const domain = oneOf(ctx, 'program.domain', p.domain, DOMAINS); if (domain) program.domain = domain
    const geo = strArray(ctx, 'program.geo_focus', p.geo_focus, LIMITS.tags, LIMITS.tag); if (geo) program.geo_focus = geo
    const tags = strArray(ctx, 'program.industry_tags', p.industry_tags, LIMITS.tags, LIMITS.tag); if (tags) program.industry_tags = tags
  }

  const out: CandidatePayload = { program: program ?? ({} as CandidatePayload['program']), questions: [], source_refs: [] }

  // entity
  if (input.entity !== undefined && input.entity !== null) {
    const e = input.entity
    if (!isObj(e)) ctx.errors.push({ path: 'entity', code: 'invalid_type' })
    else {
      allowKeys(ctx, 'entity', e, ['name', 'website', 'kind'])
      const entity: NonNullable<CandidatePayload['entity']> = { name: str(ctx, 'entity.name', e.name, { required: true, max: LIMITS.name }) ?? '' }
      const w = url(ctx, 'entity.website', e.website, false); if (w) entity.website = w
      const k = oneOf(ctx, 'entity.kind', e.kind, ENTITY_KINDS); if (k) entity.kind = k
      out.entity = entity
    }
  }

  // cycle
  if (input.cycle !== undefined && input.cycle !== null) {
    const c = input.cycle
    if (!isObj(c)) ctx.errors.push({ path: 'cycle', code: 'invalid_type' })
    else {
      allowKeys(ctx, 'cycle', c, ['name', 'opens_at', 'closes_at', 'timezone', 'is_rolling'])
      const cycle: NonNullable<CandidatePayload['cycle']> = {}
      const n = str(ctx, 'cycle.name', c.name, { max: LIMITS.cycleName }); if (n !== undefined) cycle.name = n
      const o = isoDate(ctx, 'cycle.opens_at', c.opens_at); if (o) cycle.opens_at = o
      const cl = isoDate(ctx, 'cycle.closes_at', c.closes_at); if (cl) cycle.closes_at = cl
      const tz = str(ctx, 'cycle.timezone', c.timezone, { max: LIMITS.timezone, contacts: false, answerLike: false })
      if (tz !== undefined) { if (isValidTimeZone(tz)) cycle.timezone = tz; else ctx.errors.push({ path: 'cycle.timezone', code: 'invalid_timezone' }) }
      const r = bool(ctx, 'cycle.is_rolling', c.is_rolling); if (r !== undefined) cycle.is_rolling = r
      if (cycle.opens_at && cycle.closes_at && Date.parse(cycle.opens_at) > Date.parse(cycle.closes_at)) ctx.errors.push({ path: 'cycle.closes_at', code: 'before_opens_at' })
      out.cycle = cycle
    }
  }

  const el = str(ctx, 'eligibility', input.eligibility, { max: LIMITS.eligibility }); if (el !== undefined) out.eligibility = el
  const rq = str(ctx, 'requirements', input.requirements, { max: LIMITS.requirements }); if (rq !== undefined) out.requirements = rq

  // sections
  if (input.sections !== undefined && input.sections !== null) {
    if (!Array.isArray(input.sections)) ctx.errors.push({ path: 'sections', code: 'invalid_type' })
    else if (input.sections.length > LIMITS.sections) ctx.errors.push({ path: 'sections', code: 'too_many' })
    else {
      out.sections = []
      input.sections.forEach((s, i) => {
        const path = `sections[${i}]`
        if (!isObj(s)) { ctx.errors.push({ path, code: 'invalid_type' }); return }
        allowKeys(ctx, path, s, ['title', 'order_index'])
        const title = str(ctx, `${path}.title`, s.title, { required: true, max: LIMITS.sectionTitle })
        const oi = int(ctx, `${path}.order_index`, s.order_index, 0, LIMITS.orderIndex, true)
        if (title !== undefined && oi !== undefined) out.sections!.push({ title, order_index: oi })
      })
    }
  }

  // questions
  if (input.questions === undefined || input.questions === null) out.questions = []
  else if (!Array.isArray(input.questions)) ctx.errors.push({ path: 'questions', code: 'invalid_type' })
  else if (input.questions.length > LIMITS.questions) ctx.errors.push({ path: 'questions', code: 'too_many' })
  else {
    const seenOrder = new Set<number>()
    const seenCanonical = new Set<string>()
    input.questions.forEach((q, i) => {
      const v = question(ctx, `questions[${i}]`, q)
      if (!v) return
      if (seenOrder.has(v.order_index)) ctx.errors.push({ path: `questions[${i}].order_index`, code: 'duplicate' })
      seenOrder.add(v.order_index)
      const cq = v.mapping?.canonical_question_id
      if (cq) { if (seenCanonical.has(cq)) ctx.errors.push({ path: `questions[${i}].mapping.canonical_question_id`, code: 'duplicate' }); seenCanonical.add(cq) }
      out.questions.push(v)
    })
  }

  // source refs
  if (!Array.isArray(input.source_refs) || input.source_refs.length === 0) ctx.errors.push({ path: 'source_refs', code: 'required' })
  else if (input.source_refs.length > LIMITS.sourceRefs) ctx.errors.push({ path: 'source_refs', code: 'too_many' })
  else {
    input.source_refs.forEach((r, i) => {
      const path = `source_refs[${i}]`
      if (!isObj(r)) { ctx.errors.push({ path, code: 'invalid_type' }); return }
      allowKeys(ctx, path, r, ['url', 'kind', 'note'])
      const u = url(ctx, `${path}.url`, r.url, true, LIMITS.sourceUrl)
      const kind = oneOf(ctx, `${path}.kind`, r.kind, SOURCE_REF_KINDS, true)
      const note = str(ctx, `${path}.note`, r.note, { max: LIMITS.note })
      if (u && kind) out.source_refs.push(note !== undefined ? { url: u, kind, note } : { url: u, kind })
    })
  }

  // evidence quotes (must be public page text)
  if (input.evidence !== undefined && input.evidence !== null) {
    const e = input.evidence
    if (!isObj(e)) ctx.errors.push({ path: 'evidence', code: 'invalid_type' })
    else {
      allowKeys(ctx, 'evidence', e, ['deadline_quote', 'requirements_quote'])
      const ev: NonNullable<CandidatePayload['evidence']> = {}
      const d = str(ctx, 'evidence.deadline_quote', e.deadline_quote, { max: LIMITS.quote }); if (d !== undefined) ev.deadline_quote = d
      const r = str(ctx, 'evidence.requirements_quote', e.requirements_quote, { max: LIMITS.quote }); if (r !== undefined) ev.requirements_quote = r
      out.evidence = ev
    }
  }

  return ctx.errors.length ? { ok: false, errors: ctx.errors } : { ok: true, value: out }
}

/**
 * Validates the source evidence for a submission. The snapshot is public
 * page text: secrets are rejected outright; contact details (a published
 * program inbox, say) are allowed here and surfaced by the
 * no_private_data check for curator review instead.
 */
export function validateSourceInput(input: unknown, opts: { curator: boolean }): Validated<SourceInput> {
  const ctx: Ctx = { errors: [] }
  if (!isObj(input)) return { ok: false, errors: [{ path: 'source', code: input === undefined ? 'required' : 'invalid_type' }] }
  allowKeys(ctx, 'source', input, ['url', 'final_url', 'capture_method', 'snapshot_text'])
  const u = url(ctx, 'source.url', input.url, true, LIMITS.sourceUrl)
  const f = url(ctx, 'source.final_url', input.final_url, false, LIMITS.sourceUrl)
  const methods = opts.curator ? CURATOR_CAPTURE_METHODS : SUBMITTER_CAPTURE_METHODS
  const cm = oneOf(ctx, 'source.capture_method', input.capture_method, methods as readonly string[], true)
  const serverCaptured = cm === 'url_fetch'
  let snapshot: string | undefined
  // url_fetch: any client snapshot/final_url is ignored — the server records what IT fetched.
  if (!serverCaptured && input.snapshot_text !== undefined && input.snapshot_text !== null) {
    if (typeof input.snapshot_text !== 'string') ctx.errors.push({ path: 'source.snapshot_text', code: 'invalid_type' })
    else if (input.snapshot_text.length > LIMITS.snapshot) ctx.errors.push({ path: 'source.snapshot_text', code: 'too_long' })
    else {
      const secrets = scanText(input.snapshot_text, { contacts: false, answerLike: false }).filter((x) => SECRET_KINDS.has(x.kind))
      for (const s of secrets) ctx.errors.push({ path: 'source.snapshot_text', code: `secret:${s.kind}` })
      if (!secrets.length) snapshot = input.snapshot_text.replace(/\r\n?/g, '\n')
    }
  }
  if (ctx.errors.length) return { ok: false, errors: ctx.errors }
  const value: SourceInput = { url: u!, capture_method: cm as SourceInput['capture_method'] }
  if (f && !serverCaptured) value.final_url = f
  if (snapshot !== undefined) value.snapshot_text = snapshot
  return { ok: true, value }
}
