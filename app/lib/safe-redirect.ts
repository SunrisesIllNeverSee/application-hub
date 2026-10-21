// P0 auth (AUTH-06 / EI-08): one shared guard for every post-auth return path.
// Used by the auth callback, the login page, the reset-password page and the
// teams accept handler. Only same-origin relative paths are ever returned.
//
// Pure TypeScript with no framework imports so it can be unit-tested with
// `node --test` (see tests/safe-redirect.test.mjs).

export const DEFAULT_NEXT_PATH = '/applications'

const PROBE_ORIGIN = 'https://safe-redirect.invalid'
const MAX_LENGTH = 2048

// C0 controls, DEL and C1 controls. Includes tab, CR and LF, which URL parsers
// silently strip (turning "/<TAB>/evil.com" into "//evil.com").
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/

function isPlainRelativePath(value: string): boolean {
  if (value.length === 0 || value.length > MAX_LENGTH) return false
  // Must start with exactly one "/" — no leading whitespace, scheme or "//".
  if (value[0] !== '/') return false
  if (value[1] === '/' || value[1] === '\\') return false
  if (value.includes('\\')) return false
  if (CONTROL_CHARS.test(value)) return false
  return true
}

/**
 * Returns a normalized same-origin relative path ("/path?query#hash"), or null
 * when `raw` is anything else: absolute URLs, protocol-relative URLs ("//x"),
 * backslash tricks ("/\x"), control or whitespace prefixes, javascript:/data:
 * schemes, and percent-encoded variants of those ("/%2F/x", "/%5Cx").
 */
export function sanitizeNextPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (!isPlainRelativePath(raw)) return null

  // Encoded variants: decode up to twice and re-apply the same rules.
  let decoded = raw
  for (let i = 0; i < 2; i += 1) {
    try {
      decoded = decodeURIComponent(decoded)
    } catch {
      return null // malformed escape sequence
    }
    if (!isPlainRelativePath(decoded)) return null
  }

  let resolved: URL
  try {
    resolved = new URL(raw, PROBE_ORIGIN)
  } catch {
    return null
  }
  if (resolved.origin !== PROBE_ORIGIN) return null

  // Dot-segment collapsing can create a new "//" prefix ("/..//evil.com"), so
  // the normalized form must pass the same checks again.
  const normalized = resolved.pathname + resolved.search + resolved.hash
  if (!isPlainRelativePath(normalized)) return null
  return normalized
}

/** Like sanitizeNextPath but returns `fallback` instead of null. */
export function safeNextPath(raw: unknown, fallback: string = DEFAULT_NEXT_PATH): string {
  return sanitizeNextPath(raw) ?? fallback
}

/**
 * Resolves a return path against `origin` and asserts the result stays on that
 * origin (defence in depth for NextResponse.redirect callers).
 */
export function resolveSafeRedirect(
  raw: unknown,
  origin: string,
  fallback: string = DEFAULT_NEXT_PATH
): URL {
  const path = safeNextPath(raw, fallback)
  const url = new URL(path, origin)
  if (url.origin !== new URL(origin).origin) return new URL(fallback, origin)
  return url
}

/**
 * Builds the redirectTo / emailRedirectTo value handed to Supabase. `next` is
 * appended only when a valid return path is supplied, so the common no-`next`
 * case keeps the exact URL "<origin>/auth/callback".
 */
export function buildAuthCallbackUrl(origin: string, next?: string | null): string {
  const base = `${origin}/auth/callback`
  const safe = sanitizeNextPath(next)
  return safe ? `${base}?next=${encodeURIComponent(safe)}` : base
}
