// Error classification for catalog-promotion routes. Pure (node --test).

export const CATALOG_UNAVAILABLE = 'catalog_promotion_unavailable'

type PgLikeError = { code?: string | null; message?: string | null } | null | undefined

/**
 * True when the 058 schema is not present yet (production before the owner
 * applies the migration): PostgREST "table/function not in schema cache" or
 * Postgres undefined_table / undefined_function / undefined_object.
 */
export function isCatalogSchemaMissing(err: PgLikeError): boolean {
  if (!err) return false
  const code = err.code ?? ''
  if (['PGRST205', 'PGRST202', '42P01', '42883', '42704'].includes(code)) return true
  const msg = (err.message ?? '').toLowerCase()
  return (
    (msg.includes('does not exist') || msg.includes('could not find the')) &&
    (msg.includes('catalog_') || msg.includes('program_template_revisions') || msg.includes('question_mapping_decisions'))
  )
}

export type HttpMapping = { status: number; error: string }

/** Maps a database refusal from the 058 triggers/RPC to an HTTP answer. */
export function mapCatalogDbError(err: PgLikeError): HttpMapping {
  if (isCatalogSchemaMissing(err)) return { status: 503, error: CATALOG_UNAVAILABLE }
  switch (err?.code) {
    case '42501': return { status: 403, error: 'forbidden' }
    case '40001': return { status: 409, error: 'stale_state' }
    case '55000': return { status: 409, error: 'not_approved' }
    case '23514': return { status: 422, error: 'rule_violation' }
    case '23505': return { status: 422, error: 'duplicate' }
    case '23503': return { status: 422, error: 'missing_reference' }
    case '22023': return { status: 422, error: 'invalid_payload' }
    case 'P0002': return { status: 404, error: 'not_found' }
    default: return { status: 500, error: 'catalog_error' }
  }
}
