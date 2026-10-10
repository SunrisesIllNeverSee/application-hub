# LF-13 — Extension local-first capture boundary

Contract: `aquarnd/aqua-canon/Planning/Execution/m06/local-first/LF-Architecture-Contract.md`
Inventory rows: LF-005, LF-012, LF-031, LF-032 (LF-030 client row).

## What changed

| Surface | Before | After |
|---|---|---|
| `CAPTURE_SAVE_ANSWER` (blur capture + "Save to bank") | POSTed `answerText` straight to `/api/answers/capture` | Always saved to `chrome.storage.local.localAnswerBank`; hub POST only when `syncToHub === true` |
| `CANONICAL_INGEST_REQUEST` (hub ingest) | Full page capture incl. typed answer bodies → `/api/hub/ingest` | Under `localFirst` (default ON), `stripCaptureAnswerBodies()` empties `questions[].value`, rebuilds `content` markdown with `[redacted — local-first]` placeholders; `metadata.redactedAnswers` reports the count |
| `GENERATE_REQUEST` / `GENERATE_BULK_REQUEST` (BYOK) | Question + matched bank answer sent directly to `api.anthropic.com` / `api.openai.com` with no consent | First call returns `consent_required` + honest `provider`/`model`; sidepanel shows a per-call/per-batch confirm dialog; on approval resends with `confirmEgress: true`; every provider call writes a receipt `{ts, kind, provider, model, questionPreview}` to `chrome.storage.local.consentLog` (last 500) |
| `FILL_*` autofill | Filled on any message | `userInitiated: true` required end-to-end (sidepanel click → background → content script); messages without it are refused (`user_action_required`). No auto-fill-on-load exists and none can be added silently |
| External messages | No gate | `manifest.json` `externally_connectable` restricted to `*.aquaidp.xyz` + localhost; `onMessageExternal` re-checks `sender.origin/url` via `isAllowedSenderOrigin()` — foreign origins get `{error: 'origin_rejected'}` |
| New module | — | `local-first.js` — pure-function gating module (no chrome/fetch/DOM), imported by `background.js` and by the node test |

## Storage keys added

- `localFirst` (default `true`; only explicit `false` disables — fail-closed)
- `syncToHub` (default `false`; only `=== true` syncs the local bank to hub)
- `localAnswerBank[]` — local answer entries `{id, questionText, answerText, method, savedAt, syncedToHub}`
- `consentLog[]` — BYOK egress receipts (bounded to 500)

New message type: `BANK_LOCAL_LIST` returns the local bank.

## Egress matrix — before → after

| Path | Destination | Content | Before | After (localFirst ON) |
|---|---|---|---|---|
| `/api/match-question` | aquaidp.xyz | question text only | sent on scan | unchanged (question text, no answer bodies) |
| `/api/answers/capture` | aquaidp.xyz | answer bodies | sent implicitly | local-only; hub send requires `syncToHub` opt-in |
| `/api/hub/ingest` | aquaidp.xyz | page capture w/ answer bodies | sent on click | sent on click with answer bodies stripped |
| `/api/integrations/key` | aquaidp.xyz | BYOK key fetch (inbound) | unchanged | unchanged |
| Anthropic/OpenAI BYOK | api.anthropic.com / api.openai.com | question + bank answer | sent silently | refused until per-call user confirm; receipt logged |
| `FILL_*` | funder form DOM | answer bodies | on user click | on user click only (`userInitiated` enforced) |
| `AGENT_SEND_REQUEST` | localhost agent | page capture incl. bodies | on user click | unchanged (localhost = inside the boundary; still user-initiated) |
| `EXPORT_MARKDOWN` | local file download | page capture | on user click | unchanged (local write, not egress) |
| `onMessageExternal` | — | — | unguarded | aquaidp.xyz + localhost only |

## Automated tests

```bash
node webextension/application-hub/test/local-first.test.mjs
```

41 assertions over `local-first.js`: origin allow/deny, flag defaults,
capture stripping, consent evaluation, receipt shape.

## Manual test steps

1. Load `webextension/application-hub` unpacked. Confirm fresh install
   defaults: `chrome.storage.local.get('localFirst')` → `true`,
   `syncToHub` → `false`.
2. Open a supported application page, type ≥10 chars into a field, blur.
   Check `chrome.storage.local.get('localAnswerBank')` — entry present.
   DevTools Network: **no** request to `/api/answers/capture`.
3. Click "Save to bank" in the sidepanel — same: local bank grows, no
   hub POST. Set `syncToHub: true` and repeat — POST fires.
4. Automation Assist → "Capture to Hub" with typed answers on the page.
   Inspect the `/api/hub/ingest` payload: `questions[].value` empty,
   `content` shows `[redacted — local-first]`,
   `metadata.redactedAnswers > 0`.
5. Click "Generate" with a BYOK key configured: a confirm dialog names
   provider + model. Cancel → nothing sent (no Anthropic/OpenAI request).
   Accept → one provider call; `chrome.storage.local.get('consentLog')`
   gains a receipt with `provider`, `model`, `ts`.
6. "Generate all" — one batch confirm; each field records its own receipt.
7. In the page console:
   `chrome.runtime.sendMessage('<ext-id>', {type:'FILL_FIELD_REQUEST',...})`
   from a foreign origin context → `origin_rejected` /
   `user_action_required` (fills only ever fire via sidepanel clicks).
8. Set `localFirst: false` → consent prompt no longer appears and ingest
   sends full capture (legacy behaviour preserved for opt-out).

## Known limits / follow-ups

- `webextension/chrome/application-hub` (parallel Chrome build, LF-033) was
  not modified — apply the same boundary there when it next ships.
- `matchQuestions` still POSTs question text to the hub for matching; under a
  stricter reading of LF-005 this would move to a local corpus — out of scope
  for LF-13.
- The consent dialog is `window.confirm` — honest but minimal; a richer
  per-provider consent UI is a follow-up.
