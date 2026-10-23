// Request handlers for /api/catalog/candidates* (M09 W3).
//
// Dependency-injected (auth, service-role client, rate limiter, guarded
// fetch) so they run under `node --test` with fakes; the Next.js route files
// only wire the real dependencies (see deps.ts). Relative imports only.
//
// Write path: every review step is ONE database call
// (catalog_transition_candidate) and publish is ONE call
// (catalog_publish_candidate) — the database re-checks curator membership,
// the allowed transition and the verified/published rules in the same
// transaction. Request bodies are never logged.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PublicApplicationSnapshot } from '../catalog/fetch-public.ts'
import { demoteToSuggestedMappings, validateCandidatePayload, validateSourceInput, type CandidatePayload, type ValidationError } from './schema.ts'
import { canTransition, isCandidateState, verifiedAllowed } from './transitions.ts'
import { applyMappingOverrides, validateTransitionRequest } from './requests.ts'
import { applyMatches, CHECK_KEYS, curatorOverrideAllowed, matchQuestions, sourceFreshness, type SourceFacts } from './checks.ts'
import { checksFor, loadCanonicalQuestionIndex, loadReviewContext, type CandidateRow } from './review.ts'
import { captureFromFetch, recheckOutcome } from './capture.ts'
import { isCatalogSchemaMissing } from './errors.ts'
import { CANDIDATE_COLUMNS, SOURCE_COLUMNS, dbError, isCatalogCurator, json, readJsonBody, unavailable } from './http.ts'

export type CatalogUser = { id: string }
export type RateAction = 'catalog_candidate_submit' | 'catalog_candidate_list' | 'catalog_curator_action'

export type HandlerDeps = {
  getUser: (req: Request) => Promise<{ user: CatalogUser | null; userClient: SupabaseClient }>
  admin: () => SupabaseClient | null
  rateLimit: (userId: string, action: RateAction) => boolean
  /** SSRF-guarded public fetch (W2 fetchPublicApplication) */
  fetchSource: (url: string) => Promise<PublicApplicationSnapshot>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_SUBMIT_BODY = 512 * 1024
const fetchErrorCode = (e: unknown) =>
  (e && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string') ? (e as { code: string }).code : 'network_error'

type Ctx = { user: CatalogUser; userClient: SupabaseClient; admin: SupabaseClient; curator: boolean }

async function context(req: Request, deps: HandlerDeps, action: RateAction): Promise<Ctx | Response> {
  const { user, userClient } = await deps.getUser(req)
  if (!user) return json({ error: 'unauthorized' }, 401)
  if (!deps.rateLimit(user.id, action)) return json({ error: 'rate_limited' }, 429)
  const admin = deps.admin()
  if (!admin) return unavailable()
  const curator = await isCatalogCurator(admin, user.id)
  if (curator === 'unavailable') return unavailable()
  return { user, userClient, admin, curator }
}

async function curatorContext(req: Request, deps: HandlerDeps, id: string): Promise<Ctx | Response> {
  const c = await context(req, deps, 'catalog_curator_action')
  if (c instanceof Response) return c
  if (!c.curator) return json({ error: 'forbidden' }, 403)
  if (!UUID_RE.test(id)) return json({ error: 'not_found' }, 404)
  return c
}

// ------------------------------------------------------------------
// POST /api/catalog/candidates
// ------------------------------------------------------------------
export async function handleSubmit(req: Request, deps: HandlerDeps): Promise<Response> {
  const c = await context(req, deps, 'catalog_candidate_submit')
  if (c instanceof Response) return c

  const parsed = await readJsonBody(req, MAX_SUBMIT_BODY)
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status)
  const body = parsed.body as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'invalid_candidate', errors: [{ path: '', code: 'invalid_type' }] }, 400)

  const errors: ValidationError[] = []
  for (const k of Object.keys(body)) if (k !== 'payload' && k !== 'source') errors.push({ path: k, code: 'unknown_key' })
  const payload = validateCandidatePayload(body.payload)
  if (!payload.ok) errors.push(...payload.errors.map((e) => ({ path: e.path ? `payload.${e.path}` : 'payload', code: e.code })))
  const source = validateSourceInput(body.source, { curator: c.curator })
  if (!source.ok) errors.push(...source.errors)
  if (errors.length || !payload.ok || !source.ok) return json({ error: 'invalid_candidate', errors }, 400)

  // Source evidence: server-captured for url_fetch, client-supplied otherwise.
  let row: Record<string, unknown>
  if (source.value.capture_method === 'url_fetch') {
    let snap: PublicApplicationSnapshot
    try {
      snap = await deps.fetchSource(source.value.url)
    } catch (e) {
      const code = fetchErrorCode(e)
      // M1: per-instance outbound concurrency cap reached — transient, retryable.
      if (code === 'busy') return json({ error: 'source_fetch_busy', code }, 503)
      return json({ error: 'source_fetch_failed', code }, 422)
    }
    const captured = captureFromFetch(source.value.url, snap)
    if (!captured.ok) return json({ error: captured.error, ...(captured.detail ?? {}) }, captured.status)
    row = { ...captured.source }
  } else {
    row = {
      url: source.value.url,
      final_url: source.value.final_url ?? null,
      capture_method: source.value.capture_method,
      snapshot_text: source.value.snapshot_text ?? null,
    }
  }

  // M09 hardening L8: source evidence + candidate are inserted in ONE
  // database transaction (catalog_submit_candidate, service_role only), so a
  // failed candidate insert can never leave an orphan source row. The auto
  // 'extracted' step (questions present) runs inside the same call.
  // M09 review M5: a submitter's question mappings are suggestions only —
  // stored as `suggested_mapping` (submitter_suggested), never as the
  // `mapping` the publish step turns into a canonical link.
  const stored = demoteToSuggestedMappings(payload.value).payload
  const { data: submitted, error: submitErr } = await c.admin.rpc('catalog_submit_candidate', {
    p_submitted_by: c.user.id,
    p_source: row,
    p_payload: stored,
    p_auto_extract: stored.questions.length > 0,
  })
  if (submitErr || !submitted) return dbError(submitErr)
  const created = submitted as { id: string; state: string; submitted_at: string; source_id: string }
  const state = created.state
  return json({
    candidate: { id: created.id, state, submitted_at: created.submitted_at, source_id: created.source_id },
    source: { capture_method: row.capture_method, trust: row.capture_method === 'url_fetch' ? 'server_captured' : 'client_supplied', reuse: row.reuse ?? 'unknown' },
  }, 201)
}

