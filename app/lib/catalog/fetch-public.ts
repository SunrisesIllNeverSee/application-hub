// M09 W2 — SSRF-guarded public application fetch. SERVER-ONLY.
//
// fetchPublicApplication(url) retrieves ONE public application page for
// extraction and returns a snapshot hash + extraction. It persists nothing
// and never returns the raw body.
//
// Guards (every hop, including each redirect):
//   - http/https only, default ports (80/443) only, no credentials in URL
//   - hostname resolved; every address must be public (no loopback, RFC1918,
//     link-local incl. 169.254.169.254 metadata, CGNAT, ULA, multicast,
//     reserved, documentation, NAT64/6to4/mapped forms of those)
//   - the default transport re-validates at CONNECT time via a guarded DNS
//     lookup, so a rebinding resolver cannot swap in a private address
//   - ≤ 3 redirects, overall timeout, byte cap on the decoded body,
//     content-type html/text only
// Reuse signals: robots.txt Disallow, <meta name=robots> / X-Robots-Tag
// noindex|none|noai → reuse 'disallowed'; robots unavailable → 'unknown'.
//
// Deps are injectable (resolver + fetch) so tests run with no network.

import { lookup as dnsLookup } from 'node:dns'
import { isIP } from 'node:net'
import { createHash } from 'node:crypto'
import { extractApplication, readRobotsMeta, type ExtractionResult } from './extract.ts'
import type { Reuse } from './classify.ts'
import { outboundFetchLimiter, type OutboundFetchLimiter, type OutboundRelease } from '../rate-limit.ts'

export type PublicFetchErrorCode =
  | 'invalid_url' | 'blocked_scheme' | 'blocked_port' | 'credentials_in_url' | 'blocked_host'
  | 'blocked_address' | 'dns_failed' | 'too_many_redirects' | 'redirect_without_location'
  | 'timeout' | 'too_large' | 'bad_content_type' | 'http_error' | 'network_error'
  | 'busy'

export class PublicFetchError extends Error {
  readonly code: PublicFetchErrorCode
  readonly status?: number
  constructor(code: PublicFetchErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'PublicFetchError'
    this.code = code
    if (status !== undefined) this.status = status
  }
}

export interface FetchLikeResponse {
  status: number
  headers: { get(name: string): string | null }
  body: ReadableStream<Uint8Array> | null
  /** Hard-close the underlying connection (socket) — used when we stop reading early. */
  destroy?: () => void
}
export type FetchLike = (url: string, init: { method: 'GET'; headers: Record<string, string>; signal: AbortSignal; redirect: 'manual' }) => Promise<FetchLikeResponse>

export interface PublicFetchDeps {
  /** hostname → addresses. Default: node:dns lookup (all). */
  resolve?: (hostname: string) => Promise<string[]>
  /** transport. Default: node:http(s) with a connect-time guarded lookup. */
  fetch?: FetchLike
  now?: () => Date
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
  /** fetch and honor robots.txt signals (default true) */
  checkRobots?: boolean
  userAgent?: string
  /** per-instance outbound concurrency caps (global + per target host). Default: shared limiter. */
  limiter?: Pick<OutboundFetchLimiter, 'acquireGlobal' | 'acquireHost'>
}

export interface PublicSourceRecord {
  requested_url: string
  final_url: string
  status: number
  fetched_at: string
  content_type: string
  bytes: number
  content_sha256: string
  redirects: string[]
  reuse: Reuse
  reuse_signals: string[]
}

export interface PublicApplicationSnapshot {
  source: PublicSourceRecord
  extraction: ExtractionResult
}

export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024
export const DEFAULT_TIMEOUT_MS = 10_000
export const DEFAULT_MAX_REDIRECTS = 3
const ROBOTS_MAX_BYTES = 256 * 1024
const USER_AGENT = 'AQUA-Catalog-Fetch/1.0 (+https://aquaidp.xyz; user-initiated single-page fetch)'
const ROBOTS_TOKEN = 'aqua'
const ALLOWED_TYPES = /^(?:text\/html|application\/xhtml\+xml|text\/plain|text\/markdown|text\/x-markdown)$/i
const BLOCKED_HOST_RE = /(?:^|\.)(?:localhost|local|internal|intranet|corp|home|lan|home\.arpa|localdomain|invalid|test|example)$/i
const METADATA_HOSTS = new Set(['metadata.google.internal', 'metadata', 'instance-data', 'metadata.azure.com'])

