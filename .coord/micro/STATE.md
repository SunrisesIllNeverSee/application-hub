---
type: State
title: Micro Session State
description: Save/resume slot for the current repository build state.
tags: [repo-standard, coordination, state]
timestamp: 2026-08-23
---

# Micro Session State

## Current

- Status: active
- In progress: Exchange Gateway v0.2 agent-operated orchestration on branch `exchange-agent-orchestration-v0-2`
- Next: add domain-side Exchange Agent/Steward, event delivery, stronger machine-evaluable Proposal schema, policy/authority model, supervisory human surfaces, tests, CI verification, then merge
- Scope: preserve v0.1 economic/state substrate; make agent↔domain-agent interaction the default path; human UI becomes policy, escalation, activity, and economics oversight
- Economic model: configurable transaction fee on successful financial settlement; referral/commission rates remain represented but not hard-wired
- Constraint: preserve AQUA application behavior; keep exchange core isolated and movable; do not weaken commitment/authorization/settlement invariants

## Resume order

1. Read this file.
2. Read the latest scratchpad entries.
3. Read the active handoff if one exists.
4. Check the roster.
5. If this is a cross-repo build, read `.coord/macro/MACRO_STATE.md`.
