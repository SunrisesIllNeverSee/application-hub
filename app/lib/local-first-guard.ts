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
 *
 * FAIL CLOSED (M09 hardening H1): a production runtime — VERCEL_ENV=production,
 * or NODE_ENV=production — is local-first unless the flag is EXPLICITLY
 * '0'/'false'. A missing or junk value in production can therefore never
 * silently re-open the legacy hosted private-write routes. Outside production
 * (dev, tests, previews) an unset flag keeps the legacy default (off).
 */
export function isLocalFirst(env: Record<string, string | undefined> = process.env): boolean {
  const v = env.AQUA_LOCAL_FIRST?.trim().toLowerCase()
  if (v === '1' || v === 'true') return true
  if (v === '0' || v === 'false') return false
  return isProductionRuntime(env)
}

/** VERCEL_ENV=production, or NODE_ENV=production. */
export function isProductionRuntime(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV?.trim() === 'production' || env.NODE_ENV?.trim() === 'production'
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

/**
 * F-B7/FB7R-01 — public-program URL sanitized for hosted storage under
 * local-first. The url/program_url field is itself a free-text channel
 * (`?essay=<private text>` would persist verbatim into import_queue), so
 * under the flag the stored/dedupe URL keeps only scheme+host+path:
 * query and fragment are stripped, and URLs carrying embedded credentials
 * (userinfo) refuse outright — they are private content by definition.
 *
 * Flag-off callers keep the legacy full-URL behavior — this helper is only
 * invoked on the local-first path.
 *
 * Returns { url } on success, or { refuse: Response } for userinfo URLs.
 */
export function publicUrlForLocalFirstStorage(
  raw: string,
): { url: string; refuse?: never } | { url?: never; refuse: Response } {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { refuse: Response.json({ error: 'invalid URL' }, { status: 400 }) }
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return {
      refuse: Response.json(
        privateWriteRefusal({
          detail: 'URLs with embedded credentials are not accepted in local-first mode',
          refused_fields: ['url'],
        }),
        { status: 403 },
      ),
    }
  }
  parsed.search = ''
  parsed.hash = ''
  return { url: parsed.toString() }
}
