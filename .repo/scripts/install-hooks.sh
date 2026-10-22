#!/usr/bin/env bash
# Install the repository-standard git hooks by pointing core.hooksPath at the
# tracked .repo/git-hooks directory. Idempotent. Refuses to overwrite a different
# hooksPath unless --force is given.
# NOTE: core.hooksPath is stored in the shared .git/config, so it applies to every
# worktree of this clone.
set -euo pipefail
WANT=".repo/git-hooks"
FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1
root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "install-hooks: not inside a git repository" >&2; exit 1; }
cd "$root"
[ -f "$WANT/pre-commit" ] || { echo "install-hooks: $WANT/pre-commit missing" >&2; exit 1; }
chmod +x "$WANT"/* 2>/dev/null || true
cur="$(git config --get core.hooksPath || true)"
if [ "$cur" = "$WANT" ]; then
  echo "install-hooks: core.hooksPath already $WANT (no change)"
  exit 0
fi
if [ -n "$cur" ] && [ "$FORCE" -ne 1 ]; then
  echo "install-hooks: core.hooksPath is already set to '$cur'; refusing to change it. Re-run with --force to replace." >&2
  exit 2
fi
git config core.hooksPath "$WANT"
echo "install-hooks: set core.hooksPath=$WANT (was: ${cur:-unset}); pre-commit now runs repo_check.py"