// ------------------------------------------------------------------
// GET /api/catalog/candidates
// ------------------------------------------------------------------
export async function handleList(req: Request, deps: HandlerDeps): Promise<Response> {
  const c = await context(req, deps, 'catalog_candidate_list')
  if (c instanceof Response) return c
  const url = new URL(req.url)
  const state = url.searchParams.get('state')
  if (state !== null && !isCandidateState(state)) return json({ error: 'invalid_state' }, 400)
  const limitRaw = Number(url.searchParams.get('limit') ?? '50')
  const limit = Number.isInteger(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 50

  // Non-curators read through their own RLS-scoped client (own rows only).
  const client = c.curator ? c.admin : c.userClient
  let query = client
    .from('catalog_candidates')
    .select(`${CANDIDATE_COLUMNS}, source:catalog_sources(${SOURCE_COLUMNS})`)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (!c.curator) query = query.eq('submitted_by', c.user.id)
  if (state) query = query.eq('state', state)
  const { data, error } = await query
  if (error) return isCatalogSchemaMissing(error) ? unavailable() : dbError(error)
  return json({ is_curator: c.curator, candidates: data ?? [] })
}

// ------------------------------------------------------------------
// POST /api/catalog/candidates/[id]/transition
// ------------------------------------------------------------------
export async function handleTransition(req: Request, deps: HandlerDeps, id: string): Promise<Response> {
  const c = await curatorContext(req, deps, id)
  if (c instanceof Response) return c

  const parsed = await readJsonBody(req, 64 * 1024)
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status)
  const reqBody = validateTransitionRequest(parsed.body)
  if (!reqBody.ok) return json({ error: 'invalid_request', errors: reqBody.errors }, 400)
  const r = reqBody.value

  const { data: row, error: loadErr } = await c.admin.from('catalog_candidates').select(CANDIDATE_COLUMNS).eq('id', id).maybeSingle()
  if (loadErr) return dbError(loadErr)
  if (!row) return json({ error: 'not_found' }, 404)
  const candidate = row as unknown as CandidateRow
  if (!isCandidateState(candidate.state) || !canTransition(candidate.state, r.to)) {
    return json({ error: 'illegal_transition', from: candidate.state, to: r.to }, 409)
  }
  const editable = ['candidate', 'extracted', 'matched'].includes(candidate.state)
  if (r.program_match_id !== undefined && r.program_match_id !== candidate.program_match_id && !editable) return json({ error: 'program_match_frozen' }, 409)

  // Final payload as the database will compute it: auto matches (patch) then curator overrides (mappings).
  const current = validateCandidatePayload(candidate.payload)
  if (!current.ok) return json({ error: 'stored_payload_invalid', errors: current.errors }, 422)
  let patched: CandidatePayload = current.value
  let autoMatched = 0
  let demoted = 0
  if (r.to === 'matched') {
    const index = await loadCanonicalQuestionIndex(c.admin)
    if (index.error) return dbError(index.error)
    // M5: `matched` is the first step a curator can act on, so any mapping
    // already stored came from the submitter (or a pre-fix row): demote it
    // to a suggestion before matching, so it can neither become a canonical
    // link nor block AQUA's own match.
    const d = demoteToSuggestedMappings(patched)
    patched = d.payload
    demoted = d.demoted.length
    const before = patched.questions.filter((q) => q.mapping).length
    patched = applyMatches(patched, matchQuestions(patched.questions, index.data))
    autoMatched = patched.questions.filter((q) => q.mapping).length - before
  }
  const patchQuestions = autoMatched > 0 || demoted > 0
  let finalPayload = patched
  if (r.mappings?.length) {
    const applied = applyMappingOverrides(patched, r.mappings)
    if (!applied.ok) return json({ error: 'invalid_request', errors: applied.errors }, 400)
    finalPayload = applied.payload
  }
  if ((patchQuestions || r.mappings?.length) && !editable) return json({ error: 'payload_frozen' }, 409)
  const revalidated = validateCandidatePayload(finalPayload)
  if (!revalidated.ok) return json({ error: 'invalid_request', errors: revalidated.errors }, 400)

  // Checks on the final payload and the source as reviewed in this call.
  const ctx = await loadReviewContext(c.admin, candidate)
  if (ctx.error) return dbError(ctx.error)
  if (ctx.source && r.source_review) {
    // A curator re-opening a source the evidence had closed (reuse
    // disallowed → not, robots disallow → not, stale/failed → other) must
    // say why.
    const before = ctx.source
    const after = { ...before, ...r.source_review } as typeof ctx.source
    const reopened =
      (before.reuse === 'disallowed' && after!.reuse !== 'disallowed') ||
      (before.robots_disallow === true && after!.robots_disallow !== true) ||
      ((before.verification_status === 'stale' || before.verification_status === 'failed') &&
        after!.verification_status !== before.verification_status)
    if (reopened && (r.note ?? '').trim().length < 10) {
      return json({ error: 'note_required', reason: 'source_review re-opens a source the evidence closed; add a note (10+ characters)' }, 422)
    }
    ctx.source = after
  }
  const programMatchId = r.program_match_id !== undefined ? r.program_match_id : candidate.program_match_id
  const checks = checksFor({ payload: revalidated.value, program_match_id: programMatchId }, ctx)
  const failing = CHECK_KEYS.filter((k) => !checks.results[k].pass)
  if (r.to === 'verified' && !verifiedAllowed(checks.all_passed, r.override === true, r.note)) {
    return json({ error: 'checks_failed', failing, checks }, 422)
  }
  // M6: approving needs evidence that is still good (not stale/failed, reuse
  // not disallowed, robots not disallowing) unless the curator overrides
  // explicitly with a note; the override is recorded in the event evidence.
  const freshness = sourceFreshness(ctx.source)
  const sourceOverride = r.to === 'approved' && !freshness.fresh
  if (sourceOverride && !curatorOverrideAllowed(r.override, r.note)) {
    return json({ error: 'source_not_fresh', problems: freshness.problems }, 422)
  }

  const { data, error } = await c.admin.rpc('catalog_transition_candidate', {
    candidate_id: id,
    to_state: r.to,
    actor_id: c.user.id,
    actor_role: 'curator',
    note: r.note ?? null,
    checks,
    payload_patch: patchQuestions ? { questions: patched.questions } : null,
    mappings: r.mappings?.length ? r.mappings : null,
    program_match_id: r.program_match_id ?? null,
    clear_program_match: r.program_match_id === null && candidate.program_match_id !== null,
    source_review: r.source_review && Object.keys(r.source_review).length ? r.source_review : null,
    evidence: {
      checks_all_passed: checks.all_passed,
      failing_checks: failing,
      source_trust: checks.source_trust,
      question_set_sha256: checks.question_set_sha256,
      ...(r.override ? { override: true } : {}),
      ...(r.to === 'matched' ? { auto_matched: autoMatched, suggestions_demoted: demoted } : {}),
      ...(sourceOverride ? { source_override: true, source_problems: freshness.problems } : {}),
      ...(r.source_review ? { source_review: r.source_review } : {}),
    },
  })
  if (error) return dbError(error)
  const result = (data ?? {}) as { self_approved?: boolean }
  return json({ candidate: { id, state: r.to }, self_approved: result.self_approved === true, checks })
}

