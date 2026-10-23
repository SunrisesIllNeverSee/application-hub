---
type: Reference
title: Local-first flags (server guard and client write gate)
description: How AQUA_LOCAL_FIRST and NEXT_PUBLIC_AQUA_LOCAL_FIRST resolve in dev, preview, self-hosted and Vercel production builds; both sides fail closed in production builds and the build refuses a mismatched pair.
tags: [local-first, deployment, privacy, configuration]
timestamp: 2026-10-22
---

# Local-first flags

Two flags decide whether private answer text may leave the device.

| Flag | Gates | Code |
|---|---|---|
| `AQUA_LOCAL_FIRST` | Server routes that would persist private text. Under local-first they refuse with a 403. | `app/lib/local-first-guard.ts` (`isLocalFirst`) |
| `NEXT_PUBLIC_AQUA_LOCAL_FIRST` | Direct browser writes to Supabase (for example `AnswerEditor` upserts) and the vault surfaces (`/aqua-local`, `/history`). | `app/lib/aqua-local-client/flag.ts` (`LOCAL_FIRST`) |

Values: `1` or `true` means on, and `0` or `false` means off. Anything else, including unset, falls back to the default below.

## Defaults: both sides fail closed in production builds

| Where it runs | Unset server flag | Unset client flag |
|---|---|---|
| `next dev`, unit tests | off (legacy) | off (legacy) |
| Any `next build` (`NODE_ENV=production`): Vercel previews, self-hosted `next start` | **on** | **on** |
| Vercel production (`VERCEL_ENV=production`) | build refuses: set both explicitly | build refuses: set both explicitly |

- The server reads `NODE_ENV` and `VERCEL_ENV` at runtime.
- The client reads `NODE_ENV`, which `next build` inlines into every bundle.
- In a production build, `next.config.mjs` also sets the inlined `NEXT_PUBLIC_AQUA_LOCAL_FIRST` to `1` when it is unset, so the bundle carries an explicit value.

Before this change, a preview or self-hosted production build with neither flag set had a closed server and an open client. Server routes refused private writes, but the browser wrote answer bodies straight to `profile_answers`. If the preview used the production Supabase project, private answers landed server-side. Both sides now resolve to the same effective value.

## Build-time pairing check

`next.config.mjs` calls `resolveLocalFirstBuildFlags` (`app/lib/local-first-build.mjs`). The build fails when:

- the effective server and client values differ, for example `AQUA_LOCAL_FIRST=0` with the client flag unset in a production build (unset means on);
- `VERCEL_ENV=production` and either flag is unset.

To opt a deployment out of local-first, set **both** flags to `0`.

Tests: `app/tests/local-first-guard.test.mjs`, which covers the server guard, the client flag and the build resolver.
