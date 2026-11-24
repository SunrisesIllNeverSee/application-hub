#!/usr/bin/env bash
# Vercel "Ignored Build Step" (app/vercel.json ignoreCommand; runs from app/).
# Exit 0 = skip the build. Exit 1 = run the build.
#
# Preview (every branch but main): skip by default to cut build cost. Put
# [preview] in the commit message to get a preview link for that push.
# The "does it still build" check for PRs is the "Next.js app" job in
# .github/workflows/ci.yml, which runs npm run build.
#
# Everything else (production, or Vercel did not say): build only when something
# under app/ changed since the last deployed commit. When in doubt, build.
set -u

# Skip only a git-branch preview: a deploy with no branch (CLI) always builds.
ref="${VERCEL_GIT_COMMIT_REF:-}"
if [ "${VERCEL_ENV:-}" = "preview" ] && [ -n "$ref" ] && [ "$ref" != "main" ]; then
  case "${VERCEL_GIT_COMMIT_MESSAGE:-}" in
    *"[preview]"*)
      echo "[preview] in commit message: building preview"
      exit 1
      ;;
  esac
  echo "Skipping preview build. Add [preview] to the commit message to build one."
  exit 0
fi

# Compare against the last deployed commit when Vercel provides it, so a
# multi-commit push is judged on all its commits, not only the newest one.
# The script runs from app/ (the Vercel root directory), so "." is app/.
base="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
if git diff --quiet "$base" HEAD -- .; then
  echo "No app/ files changed since $base: skipping build"
  exit 0
fi
# Files changed, or git could not tell (exit 128, e.g. shallow clone or unknown sha): build.
exit 1
