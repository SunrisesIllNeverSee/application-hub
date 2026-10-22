import { handleTransition } from '@/lib/catalog-promotion/handlers'
import { routeDeps } from '@/lib/catalog-promotion/deps'

// ============================================================
// POST /api/catalog/candidates/[id]/transition — curator review step (M09 W3)
// ============================================================
// Curator only. Request:
//   { to: 'matched'|'verified'|'approved'|'rejected',
//     note?: string,                       // required for rejected; >=10 chars for an override
//     override?: boolean,                  // verified despite failing checks (needs note)
//     program_match_id?: uuid|null,        // candidate revises this canonical program (null clears)
//     source_review?: { reuse?, robots_disallow?, verification_status? },
//     mappings?: [{ index, canonical_question_id: uuid|null, tier?, rationale? }] }
// Checks are re-run on the final payload; then ONE call to
// catalog_transition_candidate writes source review, program match, payload
// (auto exact/normalized matches + curator mappings), checks and the event
// atomically. Approval by the submitter is allowed and recorded
// (self_approved).
// Response: { candidate: { id, state }, self_approved, checks }
// Errors: 401, 403, 404, 409 illegal_transition|stale_state|payload_frozen,
//         422 checks_failed (with checks), 503 catalog_promotion_unavailable.
// ============================================================

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return handleTransition(req, routeDeps(), id)
}
