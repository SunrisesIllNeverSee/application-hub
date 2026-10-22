// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/review-ui/decision-file.ts
// source-sha256: a9efb6fdcaa8592c2828b45553893dbd9e56098d093f496e61a2112fef27ff5c
// body-sha256: c64883a6c7cfb05c1f91e8f2c3f7478931981b9e3235b0f1122cdc2448a4e7a5
// generator: v2; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.
// M09 W5 — offline review decision file: build, parse, validate, and plan an
// import. PURE (no storage, no DOM, no clock — callers pass `now`).
//
// Directive §7 "HTML review artifact": an offline HTML file must not pretend
// that clicking Approve updated AQUA. The exported review HTML therefore only
// fills a downloadable DECISION FILE; nothing changes in the vault until the
// user imports that file in the app, reviews the plan and confirms. Every
// decision is bound to a version id AND its content sha256; a decision whose
// version changed (edited, hash differs, unknown) is shown as stale and is
// never applied.
//
// M09 hardening M2: approve / needs_revision rows are NEVER preselected —
// the user ticks each one after reading the answer excerpt and full hash.
// Every export carries a random nonce (its sha256 is kept in the vault); a
// decision file whose nonce this vault did not issue is a FOREIGN FILE:
// importable only after an extra explicit confirmation, nothing preselected.

export const DECISION_FILE_FORMAT = 'aqua-review-decisions'
export const DECISION_FILE_VERSION = 1
export const DECISION_FILE_NOTICE =
  'Offline review decisions. Opening or clicking in the review HTML did NOT update AQUA. ' +
  'Import this file in AQUA (Review board → Import decisions) and confirm to apply.'

/** 2 MB — a decision file holds ids, hashes and short comments only. */
export const MAX_DECISION_FILE_BYTES = 2 * 1024 * 1024
export const MAX_DECISIONS = 2000
export const MAX_COMMENT_CHARS = 10_000

export const DECISION_KINDS = ['approve', 'needs_revision', 'needs_evidence', 'comment']         
                                                          

                                
                                
                    
                        
                                               
                        
                        
                    
 

                               
                                     
                                       
                
                     
                                                                        
                                   
                                                                                                    
                             
                    
                            
 

const HEX64 = /^[0-9a-f]{64}$/
const NONCE = /^[0-9a-f]{32,128}$/
const ISO = (s         )              => typeof s === 'string' && s.length <= 40 && Number.isFinite(Date.parse(s))
const ID = (s         )              => typeof s === 'string' && s.length > 0 && s.length <= 200 && !/[\u0000-\u001f]/.test(s)

export function buildDecisionFile(
  meta                                                                                           ,
  entries                                                                                                         ,
  now        ,
)               {
  return {
    format: DECISION_FILE_FORMAT,
    version: DECISION_FILE_VERSION,
    notice: DECISION_FILE_NOTICE,
    instance_id: meta.instance_id,
    review_exported_at: meta.review_exported_at ?? null,
    export_nonce: meta.export_nonce ?? null,
    created_at: now,
    decisions: entries.map((e) => ({
      question_occurrence_id: e.question_occurrence_id,
      version_id: e.version_id,
      version_sha256: e.version_sha256,
      decision: e.decision,
      comment: e.comment && e.comment.trim() ? e.comment : null,
      decided_at: e.decided_at ?? now,
    })),
  }
}

                                                                                                                

/** Parse + strictly validate a decision file. Unknown top-level keys are
    ignored with a warning; any malformed decision rejects the whole file
    (a partially-trusted file is not applied piecemeal). */