// ─── address policy ───────────────────────────────────────────────────────────

function v4Octets(ip: string): number[] | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return null
  const o = m.slice(1).map(Number)
  return o.every((x) => x >= 0 && x <= 255) ? o : null
}

function v4Blocked(o: number[]): boolean {
  const [a, b, c] = o
  return a === 0 || a === 10 || a === 127 || a >= 224 ||               // this-net, private, loopback, multicast+reserved+broadcast
    (a === 100 && b >= 64 && b <= 127) ||                               // CGNAT 100.64/10
    (a === 169 && b === 254) ||                                         // link-local incl. 169.254.169.254 metadata
    (a === 172 && b >= 16 && b <= 31) ||                                // 172.16/12
    (a === 192 && b === 168) ||                                         // 192.168/16
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||                   // IETF 192.0.0/24, TEST-NET-1
    (a === 192 && b === 88 && c === 99) ||                              // 6to4 relay anycast
    (a === 198 && (b === 18 || b === 19)) ||                            // benchmarking 198.18/15
    (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) // TEST-NET-2/3
}

function v6Groups(ip: string): number[] | null {
  let s = ip.toLowerCase().replace(/^\[|\]$/g, '')
  const zone = s.indexOf('%'); if (zone >= 0) s = s.slice(0, zone)
  // embedded dotted IPv4 tail (::ffff:1.2.3.4) → two hex groups
  const lastColon = s.lastIndexOf(':')
  const tail = s.slice(lastColon + 1)
  if (tail.includes('.')) {
    const o = v4Octets(tail); if (!o) return null
    s = s.slice(0, lastColon + 1) + ((o[0] << 8) | o[1]).toString(16) + ':' + ((o[2] << 8) | o[3]).toString(16)
  }
  const parts = s.split('::')
  if (parts.length > 2) return null
  const head = parts[0] ? parts[0].split(':') : []
  const rest = parts.length === 2 && parts[1] ? parts[1].split(':') : []
  let groups: string[]
  if (parts.length === 2) {
    const fill = 8 - head.length - rest.length
    if (fill < 1) return null
    groups = [...head, ...Array(fill).fill('0'), ...rest]
  } else groups = head
  if (groups.length !== 8) return null
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN))
  return nums.some((n) => Number.isNaN(n)) ? null : nums
}

/** True when an IP address must never be fetched (private, loopback, link-local, metadata, …). */
export function isBlockedAddress(ip: string): boolean {
  const v4 = v4Octets(ip)
  if (v4) return v4Blocked(v4)
  const g = v6Groups(ip)
  if (!g) return true // unparseable → refuse
  const embedded = (hi: number, lo: number) => [hi >> 8, hi & 255, lo >> 8, lo & 255]
  if (g.every((x) => x === 0)) return true                                     // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true            // ::1
  if ((g[0] & 0xfe00) === 0xfc00) return true                                   // fc00::/7 ULA
  if ((g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0) return true     // link-local, site-local
  if ((g[0] & 0xff00) === 0xff00) return true                                   // multicast
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return v4Blocked(embedded(g[6], g[7])) // ::ffff:v4
  if (g.slice(0, 6).every((x) => x === 0)) return true                          // ::v4 (deprecated compat)
  if (g[0] === 0x64 && g[1] === 0xff9b) return v4Blocked(embedded(g[6], g[7])) || g[2] !== 0 // NAT64
  if (g[0] === 0x2002) return v4Blocked(embedded(g[1], g[2]))                   // 6to4
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true                            // documentation
  if (g[0] === 0x2001 && g[1] === 0x0000) return true                            // Teredo (embedded addr obfuscated)
  if (g[0] === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true     // discard
  return false
}

async function defaultResolve(hostname: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true }, (err, addrs) => {
      if (err) reject(err)
      else resolve((addrs as Array<{ address: string }>).map((a) => a.address))
    })
  })
}

