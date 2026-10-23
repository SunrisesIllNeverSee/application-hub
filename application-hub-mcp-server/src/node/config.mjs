// Where the stdio server gets its public catalog config. There is ONE
// resolver for the companion and this server: aqua-companion's
// resolveCatalogConfig (src/catalog.mjs). This module only adapts its result
// to the shape this server's CatalogClient takes, so the two can never
// diverge. Order:
//   1. --catalog-config <file or https URL>
//   2. AQUA_SUPABASE_URL + AQUA_PUBLISHABLE_KEY
//   3. AQUA_CATALOG_CONFIG_URL (https URL)
//   4. AQUA_CATALOG_CONFIG (local JSON file; same format as aqua-companion's config/public-catalog.json)
//   5. the companion's bundled config when it holds real values
//   6. --offline / AQUA_CATALOG_OFFLINE=1: not configured
//   7. https://aquaidp.xyz/.well-known/aqua-catalog.json
// A config fetched over the network must name an https://<ref>.supabase.co
// project and cannot rename tables; its text is never put into messages. A
// config that names a non-public key throws KeyRefusal: the caller exits
// before serving anything. A missing or unreachable config is not fatal:
// the server starts and the catalog tools answer catalog_not_configured.

import { CatalogKeyRefusal, resolveCatalogConfig as resolveShared } from '../vendor/companion/src/catalog.mjs'
import { KeyRefusal } from '../catalog/key.mjs'

export const DEFAULT_CONFIG_URL = 'https://aquaidp.xyz/.well-known/aqua-catalog.json'

/**
 * Returns { configured: true, cfg: { origin, key, key_kind, tables }, source } or
 * { configured: false, reason, source }. Throws KeyRefusal when any source names a non-public key.
 */
export async function resolveCatalogConfig({ flags = {}, env = {}, cwd = process.cwd(), fetchImpl = globalThis.fetch } = {}) {
  let r
  try {
    r = await resolveShared({ flags, env, cwd }, { fetchImpl })
  } catch (e) {
    if (e instanceof CatalogKeyRefusal) {
      const code = e.role === 'service_role' ? 'service_role_key' : e.role === null ? 'unrecognized_key' : 'wrong_role'
      throw new KeyRefusal(code, `Refusing to start: ${e.message}`)
    }
    throw e
  }
  const source = r.source === 'file' || r.source === 'bundled' ? `file:${r.path ?? ''}` : r.source === 'env' ? 'env:AQUA_SUPABASE_URL' : r.source === 'offline' ? 'offline' : `url:${r.config_url ?? DEFAULT_CONFIG_URL}`
  if (!r.configured) return { configured: false, reason: r.reason, source }
  return { configured: true, cfg: { origin: r.origin, key: r.key, key_kind: r.key_kind === 'jwt' ? 'anon_jwt' : r.key_kind, tables: r.tables }, source }
}
