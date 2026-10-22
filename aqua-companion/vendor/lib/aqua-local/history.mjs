// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/aqua-local/history.ts
// source-sha256: 56e522b8cc9c47e23a2787a5f353dabd8f759a2177c0a8195ef42289f85ce480
// body-sha256: 30e4100b8ad09485987b5e481af4450b3d901f608fe77326e4124b2f17acddb2
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
                              
                               
                                                           
                        
                                                            
                  
                                                                      
                             
                                
                                                                                
                 
                                               
                       
                            
                                                                             
                                                    
                     
                  
 

                           
            
               
            
 

/**
 * Unfilled-placeholder patterns. Kept deliberately narrow so ordinary prose
 * does not trip them: bracket markers are the M09 drafting conventions,
 * TODO/TBD/XXX are whole words, angle placeholders start with a letter or an
 * ellipsis right after `<` (`<company name>`, `<…>`, `<...>`; `a < b` is not
 * one), and `{{…}}` is a template slot.
 */
export const PLACEHOLDER_RULES                             = [
  { id: 'confirm', label: '[CONFIRM…] marker', re: /\[\s*CONFIRM/i },
  { id: 'asset_needed', label: '[ASSET NEEDED…] marker', re: /\[\s*ASSET\s+NEEDED/i },
  { id: 'todo', label: 'TODO', re: /\bTODO\b/i },
  { id: 'tbd', label: 'TBD', re: /\bTBD\b/i },
  { id: 'xxx', label: 'XXX', re: /\bX{3,}\b/i },
  { id: 'angle', label: '<…> placeholder', re: /<(?:…|\.{2,}|[A-Za-z_][^<>\n]{0,80})>/ },
  { id: 'mustache', label: '{{…}} template slot', re: /\{\{[^{}\n]{0,200}\}\}/ },
]

/** Ids of every placeholder rule the text trips (empty = clean). */
export function findPlaceholders(text        )           {
  const s = String(text ?? '')
  return PLACEHOLDER_RULES.filter((r) => r.re.test(s)).map((r) => r.id)
}

/** Human-readable reason for a list of placeholder ids. */
export function describePlaceholders(ids                   )         {
  const labels = ids.map((id) => PLACEHOLDER_RULES.find((r) => r.id === id)?.label ?? id)
  return labels.length ? `Contains an unfilled placeholder (${labels.join(', ')}). Fill it in before confirming.` : ''
}

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