/** Validate URL shape (scheme, port, credentials, hostname). Throws PublicFetchError. */
export function assertFetchableUrlShape(raw: string, base?: string): URL {
  let u: URL
  try { u = base ? new URL(raw, base) : new URL(raw) } catch { throw new PublicFetchError('invalid_url', 'URL could not be parsed') }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new PublicFetchError('blocked_scheme', `scheme ${u.protocol} is not allowed`)
  if (u.username || u.password) throw new PublicFetchError('credentials_in_url', 'URLs containing credentials are not allowed')
  if (u.port && !((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443'))) throw new PublicFetchError('blocked_port', `port ${u.port} is not allowed`)
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!host) throw new PublicFetchError('invalid_url', 'URL has no host')
  if (isIP(host)) { if (isBlockedAddress(host)) throw new PublicFetchError('blocked_address', 'address is not public') }
  else {
    if (!host.includes('.') || BLOCKED_HOST_RE.test(host) || METADATA_HOSTS.has(host)) throw new PublicFetchError('blocked_host', 'host is not a public internet name')
  }
  return u
}

async function assertPublicHost(u: URL, resolve: (h: string) => Promise<string[]>): Promise<void> {
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (isIP(host)) return // checked in shape
  let addrs: string[]
  try { addrs = await resolve(host) } catch { throw new PublicFetchError('dns_failed', 'host could not be resolved') }
  if (!addrs || addrs.length === 0) throw new PublicFetchError('dns_failed', 'host resolved to no addresses')
  if (addrs.some((a) => isBlockedAddress(a))) throw new PublicFetchError('blocked_address', 'host resolves to a non-public address')
}

// ─── default transport (node:http/https, guarded at connect) ──────────────────

function guardedLookup(hostname: string, options: { all?: boolean; family?: number } | number, cb: (...args: unknown[]) => void) {
  const opts = typeof options === 'number' ? { family: options } : (options ?? {})
  dnsLookup(hostname, { all: true, family: (opts.family as 0 | 4 | 6) || 0 }, (err, addrs) => {
    if (err) return cb(err)
    const list = addrs as Array<{ address: string; family: number }>
    if (!list.length || list.some((a) => isBlockedAddress(a.address))) {
      const e = Object.assign(new Error('blocked non-public address'), { code: 'EAQUABLOCKED' })
      return cb(e)
    }
    if (opts.all) cb(null, list)
    else cb(null, list[0].address, list[0].family)
  })
}

async function nodeTransport(url: string, init: { headers: Record<string, string>; signal: AbortSignal }): Promise<FetchLikeResponse> {
  const [{ request: httpRequest }, { request: httpsRequest }, { Readable }, zlib] = await Promise.all([
    import('node:http'), import('node:https'), import('node:stream'), import('node:zlib'),
  ])
  const u = new URL(url)
  const request = u.protocol === 'https:' ? httpsRequest : httpRequest
  return new Promise<FetchLikeResponse>((resolve, reject) => {
    const req = request(u, { method: 'GET', headers: { ...init.headers, 'accept-encoding': 'gzip, deflate, br' }, lookup: guardedLookup as never, signal: init.signal }, (res) => {
      const enc = String(res.headers['content-encoding'] ?? '').toLowerCase()
      let stream: NodeJS.ReadableStream = res
      if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(zlib.createGunzip())
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate())
      else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress())
      const headers = {
        get(name: string): string | null {
          const v = res.headers[name.toLowerCase()]
          if (v === undefined) return null
          return Array.isArray(v) ? v.join(', ') : String(v)
        },
      }
      const status = res.statusCode ?? 0
      const body = status >= 300 && status < 400 ? (res.resume(), null) : (Readable.toWeb(stream as never) as unknown as ReadableStream<Uint8Array>)
      const destroy = () => { try { res.destroy() } catch { /* ignore */ } try { req.destroy() } catch { /* ignore */ } }
      resolve({ status, headers, body, destroy })
    })
    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err?.code === 'EAQUABLOCKED') reject(new PublicFetchError('blocked_address', 'host resolves to a non-public address'))
      else reject(err)
    })
    req.end()
  })
}

