/**
 * M09b B1.5 — public catalog configuration for local agents.
 *
 * GET /.well-known/aqua-catalog.json →
 *   { version, supabase_url, publishable_key, tables, notes }
 *
 * Built ONLY from the public env values the browser bundle already carries
 * (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). The key is
 * checked on every request and at build time (next.config.mjs): a secret or
 * service-role key is refused, never served.
 */
import { buildCatalogConfig } from '@/lib/public-catalog-config.mjs'

export const dynamic = 'force-dynamic'

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'X-Content-Type-Options': 'nosniff',
}

export async function GET() {
  const r = buildCatalogConfig(process.env)
  return new Response(`${JSON.stringify(r.body, null, 2)}\n`, {
    status: r.ok ? 200 : r.status,
    headers: {
      ...BASE_HEADERS,
      'Cache-Control': r.ok ? 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' : 'no-store',
    },
  })
}
