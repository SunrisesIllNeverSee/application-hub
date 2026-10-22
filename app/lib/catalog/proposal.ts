// M09 W2 — read-only extraction proposal assembly. PURE module.
//
// Combines a fetched/extracted application with catalog rows the caller
// already read (approved programs, their cycles, candidate canonical
// questions) into a proposal. It decides nothing and writes nothing: every
// link is a suggestion with tier/confidence/needs_review, and the public
// candidate is only a Candidate for human curation.

import { foldText, tokenSimilarity, contentTokens } from './normalize.ts'
import { matchBatch, type CatalogQuestion, type MatchOptions, type MatchResult } from './match.ts'
import type { ExtractionResult } from './extract.ts'
import { classifyExtraction, buildPublicCandidate, PublicCandidateLeakError, type Classification, type PublicCandidate, type SourceContext, type Visibility } from './classify.ts'

export interface ProgramRow {
  id: string
  slug: string
  name: string
  organization?: string | null
  apply_url?: string | null
  scrape_url?: string | null
}
export interface CycleRow { program_id: string; cycle_name: string; apply_url?: string | null; closes_at?: string | null }

export type ProgramMatchBasis = 'apply_url' | 'cycle_apply_url' | 'host' | 'name'
export interface ProgramMatch {
  program_id: string
  slug: string
  name: string
  basis: ProgramMatchBasis
  confidence: number
  cycle?: { cycle_name: string; closes_at?: string | null }
}

// Hosts shared by many unrelated programs — a host match there proves nothing.
const SHARED_HOSTS = /(?:^|\.)(?:google\.com|forms\.gle|typeform\.com|airtable\.com|jotform\.com|tally\.so|notion\.site|notion\.so|fillout\.com|paperform\.co|smapply\.io|submittable\.com|f6s\.com|wufoo\.com|formstack\.com|hubspot\.com|medium\.com|substack\.com|github\.io|webflow\.io|wixsite\.com|squarespace\.com|linkedin\.com|x\.com|twitter\.com)$/i

function urlKey(raw?: string | null): { host: string; path: string } | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    return { host: u.hostname.toLowerCase().replace(/^www\./, ''), path: u.pathname.replace(/\/+$/, '') || '/' }
  } catch { return null }
}

/** Match fetched program identity to existing approved programs (read-only). */
export function matchProgram(
  hints: { final_url?: string; title?: string; organization?: string; apply_urls?: string[] },
  programs: ProgramRow[],
  cycles: CycleRow[] = [],
): { best: ProgramMatch | null; candidates: ProgramMatch[]; needs_review: boolean } {
  const urls = [hints.final_url, ...(hints.apply_urls ?? [])].map(urlKey).filter(Boolean) as Array<{ host: string; path: string }>
  const sameUrl = (raw?: string | null) => { const k = urlKey(raw); return !!k && urls.some((u) => u.host === k.host && u.path === k.path) }
  const sameHost = (raw?: string | null) => { const k = urlKey(raw); return !!k && !SHARED_HOSTS.test(k.host) && urls.some((u) => u.host === k.host) }
  const out: ProgramMatch[] = []
  for (const p of programs) {
    const base = { program_id: p.id, slug: p.slug, name: p.name }
    const cyc = cycles.filter((c) => c.program_id === p.id)
    const cycleHit = cyc.find((c) => sameUrl(c.apply_url))
    if (sameUrl(p.apply_url) || sameUrl(p.scrape_url)) { out.push({ ...base, basis: 'apply_url', confidence: 0.95 }); continue }
    if (cycleHit) { out.push({ ...base, basis: 'cycle_apply_url', confidence: 0.95, cycle: { cycle_name: cycleHit.cycle_name, closes_at: cycleHit.closes_at ?? null } }); continue }
    if (sameHost(p.apply_url) || sameHost(p.scrape_url) || cyc.some((c) => sameHost(c.apply_url))) { out.push({ ...base, basis: 'host', confidence: 0.6 }); continue }
    const names = [hints.title, hints.organization].filter(Boolean) as string[]
    let best = 0
    for (const n of names) for (const pn of [p.name, p.organization].filter(Boolean) as string[]) {
      const s = foldText(n) === foldText(pn) ? 1 : tokenSimilarity(n, pn)
      if (s > best) best = s
    }
    if (best >= 0.8) out.push({ ...base, basis: 'name', confidence: Math.round(best * 0.6 * 1000) / 1000 })
  }
  out.sort((a, b) => b.confidence - a.confidence)
  const best = out[0] ?? null
  const tie = out.length > 1 && out[1].confidence === best?.confidence
  return { best, candidates: out.slice(0, 5), needs_review: !best || best.confidence < 0.9 || tie }
}

