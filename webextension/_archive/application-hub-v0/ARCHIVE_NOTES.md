# Archive: application-hub v0

Archived: 2026-05-19
Reason: full rebuild

## What was here

- WXT 0.20.26 scaffold (Chrome MV3 + Firefox MV2 builds passing)
- Minimal popup skeleton (React, no real UI)
- background.ts stub
- Userscript: application-hub.user.js — textarea detection, answer bank panel, Supabase auth via session token
- Pinned @webext-core/fake-browser@1.3.4 (v1.4.0 was published broken)

## What worked

- npm run build — Chrome MV3 clean
- npm run build:firefox — Firefox MV2 clean
- addons-linter: 0 errors
- Userscript fully functional end-to-end (token from /profile/settings → Supabase query → fill field)

## Token endpoint

GET /api/auth/token — returns session access_token
UI: Profile → Settings → "Appfeeder Extension" section → Show session token
