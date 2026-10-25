// VENDORED from application-hub-mcp-server/src/vendor/companion/vendor/lib/catalog/proposal.mjs. Do not edit: change the source and run
// `npm run vendor:hosted` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED from aqua-companion/vendor/lib/catalog/proposal.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/catalog/proposal.ts
// source-sha256: 73a7d580903dd3a3d61a60feb530fdb33264e1b0baa7cc3fdb93216aa7a9fef0
// body-sha256: 01dca06c224bcce9b94b450005f56377706965ac774815ae31c63c67d3bd8cf1
// generator: v2; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.
// M09 W2 — read-only extraction proposal assembly. PURE module.
//
// Combines a fetched/extracted application with catalog rows the caller
// already read (approved programs, their cycles, candidate canonical
// questions) into a proposal. It decides nothing and writes nothing: every
// link is a suggestion with tier/confidence/needs_review, and the public
// candidate is only a Candidate for human curation.

import { foldText, tokenSimilarity, contentTokens } from './normalize.mjs'
import { matchBatch,                                                           } from './match.mjs'
                                                    
import { classifyExtraction, buildPublicCandidate, PublicCandidateLeakError,                                                                                } from './classify.mjs'

                             
            
              
              
                              
                           
                            
 
                                                                                                                          

                                                                                 
                               
                    
              
              
                          
                    
                                                           
 

// Hosts shared by many unrelated programs — a host match there proves nothing.
const SHARED_HOSTS = /(?:^|\.)(?:google\.com|forms\.gle|typeform\.com|airtable\.com|jotform\.com|tally\.so|notion\.site|notion\.so|fillout\.com|paperform\.co|smapply\.io|submittable\.com|f6s\.com|wufoo\.com|formstack\.com|hubspot\.com|medium\.com|substack\.com|github\.io|webflow\.io|wixsite\.com|squarespace\.com|linkedin\.com|x\.com|twitter\.com)$/i

function urlKey(raw                )                                        {
  if (!raw) return null
  try {
    const u = new URL(raw)
    return { host: u.hostname.toLowerCase().replace(/^www\./, ''), path: u.pathname.replace(/\/+$/, '') || '/' }
  } catch { return null }
}

/** Match fetched program identity to existing approved programs (read-only). */
export function matchProgram(
  hints                                                                                      ,
  programs              ,
  cycles             = [],
)                                                                                   {
  const urls = [hints.final_url, ...(hints.apply_urls ?? [])].map(urlKey).filter(Boolean)                                         
  const sameUrl = (raw                ) => { const k = urlKey(raw); return !!k && urls.some((u) => u.host === k.host && u.path === k.path) }
  const sameHost = (raw                ) => { const k = urlKey(raw); return !!k && !SHARED_HOSTS.test(k.host) && urls.some((u) => u.host === k.host) }
  const out                 = []
  for (const p of programs) {
    const base = { program_id: p.id, slug: p.slug, name: p.name }
    const cyc = cycles.filter((c) => c.program_id === p.id)
    const cycleHit = cyc.find((c) => sameUrl(c.apply_url))
    if (sameUrl(p.apply_url) || sameUrl(p.scrape_url)) { out.push({ ...base, basis: 'apply_url', confidence: 0.95 }); continue }
    if (cycleHit) { out.push({ ...base, basis: 'cycle_apply_url', confidence: 0.95, cycle: { cycle_name: cycleHit.cycle_name, closes_at: cycleHit.closes_at ?? null } }); continue }
    if (sameHost(p.apply_url) || sameHost(p.scrape_url) || cyc.some((c) => sameHost(c.apply_url))) { out.push({ ...base, basis: 'host', confidence: 0.6 }); continue }
    const names = [hints.title, hints.organization].filter(Boolean)            
    let best = 0
    for (const n of names) for (const pn of [p.name, p.organization].filter(Boolean)            ) {
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
export function searchTermsFor(extraction                  , max = 12)           {
  const freq = new Map                ()
  for (const o of extraction.occurrences) {
    for (const t of new Set(contentTokens(o.asked_as))) {
      if (t.length < 5 || !/^[a-z0-9]+$/.test(t)) continue
      freq.set(t, (freq.get(t) ?? 0) + 1)
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, max).map(([t]) => t)
}

                                   
                     
                                                                    
                         
                 
                        
                                       
                    
                        
                              
                                                                                                  
                              
                                                
 

                                     
                
                
                                    
                                    
                               
                               
                                                        
                                          
                                           
                                                                                                 
                                                                   
                    
 

export function buildExtractionProposal(input   
                              
                       
                         
                     
                             
                             
 )                                                          {
  const { extraction, source } = input
  const classification = classifyExtraction(extraction, source)
  let public_candidate                         = null
  let public_candidate_refused                  = null
  try { public_candidate = buildPublicCandidate(classification) } catch (err) {
    if (err instanceof PublicCandidateLeakError) public_candidate_refused = err.reasons
    else throw err
  }

  const pm = matchProgram({ final_url: source.final_url, title: extraction.program.title, organization: extraction.program.organization, apply_urls: extraction.program.apply_urls }, input.programs ?? [], input.cycles ?? [])
  const batch = matchBatch(extraction.occurrences.map((o) => ({ asked_as: o.asked_as, requirements: o.requirements })), input.catalog ?? [], input.matchOptions)

  const questions                     = extraction.occurrences.map((o, i) => {
    const item = classification.items.find((x) => x.kind === 'question' && x.occurrence_index === i)
    const visibility             = item?.visibility ?? 'uncertain'
    const priv = visibility === 'private'
    const r = o.requirements
    const limitsOnly = { word_limit: r.word_limit, char_limit: r.char_limit, sentence_limit: r.sentence_limit, required: r.required }
    return {
      order_index: o.order_index,
      asked_as: priv ? null : o.asked_as,
      ...(priv ? { redacted: true          } : {}),
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

  const kinds                         = {}
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
