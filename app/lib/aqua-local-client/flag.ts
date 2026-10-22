// Client-side local-first flag (IN-01). Single source of truth for the
// NEXT_PUBLIC flag so every client surface gates identically.
//
// NOTE: local-first deployment must set BOTH AQUA_LOCAL_FIRST (server
// routes, see lib/local-first-guard.ts) and NEXT_PUBLIC_AQUA_LOCAL_FIRST
// (direct client→Supabase writes + client vault surfaces). next.config.mjs
// fails the build when the two disagree.
//
// FAIL CLOSED (M09 review M4), mirroring the server guard: in a production
// build (NODE_ENV=production, which `next build` inlines into every bundle,
// previews and self-hosted `next start` included) the client is local-first
// unless NEXT_PUBLIC_AQUA_LOCAL_FIRST is EXPLICITLY '0'/'false'. An unset
// or junk value can therefore never leave the browser writing private
// answer text straight to Supabase while the server routes refuse it.
// Outside production (next dev, unit tests) an unset flag keeps the legacy
// default (off). See docs/LOCAL-FIRST-FLAGS.md.

/**
 * Effective client flag. Pure: both inputs are parameters so tests can
 * exercise every case; the defaults are literal `process.env.X` reads so
 * Next.js inlines them at build time.
 */
export function clientLocalFirst(
  flag: string | undefined = process.env.NEXT_PUBLIC_AQUA_LOCAL_FIRST,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  const v = (flag ?? '').trim().toLowerCase()
  if (v === '1' || v === 'true') return true
  if (v === '0' || v === 'false') return false
  return (nodeEnv ?? '').trim() === 'production'
}

export const LOCAL_FIRST = clientLocalFirst()
