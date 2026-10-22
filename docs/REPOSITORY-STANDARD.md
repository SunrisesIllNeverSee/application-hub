---
type: Runbook
title: "Repository Standard and Git Hooks"
description: "How the repo-standard check, git hooks and enforce mode work in application-hub, and what enforce means for contributors."
tags: [repo-standard, hooks, ci]
timestamp: 2026-10-22
---
# Repository Standard and Git Hooks

## Mode: enforce (since M09 W1, 2026-10-22)

`REPO.yaml` sets `standard.mode: enforce`. Evaluation before the switch: `python3 .repo/scripts/repo_check.py` in a scratch copy with mode enforce returned 8 errors on the starting tree (an unapproved `.ello/` root dir, one loose root document, six missing `.coord` coordination files). After the fixes below it returns 0 errors, also on a fresh `git clone`.

Fixes made to reach 0 errors: `.ello` and `.claude` added to `allowed_root_dirs_extra`, `CLAUDE.md` to `allowed_root_files_extra`; the loose root `RELEASE-CANDIDATE-EVIDENCE.md` moved to `docs/`; `coordination.micro_enabled` and `macro_enabled` set to `false` (the only coordination bus is aquarnd `.coord/micro/`; this repo's `.coord/` is gitignored and absent on fresh clones); OKF frontmatter completed on 38 docs (bodies unchanged).

### Consequences of enforce

Hard violations now fail `python3 .repo/scripts/repo_check.py` (local hook and the `repo-standard` CI check) instead of warning:

- a new root directory or root document not allowed by the `platform` profile or `REPO.yaml` extras;
- files named with `_final`, `_new`, `_updated`, `_revised`, `_copy` (and similar) suffixes;
- missing required root files, or `REPO.yaml` roots outside the profile;
- coordination files missing, only if `coordination.*_enabled` is turned back on.

OKF frontmatter (`type, title, description, tags, timestamp`) under `docs/` stays a warning (`knowledge.okf_severity: warn`); it is currently clean. To revert, run `python3 .repo/scripts/set_mode.py migrate`.

## Git hooks (authoritative path)

```bash
bash .repo/scripts/install-hooks.sh          # sets core.hooksPath=.repo/git-hooks (idempotent)
bash .repo/scripts/install-hooks.sh --force  # replace a different existing hooksPath
```

`core.hooksPath` lives in the shared `.git/config`, so it applies to all worktrees of the clone. The tracked `pre-commit` hook runs `repo_check.py` and blocks a commit on errors. The older `.repo/scripts/install_git_hook.sh` (copies into `.git/hooks`) is superseded.

### `.pre-commit-config.yaml`

Kept as an optional wrapper for people who use the pre-commit framework; it calls the same `repo_check.py`. It is not authoritative, and the framework refuses to install while `core.hooksPath` is set, so use one or the other. The documented path is `install-hooks.sh`.

## Agent session hooks

`.claude/settings.json` (Claude Code) and `.devin/hooks.v1.json` (Devin) run `.repo/scripts/session-start.sh`, which prints pointers and whether the aquarnd coordination bus is available, and always exits 0. Devin's edit stamp calls `.repo/scripts/stamp-guard.sh`, a no-op when `.coord/` is absent.

## Keeping `repo_check.py` in sync

`.repo/scripts/repo_check.py` is a copy of aquarnd's; adopt aquarnd's newer version when it changes (the M09 sync added `naming.exempt_paths`, output identical here).
