# Firefox — Setup & Build Record

## Dev Setup

**Load temporary extension:**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select the `manifest.json` inside `.output/firefox-mv2-dev/`

**Or use WXT dev mode** (preferred):
```bash
cd webextension/<project-name>
npm run dev:firefox     # opens Firefox with extension loaded and HMR
```

**Or use web-ext directly:**
```bash
web-ext run --source-dir .output/firefox-mv2/
web-ext lint --source-dir .output/firefox-mv2/
```

**web-ext** is installed globally — `web-ext --version` → 10.1.0

---

## Store (AMO)

- **Firefox Add-ons (AMO)**: https://addons.mozilla.org/developers/
- **Free** to publish
- **Manifest**: WXT builds MV2 for Firefox by default (MV3 experimental)
- **Review time**: auto-review for listed extensions; manual review can take days–weeks
- **Signing**: extensions must be signed — `web-ext sign` or submit via AMO dashboard
- **New requirement (Nov 2025+)**: `data_collection_permissions` field required for new submissions

---

## Deployments

| Project         | Version | Status      | AMO URL | Notes                      |
| --------------- | ------- | ----------- | ------- | -------------------------- |
| application-hub | —       | not shipped | —       | Firefox MV2 build ready    |
