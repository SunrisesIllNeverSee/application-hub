# WebExtensions

Browser extension work for Application Hub lives here.

## Current truth

`/Users/dericmchenry/Desktop/application-hub/webextension/application-hub` is the single live extension product.

It now ships as one MV3 extension with two modes inside the same codebase:

- `Manual Assist`: detect, review, generate, fill, export, save-to-bank
- `Automation Assist`: canonical capture, Smart Matcher, threshold-gated bulk assist

The older Chrome-only `aqua-extension` scaffold has been archived under `_archive/` after its capture and Smart Matcher flows were folded into the live extension.

## Folder map

| Folder | Role |
| --- | --- |
| [application-hub/](/Users/dericmchenry/Desktop/application-hub/webextension/application-hub) | Live extension implementation |
| [x-bookmarks/](/Users/dericmchenry/Desktop/application-hub/webextension/x-bookmarks) | X bookmarks exporter for local Markdown / JSON sorting |
| [chrome/](/Users/dericmchenry/Desktop/application-hub/webextension/chrome) | Browser-specific notes and store records |
| [firefox/](/Users/dericmchenry/Desktop/application-hub/webextension/firefox) | Browser-specific notes and store records |
| [safari/](/Users/dericmchenry/Desktop/application-hub/webextension/safari) | Safari notes and wrapper path |
| [_archive/](/Users/dericmchenry/Desktop/application-hub/webextension/_archive) | Retired scaffolds and donor code |

## Live extension architecture

- `manifest.json`: one MV3 manifest
- `background.js`: orchestration, API calls, settings, routing
- `content.js`: DOM detection, fill, export, blur capture, Safari fallback panel
- `sidepanel.html/js`: main operator surface
- `popup.html/js`: lightweight auth, mode, and quick actions

Storage keys are standardized to:

- `jwt`
- `hubUrl`
- `mode`
- `automationEnabled`
- `lastActiveTab`

## API surface in use

- `POST /api/match-question`
- `GET /api/integrations/key`
- `POST /api/answers/capture`
- `POST /api/hub/ingest`
- `POST /api/hub/smart-matcher`
- `POST /api/hub/autofill-eligibility`

## Guardrails

- Keep `chrome.*` for the live extension in this pass.
- Do not put the Supabase service role key in extension code.
- Do not describe WXT, React, or a cross-browser TypeScript rebuild as current reality. That is future cleanup, not the present implementation.