// ─── body reading ─────────────────────────────────────────────────────────────

async function readLimited(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Uint8Array> {
  if (!body) return new Uint8Array(0)
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        try { await reader.cancel() } catch { /* ignore */ }
        throw new PublicFetchError('too_large', `response exceeds ${maxBytes} bytes`)
      }
      chunks.push(value)
    }
  } finally {
    try { reader.releaseLock() } catch { /* ignore */ }
  }
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { out.set(c, off); off += c.byteLength }
  return out
}

function decodeBody(bytes: Uint8Array, contentType: string): string {
  const cs = contentType.match(/charset\s*=\s*"?([\w.:-]+)"?/i)?.[1]
  try { return new TextDecoder(cs ?? 'utf-8', { fatal: false }).decode(bytes) } catch { return new TextDecoder('utf-8').decode(bytes) }
}

// ─── robots.txt ───────────────────────────────────────────────────────────────

interface RobotsRule { allow: boolean; path: string }

/**
 * Bounds on attacker-controlled robots.txt input. A rule over a bound cannot
 * be evaluated cheaply, so it is resolved conservatively: an over-limit
 * Disallow in our group counts as disallowing the path, an over-limit Allow is
 * ignored, and a file with more rules than ROBOTS_MAX_RULES is treated as
 * disallowing everything. (Only the site's own reuse signal is affected.)
 */
export const ROBOTS_MAX_RULES = 1000
export const ROBOTS_MAX_PATTERN = 512
export const ROBOTS_MAX_WILDCARDS = 16

/**
 * robots.txt path matching: `*` matches any run of characters, a trailing `$`
 * anchors the end, everything else is literal, and an unanchored pattern
 * matches a prefix of the path. No regex: the pattern is split on `*` and each
 * literal segment is located left-to-right with indexOf, taking the leftmost
 * occurrence (optimal for `*`-only globs), so the scan never backtracks.
 */
export function robotsPatternMatches(path: string, pattern: string): boolean {
  if (!pattern) return false
  const anchored = pattern.endsWith('$')
  const body = anchored ? pattern.slice(0, -1) : pattern
  const segs = body.split('*')
  const first = segs[0]
  if (!path.startsWith(first)) return false
  if (segs.length === 1) return anchored ? path.length === first.length : true
  let pos = first.length
  const lastIdx = segs.length - 1
  for (let k = 1; k < lastIdx; k++) {
    const seg = segs[k]
    if (!seg) continue
    const at = path.indexOf(seg, pos)
    if (at < 0) return false
    pos = at + seg.length
  }
  const last = segs[lastIdx]
  if (!anchored) return !last || path.indexOf(last, pos) >= 0
  return path.length - last.length >= pos && path.endsWith(last)
}

function ruleOverLimit(pattern: string): boolean {
  if (pattern.length > ROBOTS_MAX_PATTERN) return true
  let stars = 0
  for (let i = 0; i < pattern.length; i++) if (pattern[i] === '*' && pattern[i - 1] !== '*') stars++
  return stars > ROBOTS_MAX_WILDCARDS
}

/** Evaluate robots.txt for our token (falls back to "*"). Returns true when the path is disallowed. */
export function robotsDisallows(robotsTxt: string, pathWithQuery: string, token = ROBOTS_TOKEN): boolean {
  const groups: Array<{ agents: string[]; rules: RobotsRule[] }> = []
  let cur: { agents: string[]; rules: RobotsRule[] } | null = null
  let lastWasAgent = false
  let ruleCount = 0
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    const val = m[2].trim()
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur) }
      cur.agents.push(val.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!cur) continue
    if (key !== 'disallow' && key !== 'allow') continue
    if (++ruleCount > ROBOTS_MAX_RULES) return true
    cur.rules.push({ allow: key === 'allow', path: val })
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && token.includes(a.replace(/\*$/, '')) ))
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes('*'))
  let best: RobotsRule | null = null
  for (const g of chosen) for (const r of g.rules) {
    if (!r.path) continue
    if (ruleOverLimit(r.path)) { if (!r.allow) return true; continue }
    if (!robotsPatternMatches(pathWithQuery, r.path)) continue
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r
  }
  return !!best && !best.allow
}

