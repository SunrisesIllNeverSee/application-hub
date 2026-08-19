---
type: Reference
title: 11 — Wolfram Computational Results
description: 11 — Wolfram Computational Results — documentation in docs/.
tags: [documentation, docs]
timestamp: 2026-08-19
---

# 11 — Wolfram Computational Results

## Scope
This file records Wolfram computations performed against the Aqua structural review model generated from the repository bundle.

## Dependency Graph Results
- Vertices represented: **53**
- Dependency edges: **101**
- Weakly connected components: **1**

### Highest inbound dependency centers
1. `auth.users` — 46
2. `programs` — 15
3. `archived_questions` — 8
4. `intake_submissions` — 6
5. `profile_answers` — 4

### Strong outward dependency / transformation nodes observed
- `application_answers`
- `answer_stress_tests`
- `team_answers`
- `answer_reviews`
- `community_messages`
- `intake_events`
- `program_questions`
- `import_queue`
- `ai_draft_runs`
- `team_members`

## Intake State Machine Results
Reachable from `pending_review`:
- `pending_review`
- `in_progress`
- `finalized`
- `needs_revision`
- `rejected`
- `promoted`

Shortest modeled path to promotion:

```text
pending_review
→ finalized
→ promoted
```

Dead-end terminal states:
- `rejected`
- `promoted`

Self-loops:
- `in_progress → in_progress`
- `needs_revision → needs_revision`

### Interpretation
The state model permits `finalized → promoted`, but static reachability does not prove that application logic executes this transition. The promotion bridge remains an implementation-verification point.

## Structural Boundary Priorities
### Critical
1. Reviewed intake → operational archive
2. Operational answer → canonical knowledge

### High
3. Canonical knowledge → intelligence

### Medium
4. Intelligence → export / reuse

## Caveats
- Static structural model, not production telemetry.
- Connectivity does not prove semantic identity.
- Reachability does not prove runtime implementation.
- Cycle/SCC analysis should be rerun with corrected Wolfram graph code.
