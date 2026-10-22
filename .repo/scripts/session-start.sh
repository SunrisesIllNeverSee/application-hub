#!/usr/bin/env bash
# SessionStart hook for Claude Code / Devin. Prints pointers only. Never fails.
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
aquarnd="${AQUARND:-$HOME/Developer/_7_labs/aquarnd}"
echo "== application-hub session start =="
echo "Read first: AGENTS.md (instructions), REPO.yaml (repo standard)."
echo "Governance authority: aquarnd repo, aqua-canon/Planning/Execution/m06/local-first/LF-Architecture-Contract.md (this repo implements it)."
if [ -d "$aquarnd/.coord/micro" ]; then
  echo "Coordination: AVAILABLE at $aquarnd/.coord/micro (LEAD/ASSIST roles; see AGENTS.md; read STATE.md and the SCRATCHPAD.md tail there)."
else
  echo "Coordination: NOT available on this machine (aquarnd not found at $aquarnd; set AQUARND to override). Proceed without the bus and do not create one here."
fi
if [ -d "$root/.coord" ]; then
  echo "Note: $root/.coord is machine-local and gitignored; it is not the coordination bus."
fi
hp="$(git -C "$root" config --get core.hooksPath 2>/dev/null)"
if [ "$hp" = ".repo/git-hooks" ]; then echo "Git hooks: installed."; else echo "Git hooks: not installed. Run: bash .repo/scripts/install-hooks.sh"; fi
echo "Tests: cd app && npm test (unit + vault + extension); MCP: cd application-hub-mcp-server && npm test."
exit 0
