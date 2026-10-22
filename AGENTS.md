---
type: Reference
title: "Application Hub — Agent Operating Instructions"
description: "Instructions for Claude, Devin and other agents working in this product repository: authority, data rules, invariants, tests, coordination."
tags: [agents, repo-standard, instructions]
timestamp: 2026-10-22
---
# Agent Operating Instructions: application-hub

This is the **product repository** for AQUA / Application Hub (Next.js app, MCP server, browser extension, Supabase migrations). It is **public on GitHub**. Claude Code reads this through `CLAUDE.md` (`@AGENTS.md`); other agents read it directly.

## Startup order

1. Read `REPO.yaml` and this file.
2. Run `bash .repo/scripts/install-hooks.sh` once per clone (sets `core.hooksPath` to `.repo/git-hooks`, so `repo_check.py` runs on every commit; see `docs/REPOSITORY-STANDARD.md`).
3. Run `python3 .repo/scripts/repo_check.py` before structural changes.
4. Read coordination state if available (see Coordination below).

## Authority

- Governance contracts live in the **aquarnd** repo (default path `~/Developer/_7_labs/aquarnd`), not here. This repo **implements** them.
- Local-first architecture authority: `aqua-canon/Planning/Execution/m06/local-first/LF-Architecture-Contract.md` in aquarnd.
- Milestone directives and plans live under `aqua-canon/Planning/Execution/` in aquarnd. If a contract and this repo disagree, the contract wins; report the drift, do not silently reconcile.
- Production migration ledger is authoritative over migration file headers (`docs/MIGRATIONS.md`).

## Public-repo data rules

- Never commit secrets, API keys, tokens, `.env*` files, user data, private answer text, session captures, or exports from a real vault.
- Do not write security-sensitive prose (exploit details, unpatched weaknesses, credential locations) into commits, docs or PR text. Put such notes in aquarnd.
- Test fixtures must be synthetic.

## Local-first invariants (do not weaken)

- Answer bodies, versions, approvals, packets and submission history live only in the browser-encrypted vault (`app/lib/aqua-local/`). They never reach the server.
- `app/lib/aqua-local/` has zero network imports, except the single marked egress site `providers.ts` (BYOK, consent-gated).
- Server write paths for private bodies refuse under `AQUA_LOCAL_FIRST` (fail closed). Postgres enforces the boundary with deny-write RLS.
- Approval is a human act. Agent-classed approvals never count. No manufactured attestation or fake provider receipts.
- Guard tests: `app/tests/local-first-guard.test.mjs`, `webextension/application-hub/test/local-first.test.mjs`.

## Tests and checks

```bash
cd app && npm test                 # unit (tests/*.test.mjs) + vault suites + extension tests
cd app && npm run test:unit        # tests/*.test.mjs
cd app && npm run test:vault       # lib/aqua-local run-*.mjs, session, score runners
cd app && npm run type-check && npm run build
cd application-hub-mcp-server && npm test && npm run check   # vitest, typecheck, build
python3 .repo/scripts/repo_check.py --ci
```

Vault runners use plain `node` and need Node 22.18+ (native `.ts` type stripping). Use relative imports with `.ts` extensions in `app/lib/aqua-local*`; the `@/` alias does not resolve under plain node. CI (`.github/workflows/ci.yml`) runs all of the above.

## Coordination (one mechanism)

- The only coordination bus is **aquarnd `.coord/micro/`** (roles LEAD and ASSIST; sign in with `bash .coord/bin/start.sh` from the aquarnd root). Read its `AGENTS.md` and `.coord/micro/handoffs/ONBOARDING.md`.
- This repo's `.coord/` (if present) is **machine-local session state and is gitignored**. Do not commit it, do not treat it as the bus, do not create alternate scratchpads here.
- If aquarnd is not on this machine, work without the bus and say so in your PR or report. `.repo/scripts/session-start.sh` reports availability.
- Stay in your lane: do not edit another role's scratchpad entries, state or handoffs.

## Evidence versus session state

- **Governance evidence** (verification outputs, decisions, handoffs) is committed in aquarnd, or for infra checks in `docs/evidence/` here. It must contain no secrets.
- **Machine-local session state** (`.coord/`, scratch files, local vault data, `.env*`) is never committed.

## Repository rules

- No new root directories or root documents beyond `REPO.yaml` allowances. Reports go in `docs/`, generated output in `artifacts/`.
- No `_final`, `_new`, `_copy` style duplicates. Update the canonical file or archive with provenance.
- Never rename or edit existing migration files; add the next numeric prefix. Do not apply production migrations without OWNER authorization.
- Small, intentional commits. Do not force-push `main`. Do not bypass hooks or validation.
