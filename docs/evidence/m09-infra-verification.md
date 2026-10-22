---
type: Findings
title: "M09 W1 Infrastructure Verification"
description: "Command outputs proving hooks fire, session-start works on a fresh clone, and CI-equivalent commands pass locally (M09 W1)."
tags: [m09, w1, evidence, ci, hooks]
timestamp: 2026-10-22
---
# M09 W1 Infrastructure Verification (2026-10-22)

Branch `m09/infra` (base `28795b4`). Node v26.10.0 locally; CI uses Node 22 (needs 22.18+ for native `.ts` stripping). No secrets in outputs. Verified in a worktree and in scratch clones under `/private/tmp/claude-501/`.

Hook-proof note: a one-off hooksPath override on the commit command line is blocked in the authoring environment by a no-bypass guard, so hook execution was proven in an isolated scratch clone using `install-hooks.sh` (which sets `core.hooksPath` only in that clone). The real checkout's `core.hooksPath` remains unset.

## 1. install-hooks.sh behaviour (scratch clone)
```text
$ bash .repo/scripts/install-hooks.sh (1st)
install-hooks: set core.hooksPath=.repo/git-hooks (was: unset); pre-commit now runs repo_check.py
$ (2nd, idempotent)
install-hooks: core.hooksPath already .repo/git-hooks (no change)
$ git config core.hooksPath other; install-hooks.sh
install-hooks: core.hooksPath is already set to 'other'; refusing to change it. Re-run with --force to replace.
exit=2
$ install-hooks.sh --force
install-hooks: set core.hooksPath=.repo/git-hooks (was: other); pre-commit now runs repo_check.py
exit=0
```

## 2. Hook firing on real commit attempts (scratch clone, hooks installed)
```text
$ commit with a compliant file (hook runs, passes)
Repository Standard v1.0.0 | mode=enforce | type=platform

Result: 0 error(s), 0 warning(s)
[m09/infra 312a7d2] throwaway hook proof (pass)
 1 file changed, 8 insertions(+)
 create mode 100644 docs/zz-throwaway.md
commit exit=0

$ commit with forbidden suffix file docs/plan_final.md (hook must block)
Repository Standard v1.0.0 | mode=enforce | type=platform
WARN  OKF frontmatter incomplete: docs/plan_final.md
ERROR forbidden version/copy suffix: docs/plan_final.md

Result: 1 error(s), 1 warning(s)
commit exit=1
febd057 repo-standard: switch REPO.yaml to enforce (0 errors); document in docs/REPOSITORY-STANDARD.md
```

## 3. Fresh clone: session-start and guards
```text
$ ls -a | grep coord (fresh clone)
(none)
$ bash .repo/scripts/session-start.sh (aquarnd present)
== application-hub session start ==
Read first: AGENTS.md (instructions), REPO.yaml (repo standard).
Governance authority: aquarnd repo, aqua-canon/Planning/Execution/m06/local-first/LF-Architecture-Contract.md (this repo implements it).
Coordination: AVAILABLE at ~/Developer/_7_labs/aquarnd/.coord/micro (LEAD/ASSIST roles; see AGENTS.md; read STATE.md and the SCRATCHPAD.md tail there).
Git hooks: not installed. Run: bash .repo/scripts/install-hooks.sh
Tests: cd app && npm test (unit + vault + extension); MCP: cd application-hub-mcp-server && npm test.
exit=0

$ AQUARND=/nonexistent bash .repo/scripts/session-start.sh
== application-hub session start ==
Read first: AGENTS.md (instructions), REPO.yaml (repo standard).
Governance authority: aquarnd repo, aqua-canon/Planning/Execution/m06/local-first/LF-Architecture-Contract.md (this repo implements it).
Coordination: NOT available on this machine (aquarnd not found at /nonexistent; set AQUARND to override). Proceed without the bus and do not create one here.
Git hooks: not installed. Run: bash .repo/scripts/install-hooks.sh
Tests: cd app && npm test (unit + vault + extension); MCP: cd application-hub-mcp-server && npm test.
exit=0
$ bash .repo/scripts/stamp-guard.sh (no .coord)
exit=0
$ cat CLAUDE.md
@AGENTS.md
$ python3 .repo/scripts/repo_check.py --ci
Repository Standard v1.0.0 | mode=enforce | type=platform

Result: 0 error(s), 0 warning(s)
exit=0
```

## 4. CI-equivalent commands (worktree)
```text
$ python3 .repo/scripts/repo_check.py --ci

Result: 0 error(s), 1 warning(s)
exit=0
$ npm run test:agent
ℹ tests 46
ℹ pass 46
ℹ fail 0
$ npm run test:unit
ℹ tests 113
ℹ pass 113
ℹ fail 0
$ npm run test:vault
25 tests passed
11 tests passed
15 tests passed
8 tests passed
44 tests passed
7 tests passed
PASS cookie: single unchunked session → uid
PASS cookie: single RAW-JSON session (cookieEncoding=raw) → uid
PASS cookie: three-chunk session reassembles
PASS identity: never-resolved + no session → shared anonymous vault
PASS identity: sign-out (definitive null session) clears the sticky identity
PASS identity: definitive null session clears sticky WITHOUT explicit invalidate
3 tests passed
exit=0
$ npm run test:extension
ℹ tests 1
ℹ pass 1
ℹ fail 0
$ npm run type-check
> tsc --noEmit

exit=0
$ npm test (vitest)
 Test Files  5 passed (5)
      Tests  69 passed (69)
$ npm run typecheck

exit=0
$ npm run build

exit=0
$ npm run build (app, next build)
exit=0
```

Session-test runner (`run-session-tests.mjs`): 41 PASS lines, exit 0. `run-score-tests.mjs` (previously unrunnable under plain node because of the `@/` alias): 3 passed.
Pass counts: app unit 113/113, agent-readiness 46/46, vault runners 25+11+15+8+44+7+41(session)+3 (score), extension 1/1, MCP vitest 69/69.

## 5. repo_check enforce evaluation
- Starting tree, mode enforce in scratch copy: 8 errors (`.ello/` unapproved root dir, loose root `RELEASE-CANDIDATE-EVIDENCE.md`, 6 missing `.coord` files).
- After fixes: 0 errors in worktree and in a fresh clone with mode enforce; `REPO.yaml` switched to enforce. See `docs/REPOSITORY-STANDARD.md`.
