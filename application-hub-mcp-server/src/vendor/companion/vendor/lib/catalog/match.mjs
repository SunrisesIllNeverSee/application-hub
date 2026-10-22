// VENDORED from aqua-companion/vendor/lib/catalog/match.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/catalog/match.ts
// source-sha256: 5f048bd56062d1035c5ff51d6beea47f525ba35f92fd947152f724c3d83bb38f
// body-sha256: 08ad20486553d483a95450cfd368abd3cdd7fc2b06e1fc6818fb91467531b469
// generator: v2; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.
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

import { foldText, normalizeQuestion, tokenSimilarity,                   } from './normalize.mjs'

                                                                     

                                 
                                                                               
              
                            
                            
                                
 

                                  
                                             
            
                                                 
              
                                           
                            
                            
                                
 

                                  
                               
                  
                                                                                        
                                      
 

                                   
                         
                                                     
                         
                            
                              
                               
 

                                                                  

                              
                 
                                
                                                                
                       
                                     
                    
                                                                     
                    
                       
                   
                               
                                           
                                   
 

                               
     
                                                                         
                                                                           
     
                                                                                            
                                                                                                   
                    
                                                                                                         
                         
                                            
                        
 

                                                                                   

function limitsOf(req                                   )         {
  return {
    word_limit: req?.word_limit ?? undefined,
    char_limit: req?.char_limit ?? undefined,
    sentence_limit: req?.sentence_limit ?? undefined,
  }
}

function mergeLimits(base        , over                                                                                                        )         {
  return {
    word_limit: over?.word_limit ?? base.word_limit,
    char_limit: over?.char_limit ?? base.char_limit,
    sentence_limit: over?.sentence_limit ?? base.sentence_limit,
  }
}

function diffLimits(occ        , can        )           {
  const out           = []
  for (const k of ['word_limit', 'char_limit', 'sentence_limit']         ) {
    if ((occ[k] ?? null) !== (can[k] ?? null)) out.push(`${k}: ${can[k] ?? 'none'} → ${occ[k] ?? 'none'}`)
  }
  return out
}

function setDiff(a          , b          )           {
  const bk = new Set(b.map(foldText))
  return a.filter((x) => !bk.has(foldText(x)))
}

const EMPTY_DIFF                   = {
  limits_changed: false, limit_changes: [], qualifiers_added: [], qualifiers_removed: [], time_context_changed: false,
}

                                                                                                      

function formsOf(q                 )         {
  const base = (text        , lim                                                                                             )       => {
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

function differencesFor(occReq              , occLimits        , form      )                   {
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
function withoutTime(core        , req              )         {
  let out = core
  for (const t of req.time_context) out = out.split(t).join(' ')
  return out
}

/** Match one application question occurrence against catalog candidates. */
export function matchOccurrence(occurrence                 , catalog                   , opts               = {})              {
  const asked = occurrence.asked_as ?? ''
  const occN = normalizeQuestion(asked)
  const occReq               = { ...occN.requirements, ...(occurrence.requirements ?? {}),
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
  for (const tier of ['exact', 'normalized']         ) {
    const hits                                            = []
    for (const { c, forms } of prepared) {
      const matching = forms.filter((f) => (tier === 'exact' ? f.folded === occFolded : f.normalized === occN.normalized && f.normalized.length > 0))
      if (!matching.length) continue
      // Compare against the most informative recorded form: one with the
      // same limits first, then any form that recorded limits (a previous
      // occurrence), then the bare canonical text.
      const rank = (f      ) => (diffLimits(occLimits, f.limits).length === 0 ? 2 : (f.limits.word_limit ?? f.limits.char_limit ?? f.limits.sentence_limit) !== undefined ? 1 : 0)
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
  const scored                                                                                        = []
  for (const { c, forms } of prepared) {
    let best                                                                    = null
    const injected = usingScorer ? opts.semanticScore (asked, c) : undefined
    for (const f of forms) {
      const s = typeof injected === 'number' && Number.isFinite(injected)
        ? { score: injected, source: 'scorer'          }
        : { score: tokenSimilarity(withoutTime(occN.core, occReq), withoutTime(normalizeQuestion(f.text).core, f.req)), source: 'tokens'          }
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
      ? [`no match above ${threshold}; closest ${top .score.toFixed(3)} is a near miss — review before creating a new canonical question`]
      : [top ? `no match above ${threshold} (closest ${top.score.toFixed(3)})` : 'no catalog candidates'],
    differences: { ...EMPTY_DIFF },
    candidates,
  }
}

                                 
                                                                 
                   
                                          
 

                                   
                                                                        
                              
 

/**
 * Match every occurrence of one application and detect questions that
 * appear more than once inside the same application. Later duplicates are
 * flagged needs_review (program_questions is unique per
 * (program_id, archived_question_id), so they cannot be stored twice).
 */
export function matchBatch(occurrences                   , catalog                   , opts                                                        = {})                   {
  const duplicates                   = []
  const primaryOf = new Map                ()
  const folded = occurrences.map((o) => foldText(o.asked_as ?? ''))
  const normalized = occurrences.map((o) => normalizeQuestion(o.asked_as ?? '').normalized)
  const simT = opts.similarDuplicateThreshold ?? 0.9

  for (let i = 0; i < occurrences.length; i++) {
    if (primaryOf.has(i) || !folded[i]) continue
    const group           = [i]
    let tier                         = 'exact'
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
