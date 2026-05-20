# Canonical Rebuild Implementation Tasks

Source: `REBUILD/Mos2esxyz_AQUA_Deep_Dive/01_Formatted_Conversation.md` and Deric's May 20 implementation request.

Status key: `[ ]` not started, `[~]` scaffolded/partial, `[x]` implemented in this pass.

## Phase 0 — Foundation

- [x] Add migration `042_canonical_hub_and_lineage.sql`
  - Canonical commitments, answer variants, application packages, lineage events
  - Hash/version/vertical/lineage fields
  - RLS policies, indexes, `updated_at` triggers
- [x] Add migration `043_canonical_rpc_functions.sql`
  - `semantic_search_canonicals`
  - `search_canonicals_hybrid`
  - `get_canonical_package`
  - `smart_matcher_search`
  - Vector embedding column on canonicals
- [x] Add migration `044_rewards_system.sql`
  - User credits, contribution rewards, approved-reward trigger
  - Stripe Connect payout metadata fields
- [x] Add migration `045_aggregate_system.sql`
  - Aggregate stats on canonicals
  - Aggregate versions history
  - Trigger to refresh aggregate stats from high-quality variants
- [x] Add migration `046_seeding_system.sql`
  - Seeding entities
  - Source URL/TOS/deadline/requirements/data package/outcome examples
  - Staging quality gate and lineage fields
- [x] Add data reset recipe doc for synthesized archive cleanup
- [x] Add Canonical Hub Supabase Edge Function scaffold with production guardrails
- [x] Mark proprietary algorithm hooks with `TODO: Your IP`
- [x] Implement search/filter API contracts across hub endpoints

## Phase 1 — Entry/Exit Points

- [x] Add ingestion UI component
- [x] Add `/api/hub/ingest`
- [x] Add `/api/hub/export`
- [x] Support JSON, Markdown, and PDF-ready export envelopes

## Phase 2 — Internal Spokes

- [x] Add Variation Panel component
- [x] Add Highlight Editor component
- [x] Add Smart Matcher Edge Function
- [x] Add `/api/hub/smart-matcher`
- [x] Add Smart Matcher Feed component
- [~] Integrate spokes as reusable components; deep route placement remains product-choice follow-up

## Phase 3 — Chrome Extension

- [x] Add `webextension/chrome/aqua-extension/manifest.json`
- [x] Add MV3 background service worker
- [x] Add content script with form detection, AQUA fill buttons, capture hotkey
- [x] Add popup with Smart Matcher, Open Hub, Capture Page, Export MD
- [x] Include MD export and canonical hub message flow

## Phase 4 — Landing Page

- [x] Rework landing page around "APPLICATIONS. QUESTIONS. ANSWERS." and AQUA
- [x] Add Smart Matcher teaser, feature grid, and CTA footer

## Phase 5 — Seeding System

- [x] Add schema for seeding entities and manual review gate
- [x] Document capture strategy and privacy posture

## Phase 6 — Rewards & Monetization

- [x] Add rewards schema
- [x] Add Stripe Connect payout API scaffold
- [~] Real Connect onboarding/payment execution requires Stripe dashboard/env activation

## Phase 7 — Auto-Fill Thresholds

- [x] Add coverage/fidelity threshold helper API
- [x] Surface Level 1 and Level 2 eligibility logic in API response
- [~] Auto-submit remains consent-gated and disabled until portal-specific policy is approved

## Phase 8 — MCP Wrappers

- [x] Add `aqua-hub` MCP tools
- [x] Register ingest, reward, variations, qualify, package, and export tools

## Phase 9 — Documentation

- [x] Add `docs/CANONICAL_HUB.md`
- [x] Include package templates, transfer rules, lineage examples, filters, and algorithm hooks

## Phase 10 — Desktop Sync

- [~] Document Obsidian/local-first sync as future work

## Phase 11 — Optional Voice Features

- [~] Document ElevenLabs/voice features as optional hackathon work

## Production Blockers / Inputs Needed

- [ ] Deric supplies exact commitment similarity formula.
- [ ] Deric supplies language quantification/ranking metrics.
- [ ] Deric supplies fidelity computation formula.
- [ ] Deric supplies SigTune/contextual scoring rules.
- [ ] Deric approves variant reduction thresholds.
- [ ] Run the reset recipe against Supabase only after confirming backups and real-data import path.
- [ ] Activate Stripe Connect environment variables and dashboard settings before real payouts.

## Codex Sign-Off

Signed off by: Codex
Signed off at: 2026-05-20T22:29:56Z
Session: `codex-2026-05-20-canonical-rebuild`

### Scope Completed

- Canonical rebuild checklist created from Deric's implementation brief.
- Schema scaffold landed locally through migrations `042`-`046`.
- Canonical Hub and Smart Matcher Edge Function scaffolds landed locally.
- Next.js hub APIs, UI spokes, landing page rebuild, Chrome MV3 scaffold, MCP wrappers, and Canonical Hub docs landed locally.
- Proprietary algorithm hooks are intentionally marked with `TODO: Your IP`.

### Verification

- `python3 .agents/check.py` passed.
- `cd app && npm run type-check` passed.
- `cd app && npm run build` passed.
- `cd application-hub-mcp-server && npm run check` passed.
- `git diff --check` passed.
- Landing page loaded via Playwright on desktop and mobile widths.

### Known Non-Blocking Gaps

- `supabase db push --dry-run` is blocked by pre-existing remote migration history entries missing locally: `20260512153021`, `20260513011652`.
- Real production scoring still requires Deric's proprietary formulas.
- Real Stripe Connect payout execution still requires dashboard/env activation and an admin approval flow.

### Commit Status

Not committed or pushed yet. Local changes are ready for Deric review or for Codex to commit/push on explicit instruction.
