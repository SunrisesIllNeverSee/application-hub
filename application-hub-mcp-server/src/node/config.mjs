// Where the stdio server gets its public catalog config, in order:
//   1. --catalog-config <file or https URL>
//   2. AQUA_SUPABASE_URL + AQUA_PUBLISHABLE_KEY
//   3. AQUA_CATALOG_CONFIG_URL (https URL)
//   4. AQUA_CATALOG_CONFIG (local JSON file; same format as aqua-companion's config/public-catalog.json)
//   5. https://aquaidp.xyz/.well-known/aqua-catalog.json (skipped with --offline or AQUA_CATALOG_OFFLINE=1)
// A config fetched over the network must name an https://<ref>.supabase.co
// project and cannot rename tables. A config that names a non-public key throws KeyRefusal: the caller exits
// before serving anything. A missing or unreachable config is not fatal:
// the server starts and the catalog tools answer catalog_not_configured.

import fs from 'node:fs'
import path from 'node:path'
import { ConfigError, KeyRefusal, parseCatalogConfig } from '../catalog/key.mjs'
import { readCappedText } from '../catalog/rest.mjs'

export const DEFAULT_CONFIG_URL = 'https://aquaidp.xyz/.well-known/aqua-catalog.json'
const MAX_CONFIG_BYTES = 64 * 1024
const CONFIG_TIMEOUT_MS = 5000
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

const isUrl = (s) => /^https?:\/\//i.test(s)

async function fetchConfig(url, fetchImpl) {
  let u
  try {
    u = new URL(url)
  } catch {
    throw new ConfigError('the catalog config URL is not a URL')
  }
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && LOOPBACK.has(u.hostname))) throw new ConfigError('the catalog config URL must use https')
  if (u.username || u.password) throw new ConfigError('the catalog config URL must not contain credentials')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS)
  try {
    const res = await fetchImpl(u.toString(), { method: 'GET', redirect: 'error', credentials: 'omit', signal: controller.signal, headers: { accept: 'application/json' } })
    if (!res.ok) throw new ConfigError(`the catalog config URL answered HTTP ${res.status}`)
    const t = await readCappedText(res, MAX_CONFIG_BYTES)
    if (t === null) throw new ConfigError('the catalog config is too large')
    try {
      return JSON.parse(t)
    } catch {
      throw new ConfigError('the catalog config URL did not return JSON')
    }
  } catch (e) {
    if (e instanceof ConfigError) throw e
    throw new ConfigError(e?.name === 'AbortError' ? 'the catalog config URL timed out' : 'the catalog config URL could not be reached')
  } finally {
    clearTimeout(timer)
  }
}

function readConfigFile(file, cwd) {
  const abs = path.resolve(cwd, file)
  let raw
  try {
    const st = fs.statSync(abs)
    if (!st.isFile() || st.size > MAX_CONFIG_BYTES) throw new Error('x')
    raw = fs.readFileSync(abs, 'utf8')
  } catch {
    throw new ConfigError(`no readable catalog config file at ${abs}`)
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new ConfigError(`the catalog config file ${abs} is not JSON`)
  }
}

/**
 * Returns { configured: true, cfg, source } or { configured: false, reason, source }.
 * Throws KeyRefusal when any source names a non-public key.
 */
export async function resolveCatalogConfig({ flags = {}, env = {}, cwd = process.cwd(), fetchImpl = globalThis.fetch } = {}) {
  let source
  let load
  let remote = false
  if (flags['catalog-config']) {
    const v = String(flags['catalog-config'])
    source = isUrl(v) ? `url:${v}` : `file:${v}`
    remote = isUrl(v)
    load = () => (isUrl(v) ? fetchConfig(v, fetchImpl) : readConfigFile(v, cwd))
  } else if (env.AQUA_SUPABASE_URL || env.AQUA_PUBLISHABLE_KEY) {
    source = 'env:AQUA_SUPABASE_URL'
    load = async () => ({ supabase_url: env.AQUA_SUPABASE_URL, publishable_key: env.AQUA_PUBLISHABLE_KEY })
  } else if (env.AQUA_CATALOG_CONFIG_URL) {
    source = `url:${env.AQUA_CATALOG_CONFIG_URL}`
    remote = true
    load = () => fetchConfig(env.AQUA_CATALOG_CONFIG_URL, fetchImpl)
  } else if (env.AQUA_CATALOG_CONFIG) {
    source = `file:${env.AQUA_CATALOG_CONFIG}`
    load = () => readConfigFile(env.AQUA_CATALOG_CONFIG, cwd)
  } else if (flags.offline || ['1', 'true'].includes(String(env.AQUA_CATALOG_OFFLINE ?? '').toLowerCase())) {
    return { configured: false, reason: 'offline: no catalog config source', source: 'offline' }
  } else {
    source = `url:${DEFAULT_CONFIG_URL}`
    remote = true
    load = () => fetchConfig(DEFAULT_CONFIG_URL, fetchImpl)
  }
  let raw
  try {
    raw = await load()
  } catch (e) {
    if (e instanceof ConfigError) return { configured: false, reason: e.message, source }
    throw e
  }
  try {
    return { configured: true, cfg: parseCatalogConfig(raw, { remote }), source }
  } catch (e) {
    if (e instanceof KeyRefusal) throw e
    if (e instanceof ConfigError) return { configured: false, reason: e.message, source }
    throw e
  }
}
