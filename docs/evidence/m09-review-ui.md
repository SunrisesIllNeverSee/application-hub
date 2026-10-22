---
type: Evidence
title: M09 W5 — evidence-based answer review interface
description: Commands, results and screenshots for the review card, review board, offline HTML review and decision-file import (directive §7). Synthetic data only.
tags: [evidence, m09, review-ui, aqua-local, local-first]
timestamp: 2026-10-22
---

# M09 W5 — review interface evidence

Branch `m09/review-ui` (based on `m09/vault-v5`). Every screenshot and sample
file here comes from the dev harness, which seeds an in-memory vault with
**synthetic** data (`app/lib/review-ui/synthetic-seed.ts`: "Example Labs",
"Sample Accelerator 2027"). The harness has no real content and makes no network calls.

## What was built

| Piece | Where |
|---|---|
| Review card: four sections (question context, proposed final answer, evidence, agent recommendation) and four controls (Approve, Edit, Evidence / Help, Discuss) | `app/components/review/ReviewCard.tsx` |
| Review board: statuses, Direct/Adapt/Gap, words vs limit, evidence count, filters, progress, side panel or mobile sheet, one-at-a-time mode | `app/components/review/ReviewBoard.tsx` |
| Export review (HTML) with an exposure notice | `app/components/review/ExportReviewDialog.tsx`, `app/lib/review-ui/html-export.ts` |
| Decision file: build, parse, validate, plan, apply after confirmation | `app/lib/review-ui/decision-file.ts`, `app/components/review/DecisionImportPanel.tsx`, `load.ts` `applyDecisionPlan` |
| Pure view model shared by the card, board and HTML | `app/lib/review-ui/view-model.ts` |
| Route `/review/[instanceId]` (requires an unlocked vault) and a workspace link that opens an instance or creates one | `app/app/(app)/review/[instanceId]/page.tsx`, `app/components/review/{ReviewWorkspace,WorkspaceReviewLink}.tsx` |
| Dev harness (returns 404 in production) | `app/app/dev/review-harness/` |

## Commands and results (run from `app/`)

```bash
npx tsc --noEmit -p .                                   # exit 0
for f in lib/aqua-local/run-*.mjs; do node $f; done     # approval 11, intake 15, legacy-import 8,
                                                        # packet 44, provider-contract 7, core 25, v5 33 — all PASS
node lib/aqua-local-client/run-session-tests.mjs        # 41 PASS
node --test tests/*.test.mjs                            # 129 pass, 0 fail (16 new in tests/review-ui.test.mjs)
npm run build                                           # exit 0 (dummy NEXT_PUBLIC_SUPABASE_* env)
```

Browser tests (Playwright 1.63, Chromium) against `next dev` on the harness:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy \
  NEXT_PUBLIC_AQUA_LOCAL_FIRST=1 npx next dev -p 3457 &
PLAYWRIGHT_MODULE=<dir of a playwright package, e.g. the npx cache> node tests/e2e/review-ui.e2e.mjs
# → 19/19 browser checks passed (1440×900 and 390×844); see e2e-results.json
```

Each viewport checks the following:

1. The board lists all 6 questions with their status and agent classification. Filters and progress work.
2. **Approve** needs a confirm step that shows the exact sha256 on the card. After the approval is recorded, the approval signal reads `Approved · sha256 <prefix>`.
3. **Edit** saves v2 as a child of v1. The approval signal then reads "v1 was approved, v2 is not", and the lineage still shows v1's human approval.
4. **Evidence / Help**: a request is recorded. Status becomes Needs evidence and approval stays Not approved. Attached evidence is linked to the version and also does not approve it.
5. **Discuss**: a comment is bound to the version it was made on ("on v1"). Older comments show "on v1 (earlier version)" when v2 is displayed.
6. **Ask agent to revise** runs the real BYOK path after consent, using the user's instruction. It creates v2 with status **Suggested**, not approved. The provider is an Ollama-shaped mock. Playwright fulfils the request inside the browser, so it never reaches a daemon or the network.
7. One-at-a-time mode supports next and previous.
8. Export → offline HTML → decision file → import → confirm:
   - export is blocked until the exposure acknowledgement is ticked;
   - clicking in the HTML changes nothing in AQUA;
   - the decision file is matched by version id and sha256. A decision for an answer edited after export is listed as `stale_superseded` and is not applied;
   - nothing is written until the user confirms. Approvals are then written with `via decision_file`.
9. There are no page errors. Every request that leaves localhost is aborted.

Production check (`next start`): `/dev/review-harness` returns **404**, and
`/review/<id>` without a session redirects with **307** to `/login?next=…`.

## Screenshots (`docs/evidence/m09-review-ui/`)

| Step | Desktop (1440) | Mobile (390) |
|---|---|---|
| Board | `desktop-01-board.png` | `mobile-01-board.png` |
| Approve confirm (shows the bound hash) | `desktop-02-approve-confirm.png` | `mobile-02-approve-confirm.png` |
| Approved | `desktop-03-approved.png` | `mobile-03-approved.png` |
| Edited → not approved, lineage | `desktop-04-edited-not-approved.png`, `desktop-04b-lineage.png` | `mobile-04-…` |
| Evidence request / evidence linked | `desktop-05-evidence-request.png`, `desktop-05b-evidence-linked.png` | `mobile-05-…` |
| Discussion across versions | `desktop-06-discuss-history.png` | `mobile-06-…` |
| Agent revision (Suggested) | `desktop-06b-agent-revision.png` | `mobile-06b-…` |
| One at a time | `desktop-07-one-at-a-time.png` | `mobile-07-…` |
| Export notice | `desktop-08-export-notice.png` | `mobile-08-…` |
| Offline HTML (light/dark) | `desktop-09/10-offline-html*.png` | `mobile-09/10-…` |
| Import plan (stale shown) / applied | `desktop-11-import-plan.png`, `desktop-12-import-applied.png` | `mobile-11/12-…` |
| Card after import | `desktop-13-after-import-card.png` | `mobile-13-…` |
| Dark theme card | `desktop-14-dark-card.png`, `desktop-14b-dark-recommendation.png` | — |

The samples `sample-review.html` and `sample-decisions.json` are the
synthetic HTML export and decision file from the desktop run.

## Notes

- `node lib/aqua-local-client/run-score-tests.mjs` fails on the base branch
  too, before any of this work (`ERR_MODULE_NOT_FOUND '@/lib'` from
  `local-score.ts`). It is not part of the required runners and is unchanged.
- The legacy unbound `approveVersion` is no longer reachable from any UI
  (`tests/review-ui.test.mjs` enforces this). Answer Bank approvals now go
  through a confirm step and the hash-bound `recordHumanApproval`.