// ------------------------------------------------------------------
// POST /api/catalog/candidates/[id]/publish
// ------------------------------------------------------------------
export async function handlePublish(req: Request, deps: HandlerDeps, id: string): Promise<Response> {
  const c = await curatorContext(req, deps, id)
  if (c instanceof Response) return c

  // M6: refuse to mint a canonical template from evidence that went stale,
  // failed or became non-reusable. The only override is the one a curator
  // recorded (with a note) when approving, and only if the source has not
  // been re-checked since — 058's publish RPC takes no note, so a fresh
  // override cannot be recorded here.
  const { data: candRow, error: candErr } = await c.admin.from('catalog_candidates').select('id, state, source_id').eq('id', id).maybeSingle()
  if (candErr) return dbError(candErr)
  if (!candRow) return json({ error: 'not_found' }, 404)
  const sourceId = (candRow as { source_id: string | null }).source_id
  let src: SourceFacts | null = null
  if (sourceId) {
    const { data: srcRow, error: srcErr } = await c.admin.from('catalog_sources')
      .select('id, url, capture_method, reuse, robots_disallow, verification_status, last_checked_at').eq('id', sourceId).maybeSingle()
    if (srcErr) return dbError(srcErr)
    src = (srcRow as SourceFacts | null) ?? null
  }
  const freshness = sourceFreshness(src)
  // M6: an optional curator override note (10+ characters) travels to the RPC, which records it on the publish event.
  let overrideNote: string | null = null
  try {
    const body = (await req.clone().json()) as { note?: unknown }
    if (typeof body?.note === 'string' && body.note.trim().length >= 10) overrideNote = body.note.trim().slice(0, 4000)
  } catch { /* no body */ }
  if (!freshness.fresh && !overrideNote) {
    const { data: ev, error: evErr } = await c.admin.from('catalog_candidate_events')
      .select('to_state, note, evidence, at').eq('candidate_id', id).eq('to_state', 'approved')
      .order('at', { ascending: false }).limit(1).maybeSingle()
    if (evErr) return dbError(evErr)
    const approval = ev as { note: string | null; evidence: Record<string, unknown> | null; at: string } | null
    const overridden = !!approval && approval.evidence?.source_override === true && curatorOverrideAllowed(true, approval.note)
    const unchangedSince = !!approval && (!src?.last_checked_at || Date.parse(src.last_checked_at) <= Date.parse(approval.at))
    if (!src || !overridden || !unchangedSince) {
      return json({ error: 'source_not_fresh', problems: freshness.problems, ...(overridden && !unchangedSince ? { reason: 'source re-checked after the approval override' } : {}) }, 409)
    }
  }

  const { data, error } = await c.admin.rpc('catalog_publish_candidate', { candidate_id: id, curator_id: c.user.id, ...(overrideNote ? { note: overrideNote } : {}) })
  if (error) return dbError(error)
  return json({ published: data })
}

