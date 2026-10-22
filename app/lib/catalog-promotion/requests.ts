// Strict request-body validation for the curator transition route. Pure.

import { scanText, SECRET_KINDS } from './privacy.ts'
import { MAPPING_TIERS, LIMITS, type CandidatePayload, type ValidationError, type Validated } from './schema.ts'
import { CURATOR_TRANSITION_TARGETS, type CuratorTransitionTarget } from './transitions.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type MappingOverride = {
  index: number
  canonical_question_id: string | null // null = clear (novel)
  tier?: (typeof MAPPING_TIERS)[number]
  rationale?: string
}

export type TransitionRequest = {
  to: CuratorTransitionTarget
  note?: string
  override?: boolean
  program_match_id?: string | null
  source_review?: {
    reuse?: 'allowed' | 'unknown' | 'disallowed'
    robots_disallow?: boolean | null
    verification_status?: 'unverified' | 'verified' | 'stale' | 'failed'
  }
  mappings?: MappingOverride[]
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function validateTransitionRequest(input: unknown): Validated<TransitionRequest> {
  const errors: ValidationError[] = []
  if (!isObj(input)) return { ok: false, errors: [{ path: '', code: 'invalid_type' }] }
  for (const k of Object.keys(input)) if (!['to', 'note', 'override', 'program_match_id', 'source_review', 'mappings'].includes(k)) errors.push({ path: k, code: 'unknown_key' })

  const to = input.to
  if (typeof to !== 'string' || !(CURATOR_TRANSITION_TARGETS as readonly string[]).includes(to)) errors.push({ path: 'to', code: 'invalid_enum' })
  const out: TransitionRequest = { to: to as CuratorTransitionTarget }

  if (input.note !== undefined && input.note !== null) {
    if (typeof input.note !== 'string' || input.note.length > 4000) errors.push({ path: 'note', code: 'invalid' })
    else {
      const f = scanText(input.note, { answerLike: false })
      if (f.length) f.forEach((x) => errors.push({ path: 'note', code: `${SECRET_KINDS.has(x.kind) ? 'secret' : 'private_data'}:${x.kind}` }))
      else out.note = input.note.trim()
    }
  }
  if (out.to === 'rejected' && !(out.note && out.note.length >= 3)) errors.push({ path: 'note', code: 'required' })

  if (input.override !== undefined) {
    if (typeof input.override !== 'boolean') errors.push({ path: 'override', code: 'invalid_type' })
    else out.override = input.override
  }

  if (input.program_match_id !== undefined) {
    const v = input.program_match_id
    if (v !== null && (typeof v !== 'string' || !UUID_RE.test(v))) errors.push({ path: 'program_match_id', code: 'invalid_uuid' })
    else out.program_match_id = v === null ? null : (v as string).toLowerCase()
  }

  if (input.source_review !== undefined) {
    const s = input.source_review
    if (!isObj(s)) errors.push({ path: 'source_review', code: 'invalid_type' })
    else {
      const sr: NonNullable<TransitionRequest['source_review']> = {}
      for (const k of Object.keys(s)) if (!['reuse', 'robots_disallow', 'verification_status'].includes(k)) errors.push({ path: `source_review.${k}`, code: 'unknown_key' })
      if (s.reuse !== undefined) {
        if (!['allowed', 'unknown', 'disallowed'].includes(s.reuse as string)) errors.push({ path: 'source_review.reuse', code: 'invalid_enum' })
        else sr.reuse = s.reuse as 'allowed' | 'unknown' | 'disallowed'
      }
      if (s.robots_disallow !== undefined) {
        if (s.robots_disallow !== null && typeof s.robots_disallow !== 'boolean') errors.push({ path: 'source_review.robots_disallow', code: 'invalid_type' })
        else sr.robots_disallow = s.robots_disallow as boolean | null
      }
      if (s.verification_status !== undefined) {
        if (!['unverified', 'verified', 'stale', 'failed'].includes(s.verification_status as string)) errors.push({ path: 'source_review.verification_status', code: 'invalid_enum' })
        else sr.verification_status = s.verification_status as 'unverified' | 'verified' | 'stale' | 'failed'
      }
      out.source_review = sr
    }
  }

  if (input.mappings !== undefined) {
    const m = input.mappings
    if (!Array.isArray(m) || m.length > LIMITS.questions) errors.push({ path: 'mappings', code: 'invalid' })
    else {
      out.mappings = []
      m.forEach((x, i) => {
        const p = `mappings[${i}]`
        if (!isObj(x)) { errors.push({ path: p, code: 'invalid_type' }); return }
        for (const k of Object.keys(x)) if (!['index', 'canonical_question_id', 'tier', 'rationale'].includes(k)) errors.push({ path: `${p}.${k}`, code: 'unknown_key' })
        if (typeof x.index !== 'number' || !Number.isInteger(x.index) || x.index < 0) { errors.push({ path: `${p}.index`, code: 'invalid_number' }); return }
        const cq = x.canonical_question_id
        if (cq !== null && (typeof cq !== 'string' || !UUID_RE.test(cq))) { errors.push({ path: `${p}.canonical_question_id`, code: 'invalid_uuid' }); return }
        const o: MappingOverride = { index: x.index, canonical_question_id: cq === null ? null : (cq as string).toLowerCase() }
        if (x.tier !== undefined) {
          if (!(MAPPING_TIERS as readonly string[]).includes(x.tier as string)) { errors.push({ path: `${p}.tier`, code: 'invalid_enum' }); return }
          o.tier = x.tier as MappingOverride['tier']
        }
        if (x.rationale !== undefined) {
          if (typeof x.rationale !== 'string' || x.rationale.length > LIMITS.rationale) { errors.push({ path: `${p}.rationale`, code: 'invalid' }); return }
          o.rationale = x.rationale
        }
        out.mappings!.push(o)
      })
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: out }
}

/** Applies curator mapping overrides to a payload (index-addressed). */
export function applyMappingOverrides(payload: CandidatePayload, overrides: MappingOverride[]): { ok: true; payload: CandidatePayload } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = []
  const questions = payload.questions.map((q) => ({ ...q }))
  for (const o of overrides) {
    const q = questions[o.index]
    if (!q) { errors.push({ path: `mappings[${o.index}]`, code: 'no_such_question' }); continue }
    if (o.canonical_question_id === null) {
      delete q.mapping
    } else {
      const tier = o.tier && o.tier !== 'novel' ? o.tier : 'curator'
      q.mapping = { canonical_question_id: o.canonical_question_id, tier, ...(o.rationale ? { rationale: o.rationale } : {}) }
    }
  }
  const seen = new Set<string>()
  questions.forEach((q, i) => {
    const id = q.mapping?.canonical_question_id
    if (!id) return
    if (seen.has(id)) errors.push({ path: `questions[${i}].mapping.canonical_question_id`, code: 'duplicate' })
    seen.add(id)
  })
  return errors.length ? { ok: false, errors } : { ok: true, payload: { ...payload, questions } }
}
