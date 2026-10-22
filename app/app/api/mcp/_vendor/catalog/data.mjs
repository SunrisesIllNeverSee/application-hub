// VENDORED from application-hub-mcp-server/src/catalog/data.mjs. Do not edit: change the source and run
// `npm run vendor:hosted` in application-hub-mcp-server/ (CI checks these copies).
// The public catalog as the tools see it: approved programs only.
// "Approved" is the app's own rule (app/lib/canonical-catalog.ts,
// approvedProgramsFilter): slug in the approval registry OR source =
// canonical (curated publishes, migration 058). Every read starts from that
// program set, and every dependent read (cycles, questions, canonical
// questions, DNA, stats, reports) is filtered to those program ids. That
// holds even where row-level security would allow more (for example before
// migration 052 is applied), so a tool can never surface a synthetic or
// unapproved row.

import { CatalogError, inList } from './rest.mjs'

const BASE_PROGRAM_COLS = 'id,slug,name,organization,description,url,apply_url,deadline_at,closes_at,opens_at,is_rolling,status,source,type,round,cohort_name,updated_at'
const MIN_PROGRAM_COLS = 'id,slug,name,organization,description,url,apply_url,deadline_at,closes_at,opens_at,is_rolling,status,source'
const SCORE_COLS = 'id,heat_score,program_value_score,equity_pct,cash_value_usd,credit_value_usd,network_score,brand_score,follow_on_rate_pct'
const MIN_SCORE_COLS = 'id,heat_score,program_value_score,equity_pct,cash_value_usd'
const CYCLE_COLS = 'id,program_id,cycle_name,opens_at,closes_at,cohort_name,apply_url,is_active'
const OCCURRENCE_COLS = 'id,program_id,archived_question_id,asked_as,word_limit,char_limit,is_required,order_index,section'
const MIN_OCCURRENCE_COLS = 'id,program_id,archived_question_id,asked_as,word_limit,char_limit,is_required,order_index'
// Only per-question fields. Stored aggregates (significance_score,
// asked_by_count, is_universal, avg_word_limit) may be computed over
// unapproved programs, so the tools derive those from approved rows instead.
const CANON_COLS = 'id,text,theme'
const DNA_COLS = 'program_id,theme,question_count,word_limit_sum,weight_pct'
const STATS_COLS = 'program_id,acceptance_rate,application_count,updated_at'
const REPORT_COLS = 'program_id,cohort_round,outcome'

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
export const isId = (v) => typeof v === 'string' && ID.test(v)

export class CatalogData {
  /**
   * client: CatalogClient. allowSlugs: the approval registry
   * (CANONICAL_PROGRAM_SLUGS). ttlMs: how long fetched sets are reused.
   * @param {import('./rest.mjs').CatalogClient} client
   * @param {{ allowSlugs: readonly string[], ttlMs?: number, failureTtlMs?: number, now?: () => number }} opts
   */
  constructor(client, { allowSlugs, ttlMs = 5 * 60 * 1000, failureTtlMs = 30 * 1000, now = () => Date.now() }) {
    if (!Array.isArray(allowSlugs)) throw new Error('CatalogData needs the canonical slug registry')
    this.client = client
    this.allowSlugs = allowSlugs.filter(isId)
    this.ttlMs = ttlMs
    this.failureTtlMs = failureTtlMs
    this.now = now
    this.cache = new Map()
  }

  get evidence() {
    return this.client.evidence
  }

  /**
   * Cached and coalesced: concurrent callers share one in-flight fetch, and a
   * failure is remembered for failureTtlMs so a failing catalog is not
   * re-queried by every request.
   */
  memo(key, fn) {
    const hit = this.cache.get(key)
    if (hit && this.now() - hit.at < (hit.failed ? this.failureTtlMs : this.ttlMs)) return hit.promise
    const entry = { at: this.now(), failed: false, promise: null }
    entry.promise = Promise.resolve().then(fn).catch((e) => {
      entry.failed = true
      entry.at = this.now()
      throw e
    })
    this.cache.set(key, entry)
    return entry.promise
  }

