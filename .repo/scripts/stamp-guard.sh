#!/usr/bin/env bash
# Run the machine-local coordination stamp hook only if it exists. Never fails.
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
s="$root/.coord/micro/scripts/hooks/stamp.sh"
[ -f "$s" ] && bash "$s" "$@" >/dev/null 2>&1
exit 0
