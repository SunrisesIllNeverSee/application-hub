// Catalog promotion — verification check runner (M09 W3, directive §3).
//
// Produces the `checks` object stored on catalog_candidates. A source is
// never accepted merely because it was captured: reuse must be affirmed by
// a curator, the exact wording must be found in the public snapshot, and
// deadline/requirement claims need quoted evidence from that snapshot.
// Pure: all database facts are passed in.

import { createHash } from 'node:crypto'
import { checkPublicUrl, scanText } from './privacy.ts'
import { validateCandidatePayload, type CandidatePayload, type CandidateQuestion } from './schema.ts'

export type SourceFacts = {
  url: string
  final_url?: string | null
  capture_method: string
  reuse: 'allowed' | 'unknown' | 'disallowed'
  robots_disallow?: boolean | null
  verification_status?: string | null
  snapshot_text?: string | null
  last_checked_at?: string | null
}

export type ExistingProgram = {
  id: string
  slug: string
  name: string
  organization?: string | null
  url?: string | null
  apply_url?: string | null
}

export type ExistingRevision = { program_id: string; revision: number; question_set_sha256: string }

export type CheckResult = { pass: boolean; detail: string }
export type DuplicateMatch = { program_id: string; slug: string; name: string; reasons: string[] }

export const CHECK_KEYS = [
  'source_public_reusable',
  'no_private_data',
  'duplicate_template',
  'exact_wording_preserved',
  'cycle_identified',
  'deadline_requirements_evidence',
] as const
export type CheckKey = (typeof CHECK_KEYS)[number]

export type SourceTrust = 'server_captured' | 'client_supplied' | 'none'

export type CandidateChecks = {
  version: 1
  ran_at: string
  all_passed: boolean
  /** server_captured = url_fetch snapshot taken by AQUA; client_supplied = pasted/uploaded (lower trust) */
  source_trust: SourceTrust
  question_set_sha256: string
  results: Record<CheckKey, CheckResult>
  duplicates: DuplicateMatch[]
  missing_wording: number[]
}

/** Mirrors catalog_norm() in 058 and norm() in canonical-053-data.mjs. */
export const norm = (t: string): string => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Typography/whitespace-insensitive comparison form; wording otherwise exact. */
export function compareForm(s: string): string {
  return s
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/…/g, '...')
    .replace(/[\s ]+/g, ' ')
    .trim()
}

/** Mirrors public.catalog_question_set_sha256(jsonb) in 058. */
export function questionSetSha256(questions: Pick<CandidateQuestion, 'order_index' | 'section' | 'asked_as'>[]): string {
  const sorted = [...questions].sort((a, b) =>
    a.order_index - b.order_index || (a.asked_as < b.asked_as ? -1 : a.asked_as > b.asked_as ? 1 : 0))
  const body = sorted.map((q) => `${q.order_index}\u001f${q.section ?? ''}\u001f${q.asked_as}`).join('\u001e')
  return createHash('sha256').update(body, 'utf8').digest('hex')
}

/** host (no www) + path (no trailing slash), lowercased; null if unparsable. */
export function urlKey(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    const path = u.pathname.replace(/\/+$/, '').toLowerCase()
    return `${host}${path}`
  } catch {
    return null
  }
}

export function findDuplicateTemplates(
  payload: CandidatePayload,
  programs: ExistingProgram[],
  revisions: ExistingRevision[] = [],
): DuplicateMatch[] {
  const applyKey = urlKey(payload.program.apply_url)
  const nameKey = norm(payload.program.name)
  const orgKey = norm(payload.program.organization)
  const sha = payload.questions.length ? questionSetSha256(payload.questions) : null
  const out: DuplicateMatch[] = []
  for (const p of programs) {
    const reasons: string[] = []
    if (applyKey && (urlKey(p.apply_url) === applyKey || urlKey(p.url) === applyKey)) reasons.push('apply_url')
    if (nameKey && norm(p.name) === nameKey) reasons.push('name')
    else if (orgKey && p.organization && norm(p.organization) === orgKey && nameKey && norm(p.name).includes(nameKey)) reasons.push('organization+name')
    if (sha && revisions.some((r) => r.program_id === p.id && r.question_set_sha256 === sha)) reasons.push('question_set')
    if (reasons.length) out.push({ program_id: p.id, slug: p.slug, name: p.name, reasons })
  }
  return out
}

export type QuestionMatch = { index: number; canonical_question_id: string; tier: 'exact' | 'normalized' }

