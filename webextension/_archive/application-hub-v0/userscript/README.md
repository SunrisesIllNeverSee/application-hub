# Application Hub — Userscript

A lightweight alternative to the full browser extension.
Works in any browser with a userscript manager — including **Safari natively** (no Xcode required).

---

## What it does

- Detects every `<textarea>` on any application form page
- Shows a small **AH** button in the corner of each field
- Click it to open your answer bank panel on the right
- Click any answer to fill the field instantly
- Works on React/Vue/Angular SPAs (uses native setter + dispatches input events)

---

## Files

| File | Purpose |
|------|---------|
| `application-hub.user.js` | The userscript — install this |
| `INSTALL-SAFARI.md` | Safari installation guide (free, no Xcode) |
| `INSTALL-CHROME-FIREFOX.md` | Chrome / Firefox installation via Tampermonkey |

---

## Quick install

| Browser | Manager | Notes |
|---------|---------|-------|
| Safari | [Userscripts app](https://apps.apple.com/app/userscripts/id1463298887) (free) | Mac App Store, no dev account needed |
| Safari | [Tampermonkey](https://apps.apple.com/app/tampermonkey/id1482490089) | Also on Mac App Store |
| Chrome | [Tampermonkey](https://www.tampermonkey.net/) | Chrome Web Store |
| Firefox | [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) | Firefox Add-ons |

---

## Before shipping to users

1. Replace `REPLACE_WITH_ANON_KEY` in the script with the real Supabase anon key
2. Build the "API Token" UI in the web app (Profile → Settings → API Token)
3. Consider hosting the `.user.js` at a public URL so users can auto-update

---

## Limitations vs. the full extension

- No persistent background process — panel opens fresh each time
- No browser toolbar icon
- Requires the user to install a third-party userscript manager (except Safari 16+ with Userscripts app)
- Auto-update requires hosting the file at a public URL with `@updateURL` in the metadata block
