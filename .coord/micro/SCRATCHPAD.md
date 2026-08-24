---
type: Coordination
title: Micro Coordination Bus
description: Append-only working coordination bus for agents operating inside this repository.
tags: [repo-standard, coordination, scratchpad]
timestamp: 2026-08-21
---

# Micro Coordination Bus

## Protocol

- Read the tail before beginning material work.
- Append assignments, blockers, decisions, and completion reports.
- Do not use this as durable product documentation; promote durable knowledge into the appropriate repo document.

## Log

### 2026-08-21 — agent-readiness remediation
- Role: LEAD implementation/review.
- Scope: Ora Is Agentic findings for `https://mos2es.xyz` only; preserve authenticated product behavior and visual language.
- Planned changes: custom recovery 404, public trust pages, `llms.txt`, strict `Accept: text/markdown` negotiation, homepage metadata/JSON-LD/content, sitemap additions, agent-readiness tests wired into CI.
- Constraint: no verified public phone number found for Ello Cello LLC; schema may include verified public email/address but must not fabricate telephone data.

### 2026-08-22 — contribution exchange gateway v0.1
- Role: LEAD architecture + implementation.
- Scope: build a portable domain-native contribution exchange gateway inside the `app` project and wire mos2es.xyz as the reference installation.
- Product boundary: unsolicited contribution exchange first; reciprocal requests supported in core object model. Company/domain registration is required for transaction/settlement; agent registration is optional so guest agents can discover and propose.
- Economics: Model A transaction fee, configurable in basis points. Referral, originator, collaborator, and verifier attribution fields are included but rates remain configurable/TBD.
- Required surfaces: exchange manifest, agent carry-with-it brochure, marketing page, company onboarding, optional agent signup, proposal/request APIs, commitment/rights/vesting object, verification/settlement hooks, install/migration documentation, competitive positioning, tests.
- Constraint: do not modify AQUA application workflows except public discovery/content links needed for the reference install. Keep exchange implementation movable.

### 2026-08-23 — exchange agent orchestration v0.2
- Role: LEAD refactor + product architecture.
- Correction: v0.1 overemphasized human-operated SaaS surfaces. Preserve its economic/state substrate, but make agent↔domain-agent orchestration the normal path.
- Product unit: Exchange Profile + domain Exchange Agent/Steward + Contribution Proposal + Contribution Commitment + governed authorization + settlement.
- Human role: policy, authority delegation, escalations, activity/audit, economics; not routine proposal polling or manual lifecycle operation.
- Required additions: machine-evaluable proposal fields (impact/confidence/required authority/verification), domain-agent authority policy, hosted steward behavior, event subscriptions/delivery, machine-first negotiation/transition endpoints, human supervisory console, Exchange-specific metadata.
- Safety invariant: ambient observation never implies permission; proposal ≠ agreement; agreement ≠ authorization; authorization ≠ execution.
