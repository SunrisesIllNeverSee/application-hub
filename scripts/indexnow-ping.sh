#!/usr/bin/env bash
# IndexNow ping script for mos2es.xyz
# Notifies Bing, DuckDuckGo, Yandex, and Seznam about page updates.
#
# Usage:
#   ./scripts/indexnow-ping.sh                          # ping all sitemap URLs (fetched live)
#   ./scripts/indexnow-ping.sh /applications/timeline   # ping a single URL

set -euo pipefail

HOST="mos2es.xyz"
KEY="f1f880e1830342be8c1180ee9a7cfb41"
KEY_LOCATION="https://${HOST}/${KEY}.txt"
SITEMAP_URL="https://${HOST}/sitemap.xml"

ENGINES=(
  "https://api.indexnow.org/indexnow"
  "https://www.bing.com/indexnow"
  "https://yandex.com/indexnow"
)

if [ "${1:-}" != "" ]; then
  URLS=("https://${HOST}${1}")
else
  echo "Fetching sitemap from $SITEMAP_URL ..."
  SITEMAP_CONTENT=$(curl -s "$SITEMAP_URL")
  if [ -z "$SITEMAP_CONTENT" ]; then
    echo "ERROR: Could not fetch sitemap from $SITEMAP_URL" >&2
    exit 1
  fi
  mapfile -t URLS < <(echo "$SITEMAP_CONTENT" | sed -n 's/.*<loc>\(.*\)<\/loc>.*/\1/p')
fi

echo "Pinging ${#URLS[@]} URL(s) to ${#ENGINES[@]} engines..."

# IndexNow allows max 10,000 URLs per request; batch in groups of 100
BATCH_SIZE=100
for (( i=0; i<${#URLS[@]}; i+=BATCH_SIZE )); do
  BATCH=("${URLS[@]:i:BATCH_SIZE}")

  PAYLOAD=$(jq -n \
    --arg host "$HOST" \
    --arg key "$KEY" \
    --arg keyLocation "$KEY_LOCATION" \
    --argjson urlList "$(printf '%s\n' "${BATCH[@]}" | jq -R . | jq -s .)" \
    '{host: $host, key: $key, keyLocation: $keyLocation, urlList: $urlList}')

  for ENGINE in "${ENGINES[@]}"; do
    echo ""
    echo "→ $ENGINE (batch $((i/BATCH_SIZE + 1)), ${#BATCH[@]} URLs)"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "$ENGINE" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD")
    echo "  Status: $HTTP_CODE"
  done
done

echo ""
echo "Done."
