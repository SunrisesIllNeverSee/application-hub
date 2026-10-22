import { handlePublish } from '@/lib/catalog-promotion/handlers'
import { routeDeps } from '@/lib/catalog-promotion/deps'

// ============================================================
// POST /api/catalog/candidates/[id]/publish — curator publish (M09 W3)
// ============================================================
// Curator only. No body. One call to catalog_publish_candidate(candidate_id,
// curator_id): entity, canonical program, cycle, canonical questions,
// occurrences (exact asked_as + requirements), mapping decisions, a NEW
// template revision (prior occurrences never rewritten), serials and the
// 'published' event in one transaction.
// Response: 200 { published: { program_id, program_slug, program_serial,
//   entity_id, entity_serial, cycle_id, revision_id, revision, new_program,
//   new_entity, occurrences_created, occurrences_carried,
//   occurrences_retired, canonical_created } }
// Errors: 401, 403, 404, 409 not_approved, 422 rule_violation | duplicate |
//         missing_reference | invalid_payload, 503.
// ============================================================

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return handlePublish(req, routeDeps(), id)
}
