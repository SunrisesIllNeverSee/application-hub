# Aqua × Wolfram Analysis Prompt Pack

## Purpose
Analyze Aqua as a multi-representation relational transformation system. The supplied JSON artifacts distinguish observed schema/code facts from analysis labels. Do not assume similarly named entities are duplicates. Test whether they are distinct phases, projections, or redundant persistence.

## 0. Load the package
```wl
base = NotebookDirectory[];
entities = Import[FileNameJoin[{base, "01_entity_inventory.json"}], "RawJSON"];
relations = Import[FileNameJoin[{base, "02_relation_matrix.json"}], "RawJSON"];
transforms = Import[FileNameJoin[{base, "03_transformation_registry.json"}], "RawJSON"];
states = Import[FileNameJoin[{base, "04_state_transition_model.json"}], "RawJSON"];
conservation = Import[FileNameJoin[{base, "05_information_conservation.json"}], "RawJSON"];
graphData = Import[FileNameJoin[{base, "06_dependency_graph.json"}], "RawJSON"];
crosswalk = Import[FileNameJoin[{base, "07_representation_crosswalk.json"}], "RawJSON"];
phases = Import[FileNameJoin[{base, "08_phase_shift_analysis.json"}], "RawJSON"];
```

## 1. Minimal independent entities
**Prompt:** Given `entities` and `relations`, identify the minimum independent identity-bearing entities necessary to reconstruct all other persisted representations without semantic loss. Separate: (a) independent identity, (b) phase-specific projection, (c) derived metric/materialization, (d) provenance/audit, (e) supporting operational state. Do not recommend merging phase-specific objects unless functional dependencies prove equivalence.

Compute candidate functional dependencies and report violations. Treat JSON soft references separately from hard foreign keys.

## 2. Dependency topology
**Prompt:** Construct two directed graphs: `Ghard` from foreign keys and `Gall` from foreign keys plus logical/transformation edges. Compute WeaklyConnectedComponents, VertexDegree, BetweennessCentrality, PageRankCentrality, FindCycle, and articulation-like bridge sensitivity. Identify which vertices connect intake, archive, canonical, and intelligence representations.

Suggested Wolfram skeleton:
```wl
edges = DirectedEdge[#source, #target] & /@ graphData["edges"];
g = Graph[edges, VertexLabels -> "Name"];
{WeaklyConnectedComponents[g], VertexDegree[g], BetweennessCentrality[g], PageRankCentrality[g]}
```

## 3. Phase-transition audit
**Prompt:** Treat `phases["phase_model"]` as states and `phase_boundaries_to_test` as candidate transition obligations. Determine which transitions are explicit in code/schema, which rely on semantic matching or text/JSON identifiers, and which lack a durable identity bridge. Classify every transition as lossless, intentionally lossy, or unbounded/unknown.

## 4. Information conservation
**Prompt:** For each transition in `05_information_conservation.json`, formalize an information-conservation vector with dimensions: source identity, exact wording, ordering, constraints, context, evidence, temporal state, user ownership, review status, algorithm version, and provenance. Score each dimension {0=lost, 0.5=indirect/recoverable, 1=explicitly preserved}. Produce a matrix and locate the minimum-retention boundary.

## 5. Normalization without destroying phases
**Prompt:** Find the smallest set of additional bridge keys/relations that makes the entire system traceable end-to-end while leaving intentionally distinct representations intact. Optimize lexicographically for: (1) deterministic provenance, (2) referential integrity, (3) minimum schema change, (4) historical immutability, (5) query simplicity.

Candidate additions to test, not assume: promotion_map(intake_* -> archive_*), source_question_id/source_answer_id on lineage metadata or normalized bridge table, stable organization/program identity on canonical packages, algorithm_version on score-producing transformations, cross-domain trace_id.

## 6. Workflow vs knowledge provenance
**Prompt:** Analyze `intake_events` as workflow provenance and `lineage_events` as knowledge provenance. Determine the minimal bridge that allows a query from any exported answer/package back to the exact intake source, review event, operational question/answer, canonical commitment, variant, and transformation version. Test whether a single trace DAG can be reconstructed without merging the two event stores.

## 7. Canonicalization sensitivity
**Prompt:** Current code marks commitment extraction, lexical similarity, fidelity and significance logic as placeholders. Model canonical merge/split sensitivity as a threshold problem. Determine which downstream entities/rewards/packages are most sensitive to false merge versus false split. Report invariants the final proprietary formulas must satisfy independent of implementation.

## 8. Score decomposition
**Prompt:** Inspect significance_score, fidelity_score, fit_score, heat_score and related derived metrics as distinct functions. Build a dependency matrix showing raw inputs, intermediate inputs, normalization range, monotonic assumptions, and consumers. Identify accidental circularity or double-counting across Smart Matcher and ranking.

## 9. State-machine verification
**Prompt:** Formalize intake and application lifecycles as finite state machines. Verify reachability, terminal states, illegal transitions, approval bypasses, and whether `promoted` is reachable from `finalized` in the implementation represented by the artifacts. Distinguish schema-permitted from code-observed transitions.

## 10. Final synthesis
**Prompt:** Return: (A) minimal independent entity basis; (B) phase transition graph; (C) top five information-loss boundaries; (D) missing/weak identity bridges; (E) normalization recommendations ranked by leverage and migration cost; (F) invariants to preserve; (G) experiments requiring production event data rather than static code.

### Constraint
Do not redesign Aqua from first principles. Analyze and connect the system that exists. A repeated concept across representations is not evidence of redundancy until functional equivalence is demonstrated.
