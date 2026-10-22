// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/aqua-local/classify.ts
// source-sha256: b7ba78750ab290cc04ad4987e5795a92a7ee706ab999a3a8d828b1e0eb4077e4
// body-sha256: 853c9697bd62194da3a2f021355cf4ca4cd12991171919bea07b9ee84adc4a13
// generator: v2; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.
// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// v5 (M09 W4) — Direct / Adapt / Gap reuse classifier. PURE TypeScript: no
// storage, no crypto, no clock (pass `now`/cycle data explicitly). Runs on
// decrypted plaintext held in memory by the caller; nothing leaves device.
//
// RULES
//   Direct — a candidate that (a) answers the SAME question (equal
//            canonical_question_id, or exact / normalized-equal wording),
//            (b) is human-approved (hash-matching approval — the caller
//            computes `approved` with approvalGate), (c) fits the word AND
//            char limits, and (d) carries no staleness / audience / qualifier
//            flags.
//   Adapt  — a RELATED candidate (same question with ≥1 failing constraint,
//            or question/answer similarity ≥ ADAPT_THRESHOLD — 'medium' in
//            match.ts terms) — every failing constraint listed as a reason.
//   Gap    — nothing related.
//
// The classifier NEVER approves anything. Its output may be stored as a
// `suggestion` (recordSuggestion); approval still requires a human decision
// bound to the exact version hash.

import { similarityScore } from './match.mjs'
                                                          

/** match.ts 'medium' confidence floor. */
export const ADAPT_THRESHOLD = 0.3
/** A year this many (or fewer) years before the cycle year reads as dated. */
export const STALE_YEAR_WINDOW = 5

                                  
                                                                 
              
                                       
                            
                            
                              
                          
                                                                               
                            
                          
 

                                 
                    
                        
                               
              
                       
                                                                         
                               
                                                                   
                                       
                                                                  
                   
                    
                                                              
                              
                          
                         
 

                                  
                                                                       
                                
                                                        
              
                          
 

                             
                
                     
                     
                            
                
                        
                                  
                       

                              
                       
                                                                         
                                                                            
                 
                  
                
                 
                  
                  
                       
 

                                      
                                         
                               
                                   
                        
                        
                                                                     
                    
                                                                            
                       
                      
                                      
                      
                                   
    
 

const QUALIFIER_WORDS = new Set(
  (
    'why how when where who which whom current currently next last past previous future ' +
    'specific specifically team founders founder customers customer competitors competition ' +
    'revenue traction funding months month year years week weeks today recent recently ' +
    'briefly detail detailed example examples one two three four five top biggest main ' +
    'primary first plan plans goal goals risk risks impact budget timeline milestones'
  ).split(' '),
)

const STOP = new Set(
  ('a an the and or but of to in for on with at by from as is are was were be been your you we i my our ' +
    'their its it this that these those what do does did can could should would will please').split(' '),
)

