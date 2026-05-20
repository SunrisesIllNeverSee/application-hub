# AQUA — Application Hub Browser Extension

> v0.2 — AQUA agent panel + universal site support + BYOK generation

AQUA is a browser extension that detects application form fields on any site,
matches them to your answer bank, and generates tailored answers using your own AI key.

---

## Dev setup

**Chrome (load unpacked):**

1. `chrome://extensions` → Enable Developer Mode
2. Load unpacked → select this `webextension/application-hub/` folder
3. Click toolbar icon → "Open AQUA panel" → side panel opens

**Firefox:**

1. `about:debugging#/runtime/this-firefox` → Load Temporary Add-on
2. Select `manifest.json` in this folder
3. Click toolbar icon → sidebar opens automatically

**Safari:**

- Requires Xcode.app (not yet installed — see `webextension/safari/README.md`)
- Fallback: the `userscript/application-hub.user.js` works in Safari today via the Userscripts app

---

## How it works

1. Content script scans any page for `<textarea>` and `<input>` fields + their labels
2. Fields are sent to background → semantically matched against your answer bank
3. AQUA panel opens (native side panel on Chrome/Firefox, injected iframe on Safari)
4. Per field: "Generate" calls your BYOK AI key to write a tailored answer
5. "Fill field" injects the answer into the live form (React-safe native setter)
6. "Save to bank" captures the answer back to your Application Hub answer bank
7. "Export MD" downloads the full page as structured markdown

---

## Architecture

```text
content.js          — scans DOM, fills fields, export MD, captures on blur
background.js       — semantic matching, BYOK fetch, Claude/OpenAI generation
sidepanel.html/js   — AQUA agent UI (one card per detected field)
popup.html/js       — auth token + "Open AQUA panel" button
styles.css          — overlay + panel + button system
manifest.json       — MV3, <all_urls>, sidePanel (Chrome), sidebar_action (Firefox)
```

---

## Browser support

| Browser | Panel | Status |
| ------- | ----- | ------ |
| Chrome 114+ | Native side panel | Ready — load unpacked |
| Firefox | Native sidebar (`sidebar_action`) | Ready — load temp add-on |
| Edge | Native side panel (same as Chrome) | Ready — same build |
| Safari | Injected iframe (content script) | Needs Xcode for native install |

---

## API endpoints used

| Endpoint | Purpose |
| -------- | ------- |
| `GET /api/auth/token` | Session JWT for the extension |
| `POST /api/match-question` | Semantic match: question → best answer |
| `GET /api/integrations/key` | Retrieve decrypted BYOK key for generation |
| `POST /api/answers/capture` | Save answer back to bank after editing |

---

## Connect your account

1. Go to **mos2es.xyz → Profile → Settings**
2. Scroll to **"Appfeeder Extension"** → click **"Show session token"** → Copy
3. Paste into the extension popup → Save

---

## What's next

- Stream generation responses token by token in the panel
- Program DNA context: pull the program's weighted themes to inform generation
- Multi-page form persistence across page navigations
- Safari native extension (blocked on Xcode.app install)
- Store submission (Chrome Web Store, Firefox AMO)