/** Distinctive content tokens for a bounded catalog text search (safe for PostgREST filters: [a-z0-9] only). */
export function searchTermsFor(extraction: ExtractionResult, max = 12): string[] {
  const freq = new Map<string, number>()
  for (const o of extraction.occurrences) {
    for (const t of new Set(contentTokens(o.asked_as))) {
      if (t.length < 5 || !/^[a-z0-9]+$/.test(t)) continue
      freq.set(t, (freq.get(t) ?? 0) + 1)
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, max).map(([t]) => t)
}

export interface ProposalQuestion {
  order_index: number
  /** null when the wording itself is private (e.g. contains PII) */
  asked_as: string | null
  redacted?: true
  section: string | null
  requirements: Record<string, unknown>
  field_kind: string
  visibility: Visibility
  visibility_reasons: string[]
  /** answer-like text or a filled value sat next to this question (kept private, not returned) */
  has_private_context: boolean
  match: MatchResult & { duplicate_of?: number }
}

export interface ExtractionProposal {
  proposal: true
  writes: 'none'
  program_match: ProgramMatch | null
  program_candidates: ProgramMatch[]
  program_needs_review: boolean
  questions: ProposalQuestion[]
  duplicates: Array<{ indices: number[]; tier: string }>
  public_candidate: PublicCandidate | null
  public_candidate_refused: string[] | null
  uncertain: Array<{ kind: string; occurrence_index?: number; value: string; reasons: string[] }>
  private_summary: { count: number; kinds: Record<string, number> }
  warnings: string[]
}

export function buildExtractionProposal(input: {
  extraction: ExtractionResult
  source: SourceContext
  programs?: ProgramRow[]
  cycles?: CycleRow[]
  catalog?: CatalogQuestion[]
  matchOptions?: MatchOptions
}): ExtractionProposal & { classification: Classification } {
  const { extraction, source } = input
  const classification = classifyExtraction(extraction, source)
  let public_candidate: PublicCandidate | null = null
  let public_candidate_refused: string[] | null = null
  try { public_candidate = buildPublicCandidate(classification) } catch (err) {
    if (err instanceof PublicCandidateLeakError) public_candidate_refused = err.reasons
    else throw err
  }

  const pm = matchProgram({ final_url: source.final_url, title: extraction.program.title, organization: extraction.program.organization, apply_urls: extraction.program.apply_urls }, input.programs ?? [], input.cycles ?? [])
  const batch = matchBatch(extraction.occurrences.map((o) => ({ asked_as: o.asked_as, requirements: o.requirements })), input.catalog ?? [], input.matchOptions)

  const questions: ProposalQuestion[] = extraction.occurrences.map((o, i) => {
    const item = classification.items.find((x) => x.kind === 'question' && x.occurrence_index === i)
    const visibility: Visibility = item?.visibility ?? 'uncertain'
    const priv = visibility === 'private'
    const r = o.requirements
    const limitsOnly = { word_limit: r.word_limit, char_limit: r.char_limit, sentence_limit: r.sentence_limit, required: r.required }
    return {
      order_index: o.order_index,
      asked_as: priv ? null : o.asked_as,
      ...(priv ? { redacted: true as const } : {}),
      section: priv ? null : o.section,
      requirements: priv ? limitsOnly : { ...limitsOnly, word_min: r.word_min, char_min: r.char_min, optional: r.optional, time_context: r.time_context, qualifiers: r.qualifiers, limit_clauses: r.limit_clauses },
      field_kind: o.field.kind,
      visibility,
      visibility_reasons: (item?.reasons ?? []).map((x) => x.replace(/^uncertain:/, '')),
      has_private_context: !!(o.following_text || o.filled_value),
      match: priv
        ? { ...batch.results[i], reasons: batch.results[i].reasons.filter((x) => !/qualifier/.test(x)), differences: { ...batch.results[i].differences, qualifiers_added: [], qualifiers_removed: [] } }
        : batch.results[i],
    }
  })

  const kinds: Record<string, number> = {}
  for (const p of classification.private) kinds[p.kind] = (kinds[p.kind] ?? 0) + 1

  return {
    proposal: true,
    writes: 'none',
    program_match: pm.best,
    program_candidates: pm.candidates,
    program_needs_review: pm.needs_review,
    questions,
    duplicates: batch.duplicates,
    public_candidate,
    public_candidate_refused,
    uncertain: classification.uncertain.filter((u) => u.kind !== 'question').map((u) => ({ kind: u.kind, ...(u.occurrence_index !== undefined ? { occurrence_index: u.occurrence_index } : {}), value: u.value.slice(0, 300), reasons: u.reasons })),
    private_summary: { count: classification.private.length, kinds },
    warnings: [...extraction.warnings],
    classification,
  }
}
