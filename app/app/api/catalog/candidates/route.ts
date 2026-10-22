import { handleList, handleSubmit } from '@/lib/catalog-promotion/handlers'
import { routeDeps } from '@/lib/catalog-promotion/deps'

// ============================================================
// /api/catalog/candidates — public catalog contribution intake (M09 W3)
// ============================================================
// POST  (authenticated) submit a PUBLIC application template candidate.
//   Request:  { payload: CandidatePayload,
//               source: { url, capture_method: 'url_fetch'|'public_paste'|'public_file'|'curator_upload'(curators),
//                         final_url?, snapshot_text? } }
//   url_fetch: the server fetches the URL itself (SSRF-guarded), ignores any
//   client snapshot, and stores final_url, raw-content sha256, reuse +
//   signals, fetched_at and a bounded public-only snapshot; refused (422)
//   when the page disallows reuse. Other methods are client-supplied
//   evidence and are labeled lower-trust in checks.
//   Response: 201 { candidate: { id, state, submitted_at, source_id },
//                   source: { capture_method, trust, reuse } }
//   Errors: 400 invalid_candidate {errors:[{path,code}]}, 401, 413, 422
//           source_fetch_failed|source_reuse_disallowed|source_final_url_not_public, 429, 503.
// GET   (authenticated) own candidates; curators see all.
//   Query: ?state=<state>&limit=<1..100>  Response: { is_curator, candidates: [...] }
// 503 { error: 'catalog_promotion_unavailable' } until migration 058 exists.
// Handlers: lib/catalog-promotion/handlers.ts (unit-tested with fakes).
// ============================================================

export const POST = (req: Request) => handleSubmit(req, routeDeps())
export const GET = (req: Request) => handleList(req, routeDeps())
