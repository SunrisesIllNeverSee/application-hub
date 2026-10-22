// M09 W6 — optional "Suggest this application for the public catalog".
// PURE. The payload is the server-built buildPublicCandidate() output for
// the public URL, passed through unchanged after a second, client-side leak
// gate. User corrections, private items, uncertain items and answers are
// never added. Nothing is sent from here — the UI shows this exact body and
// posts it only after the user confirms.

import { detectPII, detectSecrets, sanitizeSourceUrl, type PublicCandidate } from '../catalog/classify.ts'
import { foldText } from '../catalog/normalize.ts'
import type { ExtractionReviewModel, JourneyCatalog } from './review-model.ts'

// ─── W3 contract (m09/catalog-promotion lib/catalog-promotion/schema.ts) ──
// POST /api/catalog/candidates  { payload: CandidatePayload, source: SourceInput }
// Allowlisted keys only; anything else is rejected as unknown_key.

export type CandidateResponseType = 'text_short' | 'text_long' | 'multiple_choice' | 'yes_no' | 'number' | 'url' | 'file_upload' | 'date'

export interface CandidateQuestionBody {
  asked_as: string
  order_index: number
  section?: string
  required?: boolean
  response_type?: CandidateResponseType
  word_limit?: number
  char_limit?: number
  time_context?: string
  qualifiers?: string[]
  mapping?: { canonical_question_id?: string; tier: 'exact' | 'normalized' | 'semantic' | 'novel'; confidence?: number }
}

export interface CandidatePayloadBody {
  program: { name: string; organization: string; kind: 'other'; apply_url: string; description?: string }
  cycle?: { closes_at?: string; timezone?: string }
  questions: CandidateQuestionBody[]
  source_refs: Array<{ url: string; kind: 'application_form' }>
  evidence?: { deadline_quote?: string }
}

export interface CandidateRequestBody {
  payload: CandidatePayloadBody
  /** url_fetch: the server re-fetches the page itself (W2 guarded fetch) and ignores client snapshots */
  source: { url: string; capture_method: 'url_fetch' }
}

export type CandidateRequest =
  | { ok: true; body: CandidateRequestBody; notes: string[] }
  | { ok: false; reasons: string[] }

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out))
  return out
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Deadline time-zone abbreviations (as written on pages) → IANA zones W3 accepts. */
const TZ_ALIASES: Record<string, string> = {
  UTC: 'UTC', GMT: 'UTC', Z: 'UTC',
  PT: 'America/Los_Angeles', PST: 'America/Los_Angeles', PDT: 'America/Los_Angeles', PACIFIC: 'America/Los_Angeles',
  MT: 'America/Denver', MST: 'America/Denver', MDT: 'America/Denver',
  CT: 'America/Chicago', CST: 'America/Chicago', CDT: 'America/Chicago',
  ET: 'America/New_York', EST: 'America/New_York', EDT: 'America/New_York', EASTERN: 'America/New_York',
  BST: 'Europe/London', CET: 'Europe/Berlin', CEST: 'Europe/Berlin', IST: 'Asia/Kolkata', JST: 'Asia/Tokyo', AEST: 'Australia/Sydney',
}

export function ianaTimeZone(tz: string | null | undefined): string | null {
  if (!tz) return null
  const t = tz.trim()
  const alias = TZ_ALIASES[t.toUpperCase().replace(/\./g, '')]
  if (alias) return alias
  if (/^[A-Za-z_]+\/[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)?$/.test(t)) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: t }); return t } catch { return null }
  }
  return null
}

const RESPONSE_TYPE: Record<string, CandidateResponseType> = {
  textarea: 'text_long', text: 'text_long', label: 'text_long', input: 'text_short',
  select: 'multiple_choice', radio: 'multiple_choice', checkbox: 'multiple_choice', file: 'file_upload',
}

/** Whether the suggest action may be offered at all (public URL, reuse not disallowed, a candidate exists). */
export function candidateEligibility(model: ExtractionReviewModel): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (model.source.kind !== 'url') reasons.push('Only applications imported from a public URL can be suggested.')
  if (model.source.reuse === 'disallowed') reasons.push('The source page disallows reuse.')
  if (model.source.kind === 'url' && !model.public_candidate) {
    reasons.push(...(model.public_candidate_refused?.length ? model.public_candidate_refused.map((r) => `Withheld: ${r}`) : ['No shareable public fields were found.']))
  }
  return { eligible: reasons.length === 0, reasons }
}