  /** PostgREST or-filter, same as approvedProgramsFilter(): registry slug OR source = canonical. */
  approvedFilter() {
    const safe = this.allowSlugs.filter((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s))
    return `(${[...(safe.length ? [`slug.${inList(safe)}`] : []), 'source.eq.canonical'].join(',')})`
  }

  /** Approved programs, sorted by slug. */
  programs() {
    return this.memo('programs', async () => {
      const { rows } = await this.client.getWithFallback('programs', [BASE_PROGRAM_COLS, MIN_PROGRAM_COLS], { or: this.approvedFilter(), order: 'slug.asc' })
      const allow = new Set(this.allowSlugs)
      return rows.filter((p) => p && isId(p.id) && isId(p.slug) && (allow.has(p.slug) || p.source === 'canonical') && typeof p.name === 'string')
    })
  }

  async programIds() {
    return (await this.programs()).map((p) => p.id)
  }

  /** One canonical program by id or slug, or null. */
  async findProgram(idOrSlug) {
    if (!isId(idOrSlug)) return null
    return (await this.programs()).find((p) => p.id === idOrSlug || p.slug === idOrSlug) ?? null
  }

  /** Map program_id -> score columns. Throws CatalogError(schema|not_public) if unavailable. */
  scores() {
    return this.memo('scores', async () => {
      const ids = await this.programIds()
      if (!ids.length) return new Map()
      const { rows } = await this.client.getWithFallback('programs', [SCORE_COLS, MIN_SCORE_COLS], { id: inList(ids) })
      return new Map(rows.filter((r) => ids.includes(r.id)).map((r) => [r.id, r]))
    })
  }

  cycles() {
    return this.memo('cycles', async () => {
      const ids = await this.programIds()
      if (!ids.length) return []
      const rows = await this.client.get('program_cycles', { select: CYCLE_COLS, program_id: inList(ids), order: 'program_id.asc' })
      return rows.filter((c) => ids.includes(c.program_id))
    })
  }

  /** Question occurrences (exact wording per program), ordered. */
  occurrences() {
    return this.memo('occurrences', async () => {
      const ids = await this.programIds()
      if (!ids.length) return []
      const { rows } = await this.client.getWithFallback('program_questions', [OCCURRENCE_COLS, MIN_OCCURRENCE_COLS], {
        program_id: inList(ids), order: 'program_id.asc,order_index.asc',
      })
      return rows.filter((q) => ids.includes(q.program_id) && typeof q.asked_as === 'string')
    })
  }

  /** Canonical questions referenced by canonical programs' occurrences. */
  canonicalQuestions() {
    return this.memo('canonical', async () => {
      const occ = await this.occurrences()
      const ref = [...new Set(occ.map((q) => q.archived_question_id).filter(isId))]
      const out = []
      for (let i = 0; i < ref.length; i += 150) {
        const { rows } = await this.client.getWithFallback('archived_questions', [CANON_COLS], { id: inList(ref.slice(i, i + 150)) })
        out.push(...rows)
      }
      const allowed = new Set(ref)
      return out.filter((c) => allowed.has(c.id) && typeof c.text === 'string')
    })
  }

  async dna(programId) {
    const rows = await this.client.get('program_dna', { select: DNA_COLS, program_id: `eq.${programId}`, order: 'weight_pct.desc' })
    return rows.filter((r) => r.program_id === programId)
  }

  async stats(programId) {
    const rows = await this.client.get('program_stats', { select: STATS_COLS, program_id: `eq.${programId}` })
    return rows.find((r) => r.program_id === programId) ?? null
  }

  /** Verified acceptance reports only (cohort + outcome; no reporter, no free text). */
  async reports(programId) {
    const rows = await this.client.get('acceptance_reports', { select: REPORT_COLS, program_id: `eq.${programId}`, verified: 'eq.true' })
    return rows.filter((r) => r.program_id === programId)
  }
}

export { CatalogError }