export function parseDecisionFile(text        )              {
  const errors           = []
  const warnings           = []
  if (typeof text !== 'string' || text.length === 0) return { ok: false, errors: ['File is empty.'] }
  if (text.length > MAX_DECISION_FILE_BYTES) return { ok: false, errors: ['File is too large to be a decision file.'] }
  let raw         
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['File is not valid JSON.'] }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['File is not a decision object.'] }
  const o = raw                           
  if (o.format !== DECISION_FILE_FORMAT) errors.push(`Not an AQUA decision file (format must be "${DECISION_FILE_FORMAT}").`)
  if (o.version !== DECISION_FILE_VERSION) errors.push(`Unsupported decision file version ${String(o.version)} (expected ${DECISION_FILE_VERSION}).`)
  if (!ID(o.instance_id)) errors.push('instance_id is missing or invalid.')
  if (!ISO(o.created_at)) errors.push('created_at is missing or not a timestamp.')
  if (o.review_exported_at != null && !ISO(o.review_exported_at)) errors.push('review_exported_at is not a timestamp.')
  if (o.export_nonce != null && !(typeof o.export_nonce === 'string' && NONCE.test(o.export_nonce))) errors.push('export_nonce is not a valid nonce.')
  if (!Array.isArray(o.decisions)) errors.push('decisions must be a list.')
  const known = new Set(['format', 'version', 'notice', 'instance_id', 'review_exported_at', 'export_nonce', 'created_at', 'decisions'])
  for (const k of Object.keys(o)) if (!known.has(k)) warnings.push(`Ignored unknown field "${k}".`)
  if (errors.length) return { ok: false, errors }

  const list = o.decisions             
  if (list.length > MAX_DECISIONS) return { ok: false, errors: [`Too many decisions (${list.length} > ${MAX_DECISIONS}).`] }
  const out                  = []
  const seen = new Set        ()
  list.forEach((d, i) => {
    const at = `decisions[${i}]`
    if (!d || typeof d !== 'object' || Array.isArray(d)) {
      errors.push(`${at} is not an object.`)
      return
    }
    const e = d                           
    if (!ID(e.question_occurrence_id)) errors.push(`${at}.question_occurrence_id is missing or invalid.`)
    if (!ID(e.version_id)) errors.push(`${at}.version_id is missing or invalid.`)
    if (typeof e.version_sha256 !== 'string' || !HEX64.test(e.version_sha256)) errors.push(`${at}.version_sha256 must be a 64-character lowercase hex hash.`)
    if (!DECISION_KINDS.includes(e.decision                )) errors.push(`${at}.decision must be one of ${DECISION_KINDS.join(', ')}.`)
    if (e.comment != null && typeof e.comment !== 'string') errors.push(`${at}.comment must be text.`)
    if (typeof e.comment === 'string' && e.comment.length > MAX_COMMENT_CHARS) errors.push(`${at}.comment is too long.`)
    if (e.decision === 'comment' && !(typeof e.comment === 'string' && e.comment.trim())) errors.push(`${at} is comment-only but has no comment text.`)
    if (!ISO(e.decided_at)) errors.push(`${at}.decided_at is missing or not a timestamp.`)
    const key = `${String(e.version_id)}`
    if (seen.has(key)) errors.push(`${at} repeats a decision for version ${String(e.version_id)}.`)
    seen.add(key)
    out.push({
      question_occurrence_id: String(e.question_occurrence_id),
      version_id: String(e.version_id),
      version_sha256: String(e.version_sha256),
      decision: e.decision                ,
      comment: typeof e.comment === 'string' && e.comment.trim() ? e.comment : null,
      decided_at: String(e.decided_at),
    })
  })
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    warnings,
    file: {
      format: DECISION_FILE_FORMAT,
      version: DECISION_FILE_VERSION,
      notice: typeof o.notice === 'string' ? o.notice : DECISION_FILE_NOTICE,
      instance_id: o.instance_id          ,
      review_exported_at: (o.review_exported_at                             ) ?? null,
      export_nonce: (o.export_nonce                             ) ?? null,
      created_at: o.created_at          ,
      decisions: out,
    },
  }
}

// ---------------------------------------------------------------------------
// Import planning
// ---------------------------------------------------------------------------

                                       
                                
                                                                               
                                                 
                                     
                                                                  
                             
 

                        
                                         
                                                                                     
                                                                              
                                                                  
                                                                
                       // question not in this application instance

                           
                      
                    
                     
                                                                            
                         
                          
                 
                               
                                                                                                             
                      
 

