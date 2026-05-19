# Safari — Setup & Build Record

## Two paths: Userscript (now) vs Native Extension (later)

---

## Path A — Userscript (no Xcode required)

Works today. Uses the free **Userscripts** app from the Mac App Store.

**Install:**
1. Mac App Store → search "Userscripts" by Justin Wasack → install (free)
2. Safari → Settings → Extensions → enable Userscripts
3. Set a scripts folder (e.g. `~/Documents/Userscripts/`)
4. Drop any `.user.js` file into that folder — Safari picks it up on next reload

**Projects with userscripts:**

| Project         | Script                                                            | Status  |
| --------------- | ----------------------------------------------------------------- | ------- |
| application-hub | `application-hub/userscript/application-hub.user.js`             | ready   |

---

## Path B — Native Safari Extension (requires Xcode)

Required for App Store distribution. Not yet set up.

**What you need:**
- Xcode.app — Mac App Store, ~7GB (currently not installed)
- Apple Developer account — $99/yr (for distribution only; local testing is free)

**Process once Xcode is installed:**
```bash
cd webextension/<project-name>
npm run build                                      # build the extension first
xcrun safari-web-extension-converter .output/safari-mv3/
# Opens an Xcode project — hit Run to side-load into Safari
```

**Note:** There is no "load unpacked" in Safari. Local testing = Xcode run. Distribution = Mac App Store.

---

## Store (Mac App Store)

- Distribution via Mac App Store only (no sideloading for end users)
- Same Xcode project is used for both macOS and iOS Safari
- Review time: typically 1–3 business days (same App Review as iOS apps)

---

## Deployments

| Project         | Type        | Version | Status      | Store URL | Notes                  |
| --------------- | ----------- | ------- | ----------- | --------- | ---------------------- |
| application-hub | userscript  | 0.1.0   | ready       | —         | Token flow complete    |
| application-hub | extension   | —       | blocked     | —         | Waiting on Xcode.app   |
