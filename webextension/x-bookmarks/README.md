# X Bookmarks Export

Small standalone extension for exporting the currently loaded X / Twitter bookmarks page into Markdown or JSON.

## What it does

- reads the loaded bookmarks page only
- extracts each visible bookmarked post into structured data
- downloads a Markdown or JSON dump for local sorting in VS Code

## How to use

1. Open `x.com/i/bookmarks` while signed in to X
2. Load this folder unpacked in Chrome or Edge
3. Click the extension icon
4. Choose a sort mode
5. Download Markdown or JSON

## Notes

- This is separate from the AQUA extension stack.
- It is intentionally local-first and does not need your Application Hub sign-in.
- It only exports the bookmarks already loaded in the page, so scroll to load more before exporting if needed.
