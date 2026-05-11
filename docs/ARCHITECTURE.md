# Application Hub — Architecture

_Last updated: 2026-05-11_

Application Hub is a database-first, MCP-first application platform with a founder-first public wedge and a portable application-graph core.

The durable asset is the combination of:
- a shared **question archive**
- a reusable **answer bank**
- server-side **fit / review / drafting / import** infrastructure

---

## System shape

```text
Vercel + Next.js app
  ↓
Application Hub APIs + MCP server
  ↓
Supabase (PostgreSQL + pgvector + RLS)
  ↙              ↓                ↘
BYOK providers   Stripe           scheduled jobs / alerts
```

Today that means:
- public web app at `mos2es.xyz`
- MCP server for Claude/Cursor/Windsurf/Codex
- Supabase as the single source of truth
- BYOK providers including Anthropic, OpenAI, Ollama, and Google
- Stripe code path in place, with some account/env activation still manual

---

## Current architecture

### 1. Data layer

Location:
- `migrations/`
- `seed/`
- `seed/staging/`

Current state:
- logical migration chain through `026`
- 842 programs/opportunities in the live archive
- 225 archived questions with significance scoring
- question-bank drip, profile/integrations, teams, deadline alerts, funders, and review persistence all in schema

Core responsibilities:
- opportunity catalog
- archived question library
- program/question mapping
- reusable profile answers
- fit scoring and DNA weighting
- draft usage tracking
- BYOK integration metadata
- outcome / alert / review persistence

The database remains the source of truth. UI and MCP clients should consume computed state from there rather than reproducing logic in client code.

### 2. MCP layer

Location:
- `application-hub-mcp-server/`

Current state:
- 21 tools
- 7 resources
- 3 prompts

Important tool families:
- discovery and ranking
- answer save/retrieval
- review-context bridge
- review write-back
- stress-test persistence

The MCP layer is not a sidecar. It is a first-class interface to the platform and a major part of the product story.

### 3. App layer

Location:
- `app/`

Current surfaces:
- landing page
- Hub
- Question Bank
- workspace
- profile split (`about`, `answers`, `settings`, `integrations`)
- import flows
- `/auth/callback`
- `/api/draft`
- Stripe routes

The app is founder-first in copy, but the underlying schema and import/review flows are intentionally portable across jobs, grants, and schools.

### 4. External integrations

#### BYOK providers
- Anthropic
- OpenAI
- Ollama
- Google

User keys are stored server-side with encrypted key material and provider metadata in `user_integrations`.

#### Payments
- Stripe Checkout
- Customer Portal
- Webhook sync
- event dedup via `stripe_events`

#### Scheduling / alerts
- Supabase cron
- edge-function based deadline alerts

---

## Core data concepts

| Concept | Purpose |
|---|---|
| `programs` | Canonical opportunity records |
| `archived_questions` | Deduplicated archive of reusable application questions |
| `program_questions` | Per-program phrasing and limits |
| `program_dna` | What a program emphasizes |
| `profile_answers` | User answer bank |
| `user_program_fit` | Precomputed fit scores |
| `user_integrations` | BYOK provider metadata |
| `ai_draft_runs` / `ai_usage` | Draft tracking and limits |
| `answer_reviews` | Persisted review output |
| `answer_stress_tests` | Persisted stress-test runs |

---

## Design rules

### Keep
- database logic authoritative
- MCP and app roles separable
- founder-first copy without founder-only schema assumptions
- drafting, review, and certification as distinct layers
- staging and promotion between scraped/imported data and production truth

### Avoid
- client-side duplication of core scoring formulas
- renaming applied migrations casually
- embedding provider secrets in frontend code
- treating imports or Firecrawl output as production truth without review
- premature social/community features before the data/review loop is strong

---

## Deployment split

| Layer | Target |
|---|---|
| Frontend | Vercel |
| MCP server | local stdio today, HTTP-capable for hosted deployment |
| Database | Supabase |
| Draft/review persistence | Supabase |
| Payments | Stripe |

---

## Current tension to manage

The architecture is no longer blocked on basic product existence. The main tension now is keeping three truths aligned:
- what is actually live
- what the docs claim is live
- what future RNS/CIVITAE/MO§ES layers still need

That is why cleanup and coordination docs matter so much at this stage.
