# Aqua / Wolfram Structural Review — Findings

## Executive result
The repository already implements the major conceptual layers needed for Aqua: source capture and gated intake, normalized application/question storage, reusable/profile and application-specific answers, a canonical commitment hub with variants/packages, provenance systems, semantic/hybrid retrieval, Smart Matcher primitives, and multiple derived intelligence/evaluation layers. The central review problem is therefore **cross-representation coordination**, not absence of architecture.

The static schema contains **56 persisted tables, 95 explicit foreign-key relationships, and 40 database functions/RPCs** in the supplied migration set.

## 1. Minimal independent basis
A conservative independent basis is not one table per noun. Aqua needs identity-bearing objects plus intentional phase projections. At minimum, the system currently depends on these identity domains:

1. **Source/intake identity** — `intake_submissions` with staged entity/application/question children.
2. **Program/application identity** — `programs` + cycle/version representation and `user_applications`.
3. **Question identity** — occurrence (`program_questions`) and normalized question (`archived_questions`) are distinct.
4. **User answer identity** — reusable master (`profile_answers`) and application-specific (`application_answers`) are distinct.
5. **Canonical knowledge identity** — `canonical_commitments` and user-scoped `answer_variants` are distinct.
6. **Package identity** — `application_packages` groups canonical/variant selections for portable reuse/export.
7. **Provenance identity** — workflow events and knowledge lineage are separate histories and should remain separate unless equivalence is proven.

Derived tables such as program DNA, fit, reviews, stress tests, stats and aggregates should not become authoritative identity sources.

## 2. Strongest existing structure
### Gated intake is already a phase machine
Manual ingestion stores the raw source and stages entity, application, structured layers, and questions before review. Review decisions are recorded separately and write workflow events. This gives Aqua a useful distinction between **candidate knowledge** and **approved knowledge**.

### Question occurrence vs normalized question is already correctly separated
`program_questions` preserves exact program wording while `archived_questions` stores the normalized reusable question. This is an important conservation property: normalization does not have to erase source phrasing.

### Canonical hub is a real separate representation
`canonical_commitments` are public reusable commitments; `answer_variants` are user-scoped expressions; `application_packages` assemble portable sets; `lineage_events` maintains knowledge provenance. This is not the same representation as the operational answer bank and should not be collapsed into it.

## 3. Highest-value coordination boundary: reviewed intake -> operational archive
The intake schema contains a `promoted` workflow state, but the inspected review route advances approved questions to `finalized`. The static review material does not establish a durable identity bridge from an `intake_application`/`intake_question` to the resulting `programs`/`program_questions`/`archived_questions` rows.

This does **not** prove the promotion logic is absent elsewhere; it identifies the exact boundary Wolfram should test. If promotion is implemented, the review should verify that promotion identity is persisted, not recoverable only through text similarity.

Recommended invariant:

> Every production application/question created from intake should be deterministically traceable to its intake submission and approval lineage.

## 4. Second coordination boundary: operational answer -> canonical knowledge
Aqua currently has a strong operational answer model (`profile_answers`, history, `application_answers`) and a strong canonical model (`canonical_commitments`, `answer_variants`). The canonical edge function can ingest arbitrary content/commitments and create variants/packages, but the canonical schema does not require a normalized source-answer/source-question foreign key.

Recommended invariant:

> When a canonical variant originates from an Aqua answer, the lineage must carry exact source answer, source question occurrence, source application/program, transformation version, and actor/time.

This can be implemented with bridge records or structured lineage metadata; it does not require merging the answer systems.

## 5. Provenance is dual by design
`intake_events` answers **what happened to captured material during workflow/review**. `lineage_events` answers **how canonical/variant/package knowledge was created or mapped**.

These are different semantics. The optimal structure is likely not one giant event table. The higher-leverage target is a **cross-domain trace bridge** so one traversal can move from workflow provenance into knowledge provenance.

## 6. Information-loss boundaries
Ranked by structural risk in the current static implementation:

1. **Content -> canonical commitment** — the canonical edge function explicitly labels extraction/similarity logic as placeholder; chunk boundaries and merge thresholds determine canonical identity.
2. **Reviewed intake -> archive promotion** — identity can be lost if promotion relies on name/text matching rather than persisted source IDs.
3. **Operational answer -> canonical variant** — source application/question context can disappear unless recorded in lineage.
4. **Variant/canonical -> scalar fidelity/significance** — source text is preserved, but decision semantics may be wrong while placeholder formulas remain.
5. **Knowledge/persona -> Smart Matcher rank** — many signals are compressed into a scalar/rank and should remain decomposable for explanation/calibration.

## 7. Placeholder algorithms are correctly isolated as a testing target
The canonical-hub code explicitly marks lexical similarity, fidelity, significance, and commitment extraction as placeholders. This is useful: the architecture can be reviewed independently from final proprietary scoring. Wolfram should derive **invariants** the replacement formulas must satisfy—monotonicity, boundary behavior, merge/split sensitivity, calibration, and non-circular dependencies—rather than treating current constants as final mathematics.

## 8. Normalization target
The best normalization goal is **identity/provenance normalization**, not maximal table reduction.

Keep separate:
- intake staging vs production/archive;
- question occurrence vs normalized question;
- reusable profile answer vs application-specific answer;
- canonical commitment vs user variant;
- workflow event vs knowledge lineage.

Strengthen:
- explicit promotion mappings from intake to archive;
- exact source-answer/source-question provenance for canonical variants;
- immutable program/entity IDs alongside free-text `entity` / `program_entity`;
- algorithm version identifiers on generated scores and qualification decisions;
- cross-domain trace/correlation identifier.

## 9. What Wolfram can establish from this package
With the static review package Wolfram can compute graph topology, connected components, centrality, cycles, minimal bridge candidates, state reachability, representation crosswalks, and qualitative/ordinal conservation matrices.

It **cannot** determine empirical transition frequencies, real failure rates, canonical merge/split error rates, score calibration, or knowledge decay from static code alone. Those require production/event exports later.

## 10. Recommended review sequence
1. Reconstruct hard-FK graph.
2. Add logical/transformation edges and compare topology.
3. Verify state-machine reachability, especially `finalized -> promoted`.
4. Solve minimum bridge set for end-to-end traceability.
5. Build conservation matrix across all phase boundaries.
6. Analyze sensitivity of canonical merge/split and fidelity thresholds.
7. Decompose Smart Matcher/score dependencies for circularity or double counting.
8. Only after the static structure is coherent, ingest production event samples for empirical validation.

## Bottom line
Aqua is already a multi-representation knowledge system. The high-leverage hardening task is to make **identity and provenance survive every phase shift** so its intake, archive, canonical hub, answer bank, and intelligence layers can remain independently useful while behaving as one traceable system.
