// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/aqua-local/history.ts
// source-sha256: 499856462c9e5e6c759d80a50faaa08e90b6bb48f32e0338fd22057307d7d5c8
// body-sha256: 0ae1ee28a7fff211fcb2ee3ba24d5dccb8a2ea247227d46f98bfa2ca213d737e
// generator: v2; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.
// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// M09b — submitted-history records (OWNER rule 2026-10-22: answers the user
// actually submitted count as approved AS OF their submission date, once the
// user confirms them). PURE helpers shared by the vault write
// (repo.ts recordHistoryAttestation), the browser "Confirm submitted
// history" screen and the companion importer (vendored into
// aqua-companion/vendor/), so every surface flags placeholders the same way.
//
// The placeholder rule is enforced by the VAULT WRITE, not only by the UI:
// a body that still carries an unfilled placeholder can never become a
// history attestation.

import { canonicalJson, sha256Hex } from './crypto.mjs'

/** Format tag inside every encrypted history record (`history_enc`). */
export const HISTORY_FORMAT = 'aqua-history/v1'

/** The approval surface for a submitted-history confirmation. */
export const HISTORY_VIA = 'history_attestation'

/** Where a history record's submission date came from. `null` = unknown. */
                                                                                       

/**
 * Encrypted metadata a companion history record carries (serialized JSON,
 * encrypted under the vault secret as the version's `history_enc`). Nothing
 * here is trusted by the vault write: the body is re-checked for
 * placeholders and re-hashed at attestation time.
 */
                              
                               
                                                           
                        
                                                            
                  
                                                                      
                             
                                
                                                                                
                 
                                               
                       
                            
                                                                             
                                                    
                     
                  
                                                                                                 
                                           
                                                                                
                        
     
                                                                          
                                                                           
                                               
     
                      
 

/** Domain tag mixed into the metadata hash so it can never collide with a version content hash. */
export const HISTORY_META_HASH_DOMAIN = 'aqua-history-meta/v1'

/** The version a history metadata record is bound to. */
                                     
                    
                                                     
                        
 

const orNull =    (v                      )           => (v === undefined || v === null ? null : v)
const strList = (v         )           => (Array.isArray(v) ? v.filter((x)              => typeof x === 'string') : [])

/**
 * The exact object that is hashed. Every metadata field except `meta_sha256`
 * is bound, plus `version_id` and `version_sha256`. Optional/absent values are
 * normalized (null / empty list; `flags` and placeholder markers sorted) so
 * the hash does not depend on key order or on how absence was spelled.
 */
export function historyMetaHashInput(meta                      , binding                    )                          {
  const ph = (meta.placeholder ?? {})                                       
  return {
    domain: HISTORY_META_HASH_DOMAIN,
    version_id: binding.version_id,
    version_sha256: binding.version_sha256,
    format: orNull(meta.format),
    program: orNull(meta.program),
    question: orNull(meta.question),
    submitted_at: orNull(meta.submitted_at),
    date_source: orNull(meta.date_source),
    flags: [...strList(meta.flags)].sort(),
    source_sha256: orNull(meta.source_sha256),
    source_file: orNull(meta.source_file),
    placeholder: { found: ph.found === true, markers: [...strList(ph.markers)].sort() },
    imported_at: orNull(meta.imported_at),
    importer: orNull(meta.importer),
    parse_confidence: orNull(meta.parse_confidence),
    parse_notes: strList(meta.parse_notes),
  }
}

/** sha256 hex of `canonicalJson(historyMetaHashInput(meta, binding))`. */
export async function computeHistoryMetaHash(meta                      , binding                    )                  {
  return sha256Hex(canonicalJson(historyMetaHashInput(meta, binding)))
}

/**
 * `verified`: hash present and matches. `legacy`: no metadata or no hash
 * (imported before G18; allowed but flagged, never reported as verified).
 * `mismatch`: a hash is present and does not match: refuse.
 */
                                                                      

export async function checkHistoryMetaHash(meta                                         , binding                    )                                 {
  if (!meta || typeof meta !== 'object' || meta.meta_sha256 === undefined || meta.meta_sha256 === null) return 'legacy'
  if (typeof meta.meta_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(meta.meta_sha256)) return 'mismatch'
  return (await computeHistoryMetaHash(meta, binding)) === meta.meta_sha256 ? 'verified' : 'mismatch'
}

/** Shown when the metadata hash does not match (attestation and restore refuse). */
export const HISTORY_META_MISMATCH_REASON =
  'The import details for this answer (date, source or question) changed after it was imported. It cannot be confirmed; import it again from the original file.'

/** Shown next to a record imported before metadata hashing existed. */
export const HISTORY_META_LEGACY_NOTE =
  'Imported before tamper checks existed: the date and source details cannot be verified. Check them yourself before you confirm.'

                                                              

/** Shown next to a low-confidence record on the confirm screen. */
export const LOW_CONFIDENCE_REASON =
  'The importer is not sure it split this question and answer correctly. Check that both match what you submitted before you confirm it.'

// Placeholder detection lives in ONE module (placeholders.ts) shared by the
// vault writes, the /history screen and the companion; re-exported here so
// existing importers keep working.
export { PLACEHOLDER_RULES, findPlaceholders, hasPlaceholders, describePlaceholders, normalizeForPlaceholderScan } from './placeholders.mjs'
                                                        

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** True for a real calendar date written YYYY-MM-DD. */
export function isCalendarDate(s        )          {
  const m = ISO_DATE_RE.exec(String(s ?? ''))
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < 1990 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

/**
 * Validate an `effective_at` (the submission date). Accepts YYYY-MM-DD or a
 * full ISO date-time; refuses anything in the future (by more than a day of
 * clock skew). Returns the normalized value or null.
 */
export function normalizeEffectiveAt(value        , now       = new Date())                {
  const v = String(value ?? '').trim()
  let ms        
  if (isCalendarDate(v)) ms = Date.parse(`${v}T00:00:00Z`)
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && isCalendarDate(v.slice(0, 10))) ms = Date.parse(v)
  else return null
  if (!Number.isFinite(ms)) return null
  if (ms > now.getTime() + 24 * 3600 * 1000) return null
  return v
}
