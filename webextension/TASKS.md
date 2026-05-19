# WebExtension — Setup Task List

Work through these in order. Check off each item as it's done.

---

## Phase 1 — Environment & Tooling ✅

### VS Code Extensions
- [x] Install `aaravb.chrome-extension-developer-tools`
- [x] Install `firefox-devtools.vscode-firefox-debug`
- [x] Install `ms-edgedevtools.vscode-edge-devtools`

### System Requirements
- [x] Node.js >= 18 — v22.22.2
- [x] npm >= 9 — v10.9.7
- [x] web-ext installed globally — v10.1.0
- [x] Xcode CLI tools — version 2416
- [x] **Firefox** — installed
- [ ] **Xcode.app** — CLI tools present but full app not installed (~7GB via Mac App Store)
      Needed for: running `xcrun safari-web-extension-converter` to wrap the build into a native app
      NOT needed for: building the extension JS/CSS/manifest (wxt build handles that)
- [ ] Apple Developer account ($99/yr) — only needed for distributing to other users via Mac App Store
      NOT needed for: local Safari testing (Xcode run → Safari Settings → enable extension is free)

---

## Phase 2 — WXT Project Initialization ✅

- [x] package.json created with all scripts
- [x] WXT React module configured in wxt.config.ts
- [x] Entrypoints scaffolded: background.ts, popup/ (index.html + main.tsx + App.tsx)
- [x] npm install passes cleanly
      Note: pinned @webext-core/fake-browser to 1.3.4 via overrides — v1.4.0 was published
      missing its lib/ build output (WXT upstream bug workaround)
- [x] npm run build — Chrome MV3 build passes (144KB, 725ms)
- [x] npm run build:firefox — Firefox MV2 build passes (144KB, 577ms)
- [x] Firefox data-collection warning suppressed in wxt.config.ts
- [ ] Verify npm run type-check passes (run after first npm run dev to generate .wxt/tsconfig.json)

---

## Phase 3 — Core Dependencies ✅

All installed via package.json:

- [x] webextension-polyfill — Chrome/Firefox API bridge
- [x] @types/chrome — Chrome TypeScript types
- [x] @types/firefox-webext-browser — Firefox browser.* types
- [x] @types/webextension-polyfill — TypeScript types for polyfill
- [x] webext-storage-cache — cache layer for Supabase reads
- [x] @supabase/supabase-js — Supabase client for background script
- [x] React 18 + @wxt-dev/module-react

---

## Phase 4 — Testing Setup (partial)

- [x] sinon-chrome — Chrome API mocks
- [x] addons-linter — Mozilla AMO lint (result: 0 errors, 0 notices, 2 warnings — React-internal, expected)
- [ ] webextensions-api-fake — add when writing first integration tests
- [ ] Configure vitest (recommended test runner for WXT projects)

---

## Phase 5 — Publish Pipeline (do when ready to ship)

- [ ] npm install -D @wext/shipit
- [ ] Create Chrome Web Store developer account (one-time $5 fee)
- [ ] Create Firefox AMO (addons.mozilla.org) developer account (free)
- [ ] Add data_collection_permissions to Firefox manifest before AMO submission
- [ ] Add store credentials to .env (gitignored) for shipit
- [ ] Verify npm run zip and npm run zip:firefox produce valid archives

---

## Phase 6 — First Real Feature (tooling is green — start here next)

- [ ] Popup UI: show "Connected" / "Sign in" state from browser.storage.local
- [ ] Supabase auth in extension (magic link or token-paste in options page)
- [ ] Store Supabase JWT in browser.storage.local
- [ ] Background: fetch top 3 unanswered questions from profile_answers + archived_questions
- [ ] Display in popup with word-limit badges
- [ ] Content script: detect textarea on application pages
- [ ] Message passing: content script -> background -> Supabase -> back to content script
- [ ] "Fill from answer bank" button overlay in content script

---

## Pending Environment Items

| Item | Status | Notes |
|------|--------|-------|
| Firefox | Not installed | Download from mozilla.org |
| Xcode.app | Not installed | Required for Safari builds, Mac App Store ~7GB |
| Apple Developer account | Unknown | $99/yr, needed for Safari App Store |
| Safari build test | Blocked | Waiting on Xcode.app |
