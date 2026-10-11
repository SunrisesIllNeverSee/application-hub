# F-B7 — Route disposition matrix (owner-approved boundary close)

Branch: `lf-local-first` · Flag: `AQUA_LOCAL_FIRST=1` + `NEXT_PUBLIC_AQUA_LOCAL_FIRST=1`
Owner decision: public opportunity data + necessary account/operational metadata
may stay hosted; private application answers, answer histories, and packet
contents are local-first by default. Enforcement is server-side
(`lib/local-first-guard.ts`), with UI honesty as a second layer.

Scope: only the previously identified F-B7 text-bearing routes
(`LF-Boundary-Findings.csv` + GPT pre-cutover addendum). Method is
FIELD-LEVEL — the gate checks payload shape (named free-text fields), never
text content. No keyword detection.

## Whole-route refusals (private-content-egress class)

| Route | What it does | Disposition under flag |
|---|---|---|
| `POST /api/hub/ingest` | Persists arbitrary pasted text to `intake_submissions.raw_input` (manual path) and forwards page captures to the canonical-hub edge function (capture path). | **403 refused.** Same class as the already-gated `/api/import/paste` + `/api/applications/intake`. Public program ingestion continues by URL via the two import routes below. Extension capture is excluded from v1. |
| `POST /api/hub/refine` | Echoes `selectedText` + editor `context` through a server transform. Not a write, but answer text crosses the device boundary. | **403 refused.** Sole consumer (`components/editor/HighlightEditor.tsx`) is not mounted by any v1 surface — verified dead UI path. |

## Field-level gates (mixed route → free-text fields refuse, metadata passes)

| Route | Permitted fields | Refused fields | Verdict |
|---|---|---|---|
| `PATCH /api/applications/[id]/outcome` | `status`, `interview_date`, `would_recommend`, `is_public_result`, explicit `null` clears | `outcome_notes`, `program_feedback` | User-private notes separated from operational status updates. UI (`OutcomeTracker`) hides the free-text inputs under flag; the debounced auto-save can no longer carry them. |
| `POST /api/import/program` | `url`, `program_name` | `questions_text` | Public program ingestion stays functional (URL → `import_queue`); pasted question text refuses. UI textarea hidden under flag. |
| `POST /api/import/submit-url` | `program_url`, `kind` | `notes` | Public grant/program submission stays functional; the free-text channel into `import_queue.raw_text` refuses. UI field disabled under flag. |

## Permitted unchanged (documented scope)

| Route | Why permitted |
|---|---|
| `GET+POST /api/community/messages`, `GET+PATCH+DELETE /api/community/messages/[id]` | Explicitly user-initiated hosted community feature — every write is a deliberate send action through a disclosed compose UI. `ComposeMessage` now carries an explicit "hosted on the AQUA server" disclosure line under the flag. |
| `PATCH /api/profile/identity` | Enum-only (`ApplicantMode`) account metadata — no free-text channel. |
| `POST /api/profile/fms` | Integer tier (1–5) only — account metadata. |
| `POST /api/profile/fundscore` | Takes no body; writes a computed score object — account metadata. |

## Client-side note (informational, unchanged)

`ProfileAboutForm` / `ProfileSettingsForm` / `ApplicationStatusTracker`
write profile bio/settings/status directly to Supabase (route guards can't
reach direct client writes). These are account/operational metadata under
the owner decision — profile bio is not application-answer content. The
durable RLS backstop for direct writes remains the existing owner item in
the M06 authorization package.

## Acceptance behavior (owner examples)

| Case | Result |
|---|---|
| User imports a public grant listing | `POST /api/import/submit-url` with `program_url`+`kind` → queued (`already_queued`/`already_in_archive`/`queued`). Permitted. |
| User pastes private application answers without disclosure/consent | `POST /api/hub/ingest`, `/api/import/paste`, `/api/applications/intake`, `/api/import/application(/save)` → 403 `local_first`. Refused. |
| User deliberately submits to a disclosed hosted community feature | `POST /api/community/messages` → persists (deliberate send + disclosure line). Permitted. |
| Extension capture | Out of v1 scope; `/api/hub/ingest` capture path now refuses under flag regardless. |
| Status update with private notes attached | `PATCH …/outcome` `{status:'accepted', outcome_notes:'…'}` → 403 naming `refused_fields:['outcome_notes']`; `{status:'accepted'}` alone → 200. |

## Negative-test evidence

- `node --test app/tests/local-first-guard.test.mjs` — 12/12 (5 new
  field-level cases: inert-off, refuse-under-flag, metadata-passes,
  non-string refuse, multi-field naming).
- Live refusal evidence: see `lf-restore-and-boundary` browser/route run in
  `aquarnd/…/m06/local-first/` (flagged prod build on :3144) — each gated
  route exercised end-to-end with HTTP status + payload recorded.