/** Exact, then normalized-text matches against canonical questions (semantic matching is out of scope here). */
export function matchQuestions(questions: CandidateQuestion[], canonical: { id: string; text: string }[]): QuestionMatch[] {
  const exact = new Map<string, string>()
  const normalized = new Map<string, string>()
  for (const c of canonical) {
    if (!exact.has(c.text)) exact.set(c.text, c.id)
    const k = norm(c.text)
    if (k && !normalized.has(k)) normalized.set(k, c.id)
  }
  const used = new Set<string>()
  const out: QuestionMatch[] = []
  questions.forEach((q, index) => {
    const e = exact.get(q.asked_as)
    const n = normalized.get(norm(q.asked_as))
    const id = e ?? n
    if (id && !used.has(id)) {
      used.add(id)
      out.push({ index, canonical_question_id: id, tier: e ? 'exact' : 'normalized' })
    }
  })
  return out
}

/** Adds AQUA's own exact/normalized matches (origin 'auto_match') to questions
    that have no mapping (curator-supplied mappings win). Submitter
    suggestions live in `suggested_mapping` and never block a match. */
export function applyMatches(payload: CandidatePayload, matches: QuestionMatch[]): CandidatePayload {
  const taken = new Set(payload.questions.map((q) => q.mapping?.canonical_question_id).filter(Boolean) as string[])
  const questions = payload.questions.map((q, i) => {
    if (q.mapping) return q
    const m = matches.find((x) => x.index === i)
    if (!m || taken.has(m.canonical_question_id)) return q
    taken.add(m.canonical_question_id)
    return { ...q, mapping: { canonical_question_id: m.canonical_question_id, tier: m.tier, confidence: 1, origin: 'auto_match' as const } }
  })
  return { ...payload, questions }
}

// ─── M09 review M6: source freshness for approve / publish ─────────────────

export type SourceFreshness = { fresh: boolean; problems: string[] }

/**
 * A canonical template may only be approved or published from evidence that
 * is still good: the source must not be stale (page changed since capture)
 * or failed (recheck could not fetch it), reuse must not be disallowed, and
 * robots/terms must not disallow reuse. Mirrors what 058 should enforce in
 * SQL (see the M6 note for LEAD).
 */
export function sourceFreshness(src: SourceFacts | null): SourceFreshness {
  const problems: string[] = []
  if (!src) problems.push('no source evidence attached')
  else {
    if (src.verification_status === 'stale') problems.push('source changed since capture (stale)')
    if (src.verification_status === 'failed') problems.push('source verification failed')
    if (src.reuse === 'disallowed') problems.push('source reuse is disallowed')
    if (src.robots_disallow === true) problems.push('robots/terms disallow reuse')
  }
  return { fresh: problems.length === 0, problems }
}

/** An explicit curator override needs `override: true` and a note of 10+ characters. */
export function curatorOverrideAllowed(override: boolean | undefined, note: string | undefined | null): boolean {
  return override === true && (note ?? '').trim().length >= 10
}

function inSnapshot(snapshot: string, needle: string): boolean {
  return compareForm(snapshot).includes(compareForm(needle))
}

export type RunChecksInput = {
  payload: unknown
  source: SourceFacts | null
  programs: ExistingProgram[]
  revisions?: ExistingRevision[]
  /** program the candidate is a revision of (catalog_candidates.program_match_id) */
  programMatchId?: string | null
  now?: Date
}

