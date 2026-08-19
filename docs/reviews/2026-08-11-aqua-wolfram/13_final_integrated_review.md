---
type: Reference
title: 13 — Final Integrated Aqua × Wolfram Review
description: 13 — Final Integrated Aqua × Wolfram Review — documentation in docs/.
tags: [documentation, docs]
timestamp: 2026-08-19
---

# 13 — Final Integrated Aqua × Wolfram Review

## Executive conclusion
Aqua is best modeled as a **multi-representation application knowledge system** with four major representations:

1. intake / staging,
2. operational / archive,
3. canonical / lineage,
4. derived intelligence.

The central review problem is whether transitions between these representations preserve identity, provenance, and required information consistently.

## Core topology

```text
CAPTURE
   ↓
STAGING
   ↓
VALIDATION
   ↓
PROMOTION
   ↓
OPERATIONAL KNOWLEDGE
   ↓
CANONICALIZATION
   ↓
INTELLIGENCE
   ↓
EXPORT / REUSE
```

## Representative structures

### Intake / staging
- `intake_submissions`
- `intake_entities`
- `intake_applications`
- `intake_application_layers`
- `intake_questions`
- `intake_gate_reviews`
- `intake_events`

### Operational / archive
- `programs`
- `program_cycles`
- `program_questions`
- `archived_questions`
- `user_applications`
- `application_answers`
- `profile_answers`
- `profile_answer_history`

### Canonical / lineage
- `canonical_commitments`
- `answer_variants`
- `application_packages`
- `lineage_events`

### Intelligence
- embeddings
- program DNA / signals
- fit scoring
- answer reviews
- answer stress tests
- AI draft runs
- Smart Matcher / ranking systems

## Main structural finding
The repository already contains a canonical knowledge center. The review therefore shifts from greenfield redesign to **coordination integrity**:

> How do functioning pipelines converge on, diverge from, and update the canonical knowledge spine?

## Critical phase boundaries

### 1. Reviewed intake → operational archive
Verify:
- exact promotion function,
- identity preservation,
- source provenance,
- deterministic tracing,
- exclusion of rejected/revised material.

### 2. Operational answer → canonical knowledge
Verify:
- eligibility rules,
- canonicalization idempotency,
- one-to-many/many-to-one mappings,
- provenance retention,
- user ownership.

### 3. Canonical knowledge → intelligence
Verify:
- reproducibility,
- version invalidation,
- source traceability,
- algorithm/version capture.

### 4. Intelligence → export / reuse
Verify:
- contribution lineage,
- treatment of final user edits,
- immutable submission history.

## Provenance architecture
Aqua contains two conceptually different lineage systems:

### Workflow provenance
`intake_events`

### Knowledge provenance
`lineage_events`

The critical bridge is:

```text
WORKFLOW PROVENANCE
        ↓
PROMOTION / CANONICALIZATION
        ↓
KNOWLEDGE PROVENANCE
```

The ideal reconstructable chain is:

```text
source application
→ intake submission
→ extracted question
→ reviewed intake object
→ operational answer
→ canonical commitment
→ answer variant
→ application package
→ export/submission
```

## Wolfram computational results
Current structural computations produced:

- **53 graph vertices**
- **101 edges**
- **1 weakly connected component**

The intake state model makes `promoted` reachable:

```text
pending_review
→ finalized
→ promoted
```

But state reachability must not be confused with verified runtime implementation.

## Information conservation rule
Every phase transition should answer:

1. What is preserved?
2. What is compressed?
3. What is discarded?
4. What is newly inferred/generated?

A useful invariant:

> A downstream generated statement should never have stronger factual status than the strongest upstream source supporting it.

## Normalization principle
The goal should not be minimum table count.

The correct goal is:

> **minimal deterministic bridges between intentionally distinct representations.**

Each cross-representation relationship should be classified as:
1. same object, different phase;
2. same object, different projection;
3. independently meaningful object;
4. derived object;
5. redundant persistence.

Only category 5 is an obvious normalization candidate.

## Recommended hardening priorities

### Priority 1 — Promotion registry
Record:
- source representation,
- destination representation,
- transformation function,
- preserved identity,
- provenance reference,
- validation requirement,
- reversibility,
- idempotency.

### Priority 2 — Representation crosswalk contract
Especially for questions, answers, applications, and commitments.

### Priority 3 — Provenance bridge
Ensure canonical objects can trace to operational/intake origins where applicable.

### Priority 4 — Reproducible intelligence
Derived objects should carry:
- algorithm/version,
- source object/version,
- timestamp,
- parameters where relevant.

## Highest-value next Wolfram tests
1. Reversible vs lossy vs generative transformation classification
2. Representation-crosswalk graph
3. Ambiguous many-to-many identity mappings
4. Provenance reachability from final package back to source
5. Bridge centrality
6. Corrected cycle/SCC analysis
7. Detection of canonical/intelligence objects lacking upstream provenance

## Final assessment
The core Aqua architecture is already substantially present.

The correct review question is:

> **What invariants and bridges are required so Aqua's existing representations behave as one coherent information system?**
