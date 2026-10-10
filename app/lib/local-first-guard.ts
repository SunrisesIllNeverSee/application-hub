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
  const v = process.env.AQUA_LOCAL_FIRST
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
