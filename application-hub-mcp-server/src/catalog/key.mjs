// Public catalog configuration and key checks. Shared by the stdio server
// and the hosted /mcp route (vendored into app/app/mcp/_vendor/), so this
// module uses web-standard APIs only (no node: imports).
//
// The only credential this package ever holds is the PUBLIC publishable
// (anon) key, the same key the AQUA web app ships to every browser. Any
// other role is refused before a single request is made.

export class KeyRefusal extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'KeyRefusal'
    this.code = code
  }
}

export class ConfigError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ConfigError'
  }
}

/** Decode a JWT payload without verifying it (we only read the role claim). */
function jwtPayload(key) {
  const parts = key.split('.')
  if (parts.length !== 3) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

/**
 * Classify a Supabase key. Returns { kind: 'publishable' | 'anon_jwt' } for a
 * public key and throws KeyRefusal for anything else: secret keys, JWTs with
 * a role other than "anon" (service-role keys included), JWTs without a role,
 * and unrecognized formats. The key itself never appears in the message.
 */
export function assertAnonKey(key) {
  if (typeof key !== 'string' || !key.trim()) throw new KeyRefusal('missing_key', 'No publishable key is configured.')
  const k = key.trim()
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(k)) return { kind: 'publishable' }
  if (/^sb_secret_/i.test(k)) throw new KeyRefusal('secret_key', 'Refusing to start: the configured key is a Supabase SECRET key. Only the public publishable (anon) key may be used.')
  const payload = jwtPayload(k)
  if (payload && typeof payload === 'object') {
    const role = payload.role
    if (role === 'anon') return { kind: 'anon_jwt' }
    if (role === 'service_role') throw new KeyRefusal('service_role_key', 'Refusing to start: the configured key carries role "service_role". This server never uses a service-role key; configure the public publishable (anon) key.')
    if (typeof role === 'string') throw new KeyRefusal('wrong_role', `Refusing to start: the configured key carries role "${role.slice(0, 40)}". Only the public anon / publishable key is accepted.`)
    throw new KeyRefusal('wrong_role', 'Refusing to start: the configured key has no role claim. Only the public anon / publishable key is accepted.')
  }
  throw new KeyRefusal('unrecognized_key', 'Refusing to start: the configured key is not a recognizable publishable (sb_publishable_…) or anon JWT key.')
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/** Validate a Supabase project URL and return its origin. */
export function catalogOrigin(raw) {
  let u
  try {
    u = new URL(String(raw))
  } catch {
    throw new ConfigError('supabase_url is not a URL')
  }
  if (u.username || u.password) throw new ConfigError('supabase_url must not contain credentials')
  if (u.protocol === 'http:' && !LOOPBACK.has(u.hostname)) throw new ConfigError('supabase_url must use https (plain http only for localhost)')
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new ConfigError('supabase_url must use https')
  if (u.pathname !== '/' && u.pathname !== '') throw new ConfigError('supabase_url must be the project origin only (https://<ref>.supabase.co)')
  if (u.search || u.hash) throw new ConfigError('supabase_url must not carry a query or fragment')
  return u.origin
}

export const DEFAULT_TABLES = Object.freeze({
  programs: 'programs',
  program_cycles: 'program_cycles',
  program_questions: 'program_questions',
  archived_questions: 'archived_questions',
  program_dna: 'program_dna',
  program_stats: 'program_stats',
  acceptance_reports: 'acceptance_reports',
})

const TABLE_NAME = /^[a-z_][a-z0-9_]{0,62}$/

function isPlaceholder(v) {
  return typeof v !== 'string' || !v.trim() || /YOUR-PROJECT|REPLACE[-_ ]?WITH|<|>/i.test(v)
}

/**
 * Normalize a catalog config object:
 *   { version, supabase_url, publishable_key, tables: { programs, program_cycles, program_questions, archived_questions } }
 * (the shape served at https://aquaidp.xyz/.well-known/aqua-catalog.json).
 * Returns { origin, key, key_kind, tables }. Throws ConfigError for a bad
 * shape and KeyRefusal for a non-public key. `remote`: the config came over
 * the network (origin pinned to https://<ref>.supabase.co, tables ignored).
 */
export function parseCatalogConfig(obj, { remote = false } = {}) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new ConfigError('catalog config is not a JSON object')
  if (isPlaceholder(obj.supabase_url) || isPlaceholder(obj.publishable_key)) throw new ConfigError('catalog config still has placeholder values')
  const origin = catalogOrigin(obj.supabase_url)
  // A config fetched over the network may only point at a Supabase project
  // over https and may not rename tables; local files and env are the user's choice.
  if (remote && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(origin)) throw new ConfigError('a remote catalog config must name an https://<ref>.supabase.co project')
  const { kind } = assertAnonKey(obj.publishable_key)
  const tables = { ...DEFAULT_TABLES }
  if (obj.tables !== undefined && !remote) {
    if (!obj.tables || typeof obj.tables !== 'object' || Array.isArray(obj.tables)) throw new ConfigError('catalog config "tables" must be an object')
    for (const [logical, name] of Object.entries(obj.tables)) {
      if (!(logical in DEFAULT_TABLES)) continue
      if (typeof name !== 'string' || !TABLE_NAME.test(name)) throw new ConfigError(`catalog config table name for ${logical} is not a plain identifier`)
      tables[logical] = name
    }
  }
  return { origin, key: obj.publishable_key.trim(), key_kind: kind, tables }
}