const DISALLOW_DIRECTIVES = new Set(['noindex', 'none', 'noai', 'noimageai', 'noarchive'])

// ─── main ─────────────────────────────────────────────────────────────────────

interface HopResult { res: FetchLikeResponse; url: URL; redirects: string[] }

type GetDeps = Required<Pick<PublicFetchDeps, 'resolve' | 'fetch' | 'maxRedirects' | 'userAgent'>> & {
  /** reserve a per-host slot before contacting `host` (throws PublicFetchError('busy')) */
  holdHost: (host: string) => void
}

async function guardedGet(start: string, deps: GetDeps, signal: AbortSignal, accept: string): Promise<HopResult> {
  let url = assertFetchableUrlShape(start)
  const redirects: string[] = []
  for (let hop = 0; ; hop++) {
    deps.holdHost(url.hostname)
    await assertPublicHost(url, deps.resolve)
    if (signal.aborted) throw new PublicFetchError('timeout', 'fetch timed out')
    let res: FetchLikeResponse
    try {
      res = await deps.fetch(url.toString(), { method: 'GET', headers: { 'user-agent': deps.userAgent, accept }, signal, redirect: 'manual' })
    } catch (err) {
      if (err instanceof PublicFetchError) throw err
      if (signal.aborted) throw new PublicFetchError('timeout', 'fetch timed out')
      throw new PublicFetchError('network_error', 'network request failed')
    }
    if (res.status >= 300 && res.status < 400 && res.status !== 304) {
      try { await res.body?.cancel() } catch { /* ignore */ }
      const loc = res.headers.get('location')
      if (!loc) throw new PublicFetchError('redirect_without_location', 'redirect without a Location header', res.status)
      if (hop + 1 > deps.maxRedirects) throw new PublicFetchError('too_many_redirects', `more than ${deps.maxRedirects} redirects`)
      const next = assertFetchableUrlShape(loc, url.toString())
      redirects.push(next.toString())
      url = next
      continue
    }
    return { res, url, redirects }
  }
}

/**
 * Fetch one public application page (SSRF-guarded) and extract it.
 * Throws PublicFetchError on any failure — there is no partial result.
 */