/**
 * Map the server-built public candidate (W2 buildPublicCandidate) onto the
 * W3 candidate schema, field by field, dropping everything W3 does not
 * allow. Only potentially-public candidate fields are used, plus — where W3
 * requires a value the page did not state — public catalog data (the
 * matched program's organization) or the organization name the user typed
 * in Step B (shown in the preview before sending). Never answers,
 * approvals, wording corrections, private or uncertain items.
 */
export function buildCandidateRequest(model: ExtractionReviewModel, catalog?: JourneyCatalog | null): CandidateRequest {
  const elig = candidateEligibility(model)
  if (!elig.eligible) return { ok: false, reasons: elig.reasons }
  const cand = model.public_candidate as PublicCandidate
  const reasons: string[] = []
  if (cand.kind !== 'aqua.public_catalog_candidate' || cand.status !== 'candidate' || cand.requires_human_approval !== true) {
    reasons.push('Candidate shape is not a curator-review candidate.')
  }
  const sourceUrl = sanitizeSourceUrl(model.source.final_url ?? model.source.ref ?? '')
  if (!sourceUrl) reasons.push('The source URL is not shareable.')

  const matched = model.program_match ? catalog?.programs.find((p) => p.id === model.program_match!.program_id) ?? null : null
  const name = (cand.program.title ?? '').trim()
  const organization = (cand.program.organization ?? matched?.organization ?? model.program.organization ?? '').trim()
  if (!name) reasons.push('The page does not state a program name the catalog can use.')
  if (!organization) reasons.push('Add the organization name in Step B — the catalog requires it.')
  const applyUrl = cand.program.apply_urls.map((u) => sanitizeSourceUrl(u)).find(Boolean) ?? sourceUrl

  const program: CandidatePayloadBody['program'] = { name, organization, kind: 'other', apply_url: applyUrl ?? '' }
  if (cand.program.description) program.description = cand.program.description.slice(0, 2000)

  const payload: CandidatePayloadBody = { program, questions: [], source_refs: [] }
  const d = cand.deadlines.find((x) => x.date && !x.ambiguous)
  if (d?.date) {
    const tz = ianaTimeZone(d.timezone)
    payload.cycle = { closes_at: d.time ? `${d.date}T${d.time}` : d.date, ...(tz ? { timezone: tz } : {}) }
  }
  if (cand.deadlines[0]?.text) payload.evidence = { deadline_quote: cand.deadlines[0].text.slice(0, 500) }

  const usedCanonical = new Set<string>()
  const byOrder = new Map(model.questions.map((q) => [q.order_index, q]))
  for (const pq of cand.questions) {
    const r = pq.requirements
    const q: CandidateQuestionBody = { asked_as: pq.asked_as, order_index: pq.order_index }
    if (pq.section) q.section = pq.section
    if (r.required === true) q.required = true
    else if (r.optional === true || r.required === false) q.required = false
    const rt = RESPONSE_TYPE[pq.field_kind]
    if (rt) q.response_type = rt
    if (typeof r.word_limit === 'number' && r.word_limit > 0) q.word_limit = r.word_limit
    if (typeof r.char_limit === 'number' && r.char_limit > 0) q.char_limit = r.char_limit
    if (r.time_context?.length) q.time_context = r.time_context.join('; ').slice(0, 200)
    if (r.qualifiers?.length) q.qualifiers = r.qualifiers.slice(0, 10).map((x) => x.slice(0, 300))
    // mapping: the public match suggestion (page wording vs catalog), never a user choice
    const m = byOrder.get(pq.order_index)?.match
    if (m && m.tier !== 'novel' && m.canonical_question_id && UUID_RE.test(m.canonical_question_id) && !usedCanonical.has(m.canonical_question_id.toLowerCase())) {
      usedCanonical.add(m.canonical_question_id.toLowerCase())
      q.mapping = { canonical_question_id: m.canonical_question_id.toLowerCase(), tier: m.tier as 'exact' | 'normalized' | 'semantic', confidence: Math.max(0, Math.min(1, m.confidence)) }
    } else if (m && m.tier === 'novel') {
      q.mapping = { tier: 'novel' }
    }
    payload.questions.push(q)
  }
  for (const ref of cand.source_refs.slice(0, 10)) {
    const u = sanitizeSourceUrl(ref.url)
    if (u && !payload.source_refs.some((x) => x.url === u)) payload.source_refs.push({ url: u, kind: 'application_form' })
  }
  if (!payload.source_refs.length && sourceUrl) payload.source_refs.push({ url: sourceUrl, kind: 'application_form' })

  // ── client-side leak gate on the exact body that would be sent ──
  const all = strings(payload)
  for (const str of all) {
    for (const f of detectSecrets(str)) reasons.push(`secret:${f.kind}`)
    for (const f of detectPII(str)) reasons.push(`pii:${f.kind}`)
  }
  const folded = all.map(foldText)
  const overlaps = (value: string) => {
    const f = foldText(value)
    if (f.length < 8) return false
    return folded.some((x) => x === f || (f.length >= 24 && x.includes(f)))
  }
  for (const u of model.uncertain) if (overlaps(u.value)) reasons.push(`withheld uncertain ${u.kind} would leak`)
  for (const q of model.questions) {
    if (q.corrected && q.text && q.text !== q.original_text && overlaps(q.text)) reasons.push('a private wording correction would leak')
    if (q.visibility !== 'public' && q.original_text && overlaps(q.original_text)) reasons.push(`withheld ${q.visibility} question would leak`)
  }
  if (reasons.length) return { ok: false, reasons: [...new Set(reasons)] }
  return {
    ok: true,
    body: { payload, source: { url: sourceUrl as string, capture_method: 'url_fetch' } },
    notes: [...cand.verification_notes],
  }
}

