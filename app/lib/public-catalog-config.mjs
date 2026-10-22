// M09b B1.5 — the public catalog configuration published at
// /.well-known/aqua-catalog.json. Pure module (no Next imports) so the route,
// next.config.mjs (build-time assertion) and node tests share one rule:
//
//   ONLY the public publishable / anon key may ever be published.
//   `sb_secret_…` keys and any JWT whose role is not `anon` (above all
//   `service_role`) are refused outright.
//
// The publishable key is public by design: it is the same value the web app
// ships to every browser as NEXT_PUBLIC_SUPABASE_ANON_KEY, and row-level
// security limits what it can read (canonical catalog rows only).

export const CATALOG_CONFIG_VERSION = 1

export const CATALOG_TABLES = Object.freeze({
  programs: 'programs',
  program_cycles: 'program_cycles',
  program_questions: 'program_questions',
  archived_questions: 'archived_questions',
})

export class PublishableKeyError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'PublishableKeyError'
    this.code = code
  }
}

function jwtRole(key) {
  const parts = key.split('.')
  if (parts.length !== 3) return undefined
  try {
    const json = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    return json && typeof json === 'object' ? (json.role ?? null) : null
  } catch {
    return null
  }
}

/**
 * Throws PublishableKeyError unless `key` is a publishable (`sb_publishable_…`)
 * key or an anon-role JWT. Returns the key kind ('publishable' | 'anon_jwt').
 * The thrown message never echoes the key.
 */
export function assertPublishableKey(key) {
  if (typeof key !== 'string' || !key.trim()) throw new PublishableKeyError('no publishable key configured', 'missing')
  const k = key.trim()
  if (/^sb_secret_/i.test(k)) throw new PublishableKeyError('refusing a Supabase SECRET key: only the publishable (anon) key may be published', 'secret_key')
  if (/service[_-]?role/i.test(k)) throw new PublishableKeyError('refusing a service-role-shaped key', 'service_role')
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(k)) return 'publishable'
  const role = jwtRole(k)
  if (role === undefined) throw new PublishableKeyError('the key is neither a publishable key nor a JWT', 'unrecognized')
  if (role === 'service_role') throw new PublishableKeyError('refusing a service_role JWT: only the anon key may be published', 'service_role')
  if (role !== 'anon') throw new PublishableKeyError(`refusing a JWT with role "${role ?? 'unknown'}": only the anon key may be published`, 'wrong_role')
  return 'anon_jwt'
}

/** True when the value is unset or an obvious build placeholder. */
export function isPlaceholderValue(v) {
  return typeof v !== 'string' || !v.trim() || /placeholder|YOUR-PROJECT|REPLACE[-_ ]?WITH|dummy|^<.*>$/i.test(v) || /placeholder\.supabase\.co/i.test(v)
}

/** https origin of the Supabase project, or null when unusable. */
export function supabaseOrigin(url) {
  try {
    const u = new URL(String(url))
    if (u.protocol !== 'https:' || u.username || u.password) return null
    return u.origin
  } catch {
    return null
  }
}

/**
 * Build the /.well-known/aqua-catalog.json body from public env values.
 * Returns { ok: true, body } or { ok: false, status, body } (503 when not
 * configured, 500 when a non-publishable key is configured).
 */
export function buildCatalogConfig(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (isPlaceholderValue(url) || isPlaceholderValue(key) || !supabaseOrigin(url)) {
    return {
      ok: false,
      status: 503,
      body: {
        error: 'catalog_not_configured',
        message: 'This deployment has no public catalog endpoint configured. Agents can keep working on a cached catalog; try again later.',
        version: CATALOG_CONFIG_VERSION,
      },
    }
  }
  try {
    assertPublishableKey(key)
  } catch (e) {
    return {
      ok: false,
      status: 500,
      body: { error: 'catalog_key_refused', message: e instanceof PublishableKeyError ? e.message : 'key refused', version: CATALOG_CONFIG_VERSION },
    }
  }
  return {
    ok: true,
    body: {
      version: CATALOG_CONFIG_VERSION,
      supabase_url: supabaseOrigin(url),
      publishable_key: key.trim(),
      tables: { ...CATALOG_TABLES },
      notes: [
        'Public, read-only catalog configuration for the AQUA companion and aqua-mcp-server.',
        'publishable_key is the public anon/publishable key the AQUA web app ships to every browser; row-level security limits it to approved canonical catalog rows. It is not a secret and grants no access to private answers.',
        'Clients must refuse any key whose role is not anon/publishable (never a secret or service_role key) and should fetch this file only from https://aquaidp.xyz.',
        'Use read-only GET requests to /rest/v1/<table>. Private answers never live in this project: they stay in the user\'s browser vault and local companion workspace.',
      ],
    },
  }
}
