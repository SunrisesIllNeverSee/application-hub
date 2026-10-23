// VENDORED from aqua-companion/vendor/lib/aqua-local/history.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/aqua-local/history.ts
// source-sha256: 8f6396893fab300afddd75f7575164bb33283680f41b07fbb3303bf0b21497a0
// body-sha256: 7478f28210177eda0a1fb1735dc6e1c9c2f72a906d6f116df76fca353f84a786
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