// ------------------------------------------------------------------
// POST /api/catalog/candidates/[id]/recheck-source
// ------------------------------------------------------------------
export async function handleRecheckSource(req: Request, deps: HandlerDeps, id: string, now: () => Date = () => new Date()): Promise<Response> {
  const c = await curatorContext(req, deps, id)
  if (c instanceof Response) return c
  const { data: row, error } = await c.admin.from('catalog_candidates').select('id, source_id').eq('id', id).maybeSingle()
  if (error) return dbError(error)
  if (!row) return json({ error: 'not_found' }, 404)
  const sourceId = (row as { source_id: string | null }).source_id
  if (!sourceId) return json({ error: 'no_source' }, 409)
  const { data: srcRow, error: srcErr } = await c.admin.from('catalog_sources')
    .select('id, url, capture_method, content_sha256, verification_status').eq('id', sourceId).maybeSingle()
  if (srcErr) return dbError(srcErr)
  if (!srcRow) return json({ error: 'no_source' }, 409)
  const src = srcRow as { id: string; url: string; capture_method: string; content_sha256: string | null; verification_status: string }
  if (src.capture_method !== 'url_fetch') return json({ error: 'recheck_requires_url_fetch' }, 409)

  let outcome
  try {
    outcome = recheckOutcome(src, { ok: true, snap: await deps.fetchSource(src.url) }, now())
  } catch (e) {
    const code = fetchErrorCode(e)
    // M1: a local concurrency refusal says nothing about the source — never record it as a failed check.
    if (code === 'busy') return json({ error: 'source_fetch_busy', code }, 503)
    outcome = recheckOutcome(src, { ok: false, code }, now())
  }
  const update: Record<string, unknown> = {
    verification_status: outcome.verification_status,
    last_check: outcome.last_check,
    last_checked_at: (outcome.last_check.at as string),
  }
  if (outcome.reuse) update.reuse = outcome.reuse
  if (outcome.robots_disallow) update.robots_disallow = true
  const { error: upErr } = await c.admin.from('catalog_sources').update(update).eq('id', src.id)
  if (upErr) return dbError(upErr)
  return json({ source: { id: src.id, verification_status: outcome.verification_status, ...(outcome.reuse ? { reuse: outcome.reuse } : {}) }, last_check: outcome.last_check })
}