export function runChecks(input: RunChecksInput): CandidateChecks {
  const ran_at = (input.now ?? new Date()).toISOString()
  const fail = (detail: string): CheckResult => ({ pass: false, detail })
  const ok = (detail: string): CheckResult => ({ pass: true, detail })

  const validated = validateCandidatePayload(input.payload)
  const payload = validated.ok ? validated.value : null
  const src = input.source
  const snapshot = src?.snapshot_text ?? ''
  const source_trust: SourceTrust = !src ? 'none' : src.capture_method === 'url_fetch' ? 'server_captured' : 'client_supplied'
  const trustNote = source_trust === 'server_captured' ? 'server-captured snapshot' : 'client-supplied snapshot (lower trust)'

  // 1. source public & reusable
  let source_public_reusable: CheckResult
  if (!src) source_public_reusable = fail('no source evidence attached')
  else if (!checkPublicUrl(src.url).ok || (src.final_url && !checkPublicUrl(src.final_url).ok)) source_public_reusable = fail('source URL is not a public http(s) URL')
  else if (src.robots_disallow === true) source_public_reusable = fail('robots/terms disallow reuse')
  else if (src.reuse !== 'allowed') source_public_reusable = fail(`reuse is ${src.reuse}; a curator must affirm reuse is allowed`)
  else if (src.verification_status === 'failed') source_public_reusable = fail('source verification failed')
  else if (src.verification_status === 'stale') source_public_reusable = fail('source changed since capture (stale) — re-capture before verifying')
  else source_public_reusable = ok(source_trust === 'server_captured'
    ? 'public source fetched by AQUA; reuse signals allow'
    : 'public source; reuse affirmed (client-supplied evidence — lower trust)')

  // 2. no private data (payload re-validated; snapshot contact scan)
  let no_private_data: CheckResult
  const privateCodes = validated.ok ? [] : validated.errors.filter((e) => e.code.startsWith('private_data') || e.code.startsWith('secret'))
  const snapshotFindings = snapshot ? scanText(snapshot, { answerLike: false }) : []
  if (!validated.ok) no_private_data = fail(privateCodes.length ? `payload contains ${[...new Set(privateCodes.map((e) => e.code))].join(', ')}` : 'payload no longer validates')
  else if (snapshotFindings.length) no_private_data = fail(`snapshot contains ${snapshotFindings.map((f) => f.kind).join(', ')} — confirm it is published program contact info, not applicant data`)
  else no_private_data = ok('no private data or secrets detected')

  // 3. duplicate template
  const duplicates = payload ? findDuplicateTemplates(payload, input.programs, input.revisions) : []
  let duplicate_template: CheckResult
  const others = duplicates.filter((d) => d.program_id !== input.programMatchId)
  if (!payload) duplicate_template = fail('payload invalid')
  else if (input.programMatchId) {
    duplicate_template = others.length
      ? fail(`revision of the matched program, but also resembles ${others.map((d) => d.slug).join(', ')}`)
      : ok('revision of the matched canonical program')
  } else if (duplicates.length) duplicate_template = fail(`resembles existing template(s): ${duplicates.map((d) => `${d.slug} (${d.reasons.join('+')})`).join(', ')} — set program_match_id or reject`)
  else duplicate_template = ok('no existing template matches by apply URL, name or question set')

  // 4. exact wording preserved vs snapshot
  const missing_wording: number[] = []
  let exact_wording_preserved: CheckResult
  if (!payload || payload.questions.length === 0) exact_wording_preserved = fail('no questions extracted')
  else if (!snapshot) exact_wording_preserved = fail('no source snapshot to verify wording against')
  else {
    payload.questions.forEach((q, i) => { if (!inSnapshot(snapshot, q.asked_as)) missing_wording.push(i) })
    exact_wording_preserved = missing_wording.length
      ? fail(`${missing_wording.length} of ${payload.questions.length} question(s) not found verbatim in the ${trustNote}`)
      : ok(`all ${payload.questions.length} question(s) found verbatim in the ${trustNote}`)
  }

  // 5. cycle identified
  const cycle = payload?.cycle
  const cycle_identified = cycle?.name?.trim()
    ? ok(`cycle "${cycle.name}"`)
    : cycle?.is_rolling ? ok('rolling admissions') : fail('no cycle name and not marked rolling')

  // 6. deadline / requirements evidence
  let deadline_requirements_evidence: CheckResult
  const problems: string[] = []
  if (payload) {
    if (cycle?.closes_at) {
      if (!cycle.timezone) problems.push('deadline has no time zone')
      const quote = payload.evidence?.deadline_quote
      if (!quote) problems.push('deadline has no quoted evidence')
      else if (!snapshot || !inSnapshot(snapshot, quote)) problems.push('deadline quote not found in snapshot')
    } else if (!cycle?.is_rolling) problems.push('no deadline and not rolling')
    if (payload.eligibility || payload.requirements) {
      const quote = payload.evidence?.requirements_quote
      if (!quote) problems.push('requirements have no quoted evidence')
      else if (!snapshot || !inSnapshot(snapshot, quote)) problems.push('requirements quote not found in snapshot')
    }
    deadline_requirements_evidence = problems.length ? fail(problems.join('; ')) : ok('deadline/requirements evidenced by the snapshot')
  } else deadline_requirements_evidence = fail('payload invalid')

  const results = {
    source_public_reusable, no_private_data, duplicate_template,
    exact_wording_preserved, cycle_identified, deadline_requirements_evidence,
  }
  return {
    version: 1,
    ran_at,
    all_passed: CHECK_KEYS.every((k) => results[k].pass),
    source_trust,
    question_set_sha256: payload && payload.questions.length ? questionSetSha256(payload.questions) : '',
    results,
    duplicates,
    missing_wording,
  }
}
