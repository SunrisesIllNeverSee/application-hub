# X Bookmarks Userscript

Safari-compatible userscript for collecting and exporting the X / Twitter bookmarks page to Markdown or JSON.

## Install

### Safari

1. Install the free **Userscripts** app from the Mac App Store
2. Enable the Userscripts extension in Safari
3. Save `x-bookmarks.user.js` into your userscripts folder

### Chrome / Firefox

1. Install Tampermonkey or Violentmonkey
2. Create a new script
3. Paste the contents of `x-bookmarks.user.js`

## Use

1. Open `x.com/i/bookmarks` while signed in
2. Use the floating panel to export Markdown or JSON

## Notes

- This is separate from AQUA.
- It is local-first and does not require an Application Hub login.
- It auto-scrolls to collect more bookmarks before exporting, up to the page's load limits.
