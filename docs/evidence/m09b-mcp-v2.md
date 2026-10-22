---
type: Findings
title: "M09b B0.1 aqua-mcp-server 2.0 evidence"
description: "Test counts, gates, hosted end-to-end checks, security-review fixes, and the public-readability (not_public) evidence for aqua-mcp-server 2.0.0."
tags: [m09b, mcp, evidence]
timestamp: 2026-10-22
---
# M09b B0.1: aqua-mcp-server 2.0.0 evidence (2026-10-22)

The work is on branch `m09b/mcp-v2`, based on `m09/integration` and merged with `m09b/mcp-routing` and the `m09/integration` CI fix. It was built by ASSIST.

- Local runs used Node v26.10.0; CI uses Node 22.
- All fixtures are synthetic. No secrets appear in any output.

## Tool counts (from `application-hub-mcp-server/TOOLS.json`, generated)

| Mode | Tools | Tiers |
|---|---|---|
| stdio-workspace | 37 | 23 read, 8 private_write, 1 human_consent, 5 human_only |
| stdio-catalog (no workspace open) | 14 | 13 read, 1 human_consent (11 public tools + `locate_workspace`, `init_workspace`, `doctor`) |
| hosted | 11 | 11 read |

How the stdio modes work:

- They run on the companion's `createAquaToolRegistry` (merged from `m09b/agent-path`).
- The companion owns tools, session and tier enforcement.
- `init_workspace` uses MCP elicitation through the dispatcher's server-to-client requests. On success it switches modes and sends `notifications/tools/list_changed`.

Resources:

- In all modes: `aqua://programs`, `aqua://programs/{slug}`, `aqua://questions/{id}`.
- In workspace mode only: `aqua://workspace/status`.

The prompts are `start-application`, `reuse-my-answers` and `get-ready-to-export`.

## Gates

| Command | Result |
|---|---|
| `cd application-hub-mcp-server && npm test` | 51 / 51 |
| `npm run manifest:check` / `npm run vendor:hosted:check` | up to date / up to date |
| `node scripts/gen-agent-guidance.mjs --check` | up to date (37 tools from TOOLS.json) |
| `cd app && npm run -s test:unit` | 383 / 383 (includes `tests/mcp-hosted.test.mjs`, 11) |
| `npx tsc --noEmit -p app` | clean |
| `cd aqua-companion && npm test` | 90 / 90 |
| `npm run build` (placeholder env) | ok; `ƒ /api/mcp`, `○ /mcp` |

## Hosted end-to-end (local production build, `next start`)

| Request | Result |
|---|---|
| `POST /mcp` `tools/list`, Accept `application/json, text/event-stream` | 200, 11 tools. Passes the middleware rewrite to `/api/mcp`. |
| `POST /mcp` `initialize` 2025-11-25 | 200, `protocolVersion` 2025-11-25 |
| `GET /mcp` with `Accept: text/html` | 200 html (the rewritten 2.0 docs page) |
| `GET /mcp` with `Accept: text/event-stream` | 405 |
| notification | 202, no body |
| `hub_search_programs` (production anon config) | ok, total 5 |
| `resources/read aqua://programs/yc-summer-2026` (production) | ok, 30 questions; sections scores/stats/questions ok |

## Security review (independent reviewer, read-only)

The reviewer found no critical or high issues. Every medium and low finding was fixed in `290ea2c`, each with a regression test (`test/review-fixes.test.mjs` and the last two tests in `app/tests/mcp-hosted.test.mjs`):

- Bodies and responses are streamed with a byte cap.
- The rate-limit IP comes from `x-vercel-forwarded-for`, then `x-real-ip`, then the last `x-forwarded-for` entry.
- Stored cross-program aggregates are no longer read.
- Catalog reads are coalesced and failures are negatively cached.
- Trusted fields come only from fixed lists.
- The upstream error-code format is allowlisted.
- Arguments are checked as own properties only.
- Remote configs are pinned to `https://<ref>.supabase.co`.

The finding about future setup handlers is resolved: the companion's own `setupContext` now carries no stdin/stdout.

One accepted residual: an approved program's slug is identifier-shaped catalog text in a trusted field. Slugs come only from the approval registry or reviewer-curated publishes.

## not_public evidence

### Live production check (read-only GETs, publishable key, counts only)

The check ran on 2026-10-22 at 19:14 UTC against `betcyfbzsgusaghriptz` (`npm run live-check`). The key came from the Supabase MCP `get_publishable_keys` call, approved by OWNER.

| Table (scoped to approved programs) | Anon readable | Rows |
|---|---|---|
| programs (approved: registry slug or source=canonical) | yes | 5 |
| programs score columns | yes | 5 |
| program_cycles | yes | 0 |
| program_questions | yes | 103 |
| archived_questions (referenced) | yes | 103 |
| program_dna | yes | 42 |
| program_stats | yes | 0 |
| acceptance_reports (verified) | yes | 0 |
| unapproved program rows visible to the anon key | | 0 (052 in effect) |

**not_public list in production: empty.** Every table the tools use is readable with the public key, within the approved scope.

Empty data:

- `program_cycles`, `program_stats` and `acceptance_reports` have no rows for approved programs.
- `heat_score` and `program_value_score` are null on all 5 programs, so `hub_get_heat_scores` and `hub_get_program_rankings` return 0 results.

This is a data gap, not an access gap. `not_public` handling is covered against a fake PostgREST: 401, 403, 42501 and 404/PGRST205, with each section degrading on its own.

### Static expectation (migrations)

| Data | Anon read | Source |
|---|---|---|
| `programs` | approved rows only | 052 |
| `program_cycles` | all rows. The tools still scope reads to approved ids. | 039 |
| `program_questions`, `archived_questions`, `program_dna`, `program_stats` | canonical programs' rows | 052 |
| `acceptance_reports` | `verified = true` rows | 005 |
| RPCs `get_top_programs_by_value`, `match_archived_questions` | not used | 2.0 design |

## Removed

The 1.x sources were removed in `4963060`, approved by OWNER on 2026-10-22:

- `src/**/*.ts` (the service-role client, `user_token` tools, the `OPERATOR_USER_ID` bypass, hosted private-answer tools, the old matcher);
- `src/data/`;
- the nested 1.x plugin;
- `tsconfig.json`, `vitest.config.ts` and `.env.example`.

The `SERVICE_ROLE` grep test is green.
