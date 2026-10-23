// Build-time local-first flag rules (IR-015, M09 hardening H1, M09 review
// M4). Pure module (no Next imports) so next.config.mjs and node tests share
// one rule. See docs/LOCAL-FIRST-FLAGS.md.
//
//   AQUA_LOCAL_FIRST              server route guard (lib/local-first-guard.ts)
//   NEXT_PUBLIC_AQUA_LOCAL_FIRST  client write gate (lib/aqua-local-client/flag.ts)
//
// A production build is NODE_ENV=production (every `next build`, so Vercel
// previews and self-hosted `next start` too) or VERCEL_ENV=preview|production.
// In a production build an UNSET flag means ON for both sides (fail closed);
// only an explicit '0'/'false' opts out. The effective server and client
// values must agree, or the build fails: a server that refuses private
// writes while the browser writes them straight to Supabase is the gap this
// closes.

/** 'on' | 'off' | 'unset' ('unset' also covers junk values). */
export function flagState(v) {
  const s = (v ?? '').trim().toLowerCase()
  if (s === '1' || s === 'true') return 'on'
  if (s === '0' || s === 'false') return 'off'
  return 'unset'
}

export function isProductionBuild(env) {
  const vercel = (env.VERCEL_ENV ?? '').trim()
  return (env.NODE_ENV ?? '').trim() === 'production' || vercel === 'production' || vercel === 'preview'
}

/**
 * Resolve the effective flags for a build, or throw on a mismatch.
 * Returns `defaults`: env assignments next.config.mjs applies so the
 * inlined NEXT_PUBLIC value is explicit in production bundles.
 */
export function resolveLocalFirstBuildFlags(env) {
  const prod = isProductionBuild(env)
  const server = flagState(env.AQUA_LOCAL_FIRST)
  const client = flagState(env.NEXT_PUBLIC_AQUA_LOCAL_FIRST)
  const effective = (s) => s === 'on' || (s === 'unset' && prod)
  const serverOn = effective(server)
  const clientOn = effective(client)
  if (serverOn !== clientOn) {
    throw new Error(
      `local-first flag mismatch: AQUA_LOCAL_FIRST=${env.AQUA_LOCAL_FIRST ?? '<unset>'} ` +
        `but NEXT_PUBLIC_AQUA_LOCAL_FIRST=${env.NEXT_PUBLIC_AQUA_LOCAL_FIRST ?? '<unset>'}` +
        (prod ? ' (production build: unset means ON)' : '') +
        '. Set BOTH to the same value — a mismatched pair leaves private client writes ungated.',
    )
  }
  // Vercel production must be configured explicitly, never by default.
  if ((env.VERCEL_ENV ?? '').trim() === 'production' && (server === 'unset' || client === 'unset')) {
    throw new Error(
      'local-first is ON by default in production (server guard fails closed). ' +
        'Set AQUA_LOCAL_FIRST=1 and NEXT_PUBLIC_AQUA_LOCAL_FIRST=1, or explicitly opt BOTH out with 0.',
    )
  }
  const defaults = {}
  if (prod && client === 'unset') defaults.NEXT_PUBLIC_AQUA_LOCAL_FIRST = '1'
  return { production: prod, serverOn, clientOn, defaults }
}
