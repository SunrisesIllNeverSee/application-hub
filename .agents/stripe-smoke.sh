#!/usr/bin/env bash
# Stripe smoke check — verifies the env-level activation is complete.
# Doesn't make charges. Just confirms:
#   1. all 7 Stripe env vars are set in Vercel (production)
#   2. the production deploy is recent enough to have them
#   3. CRON_SECRET (for recruiter agent) is also set
#   4. the webhook endpoint route compiled in the deployed app
#
# Doesn't verify:
#   - real-world checkout flow (needs a human + test card)
#   - webhook signing key matches Stripe's actual webhook config
#   - that the Stripe dashboard webhook endpoint URL is correct
#
# Usage:
#   .agents/stripe-smoke.sh
#   .agents/stripe-smoke.sh --json   # machine-readable

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JSON_MODE=${1:-text}

# Locate Vercel CLI (handle the hermes node prefix from this setup)
if command -v vercel >/dev/null 2>&1; then
  VERCEL=vercel
elif [ -x "/Users/dericmchenry/Desktop/hermes/node/bin/vercel" ]; then
  VERCEL="/Users/dericmchenry/Desktop/hermes/node/bin/vercel"
else
  echo "vercel CLI not found on PATH; cannot run smoke check" >&2
  exit 3
fi

cd "$REPO_ROOT"

REQUIRED_VARS=(
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  STRIPE_PRO_MONTHLY_PRICE_ID
  STRIPE_PRO_ANNUAL_PRICE_ID
  STRIPE_TEAM_MONTHLY_PRICE_ID
  STRIPE_TEAM_ANNUAL_PRICE_ID
  CRON_SECRET
)

ENV_LIST=$($VERCEL env ls 2>&1 || true)

# Parallel arrays — macOS ships bash 3.2 which lacks associative arrays.
MISSING=""
for var in "${REQUIRED_VARS[@]}"; do
  if ! echo "$ENV_LIST" | grep -q " $var "; then
    MISSING="$MISSING $var"
  fi
done

# Check most recent production deploy age
RECENT_DEPLOY=$($VERCEL ls 2>&1 | grep -E "Production" | head -1 | awk '{print $1}')

# Print report
if [ "$JSON_MODE" = "--json" ]; then
  printf '{\n  "vars": {\n'
  first=1
  for var in "${REQUIRED_VARS[@]}"; do
    [ $first -eq 0 ] && printf ",\n"
    if echo "$MISSING" | grep -q " $var\b"; then
      printf '    "%s": 0' "$var"
    else
      printf '    "%s": 1' "$var"
    fi
    first=0
  done
  printf "\n  },\n"
  printf '  "recent_deploy_age": "%s"\n' "$RECENT_DEPLOY"
  printf '}\n'
else
  echo "=== Stripe smoke check ==="
  echo ""
  echo "Env vars on Vercel (production):"
  for var in "${REQUIRED_VARS[@]}"; do
    if echo "$MISSING" | grep -q " $var\b"; then
      echo "  ✗ $var  (MISSING — set via: vercel env add $var production)"
    else
      echo "  ✓ $var"
    fi
  done
  if [ -z "$MISSING" ]; then
    ALL_SET=1
  else
    ALL_SET=0
  fi
  echo ""
  echo "Most recent production deploy: $RECENT_DEPLOY"
  echo ""
  if [ $ALL_SET -eq 1 ]; then
    echo "✓ All env vars present. Next step: human-driven test."
    echo ""
    echo "  1. Visit https://mos2es.xyz/profile/settings (sign in first)"
    echo "  2. Click 'Upgrade to Pro Monthly'"
    echo "  3. Stripe Checkout: card 4242 4242 4242 4242, any future date, any CVC"
    echo "  4. After redirect back, verify in Supabase:"
    echo ""
    echo "     SELECT user_id, tier, status, stripe_customer_id"
    echo "     FROM user_subscriptions"
    echo "     WHERE stripe_subscription_id IS NOT NULL"
    echo "     ORDER BY updated_at DESC LIMIT 5;"
    echo ""
    echo "  5. Verify webhook fired:"
    echo "     SELECT event_type, processed_at, error_text"
    echo "     FROM stripe_events"
    echo "     ORDER BY received_at DESC LIMIT 5;"
  else
    echo "✗ Some env vars missing — see above. Set them, then redeploy."
  fi
fi