export type CandidateSubmitResult =
  | { ok: true; candidate_id: string | null; state: string | null }
  | { ok: false; code: 'unavailable' | 'invalid' | 'unauthorized' | 'rate_limited' | 'reuse_disallowed' | 'source_fetch_failed' | 'network_error' | 'error'; message: string; errors?: Array<{ path: string; code: string }> }

/** POST the confirmed body. `fetchImpl` is injected (tests / harness). */
export async function submitCandidate(body: CandidateRequestBody, fetchImpl: typeof fetch): Promise<CandidateSubmitResult> {
  let res: Response
  try {
    res = await fetchImpl('/api/catalog/candidates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, code: 'network_error', message: 'Could not reach AQUA — nothing was submitted.' }
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (res.ok) {
    const c = (json?.candidate ?? {}) as Record<string, unknown>
    return { ok: true, candidate_id: typeof c.id === 'string' ? c.id : null, state: typeof c.state === 'string' ? c.state : null }
  }
  if (res.status === 503 || json?.error === 'catalog_promotion_unavailable') {
    return { ok: false, code: 'unavailable', message: 'Catalog submissions open soon — nothing was submitted.' }
  }
  if (res.status === 401) return { ok: false, code: 'unauthorized', message: 'Sign in to suggest an application.' }
  if (res.status === 422 && json?.error === 'source_reuse_disallowed') {
    return { ok: false, code: 'reuse_disallowed', message: 'The page says its content may not be reused, so it cannot be suggested. Nothing was added to the catalog.' }
  }
  if (res.status === 422 && json?.error === 'source_fetch_failed') {
    return { ok: false, code: 'source_fetch_failed', message: 'AQUA could not re-fetch the public page to verify it. Nothing was added — try again later.' }
  }
  if (res.status === 429) return { ok: false, code: 'rate_limited', message: 'Too many suggestions — try again later.' }
  if (res.status === 400) {
    return { ok: false, code: 'invalid', message: 'The catalog refused this suggestion.', errors: Array.isArray(json?.errors) ? (json!.errors as Array<{ path: string; code: string }>) : undefined }
  }
  return { ok: false, code: 'error', message: `The catalog returned an error (${res.status}).` }
}
