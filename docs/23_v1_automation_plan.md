# V1 Automation — Architecture Plan

_Last updated: 2026-05-11_

## What V1 is

A browser extension that detects form fields on supported application portals, matches
them to the user's Answer Bank via semantic search, and surfaces pre-filled answers —
either automatically or on review, depending on user preference.

**What V1 is not:** autonomous submission. The user always reviews and submits. V1
closes the copy-paste loop, not the submission loop.

---

## Architecture

```
Browser Extension (Chrome MV3)
  ├── Content Script        — runs on portal pages, detects form fields
  ├── Background Worker     — handles API calls, auth, state
  ├── Side Panel / Overlay  — shows matched answers in Suggest mode
  └── Popup                 — settings: mode toggle, auth, portal status

        ↕  (HTTPS calls to mos2es.xyz)

Next.js API
  └── POST /api/match-question
        ├── embed query text  (OpenAI text-embedding-3-small)
        ├── pgvector similarity search (match_archived_questions RPC)
        ├── full-text fallback (if no embeddings)
        └── returns: top 3 matches + user's saved answer + confidence

        ↕

Supabase
  ├── archived_questions  (225 canonical questions + embeddings)
  ├── profile_answers     (user's saved answers)
  └── programs / program_dna  (for program-aware match ranking)
```

---

## UX modes (user-togglable)

### Auto-fill mode
- Content script detects a text field and sends its label to `/api/match-question`
- If the top match has `auto_fill_safe: true` (similarity ≥ 0.87) AND the user has a
  saved answer, the field is pre-populated immediately
- A subtle indicator shows which fields were auto-filled ("✦ Filled from Answer Bank")
- User can click the indicator to see the match or change to a different answer

### Suggest mode  
- Content script scans all visible text fields on page load
- Opens a side panel listing every field with its matched answer (if any)
- User clicks "Apply" per field to paste the answer
- Confidence badges: High / Medium / Low based on similarity score

### Toggle
Lives in the extension popup. Default: Suggest (safer, always shows what will be applied).
Auto-fill can be enabled per-session or as persistent preference stored in `chrome.storage.sync`.

---

## Confidence thresholds

| Threshold | Label | Auto-fill safe |
|---|---|---|
| ≥ 0.87 | High | Yes (auto-fill mode only) |
| 0.72–0.86 | Medium | No — show in suggest panel |
| < 0.72 | Low | No — show as "possible match, review carefully" |

These constants live in `/api/match-question/route.ts` as `AUTO_FILL_THRESHOLD` and
`DEFAULT_THRESHOLD`. Tune after seeing real match data.

---

## Question identity resolution

The hard problem is mapping a portal's form field label ("What problem are you solving?")
to a canonical question in the archive. The API handles this in two modes:

**Vector mode (preferred):** Generates an OpenAI embedding for the field label text,
runs cosine similarity against all embedded questions in pgvector. Accurate across
paraphrases and synonyms.

**Full-text fallback:** Uses Postgres `websearch_to_tsquery` when embeddings aren't
available (no platform OpenAI key and no BYOK OpenAI key). Less accurate but still
useful for distinctive phrases.

**Prerequisite:** Run `scripts/seed-question-embeddings.ts` once to populate the 225
question embeddings. After that the vector path is always available.

---

## Portal support strategy

### V1 beta whitelist (5 portals)

| Portal | URL | Status | Notes |
|---|---|---|---|
| Y Combinator | apply.ycombinator.com | Amber — see ToS audit | Highest volume |
| Techstars | application.techstars.com | Green | Standard form |
| a16z Start | starts.a16z.com | Green | React SPA |
| 500 Global | 500.co/apply | Green | Standard form |
| Solofounders | solofounders.xyz | Green | Community platform |

See `docs/24_portal_tos_audit.md` for full ToS posture per portal.

### Extension URL matching
Content scripts only activate on whitelisted hostnames. Config lives in `manifest.json`
`matches` array. Adding a new portal = one line in the manifest + one content script
test pass.

```json
"content_scripts": [{
  "matches": [
    "https://apply.ycombinator.com/*",
    "https://application.techstars.com/*",
    "https://starts.a16z.com/*",
    "https://500.co/apply/*",
    "https://solofounders.xyz/apply/*"
  ],
  "js": ["content.js"]
}]
```

### DOM extraction approach
Form field detection uses a priority chain:
1. `<label for="...">` → `<input id="...">` — most reliable
2. `aria-label` attribute on the input element
3. Adjacent text node above/before the input
4. Placeholder text (lowest confidence — many portals use generic placeholders)

Each portal may need a custom selector override if the standard chain fails. These
overrides live in `extension/portals/*.ts` (one file per portal).

---

## Auth flow

The extension needs a user session to call `/api/match-question`.

**V1 approach (simplest):** User opens Application Hub in the same browser, logs in.
The extension reads the Supabase session from `localStorage` on the `mos2es.xyz` origin
via a content script injected on `mos2es.xyz/*`. This is same-origin, no special
permissions needed.

**V1+ approach (more robust):** Generate an extension API token in `/profile/settings`
that the user pastes into the extension once. Token is a signed JWT scoped to
`match-question` only. Avoids needing Application Hub open in a tab.

V1 ships with the localStorage approach. Token approach ships in V1+.

---

## What's already built

| Component | Status |
|---|---|
| Answer Bank (source of pre-fill content) | Done |
| pgvector schema + `match_archived_questions` RPC | Done |
| `/api/match-question` API route | Done |
| Question embeddings (225 questions) | **Needs seeding** — run `scripts/seed-question-embeddings.ts` |
| OpenAI embedding for runtime queries | Done (uses `OPENAI_API_KEY` or BYOK) |
| Full-text fallback | Done |
| Browser extension | **Not started** |

---

## Build sequence

1. **Run embedding seeding script** — `npx tsx scripts/seed-question-embeddings.ts`
   (needs `OPENAI_API_KEY`). One-time. ~225 API calls, pennies.
2. **Test `/api/match-question`** locally with real field label strings
3. **Scaffold Chrome extension** — MV3 manifest, content script stub, background worker
4. **Implement content scripts per portal** — starting with Techstars (clearest HTML),
   then 500 Global, then a16z, then YC
5. **Ship Suggest mode first** — lower risk than Auto-fill
6. **Add Auto-fill toggle** once Suggest mode is validated

---

## Open decisions

| Decision | Default | Notes |
|---|---|---|
| Extension auth method | localStorage read | Token approach is cleaner but adds setup friction |
| YC inclusion | Amber — ship without until ToS reviewed | See portal audit |
| Confidence thresholds | HIGH=0.87, MED=0.72 | Tune after seeing live match data |
| Side panel vs overlay | Side panel preferred | Chrome's native Side Panel API (MV3) is cleaner than injected overlay |
