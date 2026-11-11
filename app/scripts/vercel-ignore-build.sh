#!/usr/bin/env bash
# Vercel "Ignored Build Step" (app/vercel.json ignoreCommand; runs from app/).
# Exit 0 = skip the build. Exit 1 = run the build.
#
# Preview (every branch but main): skip by default to cut build cost. Put
# [preview] in the commit message to get a preview link for that push.
# The "does it still build" check for PRs is the "Next.js app" job in
# .github/workflows/ci.yml, which runs npm run build.
#
# Everything else (production, or Vercel did not say): always build, as before.
set -u

if [ "${VERCEL_ENV:-}" = "preview" ] && [ "${VERCEL_GIT_COMMIT_REF:-}" != "main" ]; then
  case "${VERCEL_GIT_COMMIT_MESSAGE:-}" in
    *"[preview]"*)
      echo "[preview] in commit message: building preview"
      exit 1
      ;;
  esac
  echo "Skipping preview build. Add [preview] to the commit message to build one."
  exit 0
fi

exit 1
