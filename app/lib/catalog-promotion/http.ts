// HTTP helpers shared by the catalog-promotion handlers. Pure (no Next.js,
// no Supabase runtime import) so the handlers run under node --test.

import type { SupabaseClient } from '@supabase/supabase-js'
import { CATALOG_UNAVAILABLE, isCatalogSchemaMissing, mapCatalogDbError } from './errors.ts'

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const unavailable = () => json({ error: CATALOG_UNAVAILABLE }, 503)

export function dbError(err: { code?: string | null; message?: string | null } | null | undefined) {
  const m = mapCatalogDbError(err)
  // Log the SQLSTATE only — never request bodies or row contents.
  if (m.status >= 500 && m.status !== 503) console.error('[catalog] db error', err?.code ?? 'unknown')
  return json({ error: m.error }, m.status)
}

/** 'unavailable' when 058 is not applied yet. */
export async function isCatalogCurator(admin: SupabaseClient, userId: string): Promise<boolean | 'unavailable'> {
  const { data, error } = await admin.from('catalog_curators').select('user_id').eq('user_id', userId).maybeSingle()
  if (error) return isCatalogSchemaMissing(error) ? 'unavailable' : false
  return !!data
}

export async function readJsonBody(req: Request, maxBytes: number): Promise<{ ok: true; body: unknown } | { ok: false; status: number; error: string }> {
  const len = Number(req.headers.get('content-length') ?? '0')
  if (len > maxBytes) return { ok: false, status: 413, error: 'payload_too_large' }
  let text: string
  try { text = await req.text() } catch { return { ok: false, status: 400, error: 'invalid_body' } }
  if (text.length > maxBytes) return { ok: false, status: 413, error: 'payload_too_large' }
  try { return { ok: true, body: JSON.parse(text) } } catch { return { ok: false, status: 400, error: 'invalid_json' } }
}

export const CANDIDATE_COLUMNS =
  'id, state, submitted_by, submitted_at, updated_at, source_id, payload, checks, program_match_id, published_revision_id'
export const SOURCE_COLUMNS =
  'id, url, final_url, capture_method, captured_at, content_sha256, reuse, robots_disallow, last_checked_at, verification_status, fetched_at, reuse_signals, snapshot_sha256'
