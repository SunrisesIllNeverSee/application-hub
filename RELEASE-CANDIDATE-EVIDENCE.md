# Release Candidate — Evidence Pointers (cross-repo)

This branch's verification evidence lives in the **aquarnd** repository
(`~/Developer/_7_labs/aquarnd`), not here. Reviewers should check:

| Deliverable | Location in aquarnd |
|---|---|
| Combined RC review + attestation | `aqua-canon/Planning/Execution/m04/reviews/RC-Combined-*` |
| Test matrix (20 rows) | `aqua-canon/Planning/Execution/m05/evidence/rc-test-matrix.csv` |
| 051 storage custody candidate (review-only) | `aqua-canon/Planning/Execution/m05/candidates/051_*` |
| 052 ledger guards candidate (review-only) | `aqua-canon/Planning/Execution/m05/candidates/052_*` |
| Owner decision register (10 decisions) | `aqua-canon/Planning/Execution/Owner-Decision-Register.md` |
| M06 preflight report | `aqua-canon/Planning/Execution/m06/M06-Preflight-Report.md` |
| Browser walkthrough evidence | `aqua-canon/Planning/Execution/m04/evidence/walkthrough/` |
| Auth readiness / client inventory | `aqua-canon/Planning/Execution/m05/{env-check,client-inventory}` |

Branch state at evidence cut: `m06-release-candidate` =
site main + `m05-reward-integrity` (049/050) + `m04-aqua-staging` (/aqua
surface) + flag-guard/onboarding/ES256-pin corrections.

## lf-local-first evidence (LF-27)

The `lf-local-first` branch (HEAD `929dd83`) carries the M06 local-first
build: `/aqua-local` vault surface, server write boundary
(`lib/local-first-guard.ts`), aqua-local domain lib (`lib/aqua-local/`),
extension capture boundary, and MCP local-first service.

| Deliverable | Location in aquarnd |
|---|---|
| Integrated RC report (LF-27) | `aqua-canon/Planning/Execution/m06/local-first/LF-Integrated-RC-Report.md` |
| LF-27 attestation | `aqua-canon/Planning/Execution/m04/reviews/lf-27-attestation.json` |
| Earlier LF task reports | `aqua-canon/Planning/Execution/m04/reviews/lf-*` |

Verification highlights (full matrix in the report): `tsc --noEmit` clean,
`next build` clean, authenticated `/aqua-local` renders 200 under
`AQUA_LOCAL_FIRST=1`/`NEXT_PUBLIC_AQUA_LOCAL_FIRST=1` and 404s flag-off;
7 private-write API routes return honest 403 `{local_first:true}` under the
flag and original behavior flag-off; vault is client-side IndexedDB only —
zero local-first DB migrations (049/050 are unrelated m05 reward-integrity);
181 tests pass across the 5 node suites + MCP vitest.
