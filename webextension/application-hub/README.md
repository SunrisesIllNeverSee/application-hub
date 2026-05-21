# AQUA — Application Hub Browser Extension

One live extension. Two operating modes.

- `Manual Assist`: detect, review, generate, fill, export, save
- `Automation Assist`: capture to Canonical Hub, Smart Matcher, threshold-gated bulk assist
- `Local Agent Bridge`: send the current application page into your local workspace without auth

## Load locally

### Chrome

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Load unpacked from `/Users/dericmchenry/Desktop/application-hub/webextension/application-hub`
4. Click the toolbar icon to open the popup
5. Use `Open side panel` from the popup
6. Optional local agent lane: run `npm run extension:agent` from the repo root, then use `Send to local agent`

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Load Temporary Add-on
3. Select `/Users/dericmchenry/Desktop/application-hub/webextension/application-hub/manifest.json`

## File ownership map

| File | Owns |
| --- | --- |
| [manifest.json](/Users/dericmchenry/Desktop/application-hub/webextension/application-hub/manifest.json) | MV3 wiring, permissions, popup, side panel, content injection |
| [background.js](/Users/dericmchenry/Desktop/application-hub/webextension/application-hub/background.js) | Settings, message bus, API calls, canonical capture, Smart Matcher, autofill gating |
| [content.js](/Users/dericmchenry/Desktop/application-hub/webextension/application-hub/content.js) | Field detection, fill commands, blur capture, page scrape/export, Safari fallback panel |
| [sidepanel.html](/Users/dericmchenry/Desktop/application-hub/webextension/application-hub/sidepanel.html) | Main extension UI shell |
| [sidepanel.js](/Users/dericmchenry/Desktop/application-hub/webextension/application-hub/sidepanel.js) | Manual and automation workflows, field cards, bulk assist UX |
| [popup.html](/Users/dericmchenry/Desktop/application-hub/webextension/application-hub/popup.html) | Lightweight auth, mode toggle, quick actions |
| [popup.js](/Users/dericmchenry/Desktop/application-hub/webextension/application-hub/popup.js) | Popup state, connection save/clear, quick action dispatch |
| [styles.css](/Users/dericmchenry/Desktop/application-hub/webextension/application-hub/styles.css) | Panel, callout, field-card, and overlay styling |

## Request flow map

### Manual Assist

1. `content.js` scans fields and sends `FIELDS_DETECTED_FROM_PAGE`
2. `background.js` calls `POST /api/match-question`
3. `sidepanel.js` renders matched fields
4. Per-field generation uses `GET /api/integrations/key` plus the user's BYOK provider
5. Fill commands route back through `content.js`
6. Save-to-bank uses `POST /api/answers/capture`
7. Export uses `content.js` page scrape to Markdown

### Automation Assist

1. `sidepanel.js` or `popup.js` triggers `CANONICAL_INGEST_REQUEST`
2. `background.js` requests page capture from `content.js`
3. `background.js` calls `POST /api/hub/ingest`
4. Smart Matcher uses `POST /api/hub/smart-matcher`
5. Bulk Assist checks `POST /api/hub/autofill-eligibility`
6. If level 1 thresholds pass, the extension fills matched answers in bulk

### Local Agent Bridge

1. Start the helper with `npm run extension:agent`
2. The extension sends the current page capture to `http://127.0.0.1:4317/assist`
3. The helper saves the page into `codex/qaapplication/inbox/`
4. The helper returns the closest files from `codex/qaapplication/` so you can open the current application beside prior ones in VS Code

## Auth model

The extension stores a user JWT in extension local storage for v1. Live app routes now accept either:

- the standard session cookie
- a bearer JWT from the extension

That keeps one auth model across popup, panel, and background without introducing service-role behavior.

For the `Local Agent Bridge`, sign-in is not required. It is a purely local workspace assist lane.

## Notes

- `chrome.*` is the live implementation for this pass.
- The archived donor scaffold lives in `_archive/` and should not be treated as runnable current code.
- A future WXT or TypeScript rebuild is fine later, but it is not the present architecture.
