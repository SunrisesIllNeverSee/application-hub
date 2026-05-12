# Browser Extension V1 — Spec

**Status:** Scaffold complete, build pending  
**Version:** 1.0 (MV3)  
**Directory:** `appfeeder/`

---

## What it does

When a founder opens a supported application portal in Chrome, the
extension detects the page, reads visible question text from the DOM,
matches each question against the user's answer bank in Supabase, and
pre-fills (or suggests) answers — no copy-paste, no context-switching.

---

## V1 Portal Whitelist

Five portals for V1. Chosen because they have public, stable application
URLs and real question surfaces.

| Portal | URL pattern | Notes |
| --- | --- | --- |
| Y Combinator | `ycombinator.com/apply*` | Long-form, HTML form |
| Techstars | `apply.techstars.com/*` | Multi-step form |
| a16z Speedrun | `speedrun.a16z.com/apply*` | Airtable-based |
| 500 Global | `500.co/*/apply*` | Varies by cohort |
| Solofounders | `apply.solofounders.com/*` | AcceleratorApp |

**Not in V1:** Typeform portals (session-state questions) — these work
better as organic captures when the user submits; covered by Phase C
of the FundingCake pipeline once the extension is live.

---

## Architecture

```
Chrome Extension (MV3)
│
├── manifest.json          ← Portal URL patterns, permissions
├── content.js             ← Injected into portal pages
│     detects questions → calls background → injects answers
├── background.js          ← Service worker
│     manages auth token, Supabase REST calls, answer matching
├── popup.html / popup.js  ← User-facing: auth status + mode toggle
└── icons/                 ← 16/48/128px
```

### Flow

```
1. User opens e.g. apply.techstars.com
2. content.js fires (matches URL pattern in manifest)
3. content.js scans DOM for question labels (textarea labels, h3s, li prompts)
4. Sends question texts to background.js via chrome.runtime.sendMessage
5. background.js calls Supabase REST:
     GET /rest/v1/rpc/match_question_text
     with user JWT + question texts
6. Returns matched answers (profile_answers rows)
7. content.js injects answers into matching textareas
8. Shows a small non-blocking overlay: "X answers pre-filled — review before submitting"
```

---

## Auth

V1 uses simple token storage. No OAuth flow — user pastes their JWT once.

```
popup.html → user pastes Supabase anon key + user JWT
           → chrome.storage.local.set({ jwt, anonKey })
background.js reads from chrome.storage.local for each API call
```

The JWT comes from the user's session on mos2es.xyz. In the popup,
show a "Get your token" link → `https://mos2es.xyz/profile/settings`
(where we'll add a "copy session token" button in a follow-up).

No server-side auth relay. Direct Supabase REST only.

**Security:** The JWT is scoped to the user's own data by RLS. The anon
key is already public (it's in the Next.js client bundle). The only risk
is token theft via extension compromise — acceptable for V1.

---

## Question detection

Each portal has a detector function in `content.js`:

```js
const DETECTORS = {
  'ycombinator.com': detectYC,
  'apply.techstars.com': detectTechstars,
  // ...
}
```

Each detector returns an array of `{ fieldId, questionText, element }`.

Generic fallback (for any unlisted portal):

```js
// Grab all textarea labels and aria-labels as question candidates
document.querySelectorAll('label, [aria-label]')
```

---

## Answer matching

`background.js` calls the existing `/rest/v1/rpc/match_question_text`
RPC (or direct `profile_answers` query ordered by similarity if RPC
isn't available). Returns the best matching answer for each question.

Similarity threshold for auto-fill: **≥ 0.72**  
Below threshold: suggest (highlight field, don't fill)

---

## Modes (popup toggle)

| Mode | Behaviour |
| --- | --- |
| **Suggest** (default) | Highlight matched fields, show answer in sidebar — user clicks to fill |
| **Auto-fill** | Inject immediately on page load, user reviews before submit |

V1 ships Suggest mode only. Auto-fill toggle is in the popup but disabled
(`coming soon`).

---

## What it does NOT do in V1

- No server-side proxy — all Supabase calls are direct from the extension
- No Typeform slide-stepping (captured organically when user submits)
- No answer saving back to Supabase (read-only in V1)
- No cross-browser support (Chrome/Chromium only in V1)
- No MCP server dependency

---

## File structure

```
appfeeder/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── styles.css          ← overlay + highlight styles
├── icons/
│   ├── 16.png
│   ├── 48.png
│   └── 128.png
└── README.md
```

---

## Loading in Chrome (dev)

1. `chrome://extensions` → Enable Developer Mode
2. Load unpacked → select `appfeeder/`
3. Navigate to one of the V1 portals
4. Open popup → paste JWT from mos2es.xyz/profile/settings

---

## V2 ideas (not in V1)

- OAuth-based auth flow (no token paste)
- Answer save-back when user edits a pre-filled field
- Typeform slide detection
- Firefox / Edge support (WebExtensions API)
- Org-level shared answer bank (Team plan feature)
