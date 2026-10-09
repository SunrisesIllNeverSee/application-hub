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
