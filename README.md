# Application Hub

**Founder-first application infrastructure for accelerators, grants, jobs, schools, and fellowships.**

[![CI](https://github.com/SunrisesIllNeverSee/application-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/SunrisesIllNeverSee/application-hub/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-14.2.35-black)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ECF8E)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6)
![MCP](https://img.shields.io/badge/MCP-31%20tools-6E56CF)
![Vercel](https://img.shields.io/badge/Vercel-Live-black)
![Custody](https://img.shields.io/badge/Local--first%20custody-DB%20enforced-0A7EA4)

Application Hub is a founder-first product built on a portable application graph. It turns recurring application questions into reusable assets, helps users build an answer bank that compounds over time, and exposes the full intelligence layer through both a web app and an MCP server.

The public wedge is startup opportunities. The underlying spine is broad enough to support grants, jobs, and school applications without a ground-up rebuild.

## What It Does

- Archives reusable application questions and scores them by significance
- Builds a reusable answer bank so one strong answer can travel across many opportunities
- Ranks opportunities with program DNA, fit scoring, and readiness signals
- Supports BYOK drafting, review persistence, and agent-side critique through MCP

## Who It’s For

- Founders applying to accelerators, fellowships, grants, and venture programs
- Power users working directly in Claude, Cursor, or Windsurf through MCP
- Future adjacent users in jobs, schools, and grants once those public surfaces expand

## Current State

| Surface | State |
|---|---|
| Live app | `https://aquaidp.xyz` — local-first build live |
| Custody | Private answers/notes live in a browser-encrypted IndexedDB vault; Postgres **enforces** the boundary (RLS deny-write policies, migration 051 — see `docs/STATUS.md`) |
| Archive + migration counts | See `docs/STATUS.md` (registry archived to `docs/archive/build-era/agents/`) |
| MCP server | `aqua-mcp-server@1.0.1` on npm — 31 tools (25 `hub_*` + 6 `aqua.*`), manifest at `/.well-known/mcp`, docs at `/mcp` |
| Web product | Hub, local vault bank, workspace, packet freeze/sign/export, imports, BYOK |
| Review layer | persisted reviews + stress tests + starter reviewer family |

## Local-First Custody (what "your data stays yours" means here)

- **Vault**: answers, drafts, intake blobs, and provider keys are AES-GCM encrypted under your secret in this device's IndexedDB — `aqua-local-<your uid>` per account, isolated on sign-out/switch.
- **Server contract**: private-content API routes refuse under the local-first flag (HTTP 403); the database enforces the same boundary with RESTRICTIVE RLS policies — authenticated writes to the six private-content tables are denied while `local_first` is active.
- **BYOK**: generation goes browser → your provider directly (Anthropic/OpenAI/Google/Ollama); each generation writes a consent receipt naming the endpoint before egress; new custom endpoints get a first-use warning.
- **Packets**: application packets freeze a sha256 manifest and are signed on-device (ECDSA). The server never sees the content unless you export it yourself.
- **Honest limits**: Ollama on `localhost` is blocked by browser Private Network Access on hosted HTTPS — use an HTTPS endpoint or run the app locally.

## Architecture At A Glance

```mermaid
flowchart TD
    A["Next.js app on Vercel"] --> B["App APIs + MCP server"]
    B --> C["Supabase<br/>portable application graph<br/>RLS + scoring"]
    B --> D["BYOK providers<br/>Anthropic / OpenAI / Ollama / Google"]
    B --> E["Stripe"]
```

## Quick Start

### App

```bash
cd app
npm install
npm run type-check
npm run build
```

### MCP server

Published package:

```bash
npx aqua-mcp-server@1.0.1   # 31 tools; needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
```

From source:

```bash
cd application-hub-mcp-server
npm install
npm run check
```

Prerequisites:
- live Supabase project aligned with the current migration chain in `docs/STATUS.md`
- app env vars for Supabase
- MCP env vars for Supabase service-role + anon access

## Repo Guide

- `REPO_INDEX.md` — navigational map of the whole repository (start here)
- `docs/ROADMAP.md` — sequence and leverage
- `docs/STATUS.md` — confirmed repo state
- `docs/VISION.md` — product thesis and future shape
- `docs/ARCHITECTURE.md` — architecture overview
- `docs/MIGRATIONS.md` — migration chain and duplicate-prefix policy
- `docs/STRIPE_SETUP.md` — Stripe activation walkthrough
- `docs/BYOK_OLLAMA.md` — verified Ollama tunnel path
- `docs/21_curated_ingest_lane.md` — narrow staging/promotion rule for new targets
- `docs/archive/` — superseded and dated historical material

## MCP And Agents

Application Hub is not just a web app. The MCP server is a first-class product surface.

Current capabilities include:
- answer save/retrieval
- fit and ranking tools
- review-context bridge
- review write-back
- persisted stress tests

Checked-in reviewer family:
- `rns-answer-reviewer`
- `program-fit-reviewer`
- `fidelity-certifier`
- `stress-test-conductor`

## Contributing And Operating

- See `CONTRIBUTING.md` for seed promotion and contribution guidance
- See `docs/09_launch_checklist.md` for launch validation
- See `docs/10_byok_and_draft_policy.md` for BYOK/runtime behavior
- See `docs/SECURITY.md` for security posture and secret-handling rules

## Vision

The point is not to build yet another AI writer. The point is to build infrastructure for the application graph: questions, answers, fit signals, review loops, and reusable identity material that gets stronger with use.

Founder applications are the wedge. Portability across adjacent application domains is the deeper moat.
