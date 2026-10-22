---
type: Evidence
title: M09 W6 — unified application journey (Steps A–H) evidence
description: Commands, results and screenshots for the /apply journey — catalog, paste, file and URL paths walked A→H at 1440px and 390px on the dev harness with synthetic data.
tags: [evidence, m09, journey, local-first]
timestamp: 2026-10-22
---

# M09 W6 — application journey evidence

Branch `m09/journey` (base = `m09/vault-v5` + `m09/catalog-qu`, with `m09/review-ui` (W5) merged in so Step E links to the real `/review/[instanceId]`). All data is
synthetic (fictional programs on `example.org` / `example.net`, synthetic
answers). No production system was touched.

## Commands and results (2026-10-22)

Run from `app/` with `node_modules` linked from the main checkout.

| Check | Command | Result |
|---|---|---|
| Type-check | `npx tsc --noEmit -p .` | exit 0 |
| Node tests | `node --test tests/*.test.mjs` | 268 tests, 268 pass, 0 fail, 0 skipped (journey: 34 new; includes W5's review-ui tests) |
| Vault runners | `node lib/aqua-local/run-{approval,intake,legacy-import,packet,provider-contract,v5}-tests.mjs`, `node lib/aqua-local/run-tests.mjs` | 11 / 15 / 8 / 44 / 7 / 33 / 25 passed |
| Client runners | `node lib/aqua-local-client/run-session-tests.mjs`; score runner with the governance alias shim (`node --import …/ir-node-alias.mjs lib/aqua-local-client/run-score-tests.mjs`) | 41 PASS; 3 passed |
| Production build | `NEXT_PUBLIC_AQUA_LOCAL_FIRST=1 AQUA_LOCAL_FIRST=1 npm run build` (dummy Supabase URL/key) | exit 0; `/apply`, `/apply/[instanceId]`, `/review/[instanceId]` built |
| Harness 404 in production | `next start` then `curl /dev/journey`, `/dev/journey/LA-x` | 404, 404; `/apply` → 307 `/login?next=%2Fapply` |
| Browser walk | see below | `BROWSER WALK: PASS` |

New unit tests (`app/tests/`):

- `journey-review.test.mjs` — URL/paste/catalog review models; wording
  corrections keep the original and are logged; limits/required corrections;
  duplicate merge (stricter limit survives) and remove/restore; program match
  pick/clear and catalog-template choice; activation blockers; deadline
  correction.
- `journey-activate.test.mjs` — catalog path creates an `AI-` instance with
  ids only (no question wording in the record) using the W5 workspace
  convention (`application_id = program_id`, occurrence id =
  `archived_question_id`); a second catalog start, a URL import choosing the
  catalog template, or an instance made by W5's workspace link are all the
  SAME instance (one per program, nothing written); a URL import keeping its
  own list is `LA-` with the program link inside the encrypted template;
  `?url=` deep-link prefill rules; paste path creates an `LA-`
  instance whose encrypted template keeps exact wording, corrections with
  originals, limits and the deadline time zone; blocked models write nothing;
  URL import failures (network, 422, private link, bad body) create nothing,
  private-looking links are never sent, and the request body is `{url}` only;
  lifecycle derivation.
- `journey-candidate.test.mjs` — the server-built public candidate is mapped
  onto W3's schema (`program.name/organization/kind/apply_url`, `cycle` with
  an IANA time zone, questions with `response_type`/limits/`mapping`, each
  canonical id mapped once, `source_refs`, `evidence.deadline_quote`; W2-only
  keys dropped) and the body is **validated with W3's own
  `validateCandidatePayload` + `validateSourceInput`** (loaded with
  `git show m09/catalog-promotion:app/lib/catalog-promotion/{schema,privacy}.ts`
  into a temp dir that the test removes; it uses `lib/catalog-promotion/` once
  merged). Source is `{url, capture_method:'url_fetch'}` — the server
  re-fetches. Filled values, corrections, uncertain/private items and PII are
  refused; local imports and `reuse: disallowed` are never offered; 201 / 400 /
  422 `source_reuse_disallowed` / 422 `source_fetch_failed` / 503 / network.
