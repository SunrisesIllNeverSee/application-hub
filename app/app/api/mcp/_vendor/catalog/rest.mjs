// VENDORED from application-hub-mcp-server/src/catalog/rest.mjs. Do not edit: change the source and run
// `npm run vendor:hosted` in application-hub-mcp-server/ (CI checks these copies).
// Read-only PostgREST client for the public AQUA catalog. Rules enforced
// here rather than by callers:
//   - GET only, to exactly the configured origin, under /rest/v1/ only;
//   - no redirects followed, no cookies, no credential other than the
//     public key (already checked by assertAnonKey);
//   - only table names, column lists and public catalog ids are sent;
//   - responses are size-capped and time-limited.
// Every request is recorded as evidence (table, HTTP status, row count,
// PostgREST error code), never row content, so "is this anon-readable?" can
// be answered from the log.

export const MAX_RESPONSE_BYTES = 8 * 1024 * 1024
export const TIMEOUT_MS = 15_000
const PAGE = 1000
const MAX_PAGES = 5
const PG_CODE = /^[A-Z0-9]{3,8}$/

/**
 * Read a Request/Response body as text, stopping at maxBytes (counted in
 * bytes, streamed: a body without Content-Length cannot exceed the cap).
 * Returns null when the body is larger than maxBytes.
 */
export async function readCappedText(msg, maxBytes) {
  const declared = Number(msg.headers?.get?.('content-length') ?? 0)
  if (declared > maxBytes) return null
  if (!msg.body) return ''
  const reader = msg.body.getReader()
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const buf = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    buf.set(c, at)
    at += c.byteLength
  }
  return new TextDecoder().decode(buf)
}

export class CatalogError extends Error {
  /**
   * kind: not_public   the key cannot read this table (401/403, 42501, or not exposed: 404/PGRST205)
   *       schema       the table is readable but a requested column does not exist (42703)
   *       network      unreachable, timeout, 5xx, bad response
   */
  constructor(kind, message, { table = null, http_status = null, code = null } = {}) {
    super(message)
    this.name = 'CatalogError'
    this.kind = kind
    this.table = table
    this.http_status = http_status
    this.code = code
  }
}

function classify(status, code) {
  if (status === 401 || status === 403 || code === '42501') return 'not_public'
  if (status === 404 || code === 'PGRST205' || code === '42P01') return 'not_public'
  if (code === '42703' || code === 'PGRST204') return 'schema'
  return 'network'
}

/** PostgREST in.() list of identifier-shaped values, quoted defensively. */
export function inList(values) {
  return `in.(${values.map((v) => `"${String(v).replace(/["\\,()]/g, '')}"`).join(',')})`
}

export class CatalogClient {
  /** cfg: { origin, key, tables } from parseCatalogConfig. */
  constructor(cfg, { fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS, maxBytes = MAX_RESPONSE_BYTES } = {}) {
    this.origin = cfg.origin
    this.key = cfg.key
    this.tables = cfg.tables
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
    this.maxBytes = maxBytes
    /** @type {Array<{table:string,status:number|null,rows:number|null,code:string|null,at:string}>} */
    this.evidence = []
  }

  table(logical) {
    const t = this.tables[logical]
    if (!t) throw new CatalogError('schema', `unknown catalog table ${logical}`)
    return t
  }

  record(entry) {
    this.evidence.push({ ...entry, at: new Date().toISOString() })
    if (this.evidence.length > 200) this.evidence.shift()
  }

  /** One GET. Returns the parsed JSON array. */
  async getOnce(logical, params) {
    const table = this.table(logical)
    const url = new URL(`/rest/v1/${table}?${new URLSearchParams(params).toString()}`, this.origin)
    if (url.origin !== this.origin) throw new CatalogError('network', 'refusing a request to a different origin', { table: logical })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    let res
    try {
      res = await this.fetchImpl(url.toString(), {
        method: 'GET',
        redirect: 'error',
        credentials: 'omit',
        signal: controller.signal,
        headers: { apikey: this.key, accept: 'application/json', 'accept-profile': 'public' },
      })
    } catch (e) {
      clearTimeout(timer)
      this.record({ table: logical, status: null, rows: null, code: e?.name === 'AbortError' ? 'timeout' : 'unreachable' })
      throw new CatalogError('network', e?.name === 'AbortError' ? 'the catalog request timed out' : 'the catalog could not be reached', { table: logical })
    }
    try {
      const text = await readCappedText(res, this.maxBytes)
      if (text === null) throw new CatalogError('network', 'the catalog response is too large', { table: logical, http_status: res.status })
      let body = null
      try {
        body = text ? JSON.parse(text) : null
      } catch {
        body = null
      }
      if (!res.ok) {
        const code = body && typeof body.code === 'string' && PG_CODE.test(body.code) ? body.code : null
        this.record({ table: logical, status: res.status, rows: null, code })
        const kind = classify(res.status, code)
        throw new CatalogError(kind, `the catalog answered HTTP ${res.status}${code ? ` (${code})` : ''} for ${logical}`, { table: logical, http_status: res.status, code })
      }
      if (!Array.isArray(body)) {
        this.record({ table: logical, status: res.status, rows: null, code: 'not_a_list' })
        throw new CatalogError('network', `the catalog returned a non-list for ${logical}`, { table: logical, http_status: res.status })
      }
      this.record({ table: logical, status: res.status, rows: body.length, code: null })
      return body
    } finally {
      clearTimeout(timer)
    }
  }

  /** Paged GET (limit/offset) until a short page. */
  async get(logical, params) {
    const rows = []
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await this.getOnce(logical, { ...params, limit: String(PAGE), offset: String(page * PAGE) })
      rows.push(...body)
      if (body.length < PAGE) return rows
    }
    throw new CatalogError('network', `more than ${PAGE * MAX_PAGES} ${logical} rows`, { table: logical })
  }

  /** GET with column fallbacks: try each select list until one is not a schema error. */
  async getWithFallback(logical, selects, params) {
    let last = null
    for (const select of selects) {
      try {
        return { rows: await this.get(logical, { select, ...params }), select }
      } catch (e) {
        if (!(e instanceof CatalogError) || e.kind !== 'schema') throw e
        last = e
      }
    }
    throw last
  }
}
