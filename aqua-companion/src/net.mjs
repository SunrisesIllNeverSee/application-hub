// The companion's ONLY network code: read-only GETs against the configured
// public catalog endpoint (Supabase PostgREST with the public, publishable
// key). Rules, enforced here rather than by callers:
//   - every URL must have exactly the configured origin (no redirects
//     followed, no other hosts);
//   - https only, except plain http to a loopback host (local testing);
//   - GET only, no cookies, no credentials other than the public key header;
//   - nothing from the workspace is ever sent: callers pass only table names,
//     column lists and public catalog ids;
//   - responses are size-capped and time-limited.
// A test asserts no other companion module calls fetch or imports a network
// builtin.

export class CatalogNetworkError extends Error {
  constructor(message, code = 'network') {
    super(message)
    this.name = 'CatalogNetworkError'
    this.code = code
  }
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
export const MAX_RESPONSE_BYTES = 20 * 1024 * 1024
export const TIMEOUT_MS = 15_000

/** An https://<ref>.supabase.co origin: the only host a REMOTE catalog configuration may name. */
export const SUPABASE_ORIGIN_RE = /^https:\/\/[a-z0-9-]+\.supabase\.co$/

/** Printable, single-line, length-capped text, for the rare place config-derived text must be shown. */
export function safeText(s, max = 120) {
  const t = String(s ?? '').replace(/[^\x20-\x7e]/g, '?')
  return t.length > max ? `${t.slice(0, max)}...` : t
}

/** Validate a configured endpoint and return its origin (throws on anything unsafe). Never echoes the raw value. */
export function endpointOrigin(raw) {
  let u
  try {
    u = new URL(raw)
  } catch {
    throw new CatalogNetworkError('the catalog URL is not a URL', 'config')
  }
  if (u.username || u.password) throw new CatalogNetworkError('the catalog URL must not contain credentials', 'config')
  if (u.protocol === 'http:' && !LOOPBACK.has(u.hostname)) throw new CatalogNetworkError('the catalog URL must use https (plain http is allowed only for localhost)', 'config')
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new CatalogNetworkError('the catalog URL must use https', 'config')
  if (u.pathname !== '/' && u.pathname !== '') throw new CatalogNetworkError('the catalog URL must be the project origin only (for example https://<ref>.supabase.co)', 'config')
  if (u.search || u.hash) throw new CatalogNetworkError('the catalog URL must not carry a query or fragment', 'config')
  return u.origin
}

/** The one origin the companion fetches its default catalog configuration from (M09b). */
export const CONFIG_ORIGIN = 'https://aquaidp.xyz'
export const CONFIG_PATH = '/.well-known/aqua-catalog.json'
const MAX_CONFIG_BYTES = 64 * 1024

/**
 * GET a catalog configuration document from a URL the USER chose (--catalog-config <url>,
 * AQUA_CATALOG_CONFIG_URL). https only (plain http to loopback for tests); no redirects, no
 * credentials, nothing sent, size- and time-capped. The content is treated as untrusted by the caller.
 */
export async function getConfigJsonFromUrl(rawUrl, { fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  let u
  try {
    u = new URL(String(rawUrl))
  } catch {
    throw new CatalogNetworkError('the catalog config URL is not a URL', 'config')
  }
  if (u.username || u.password) throw new CatalogNetworkError('the catalog config URL must not contain credentials', 'config')
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && LOOPBACK.has(u.hostname))) throw new CatalogNetworkError('the catalog config URL must use https', 'config')
  return requestJson(u.origin, `${u.pathname}${u.search}`, { accept: 'application/json' }, { fetchImpl, timeoutMs, maxBytes: MAX_CONFIG_BYTES, allowedOrigins: [u.origin] })
}

/**
 * GET `pathAndQuery` (must start with /rest/v1/) from `origin` and parse JSON.
 * `fetchImpl` is injectable for tests; the default is the platform fetch.
 */
export async function getPublicJson(origin, pathAndQuery, publishableKey, { fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS, maxBytes = MAX_RESPONSE_BYTES } = {}) {
  if (!pathAndQuery.startsWith('/rest/v1/')) throw new CatalogNetworkError('only PostgREST paths under /rest/v1/ are requested', 'config')
  return requestJson(origin, pathAndQuery, { apikey: publishableKey, accept: 'application/json', 'accept-profile': 'public' }, { fetchImpl, timeoutMs, maxBytes })
}

/**
 * GET the public catalog configuration from https://aquaidp.xyz/.well-known/aqua-catalog.json.
 * Allowlist: exactly that origin and path, no redirects, no credentials, nothing sent.
 */
export async function getCatalogConfigJson({ fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  return requestJson(CONFIG_ORIGIN, CONFIG_PATH, { accept: 'application/json' }, { fetchImpl, timeoutMs, maxBytes: MAX_CONFIG_BYTES, allowedOrigins: [CONFIG_ORIGIN] })
}

/** The single network primitive: pinned-origin GET, no redirects, no cookies, size- and time-capped. */
async function requestJson(origin, pathAndQuery, headers, { fetchImpl, timeoutMs, maxBytes, allowedOrigins = null }) {
  if (allowedOrigins && !allowedOrigins.includes(origin)) throw new CatalogNetworkError('refusing a request to an origin outside the allowlist', 'config')
  const url = new URL(pathAndQuery, origin)
  if (url.origin !== origin) throw new CatalogNetworkError('refusing a request to a different origin', 'config')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res
  try {
    res = await fetchImpl(url.toString(), {
      method: 'GET',
      redirect: 'error',
      credentials: 'omit',
      signal: controller.signal,
      headers,
    })
  } catch (e) {
    clearTimeout(timer)
    throw new CatalogNetworkError(e?.name === 'AbortError' ? `the request to ${origin} timed out` : `${origin} could not be reached (${e?.message ?? e})`)
  }
  try {
    if (!res.ok) throw new CatalogNetworkError(`${origin} answered HTTP ${res.status}`, res.status === 401 || res.status === 403 ? 'auth' : 'http')
    const declared = Number(res.headers?.get?.('content-length') ?? 0)
    if (declared > maxBytes) throw new CatalogNetworkError('the response is too large', 'too_large')
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > maxBytes) throw new CatalogNetworkError('the response is too large', 'too_large')
    try {
      return JSON.parse(buf.toString('utf8'))
    } catch {
      throw new CatalogNetworkError('the response is not JSON', 'format')
    }
  } finally {
    clearTimeout(timer)
  }
}
