/**
 * Text sanitization helpers shared across API routes.
 *
 * sanitizeText: trim, strip control chars (except newline/tab), enforce max length.
 * sanitizeSubject: single-line subject — trim, strip control chars and newlines, cap at 200 chars.
 */

export function sanitizeText(input: unknown, maxLen: number): string {
  if (input == null) return ''
  const raw = typeof input === 'string' ? input : String(input)
  // Strip ASCII control chars except \t (0x09) and \n (0x0A)
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '').trim()
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen)
}

export function sanitizeSubject(input: unknown): string {
  if (input == null) return ''
  const raw = typeof input === 'string' ? input : String(input)
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned.length <= 200 ? cleaned : cleaned.slice(0, 200)
}