export async function fetchPublicApplication(rawUrl: string, deps: PublicFetchDeps = {}): Promise<PublicApplicationSnapshot> {
  // M1: per-instance concurrency caps — one global slot for the whole
  // operation, plus one slot per distinct target host it contacts.
  const limiter = deps.limiter ?? outboundFetchLimiter
  const releaseGlobal = limiter.acquireGlobal()
  if (!releaseGlobal) throw new PublicFetchError('busy', 'too many outbound fetches in progress — try again shortly')
  const held = new Map<string, OutboundRelease>()
  const releaseAll = () => { for (const r of held.values()) r(); held.clear(); releaseGlobal() }
  const holdHost = (rawHost: string) => {
    const host = rawHost.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
    if (held.has(host)) return
    const r = limiter.acquireHost(host)
    if (!r) throw new PublicFetchError('busy', 'too many concurrent fetches to this host — try again shortly')
    held.set(host, r)
  }
  const cfg = {
    resolve: deps.resolve ?? defaultResolve,
    fetch: deps.fetch ?? (nodeTransport as unknown as FetchLike),
    maxRedirects: deps.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
    userAgent: deps.userAgent ?? USER_AGENT,
    holdHost,
  }
  const maxBytes = deps.maxBytes ?? DEFAULT_MAX_BYTES
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const now = deps.now ?? (() => new Date())
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const run = async (): Promise<PublicApplicationSnapshot> => {
      const fetchedAt = now().toISOString()
      const { res, url, redirects } = await guardedGet(rawUrl, cfg, controller.signal, 'text/html,application/xhtml+xml,text/plain;q=0.9,text/markdown;q=0.8')
      if (res.status < 200 || res.status >= 300) {
        try { await res.body?.cancel() } catch { /* ignore */ }
        throw new PublicFetchError('http_error', `upstream responded ${res.status}`, res.status)
      }
      const contentType = (res.headers.get('content-type') ?? '').trim()
      const mime = contentType.split(';')[0].trim()
      if (!ALLOWED_TYPES.test(mime)) {
        try { await res.body?.cancel() } catch { /* ignore */ }
        throw new PublicFetchError('bad_content_type', `content-type ${mime || '(none)'} is not html/text`)
      }
      const declared = Number(res.headers.get('content-length') ?? '')
      if (Number.isFinite(declared) && declared > maxBytes) {
        // L2: never drain an oversized body — tear the socket down now.
        res.destroy?.()
        try { await res.body?.cancel() } catch { /* ignore */ }
        throw new PublicFetchError('too_large', `response exceeds ${maxBytes} bytes`)
      }
      let bytes: Uint8Array
      try { bytes = await readLimited(res.body, maxBytes) } catch (err) {
        if (err instanceof PublicFetchError) {
          if (err.code === 'too_large') res.destroy?.() // L2: stop the upstream immediately
          throw err
        }
        if (controller.signal.aborted) throw new PublicFetchError('timeout', 'fetch timed out')
        throw new PublicFetchError('network_error', 'reading the response failed')
      }
      const sha = createHash('sha256').update(bytes).digest('hex')
      const text = decodeBody(bytes, contentType)
      const isHtml = /html/i.test(mime)

      // reuse signals
      const signals: string[] = []
      let disallowed = false
      let unknown = false
      const xr = (res.headers.get('x-robots-tag') ?? '').toLowerCase()
      for (const d of xr.split(/[,\s]+/).filter(Boolean)) if (DISALLOW_DIRECTIVES.has(d.replace(/^[\w-]+:/, ''))) { disallowed = true; signals.push(`x-robots-tag:${d}`) }
      if (isHtml) for (const d of readRobotsMeta(text)) if (DISALLOW_DIRECTIVES.has(d)) { disallowed = true; signals.push(`meta-robots:${d}`) }
      if (deps.checkRobots !== false) {
        try {
          const robotsUrl = new URL('/robots.txt', url).toString()
          const r = await guardedGet(robotsUrl, cfg, controller.signal, 'text/plain')
          if (r.res.status >= 200 && r.res.status < 300) {
            let robotsBytes: Uint8Array
            try { robotsBytes = await readLimited(r.res.body, ROBOTS_MAX_BYTES) } catch (e) {
              if (e instanceof PublicFetchError && e.code === 'too_large') r.res.destroy?.()
              throw e
            }
            const body = decodeBody(robotsBytes, 'text/plain')
            if (robotsDisallows(body, url.pathname + url.search)) { disallowed = true; signals.push('robots.txt:disallow') }
            else signals.push('robots.txt:allow')
          } else if (r.res.status >= 400 && r.res.status < 500) {
            try { await r.res.body?.cancel() } catch { /* ignore */ }
            signals.push(`robots.txt:absent(${r.res.status})`)
          } else {
            try { await r.res.body?.cancel() } catch { /* ignore */ }
            unknown = true; signals.push(`robots.txt:unavailable(${r.res.status})`)
          }
        } catch (err) {
          if (controller.signal.aborted) throw new PublicFetchError('timeout', 'fetch timed out')
          unknown = true
          signals.push(`robots.txt:unavailable(${err instanceof PublicFetchError ? err.code : 'error'})`)
        }
      } else { unknown = true; signals.push('robots.txt:not-checked') }
      const reuse: Reuse = disallowed ? 'disallowed' : unknown ? 'unknown' : 'allowed'

      const extraction = extractApplication({ content: text, format: isHtml ? 'html' : /markdown/i.test(mime) ? 'markdown' : 'text', baseUrl: url.toString() })
      return {
        source: {
          requested_url: rawUrl,
          final_url: url.toString(),
          status: res.status,
          fetched_at: fetchedAt,
          content_type: mime,
          bytes: bytes.byteLength,
          content_sha256: sha,
          redirects,
          reuse,
          reuse_signals: signals,
        },
        extraction,
      }
    }
    const aborted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new PublicFetchError('timeout', 'fetch timed out')), { once: true })
    })
    return await Promise.race([run(), aborted])
  } finally {
    clearTimeout(timer)
    controller.abort()
    releaseAll()
  }
}
