// Catalog promotion — private-data and secret detection (M09 W3, directive §12/§15).
//
// Pure and dependency-free so it runs under `node --test` (type stripping).
// Findings carry a KIND only — never the matched text — so callers can log
// or return them without echoing private content.

export type PrivacyFindingKind =
  | 'email'
  | 'phone'
  | 'jwt'
  | 'bearer_token'
  | 'api_key'
  | 'credential_assignment'
  | 'token_url'
  | 'private_url'
  | 'answer_like'

export type PrivacyFinding = { kind: PrivacyFindingKind }

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/i
// NANP-style 3-3-4 with separators, or +CC international with 8+ digits.
const PHONE_RES = [
  /(?:^|[^\d])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?!\d)/,
  /(?:^|[^\w])\+\d{1,3}(?:[\s.-]?\d{1,4}){2,5}(?!\d)/,
]
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/
const BEARER_RE = /\bbearer\s+[A-Za-z0-9._~+/=-]{16,}/i
const API_KEY_RES = [
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}/, // Stripe-style
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/, // OpenAI / Anthropic-style
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9]{30,}/, // GitHub tokens
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/, // Slack tokens
  /\bAIza[0-9A-Za-z_-]{30,}/, // Google API key
  /\bsbp_[A-Za-z0-9]{30,}/, // Supabase PAT
]
const CREDENTIAL_ASSIGN_RE =
  /\b(?:api[_-]?key|secret|access[_-]?token|auth[_-]?token|password|passwd|client[_-]?secret|service[_-]?role)\s*[:=]\s*["']?[^\s"']{8,}/i

const URL_IN_TEXT_RE = /\bhttps?:\/\/[^\s<>"')\]]+/gi
const SENSITIVE_PARAM_RE =
  /^(?:token|access_token|id_token|refresh_token|auth|authorization|key|api_key|apikey|sig|signature|secret|password|pass|session|sessionid|sid|code|otp|jwt|x-amz-signature|x-amz-credential|x-amz-security-token|x-goog-signature|se|sp|sv)$/i

/** True for hosts that are not on the public internet. */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!h) return true
  if (h === 'localhost' || h.endsWith('.localhost')) return true
  if (/\.(?:local|internal|lan|home|corp|intranet|localdomain|test|invalid|example)$/.test(h)) return true
  if (!h.includes('.') && !h.includes(':')) return true // single-label host
  // IPv4
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a >= 224) return true
    return false
  }
  // IPv6
  if (h.includes(':')) {
    if (h === '::' || h === '::1') return true
    if (/^f[cd][0-9a-f]{2}:/.test(h)) return true // fc00::/7
    if (/^fe[89ab][0-9a-f]:/.test(h)) return true // fe80::/10
    if (h.startsWith('::ffff:')) return isPrivateHost(h.slice(7))
    return false
  }
  return false
}

export type UrlVerdict = { ok: true; url: URL } | { ok: false; kind: 'invalid_url' | 'private_url' | 'token_url' }

/** Validates a public http(s) URL with no credentials or secret-bearing params. */
export function checkPublicUrl(raw: string): UrlVerdict {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return { ok: false, kind: 'invalid_url' }
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, kind: 'invalid_url' }
  if (u.username || u.password) return { ok: false, kind: 'token_url' }
  if (isPrivateHost(u.hostname)) return { ok: false, kind: 'private_url' }
  for (const k of u.searchParams.keys()) if (SENSITIVE_PARAM_RE.test(k)) return { ok: false, kind: 'token_url' }
  // fragments sometimes carry OAuth tokens (#access_token=...)
  if (/(?:^|[#&])(?:access_token|id_token|token|code)=/i.test(u.hash)) return { ok: false, kind: 'token_url' }
  return { ok: true, url: u }
}

const FIRST_PERSON_RE = /\b(?:i|i'm|i’m|i've|i’ve|i'd|i’d|i'll|i’ll|me|my|mine|myself)\b/gi

/**
 * Heuristic for applicant-answer prose smuggled into a catalog field:
 * long text dense with singular first person. Program copy uses "we"/"you";
 * an applicant's answer uses "I"/"my".
 */
export function looksLikeAnswer(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length < 40) return false
  const fp = text.match(FIRST_PERSON_RE)?.length ?? 0
  return fp >= 3 && fp / words.length >= 0.025
}

export type ScanOptions = {
  /** Contact details (email/phone) are findings. Default true. */
  contacts?: boolean
  /** Apply the answer-like prose heuristic. Default true. */
  answerLike?: boolean
}

/** Scans free text. Returns unique finding kinds (no matched content). */
export function scanText(text: string, opts: ScanOptions = {}): PrivacyFinding[] {
  const { contacts = true, answerLike = true } = opts
  const kinds = new Set<PrivacyFindingKind>()
  if (contacts && EMAIL_RE.test(text)) kinds.add('email')
  if (contacts && PHONE_RES.some((re) => re.test(text))) kinds.add('phone')
  if (JWT_RE.test(text)) kinds.add('jwt')
  if (BEARER_RE.test(text)) kinds.add('bearer_token')
  if (API_KEY_RES.some((re) => re.test(text))) kinds.add('api_key')
  if (CREDENTIAL_ASSIGN_RE.test(text)) kinds.add('credential_assignment')
  for (const m of text.matchAll(URL_IN_TEXT_RE)) {
    const v = checkPublicUrl(m[0].replace(/[.,;:!?]+$/, ''))
    if (!v.ok && v.kind === 'token_url') kinds.add('token_url')
    if (!v.ok && v.kind === 'private_url') kinds.add('private_url')
  }
  if (answerLike && looksLikeAnswer(text)) kinds.add('answer_like')
  return [...kinds].map((kind) => ({ kind }))
}

/** Secret-class findings: never acceptable anywhere, including snapshots. */
export const SECRET_KINDS: ReadonlySet<PrivacyFindingKind> = new Set([
  'jwt',
  'bearer_token',
  'api_key',
  'credential_assignment',
  'token_url',
])
