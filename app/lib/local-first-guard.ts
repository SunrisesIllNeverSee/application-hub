// Local-first server write boundary (LF-25).
//
// When AQUA_LOCAL_FIRST=1 (or 'true'), private content — answer bodies and
// other private user text — must stay on the user's device. Server routes
// that persist private content FAIL CLOSED with an honest 403 refusal.
// Public/catalog reads, auth, and non-private metadata writes keep working.
//
// Authority: aquarnd/aqua-canon/Planning/Execution/m06/local-first/
//   LF-Architecture-Contract.md + LF-Private-Data-Flow-Inventory.csv
//
// FLAG PAIRING (required): server routes gate on AQUA_LOCAL_FIRST; direct
// client→Supabase writes (e.g. AnswerEditor upserts) gate on
// NEXT_PUBLIC_AQUA_LOCAL_FIRST. A deployment enabling local-first MUST set
// both — route guards cannot intercept direct client writes. Durable
// backstop = a server-side RLS policy decision; tracked as an owner item in
// the M06 authorization package (Out-of-code boundary).
//
// Deliberately dependency-free (no next/server import) so this module can be
// unit-tested directly with `node --test` (type stripping) and reused by any
// route handler. `Response.json` is the standard Web API and is fully
// supported inside Next.js route handlers.

export const LOCAL_FIRST_REFUSAL_MESSAGE =
  'local-first mode: private content stays on device'

/**
 * True when the deployment is running in local-first mode.
 * Server-side flag: AQUA_LOCAL_FIRST=1 (also accepts 'true').
 */
export function isLocalFirst(): boolean {
  const v = process.env.AQUA_LOCAL_FIRST?.trim().toLowerCase()
  return v === '1' || v === 'true'
}

/**
 * Standard honest refusal payload for private-content writes under local-first.
 */
export function privateWriteRefusal(extra?: Record<string, unknown>) {
  return { error: LOCAL_FIRST_REFUSAL_MESSAGE, local_first: true, ...extra }
}

/**
 * 403 Response for a private-content write attempted under local-first mode.
 * Returns null when the flag is off so callers can do:
 *
 *   const refusal = refusePrivateWrite()
 *   if (refusal) return refusal
 */
export function refusePrivateWrite(extra?: Record<string, unknown>): Response | null {
  if (!isLocalFirst()) return null
  return Response.json(privateWriteRefusal(extra), { status: 403 })
}

/**
 * F-B7 field-level gate for mixed routes: structured/account metadata writes
 * stay permitted under local-first, but named free-text fields that carry
 * user-private content refuse honestly. Field-level (not keyword) — the
 * check is on the payload SHAPE, never the text content.
 *
 * A field "carries text" when present with a non-null value; an empty
 * string and an explicit null (clearing a stored value) are allowed.
 *
 * Returns null when the flag is off or none of the fields carry text, so
 * callers can do:
 *
 *   const refusal = refusePrivateTextFields(body, ['outcome_notes'])
 *   if (refusal) return refusal
 */
export function refusePrivateTextFields(
  body: Record<string, unknown>,
  fields: string[],
  extra?: Record<string, unknown>,
): Response | null {
  if (!isLocalFirst()) return null
  const refused = fields.filter((f) => {
    const v = body[f]
    if (v == null) return false
    if (typeof v === 'string') return v.trim().length > 0
    return true
  })
  if (refused.length === 0) return null
  return Response.json(
    privateWriteRefusal({
      detail: `free-text field(s) stay on your device in local-first mode: ${refused.join(', ')}`,
      refused_fields: refused,
      ...extra,
    }),
    { status: 403 },
  )
}