export function normalizeQuestion(text        )         {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(text        )           {
  return normalizeQuestion(text)
    .split(' ')
    .filter((t) => t.length > 0 && !STOP.has(t))
}

export function wordCount(text        )         {
  return text.split(/\s+/).filter((w) => w.length > 0).length
}

export function charCount(text        )         {
  return [...text].length
}

function escapeRe(s        )         {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function mentions(body        , name        )          {
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(name)}($|[^\\p{L}\\p{N}])`, 'iu')
  return re.test(body)
}

function cycleYearOf(occ                 , opts                 )                {
  if (occ.cycle_year) return occ.cycle_year
  const fromDeadline = occ.deadline ? Number(occ.deadline.slice(0, 4)) : NaN
  if (Number.isFinite(fromDeadline) && fromDeadline > 1900) return fromDeadline
  const fromNow = opts.now ? Number(opts.now.slice(0, 4)) : NaN
  return Number.isFinite(fromNow) && fromNow > 1900 ? fromNow : null
}

                     
                           
                        
                    
                        
                                           
 

function evaluate(occ                 , c                , opts                 )            {
  const threshold = opts.adapt_threshold ?? ADAPT_THRESHOLD
  const occNorm = normalizeQuestion(occ.text)
  const candQ = c.question_text ? normalizeQuestion(c.question_text) : null
  const sameCanonical =
    !!occ.canonical_question_id &&
    !!c.canonical_question_id &&
    occ.canonical_question_id === c.canonical_question_id
  const sameWording = candQ !== null && candQ.length > 0 && candQ === occNorm
  const same_question = sameCanonical || sameWording

  const qSim = c.question_text ? similarityScore(occ.text, c.question_text) : 0
  const aSim = similarityScore(occ.text, `${c.title ?? ''}\n${c.body}`)
  // Same wording = 1; same canonical id = at least 0.9 (an identity match
  // the token score cannot see); otherwise the better of question/answer.
  const similarity = sameWording ? 1 : Math.max(qSim, aSim, sameCanonical ? 0.9 : 0)
  const related = same_question || similarity >= threshold

  const reasons                = []
  if (!related) return { candidate: c, same_question, similarity, reasons, classification: null }

  if (!same_question) {
    reasons.push({
      code: 'different_question',
      message: `answers a related but different question (similarity ${similarity.toFixed(2)})`,
    })
  } else if (candQ !== null && !sameWording) {
    // Same canonical question, different wording — flag qualifiers the
    // occurrence asks for that the source question did not.
    const candTokens = new Set(tokens(c.question_text ))
    const missing = [...new Set(tokens(occ.text))].filter(
      (t) => !candTokens.has(t) && (QUALIFIER_WORDS.has(t) || /^\d+$/.test(t)),
    )
    if (missing.length) {
      reasons.push({
        code: 'different_question_qualifier',
        message: `this question adds qualifier(s) the source question lacked: ${missing.join(', ')}`,
        qualifiers: missing,
      })
    }
  }

  if (!c.approved) {
    reasons.push({ code: 'unapproved', message: 'source version has no live human approval' })
  }

  if (occ.word_limit && occ.word_limit > 0) {
    const n = wordCount(c.body)
    if (n > occ.word_limit) {
      reasons.push({
        code: 'over_word_limit',
        message: `over word limit by ${n - occ.word_limit} words (${n}/${occ.word_limit})`,
        over_by: n - occ.word_limit,
        limit: occ.word_limit,
        actual: n,
      })
    }
  }
  if (occ.char_limit && occ.char_limit > 0) {
    const n = charCount(c.body)
    if (n > occ.char_limit) {
      reasons.push({
        code: 'over_char_limit',
        message: `over character limit by ${n - occ.char_limit} characters (${n}/${occ.char_limit})`,
        over_by: n - occ.char_limit,
        limit: occ.char_limit,
        actual: n,
      })
    }
  }

  // Audience: names of OTHER programs/orgs appearing in the body.
  const own = new Set(
    [occ.program_name, occ.org_name].filter((n)              => !!n).map((n) => n.toLowerCase().trim()),
  )
  const pool = [c.program_name, c.org_name, ...(opts.known_program_names ?? [])]
    .filter((n)              => !!n && n.trim().length >= 3)
    .map((n) => n.trim())
  const seen = new Set        ()
  const mentioned           = []
  for (const n of pool) {
    const k = n.toLowerCase()
    if (own.has(k) || seen.has(k)) continue
    seen.add(k)
    if (mentions(c.body, n)) mentioned.push(n)
  }
  if (mentioned.length) {
    reasons.push({
      code: 'mentions_other_program',
      message: `mentions another program/organization: ${mentioned.join(', ')}`,
      names: mentioned,
    })
  }

  // Staleness: years shortly before the cycle year read as dated claims.
  const cycle = cycleYearOf(occ, opts)
  if (cycle) {
    const years = [...new Set((c.body.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number))]
      .filter((y) => y < cycle && cycle - y <= STALE_YEAR_WINDOW)
      .sort()
    if (years.length) {
      reasons.push({
        code: 'dated_year',
        message: `references year(s) ${years.join(', ')} — older than the ${cycle} cycle`,
        years,
      })
    }
  }

  const classification = same_question && reasons.length === 0 ? 'direct' : 'adapt'
  return { candidate: c, same_question, similarity, reasons, classification }
}

function rank(a           , b           )         {
  const dir = (e           ) => (e.classification === 'direct' ? 1 : 0)
  return (
    dir(b) - dir(a) ||
    Number(b.same_question) - Number(a.same_question) ||
    Number(b.candidate.approved) - Number(a.candidate.approved) ||
    a.reasons.length - b.reasons.length ||
    b.similarity - a.similarity ||
    b.candidate.created_at.localeCompare(a.candidate.created_at) ||
    a.candidate.version_id.localeCompare(b.candidate.version_id)
  )
}

export function classifyReuse(
  occurrence                 ,
  candidates                  ,
  opts                  = {},
)                      {
  const evaluated = candidates
    .map((c) => evaluate(occurrence, c, opts))
    .filter((e) => e.classification !== null)
    .sort(rank)

  const best = evaluated[0]
  if (!best) {
    return {
      classification: 'gap',
      reasons: [{ code: 'no_related_answer', message: 'no related answer in the vault' }],
      evidence_ids: [],
      similarity: 0,
      alternatives: [],
    }
  }
  return {
    classification: best.classification ,
    candidate_version_id: best.candidate.version_id,
    candidate_version_sha256: best.candidate.version_sha256,
    reasons: best.reasons,
    evidence_ids: [...(best.candidate.evidence_ids ?? [])],
    similarity: best.similarity,
    alternatives: evaluated.slice(1, 6).map((e) => ({
      version_id: e.candidate.version_id,
      classification: e.classification ,
      similarity: e.similarity,
      reason_codes: e.reasons.map((r) => r.code),
    })),
  }
}
