// M09 hardening M5 — keep `?url=` deep links out of servers' and analytics'
// view of the page URL.
//
// `/apply?url=<application link>` prefills the "From a URL" path. The link a
// user pastes can be private (signed URLs, tokens, draft links), so it must
// not end up in page-view analytics, Referer headers or the login `next`
// parameter. The fix has three layers:
//   1. middleware redirects any page request carrying `url=` (top level or
//      inside `next=`) to the same page with the value moved into the URL
//      FRAGMENT (`#url=…`) — fragments are never sent to servers;
//   2. an early inline script does the same client-side before analytics
//      initialise (defence in depth when middleware did not run);
//   3. PostHog `before_send` and GA4 `page_location` drop `url`/`next`
//      query params and `#url=` fragments from every captured URL.
//
// PURE (no Next.js / DOM imports) so it runs under `node --test`.

/** Query keys that may carry a private URL. */
export const SENSITIVE_QUERY_KEYS = ['url'] as const
/** Query keys dropped from analytics URLs entirely. */
export const ANALYTICS_DROPPED_QUERY_KEYS = ['url', 'next'] as const
export const URL_FRAGMENT_KEY = 'url'
/** sessionStorage key that carries a pending `#url=` across the login round-trip. */
export const PENDING_URL_FRAGMENT_KEY = 'aqua:pending-url-fragment'

function nestedUrlParam(next: string | null): { stripped: string; value: string | null } | null {
  if (!next || !/(^|[?&])url=/.test(next)) return null
  const q = next.indexOf('?')
  if (q < 0) return null
  const path = next.slice(0, q)
  const hashAt = next.indexOf('#', q)
  const query = next.slice(q + 1, hashAt < 0 ? undefined : hashAt)
  const params = new URLSearchParams(query)
  const value = params.get('url')
  params.delete('url')
  const rest = params.toString()
  return { stripped: `${path}${rest ? `?${rest}` : ''}`, value }
}

/**
 * Plan for a page request: when its query (or its `next` param) carries a
 * `url=` value, returns the search string without it and the fragment to
 * redirect to; otherwise null.
 */
export function planUrlFragmentRedirect(search: string, opts: { pathname?: string } = {}): { search: string; fragment: string } | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  let value: string | null = null
  if (params.has('url')) {
    value = params.get('url')
    params.delete('url')
    if (opts.pathname === '/apply' && !params.has('path')) params.set('path', 'url')
  }
  const nested = nestedUrlParam(params.get('next'))
  if (nested) {
    params.set('next', nested.stripped)
    if (value === null) value = nested.value
  }
  if (value === null && !nested) return null
  const rest = params.toString()
  return { search: rest ? `?${rest}` : '', fragment: value ? `${URL_FRAGMENT_KEY}=${encodeURIComponent(value)}` : '' }
}

/** Remove `url` (and a `url` nested in `next`) from a relative `path?query` used as a login `next`. */
export function stripUrlFromNext(next: string): string {
  const q = next.indexOf('?')
  if (q < 0) return next
  const path = next.slice(0, q)
  const params = new URLSearchParams(next.slice(q + 1))
  params.delete('url')
  const rest = params.toString()
  return `${path}${rest ? `?${rest}` : ''}`
}

/** The `#url=` value of a fragment ('' / '#…'), or null. */
export function readUrlFragment(hash: string | null | undefined): string | null {
  if (!hash) return null
  const h = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(h)
  const v = params.get(URL_FRAGMENT_KEY)
  return v && v.trim() ? v : null
}

/**
 * Analytics-safe copy of an absolute or relative URL: drops `url` and `next`
 * query params and any fragment that carries `url=`. Non-URL strings are
 * returned unchanged.
 */
