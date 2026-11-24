#!/usr/bin/env bash
# Vercel "Ignored Build Step" (app/vercel.json ignoreCommand; runs from app/).
# Exit 0 = skip the build. Exit 1 = run the build.
#
# Preview (every branch but main): skip by default to cut build cost. Put
# [preview] in the commit message to get a preview link for that push.
# The "does it still build" check for PRs is the "Next.js app" job in
# .github/workflows/ci.yml, which runs npm run build.
#
# Production: build only when app/ (or the root package files or root
# vercel.json) changed since the last deployed commit. When in doubt, build.
set -u

ref="${VERCEL_GIT_COMMIT_REF:-}"

# No branch (CLI deploy): someone asked for it explicitly, so build.
if [ -z "$ref" ]; then
  echo "No git branch (CLI deploy): building"
  exit 1
fi

if [ "${VERCEL_ENV:-}" = "preview" ] && [ "$ref" != "main" ]; then
  case "${VERCEL_GIT_COMMIT_MESSAGE:-}" in
    *"[preview]"*)
      echo "[preview] in commit message: building preview"
      exit 1
      ;;
  esac
  echo "Skipping preview build. Add [preview] to the commit message to get one."
  exit 0
fi

# Production: compare against the last deployed commit. If Vercel does not say
# which one that was, build rather than guess from HEAD^.
base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$base" ]; then
  echo "No previous deployed commit known: building"
  exit 1
fi
# "." is app/ (the Vercel root directory).
git diff --quiet "$base" HEAD -- . ../package.json ../package-lock.json ../vercel.json
rc=$?
if [ "$rc" -eq 0 ]; then
  echo "No app files changed since $base: skipping build"
  exit 0
fi
[ "$rc" -gt 1 ] && echo "git diff failed (rc=$rc): building"
exit 1
