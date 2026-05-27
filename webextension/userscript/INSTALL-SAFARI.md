# Installing Application Hub Userscript in Safari

No Xcode, no App Store, no developer account required.
Safari 16+ on macOS has native userscript support via a free app.

---

## Step 1 — Install the Userscripts app

1. Open the Mac App Store
2. Search **"Userscripts"** — the app by Justin Wasack (free, open source)
3. Install it

> Alternatively, Tampermonkey is available on the Mac App Store and also works —
> but Userscripts is free and has no subscription.

---

## Step 2 — Enable it in Safari

1. Open **Safari → Settings → Extensions**
2. Find **Userscripts** in the list and check the box to enable it
3. Click **"Allow on All Websites"** (the script only activates when you open the panel)

---

## Step 3 — Set a scripts folder

1. Click the **Userscripts icon** in the Safari toolbar (looks like `</> `)
2. Click **"Set Userscripts Directory"**
3. Choose or create a folder — e.g. `~/Documents/Userscripts/`

---

## Step 4 — Add the script

1. Copy `application-hub.user.js` into the folder you chose in Step 3
2. The Userscripts app watches that folder — it picks up new files automatically
3. Reload any page with a form — you'll see a small **AH** button appear in the top-right corner of each text area

---

## Step 5 — Connect your account

1. Click the **AH** button on any text area
2. The Application Hub panel opens on the right side of the page
3. Paste your **access token** from applicationhub.app → Profile → Settings → API Token
4. Click **Connect** — your answer bank loads immediately

Your token is stored locally by the Userscripts app and never leaves your machine except to authenticate with Application Hub.

---

## Resetting your token

If your token expires or you need to reconnect:

1. Click the **Userscripts icon** in the Safari toolbar
2. Click **"Application Hub — Reset token"**
3. Reload the page and paste a fresh token

---

## Updating the script

When a new version of `application-hub.user.js` is released:

1. Replace the file in your scripts folder with the new version
2. The Userscripts app picks it up automatically — no Safari restart needed

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| AH button doesn't appear | Check Safari → Settings → Extensions → Userscripts is enabled |
| "Could not load answers" | Token expired — use the Reset token menu command and reconnect |
| Panel doesn't open | Disable any content blockers for the page, then reload |
| Script not found by app | Confirm the file is in the exact folder you set in Step 3 |
