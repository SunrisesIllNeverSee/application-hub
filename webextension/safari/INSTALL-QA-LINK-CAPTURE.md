# QA Link Capture - Safari Setup

This userscript works in **Safari proper**, not the in-app browser.

## What you need

- The free **Userscripts** app from the Mac App Store
- The local agent running in a terminal:

```bash
npm run extension:agent
```

## Install

1. Install **Userscripts** from the Mac App Store.
2. Safari -> Settings -> Extensions -> enable **Userscripts**.
3. In the Userscripts app, point the script folder at the folder where you keep `.user.js` files.
4. Put `qa-link-capture.user.js` into that folder.
5. Open a normal webpage in Safari and reload it.

## What you should see

- a yellow banner at the top that says `QA Link Capture active`
- a mid-right panel with `Send to QA`

## If nothing shows up

- confirm you are in Safari, not the in-app browser
- confirm Userscripts is enabled
- confirm the script folder points at the right folder
- quit and reopen Safari after updating the file
- reload the page after every change

## Notes

- The warning about `@inject-into content` is normal when the script uses `GM_xmlhttpRequest`.
- The local server only receives captures after you click `Send to QA`.
