/**
 * Minimal text sanitization for user-submitted content.
 * Strips dangerous HTML elements/attributes, enforces max length.
 * Use on ALL text fields written via API routes (message body/subject,
 * outcome notes, program feedback).
 *
 * Not a full HTML parser — we don't render this as HTML on the client,
 * so we just defang the common XSS vectors and trust React's auto-escape.
 */

const DANGEROUS_TAGS = /<\s*\/?\s*(script|iframe|object|embed|style|link|meta|svg|math|template|noscript)\b[^>]*>/gi
const ON_HANDLERS = /\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const JAVASCRIPT_URL = /javascript\s*:/gi
const DATA_URL = /data\s*:\s*text\/(html|javascript|xml)/gi

export function sanitizeText(input: unknown, maxLen = 5000): string {
  if (typeof input !== 'string') return ''
  let s = input
    .replace(DANGEROUS_TAGS, '')
    .replace(ON_HANDLERS, '')
    .replace(JAVASCRIPT_URL, '')
    .replace(DATA_URL, '')
    .trim()
  if (s.length > maxLen) s = s.slice(0, maxLen)
  return s
}

export function sanitizeSubject(input: unknown): string {
  return sanitizeText(input, 200)
}
