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
export type HistoryDateSource = 'frontmatter' | 'metadata' | 'filename' | 'flag' | null

/**
 * Encrypted metadata a companion history record carries (serialized JSON,
 * encrypted under the vault secret as the version's `history_enc`). Nothing
 * here is trusted by the vault write: the body is re-checked for
 * placeholders and re-hashed at attestation time.
 */
export interface HistoryMeta {
  format: typeof HISTORY_FORMAT
  /** Program / application the answer was submitted to. */
  program: string | null
  /** Exact question wording as found in the source file. */
  question: string
  /** YYYY-MM-DD, or null when the importer could not establish it. */
  submitted_at: string | null
  date_source: HistoryDateSource
  /** Importer flags, e.g. 'date_unknown', 'date_conflict', 'date_ambiguous'. */
  flags: string[]
  /** sha256 of the source file bytes (hex). */
  source_sha256: string
  source_file: string | null
  /** Importer's placeholder scan of the answer (re-checked by the vault). */
  placeholder: { found: boolean; markers: string[] }
  imported_at: string
  importer: string
  /** Importer's confidence that the question/answer split is right (absent on older imports). */
  parse_confidence?: HistoryParseConfidence
  /** Why the confidence is below high, e.g. 'answer_contains_question_line'. */
  parse_notes?: string[]
}

export type HistoryParseConfidence = 'high' | 'medium' | 'low'

/** Shown next to a low-confidence record on the confirm screen. */
export const LOW_CONFIDENCE_REASON =
  'The importer is not sure it split this question and answer correctly. Check that both match what you submitted before you confirm it.'

// Placeholder detection lives in ONE module (placeholders.ts) shared by the
// vault writes, the /history screen and the companion; re-exported here so
// existing importers keep working.
export { PLACEHOLDER_RULES, findPlaceholders, hasPlaceholders, describePlaceholders, normalizeForPlaceholderScan } from './placeholders.ts'
export type { PlaceholderRule } from './placeholders.ts'

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** True for a real calendar date written YYYY-MM-DD. */
export function isCalendarDate(s: string): boolean {
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
export function normalizeEffectiveAt(value: string, now: Date = new Date()): string | null {
  const v = String(value ?? '').trim()
  let ms: number
  if (isCalendarDate(v)) ms = Date.parse(`${v}T00:00:00Z`)
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && isCalendarDate(v.slice(0, 10))) ms = Date.parse(v)
  else return null
  if (!Number.isFinite(ms)) return null
  if (ms > now.getTime() + 24 * 3600 * 1000) return null
  return v
}
