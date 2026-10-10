// Client-side local-first flag (IN-01). Single source of truth for the
// NEXT_PUBLIC flag so every client surface gates identically.
//
// NOTE: local-first deployment must set BOTH AQUA_LOCAL_FIRST (server
// routes, see lib/local-first-guard.ts) and NEXT_PUBLIC_AQUA_LOCAL_FIRST
// (direct client→Supabase writes + client vault surfaces). Setting only
// the server flag leaves client writes ungated.

export const LOCAL_FIRST = ['1', 'true'].includes(
  (process.env.NEXT_PUBLIC_AQUA_LOCAL_FIRST ?? '').trim().toLowerCase(),
)
