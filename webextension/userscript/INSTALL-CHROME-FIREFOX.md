# Installing Application Hub Userscript — Chrome & Firefox

---

## Chrome — Tampermonkey

1. Install **[Tampermonkey](https://www.tampermonkey.net/)** from the Chrome Web Store
2. Click the Tampermonkey icon → **"Create a new script"**
3. Delete the placeholder and paste the full contents of `application-hub.user.js`
4. Hit **Ctrl+S** (or Cmd+S) to save
5. Reload any page with a form — the **AH** button appears on text areas

---

## Firefox — Tampermonkey or Violentmonkey

### Tampermonkey (recommended)
Same steps as Chrome — install from Firefox Add-ons, create script, paste, save.

### Violentmonkey (open source alternative)
1. Install **[Violentmonkey](https://violentmonkey.github.io/)** from Firefox Add-ons
2. Click the Violentmonkey icon → **"+"** → **"New script"**
3. Paste the contents of `application-hub.user.js`
4. Save and reload

---

## Connecting your account (same for all browsers)

1. Click the **AH** button on any text area
2. Paste your access token from **applicationhub.app → Profile → Settings → API Token**
3. Click **Connect**

To reset: open the Tampermonkey/Violentmonkey menu on any page → **"Application Hub — Reset token"**
