# LF-25 — Local-first server write boundary: refusal matrix

Date: 2026-05-24 (session). Branch: `lf-local-first`.
Flag: `AQUA_LOCAL_FIRST=1` (server) / `NEXT_PUBLIC_AQUA_LOCAL_FIRST=1` (client) /
`AQUA_LOCAL_FIRST=1` (MCP server).

Method: `next dev` on :3123 with `AQUA_LOCAL_FIRST=1` and
`NEXT_PUBLIC_AQUA_LOCAL_FIRST=1`; control server on :3124 without the flag.
Curls sent unauthenticated — the guard refuses before/at the auth boundary
for all wholesale-gated routes, so 403s are reachable without credentials
(fail closed). Onboarding and fill check auth first, so they 401
unauthenticated and still cannot write.

## Flag ON (:3123)

| Route | Result | Verdict |
|---|---|---|
| POST /api/answers/capture | 403 `{"error":"local-first mode: private content stays on device","local_first":true}` | REFUSED ✅ |
| POST /api/onboarding/complete | 401 `{"error":"Unauthorized"}` (auth precedes guard; with a session the profile meta update succeeds and answers are dropped with `answers_stored_server_side:false`) | NO WRITE PATH ✅ |
| POST /api/draft | 403 `{"error":"local-first mode: private content stays on device","local_first":true,"detail":"Drafting runs on your device in local-first mode."}` | REFUSED ✅ |
| POST /api/applications/intake | 403 `{"error":"local-first mode: private content stays on device","local_first":true}` | REFUSED ✅ |
| POST /api/applications/[id]/fill | 401 unauthenticated; with auth, non-`dry_run` → 403 refusal; `dry_run:true` allowed (read-only) | WRITE REFUSED ✅ |
| POST /api/import/paste | 403 `{"error":"local-first mode: private content stays on device","local_first":true}` | REFUSED ✅ |
| POST /api/import/application/save | 403 `{"error":"local-first mode: private content stays on device","local_first":true}` | REFUSED ✅ |
| AnswerEditor.tsx client upsert | `NEXT_PUBLIC_AQUA_LOCAL_FIRST` → Supabase upsert skipped, "Local-first mode" notice + "Kept on device — not saved to server" state, button label "Keep on device". Never fake-saves. | SKIPPED ✅ |
| MCP hub_save_answer | `AQUA_LOCAL_FIRST` → `isError` result "Refused: local-first mode: private content stays on device" | REFUSED ✅ |
| MCP hub_save_answer_review | same refusal | REFUSED ✅ |
| MCP hub_log_draft_run | same refusal ("draft-run payloads can carry private content") | REFUSED ✅ |
| MCP hub_intake_application | same refusal ("pasted application text stays on device") | REFUSED ✅ |
| MCP hub_fill_application | refused unless `dry_run:true` | WRITE REFUSED ✅ |
| MCP hub_set_borrow_threshold | same refusal ("preference writes to your server profile are disabled") | REFUSED ✅ |

## Public / auth / catalog paths (flag ON, still working)

| Path | Result |
|---|---|
| GET / | 200 |
| GET /.well-known/agent.json | 200 |
| GET /.well-known/mcp | 200 |
| GET /api/beta/check | 401 (auth required — unchanged) |
| POST /api/stress-test | 401 (auth required — unchanged; read-only sink left open) |
| POST /api/credits/claim | 401 (auth required — unchanged; metadata-only) |

## Flag OFF (:3124, control)

| Route | Result |
|---|---|
| POST /api/answers/capture | 401 Unauthorized (normal auth path — guard inert) |
| POST /api/draft | 401 Unauthorized |
| POST /api/applications/intake | 401 Unauthorized |
| POST /api/import/paste | 401 Unauthorized |
| POST /api/import/application/save | 401 Unauthorized |

## Unit tests

`node --test app/tests/local-first-guard.test.mjs` — 7/7 pass
(flag semantics, 403 payload shape, null-when-off, extra-detail merge).

## Type checks

- `app/`: `npx tsc --noEmit` clean.
- `application-hub-mcp-server/`: `npx tsc --noEmit` clean; `npx vitest run` 69/69 pass.
