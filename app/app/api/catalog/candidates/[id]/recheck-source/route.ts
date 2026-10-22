import { handleRecheckSource } from '@/lib/catalog-promotion/handlers'
import { routeDeps } from '@/lib/catalog-promotion/deps'

// ============================================================
// POST /api/catalog/candidates/[id]/recheck-source — curator re-check (M09 W3)
// ============================================================
// Curator only; url_fetch sources only. Re-fetches the source URL with the
// same SSRF-guarded fetch and records the result on the source (evidence is
// never overwritten): unchanged digest keeps the status (failed/stale ->
// unverified), a changed digest marks it 'stale', a fetch failure marks it
// 'failed', and a reuse-disallow signal sets reuse='disallowed' (publish is
// then refused). Sets last_checked_at and last_check.
// Response: { source: { id, verification_status, reuse? }, last_check }
// Errors: 401, 403, 404, 409 recheck_requires_url_fetch|no_source, 503.
// ============================================================

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return handleRecheckSource(req, routeDeps(), id)
}