export function analyticsSafeUrl(href: string): string {
  if (typeof href !== 'string' || !href) return href
  let u: URL
  const relative = href.startsWith('/') && !href.startsWith('//')
  try {
    u = relative ? new URL(href, 'https://relative.invalid') : new URL(href)
  } catch {
    return href
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return href
  let changed = false
  // /review carries identifiers of what the user is reviewing (e.g.
  // ?program=<uuid>); analytics keeps the path only (M09 review, LOW).
  if (ANALYTICS_QUERYLESS_ROUTE_RE.test(u.pathname) && u.search) {
    u.search = ''
    changed = true
  }
  for (const k of ANALYTICS_DROPPED_QUERY_KEYS) {
    if (u.searchParams.has(k)) {
      u.searchParams.delete(k)
      changed = true
    }
  }
  if (u.hash && /(^#|&)url=/.test(u.hash)) {
    u.hash = ''
    changed = true
  }
  if (!changed) return href
  return relative ? `${u.pathname}${u.search}${u.hash}` : u.toString()
}

/** Routes whose query string never reaches PostHog. */
export const ANALYTICS_QUERYLESS_ROUTE_RE = /^\/review(\/|$)/

/** URL-valued PostHog properties sanitized by `before_send`. */
export const POSTHOG_URL_PROPERTIES = [
  '$current_url', '$referrer', '$initial_current_url', '$initial_referrer', '$session_entry_url',
  '$session_entry_referrer', '$prev_pageview_url', '$pathname',
] as const

/** Sanitize every URL-valued property of an analytics event in place (and return it). */
export function sanitizeAnalyticsProperties<T extends Record<string, unknown> | null | undefined>(props: T): T {
  if (!props || typeof props !== 'object') return props
  const p = props as Record<string, unknown>
  for (const k of POSTHOG_URL_PROPERTIES) {
    if (typeof p[k] === 'string') p[k] = analyticsSafeUrl(p[k] as string)
  }
  for (const nested of ['$set', '$set_once']) {
    const n = p[nested]
    if (n && typeof n === 'object') sanitizeAnalyticsProperties(n as Record<string, unknown>)
  }
  return props
}

/** GA4 page_location for a path: origin + pathname only on /apply and /review (no query, no fragment). */
export const GA4_QUERYLESS_ROUTE_RE = /^\/(apply|review)(\/|$)/

/**
 * Inline script for the root layout <head>: runs before any analytics, moves
 * `?url=` (and `url=` nested in `next=`) into the fragment with
 * history.replaceState. Mirrors planUrlFragmentRedirect; plain ES5.
 */
export const EARLY_URL_STRIP_SCRIPT = `(function(){try{var l=window.location;var s=new URLSearchParams(l.search);var v=null;var c=false;if(s.has('url')){v=s.get('url');s.delete('url');c=true;if(l.pathname==='/apply'&&!s.has('path'))s.set('path','url');}var n=s.get('next');if(n&&/(^|[?&])url=/.test(n)){var q=n.indexOf('?');if(q>=0){var h=n.indexOf('#',q);var np=new URLSearchParams(n.slice(q+1,h<0?undefined:h));if(v===null)v=np.get('url');np.delete('url');var r=np.toString();s.set('next',n.slice(0,q)+(r?'?'+r:''));c=true;}}if(!c)return;var qs=s.toString();var frag=v?'#url='+encodeURIComponent(v):l.hash;window.history.replaceState(window.history.state,'',l.pathname+(qs?'?'+qs:'')+frag);}catch(e){}})();`

/** Pending `#url=` carried across login (sessionStorage), valid for 30 minutes. */
export const PENDING_URL_TTL_MS = 30 * 60 * 1000
export function encodePendingUrl(value: string, now = Date.now()): string {
  return JSON.stringify({ v: value, at: now })
}
export function decodePendingUrl(raw: string | null, now = Date.now()): string | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as { v?: unknown; at?: unknown }
    if (typeof o.v !== 'string' || typeof o.at !== 'number' || now - o.at > PENDING_URL_TTL_MS || o.at > now + 60_000) return null
    return o.v
  } catch {
    return null
  }
}
