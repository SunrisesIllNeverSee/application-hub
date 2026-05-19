# Chrome — Setup & Build Record

## Dev Setup

**Load unpacked extension:**
1. Go to `chrome://extensions`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked" → select `.output/chrome-mv3/` from any project

**Or use WXT dev mode** (preferred — HMR, no manual reload):
```bash
cd webextension/<project-name>
npm run dev         # opens Chrome automatically with extension loaded
```

**Debugging:**
- Right-click extension icon → Inspect popup
- `chrome://extensions` → click "service worker" link to inspect background script
- VS Code: `ms-edgedevtools.vscode-edge-devtools` extension (works for Chrome too)

---

## Store

- **Chrome Web Store**: one-time $5 developer registration
- **Dashboard**: https://chrome.google.com/webstore/devconsole
- **Manifest**: MV3 required for all new submissions
- **Review time**: typically 1–3 business days

---

## Deployments

| Project         | Version | Status      | Store URL | Notes              |
| --------------- | ------- | ----------- | --------- | ------------------ |
| application-hub | —       | not shipped | —         | WXT build ready    |