- `journey-prepare.test.mjs` — required missing, missing approval, required
  skip refused, over word/char limit, sha mismatch, undecryptable, unexplained
  skips, newer-draft warning; plus a memory-vault integration (human
  hash-bound approvals only; a tampered body reads as `sha_mismatch`).
- `journey-file-input.test.mjs` — regression for real browser `File`/`Blob`
  objects (see "Defect found" below); PDF message; docx built in-test.

## Browser walk

```bash
# dev server (harness exists only outside production builds)
cd app
NEXT_PUBLIC_AQUA_LOCAL_FIRST=1 AQUA_LOCAL_FIRST=1 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=dev-harness-dummy-anon-key \
npx next dev -p 3961
# walk (playwright-core 1.56.1 + a local chromium headless shell)
PW_CORE=<dir>/node_modules/playwright-core CHROMIUM=<chrome-headless-shell> \
BASE_URL=http://localhost:3961 node tests/browser/journey.browser.mjs
```

`tests/browser/journey.browser.mjs` walks `/dev/journey` in two fresh browser
contexts (1440×900, 390×844). `POST /api/catalog/extract-url` is stubbed by
network interception with the fixture from `tests/fixtures/journey-fixtures.mjs`
(the same pure pipeline the route runs in its step 3).
`POST /api/catalog/candidates` is stubbed to `503 catalog_promotion_unavailable`.
The `.docx` is generated in-test. Approvals in the walk use the harness-only
"Approve as shown" stand-in, which calls the same `approveAsHuman` API, because
the walk does not sign in, and `/review/[instanceId]` (W5, merged) sits behind auth in the `(app)` layout.

Results (`docs/evidence/m09-journey/results.json`), identical at both widths:

| Path | Steps observed | Instance | D classification | Exported packet |
|---|---|---|---|---|
| catalog | A pick → B template summary → C → D → E (CTA → `/review/<id>?program=<program_id>`) → F → G → H | `AI-` (ids only, `application_id = program_id`) | gap, gap, skip | `verify-packet.mjs`: PASS 10/10 |
| paste | B wording corrected (original kept) → C | `LA-` | **adapt** (source mentions another program), gap, skip | PASS 10/10 |
| file | PDF refused with the unsupported message; .docx parsed on device | `LA-` | gap, gap, **direct** | PASS 10/10 |
| URL | opened as `/dev/journey?url=<encoded>`: prefilled, not fetched, `url=` dropped from the address bar; private Google Docs link refused locally (no request); duplicate merged; contact field removed; W3-shaped candidate body shown → confirmed → 503 "open soon" | `LA-`, imported list kept, program link in the encrypted template | direct, direct, skip | PASS 10/10 |

After the four walks, "My applications" lists 4 instances, all `submitted`.
Reopening one shows the read-only historical view (frozen packet, answers,
submission record) with no editing controls.

Privacy check over every request the pages made:

- request bodies containing answer text, pasted text, file content or the
  vault secret: **0**
- `extract-url` requests: 2 (one per width), body exactly `{"url": "<url>"}`
- `candidates` requests: 2, only after the explicit confirmation
- other off-site requests: `GET googletagmanager.com/gtag/js` (root-layout
  page analytics, pre-existing, no content); no PostHog key is set in the
  harness and the journey emits no PostHog events.

## Screenshots (synthetic only)

`docs/evidence/m09-journey/` — `w1440-<path>-<step>.jpg` for every step of
every path (A choose/paste/url/pdf-unsupported, B review, D populate, E review,
F prepare, G export, H historical) and `w390-<path>-{B,F,H}.jpg` plus
`w390-paste-D-populate.jpg`; `w1440-url-A-url-deeplink.jpg` shows the `?url=` prefill; `w{1440,390}-mine-reopen-list.jpg` shows the
instance list with lifecycle status.

## Defect found and fixed

`lib/catalog/files.ts` `parseUserFile` checked `'bytes' in input` to decide
whether it had raw bytes. Current Chromium gives every `Blob`/`File` a
`bytes()` method, so every real upload read as "The file is empty." It now
reads raw bytes only when `bytes` is a `Uint8Array`/`ArrayBuffer`, and the
journey passes explicit bytes. Regression test: `journey-file-input.test.mjs`.
