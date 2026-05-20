# WebExtension — Task List

---

## Done

### Environment

- [x] VS Code extensions: Chrome DevTools, Firefox Debugger, Edge Tools
- [x] Node.js v22, npm v10
- [x] web-ext v10.1.0 installed globally
- [x] Firefox installed

### Foundation (2026-05-19)

- [x] webextension/ folder structure — chrome/, firefox/, safari/ browser reference docs
- [x] appfeeder/ moved into webextension/application-hub/
- [x] v0 WXT scaffold archived at \_archive/application-hub-v0/

### Extension v0.2 (2026-05-20)

- [x] manifest.json — removed 6-site allowlist, now `<all_urls>`, sidePanel + sidebar\_action
- [x] AQUA side panel — sidepanel.html + sidepanel.js (per-field generate, fill, save to bank)
- [x] background.js — BYOK fetch, Anthropic + OpenAI generation, routes fields to panel
- [x] content.js — universal scan (any site), fill commands, EXPORT\_MD, GET\_FIELDS
- [x] Safari fallback — injected iframe panel via content script (no Xcode needed)
- [x] popup.html/js — simplified: auth token + "Open AQUA panel" button
- [x] styles.css — overlay + full panel UI + button system
- [x] GET /api/integrations/key — decrypts and returns BYOK key for extension
- [x] README.md — full architecture doc, browser support table, API endpoints

---

## Up Next

### Load and test in Chrome

- [ ] chrome://extensions → Load unpacked → webextension/application-hub/
- [ ] Click toolbar icon → confirm AQUA panel opens
- [ ] Navigate to any application form → confirm fields detected
- [ ] Paste session token → confirm Connected status
- [ ] Test "Generate" on a field (requires BYOK key in Profile → Settings → Integrations)
- [ ] Test "Fill field" → confirm React-safe injection works
- [ ] Test "Export MD" → confirm markdown downloads

### Load and test in Firefox

- [ ] about:debugging → Load Temporary Add-on → select manifest.json
- [ ] Confirm sidebar opens on toolbar click
- [ ] Same field detection + fill test as Chrome

### Program DNA context

- [ ] Detect current program from URL in content.js
- [ ] background.js: fetch program\_dna from Supabase when program identified
- [ ] Pass DNA weights to generateAnswer() prompt for tailored output

### Streaming responses

- [ ] Replace single-shot generation with streaming (Anthropic SSE / OpenAI stream)
- [ ] Show token-by-token output in the panel textarea

### Multi-page form persistence

- [ ] Accumulate detected fields across navigations in chrome.storage.session
- [ ] Panel shows all fields from full application, not just current page

### Safari native extension

- [ ] Blocked on Xcode.app install (~7GB, Mac App Store)
- [ ] After Xcode: xcrun safari-web-extension-converter + Xcode run

### Publish pipeline

- [ ] Chrome Web Store developer account ($5 one-time)
- [ ] Firefox AMO account (free)
- [ ] Add data\_collection\_permissions to Firefox manifest before AMO submit
- [ ] npm install -D @wext/shipit for unified publish command