/** 'this_vault' = the file's export nonce was issued by this vault for this instance. */
                                                         

                             
             
                  
                   
                    
               
                            
 

/** Decisions that must always be ticked by hand (M2). */
export const NEVER_PRESELECTED                          = ['approve', 'needs_revision']

const STATUS_MESSAGE                             = {
  ready: 'Matches the current version and hash.',
  already_approved: 'This version is already approved — only the comment (if any) will be added.',
  stale_hash: 'Stale — the stored content hash differs from the reviewed hash. Not applied.',
  stale_superseded: 'Stale — a newer version of this answer exists. Not applied; review the new version.',
  unknown_version: 'Stale — this version is not part of this question. Not applied.',
  unknown_question: 'Stale — this question is not part of this application. Not applied.',
}

export function planDecisionImport(
  file              ,
  instanceId        ,
  current                        ,
  opts                                  = {},
)             {
  // Default is the cautious one: unless the caller verified the nonce, the file is foreign.
  const origin                     = opts.origin ?? 'foreign'
  if (file.instance_id !== instanceId) {
    return {
      ok: false,
      errors: [`This decision file belongs to a different application instance (${file.instance_id}).`],
      items: [],
      applicable: 0,
      stale: 0,
      origin,
    }
  }
  const byOcc = new Map(current.map((c) => [c.question_occurrence_id, c]))
  const items             = file.decisions.map((entry) => {
    const q = byOcc.get(entry.question_occurrence_id)
    let status            
    let number                = null
    if (!q) status = 'unknown_question'
    else {
      const sorted = q.versions
      const idx = sorted.findIndex((v) => v.id === entry.version_id)
      const v = idx >= 0 ? sorted[idx] : null
      number = idx >= 0 ? idx + 1 : null
      if (!v) status = 'unknown_version'
      else if (v.sha256 !== entry.version_sha256) status = 'stale_hash'
      else if (q.governing_version_id !== v.id) status = 'stale_superseded'
      else if (entry.decision === 'approve' && q.governing_approved) status = 'already_approved'
      else status = 'ready'
    }
    const applicable = status === 'ready' || (status === 'already_approved' && !!entry.comment)
    return {
      entry,
      status,
      applicable,
      writes_comment: applicable && !!entry.comment,
      writes_decision: status === 'ready' && entry.decision !== 'comment',
      message: STATUS_MESSAGE[status],
      version_number: number,
      preselected: applicable && origin === 'this_vault' && !NEVER_PRESELECTED.includes(entry.decision),
    }
  })
  return {
    ok: true,
    errors: [],
    origin,
    items,
    applicable: items.filter((i) => i.applicable).length,
    stale: items.filter((i) => i.status.startsWith('stale') || i.status.startsWith('unknown')).length,
  }
}

// ---------------------------------------------------------------------------
// In-browser builder embedded in the exported review HTML. Plain ES5-ish JS
// with no outer references, so it can be inlined verbatim and also executed
// in tests (`new Function(DECISION_BUILDER_JS + '; return aquaBuildDecisionFile')()`).
// It must produce exactly what parseDecisionFile accepts.
// ---------------------------------------------------------------------------

export const DECISION_BUILDER_JS = `function aquaBuildDecisionFile(meta, entries, now) {
  var out = [];
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var comment = typeof e.comment === 'string' && e.comment.replace(/\\s+/g, '') ? e.comment : null;
    var decision = e.decision || (comment ? 'comment' : null);
    if (!decision) continue;
    out.push({
      question_occurrence_id: e.question_occurrence_id,
      version_id: e.version_id,
      version_sha256: e.version_sha256,
      decision: decision,
      comment: comment,
      decided_at: e.decided_at || now
    });
  }
  return {
    format: ${JSON.stringify(DECISION_FILE_FORMAT)},
    version: ${DECISION_FILE_VERSION},
    notice: ${JSON.stringify(DECISION_FILE_NOTICE)},
    instance_id: meta.instance_id,
    review_exported_at: meta.review_exported_at || null,
    export_nonce: meta.export_nonce || null,
    created_at: now,
    decisions: out
  };
}`
