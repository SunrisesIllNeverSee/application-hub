# WebExtension — Task List

## Done

- [x] Chose `webextension/application-hub/` as the single surviving implementation path
- [x] Folded donor flows from the old Chrome `aqua-extension` scaffold into the live extension
- [x] Standardized extension storage keys: `jwt`, `hubUrl`, `mode`, `automationEnabled`, `lastActiveTab`
- [x] Standardized the live message bus around auth, fields, generation, fill, capture, export, matcher, and canonical actions
- [x] Added explicit `Manual Assist` and `Automation Assist` modes to the extension UI
- [x] Wired live extension actions to:
  - `POST /api/match-question`
  - `GET /api/integrations/key`
  - `POST /api/answers/capture`
  - `POST /api/hub/ingest`
  - `POST /api/hub/smart-matcher`
  - `POST /api/hub/autofill-eligibility`
- [x] Updated app routes so bearer JWT auth works for extension-driven hub and BYOK calls
- [x] Archived the donor scaffold at `/Users/dericmchenry/Desktop/application-hub/webextension/_archive/aqua-extension-donor-2026-05-21`
- [x] Added a local agent bridge:
  - helper server at `scripts/local-extension-agent.mjs`
  - root script `npm run extension:agent`
  - popup + sidepanel action to send the current page into `codex/qaapplication/inbox/`

## Next verification pass

- [ ] Load unpacked in Chrome from `/Users/dericmchenry/Desktop/application-hub/webextension/application-hub`
- [ ] Confirm popup loads and saves `hubUrl`, `jwt`, and automation toggle
- [ ] Confirm side panel opens from popup
- [ ] Confirm background service worker starts without message routing errors
- [ ] Confirm content script detects fields on a simple local form page
- [ ] Confirm Manual Assist can:
  - detect fields
  - match answers
  - generate one field
  - fill one field
  - save to bank
  - export Markdown
- [ ] Confirm Automation Assist can:
  - capture current page into Canonical Hub
  - run Smart Matcher
  - gate Bulk Assist by coverage and fidelity
- [ ] Confirm missing or invalid JWT fails closed without partial silent behavior
- [ ] Review Firefox compatibility at the manifest and API level
- [ ] Keep Safari as injected-panel fallback until a native packaging pass happens

## Later

- [ ] Program DNA context in generation prompts
- [ ] Multi-page application persistence
- [ ] Streaming generation in the panel
- [ ] Native Safari packaging
- [ ] WXT / TypeScript / React migration, only after the single-extension lane stays stable
