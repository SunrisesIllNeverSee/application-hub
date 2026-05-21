# WebExtension — Claude Context

Read this before editing anything in `webextension/`.

## Current reality

The live extension is plain JavaScript MV3 in:

- `/Users/dericmchenry/Desktop/application-hub/webextension/application-hub`

Do not treat the archived donor scaffold or older WXT notes as the active implementation.

## Product model

One extension, two operating modes:

- `Manual Assist`
  - detect fields
  - show matched bank answers
  - generate one field at a time
  - fill only on user click
  - export Markdown
  - save edited answers back to bank
- `Automation Assist`
  - capture full page/application into Canonical Hub
  - run Smart Matcher
  - bulk assist with coverage and fidelity gates
  - no auto-submit in this pass

Manual is the default lane. Automation is additive, not a replacement.

## Runtime surfaces

- `background.js` — orchestration layer and message bus
- `content.js` — DOM scan, fill, export, capture hooks, Safari fallback
- `sidepanel.html/js` — main UX
- `popup.html/js` — lightweight auth, status, mode, quick actions

## Message families

- `AUTH_*`
- `FIELDS_*`
- `MATCH_*`
- `GENERATE_*`
- `FILL_*`
- `CAPTURE_*`
- `EXPORT_*`
- `SMART_MATCHER_*`
- `CANONICAL_*`

Keep new work inside those families instead of inventing one-off message types.

## Storage keys

- `jwt`
- `hubUrl`
- `mode`
- `automationEnabled`
- `lastActiveTab`

## Backend assumptions

The extension calls deployed Next.js routes with a bearer JWT. If a route only trusts cookie auth, fix the route instead of papering over it inside extension code.

## Future work, not current truth

- WXT migration
- TypeScript/React rebuild
- broader `browser.*` polyfill cleanup
- native Safari packaging
