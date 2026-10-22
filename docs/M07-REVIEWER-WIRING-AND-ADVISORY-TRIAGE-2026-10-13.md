---
type: Reference
title: "AQUA M07 — Independent wiring and residual-finding review"
description: "AQUA M07 — Independent wiring and residual-finding review (M07-REVIEWER-WIRING-AND-ADVISORY-TRIAGE-2026-10-13.md); frontmatter added mechanically for OKF conformance, body unchanged."
tags: [application-hub]
timestamp: 2026-10-13
---
# AQUA M07 — Independent wiring and residual-finding review

Review baseline: production `cbf6986`. This note is a source-level audit, **not** an owner policy decision, merged product change, production deployment, or a declaration that all listed findings are resolved. Owner's M07 request is to complete outstanding issues fully.

## Safe small fix in this review branch

The site `/developers` and `/.well-known/mcp` claim 27 MCP tools. The current `application-hub-mcp-server/src/tools/` registry contains **31** registration calls: 11 public `hub_*`, 14 account-scoped `hub_*`, and 6 `aqua.*`. This branch repairs the advertised totals, categories and source path, and labels local-first private-write refusals truthfully.

The npm registry's `aqua-mcp-server@1.0.0` tarball contains README.md and package.json only; its declared `dist/index.js` binary is missing. Until a verified executable version is owner-authorized and published, the developer portal and manifest must not claim `npx -y aqua-mcp-server` works. This branch temporarily recommends the source build, with `AQUA_LOCAL_FIRST=1` for the local MCP process.

The prior quickstart demonstrated `POST /api/match-question` while local-first refuses that route with 403. The corrected quickstart points at public discovery and explicitly notes local private matching. The Appfeeder capture claim is labeled deferred.

## Independent assessment of the eight residual findings

| Finding | Evidence / actual contract | Treatment to verify in M07 |
|---|---|---|
| IR-014 | `repo.ts` writes version titles in plaintext; `answers.scope` contains plaintext identifiers. `LF-Privacy-Threat-Model.md` explicitly permits title/scope metadata leakage. | Preserve index and migration compatibility; consider encrypted private titles. Metadata exception is *not* proof titles are nonsensitive. |
| IR-015 | `AQUA_LOCAL_FIRST` server-only is insufficient when the client twin is missing: old client `profile_answers` writers can operate. | Build/deployment fail-closed validation and independent Supabase RLS review; do not assume a configured Vercel flag enforces direct client writes. |
| IR-024 | `repo.ts::signPacket` stores caller-provided `signature_b64`; the governed `signoff.ts::attestPacket` validates packet state and stored manifest SHA. | Verify the raw primitive is never promoted as a verified signature by readers/exports. Distinguish an unverified claim from cryptographic attestation. The ledger's `closed` is a documented scope acceptance, not removal of the behavior. |
| IR-026 | `saveScopedVersion` refuses cross-answer parent links; a new application scope creates a root version even if drafted from a bank answer. | Preserve source lineage separately from `parent_version_id`, never transfer prior approval across scopes. Ledger `closed` records by-design acceptance, not restored lineage. |
| IR-035 | `intake.ts` saves `catalog_cache.blob.questions[].text`, entity name, source URL and application title as plaintext. Raw pasted source is not stored, but selected extracted question text can still be sensitive. | Encrypt locally authored intake question content and update compatible backup/import/read paths; migrate old records safely. This is a stronger exposure than a nonsemantic ID. |
| IR-036 | `importOccurrenceId(question, idx)` includes batch index, so reordered re-import duplicates slots. | Deterministic order-invariant identity for distinct normalized questions; retain intra-batch differentiation for literal duplicates and never misbind cross-application versions. |
| IR-037 | Heuristic Q&A parser can split question-mark lines inside an answer or absorb a genuine unmarked question. | Surface ambiguity and edit/confirm preview before commit; adversarial parser fixture tests. No claim of zero ambiguity from a line grammar alone. |
| IR-038 | `/api/hub/smart-matcher` currently caps serialized `user_persona` at 8 KB, in addition to per-key/value bounds; the ledger's approximate 25 KB worst-case is stale. | Preserve the legitimate persona-matching contract, but validate *source/authorization* for text fields; size caps do not prove that a body is nonprivate. Test canary egress and explicit consent where needed. |

## Integration / release handoff

- Keep fixes to `/developers` and `/.well-known/mcp` in this review branch. Cherry-pick or merge only after Devin's M07 branch has been reconciled; there may be overlap with the pending npm package work.
- Do not automatically deploy this documentation branch. Production is `cbf6986` while M07 work proceeds.
- All eight findings require concrete outcome labels: VERIFIED FIX, VERIFIED ACCEPTED RISK with exact owner approval, or OPEN. The existing historical ledger must remain intact; append independent evidence rather than erasing counterexamples.
- Critical M07 acceptance includes real packaged npm install+tools/list, BYOK localhost/remote connectivity, browser coverage, and privacy/backup backward compatibility.
