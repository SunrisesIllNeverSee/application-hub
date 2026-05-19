# WebExtension — Claude Context

> Claude context for the `webextension/` folder.
> Read this before working on anything in this directory.

---

## What this is

A cross-browser WebExtension for the Application Hub platform. Built with WXT (Vite-based), TypeScript, React. Targets Chrome, Firefox, Edge, and Safari from a single codebase.

This extension is a companion to the main `app/` Next.js application — it shares the same Supabase backend (`betcyfbzsgusaghriptz`).

---

## Current state

- [ ] WXT project not yet initialized — see `TASKS.md` for setup checklist
- [ ] No entrypoints written yet
- [ ] No Supabase auth integration yet

---

## Architecture decisions

**Framework**: WXT — chosen over Plasmo because it has better Safari support, is framework-agnostic, and has the best DX in 2026.

**UI**: React (same as `app/`) so components can eventually be shared.

**Auth**: Supabase JWT stored in `browser.storage.local`. The extension authenticates independently from the web app session — user logs in once via the extension's options page.

**API**: Background script makes direct Supabase calls (anon key for user-scoped reads, service role never in extension). Draft generation hits `/api/draft` on the deployed Next.js app, or Anthropic directly if the user has a BYOK key stored via the existing `user_integrations` table.

---

## Key conventions

- All extension code lives in `webextension/` — do not mix with `app/`
- Use `browser.*` namespace everywhere (not `chrome.*`) — the polyfill handles Chrome compatibility
- Background script = service worker in MV3 — it can be terminated; don't store ephemeral state there
- Content scripts have limited API access — pass messages to background for storage/fetch
- Icons must be provided in multiple sizes: 16, 32, 48, 128px

---

## Supabase connection

```
URL: https://betcyfbzsgusaghriptz.supabase.co
Anon key: safe to use in extension (public, user-scoped RLS)
Service role key: NEVER put this in an extension
```

The anon key goes in `wxt.config.ts` under `define` (build-time constant) or in `browser.storage.local` after first run.

---

## Safari specifics

Safari builds require an Xcode wrapper — you cannot test Safari without a Mac and Xcode installed. After `npm run build`, run:

```bash
xcrun safari-web-extension-converter .output/safari-mv3/
```

This generates an Xcode project in the parent directory. Open it, build, and enable the extension in Safari Preferences.

---

## Do not do these things

- Do not put the Supabase service role key in any extension file
- Do not call `chrome.*` directly — always use `browser.*` + polyfill
- Do not store sensitive data (API keys, JWTs) in `sessionStorage` or `localStorage` on the page — use `browser.storage.local`
- Do not use `manifest_version: 2` for new code unless Firefox compatibility requires it (WXT handles the split automatically)
