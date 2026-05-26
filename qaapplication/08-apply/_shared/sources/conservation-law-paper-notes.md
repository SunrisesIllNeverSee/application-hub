<!--
Source: Paper0_v05_main.tex (V.05, March 19, 2026, DOI 10.5281/zenodo.20029607)
"A Conservation Law for Commitment in Language Under Transformative
Compression and Recursive Application"
Author: Deric J. McHenry, Ello Cello LLC

Read on 2026-05-23. Compressing the paper to its commitment kernel here per
the user's instruction to make notes so I can come back without re-reading.

Per the user: "the paper only focuses on HOW i do it... not WHAT i do with
it... which is where the products and governance come in." This notes file
respects that frame — Section A captures what the paper claims and proves
(HOW); Section B captures explicit non-coverage (WHERE products and
governance extend the framework); Section C captures verbatim hooks for
application drafts.
-->

# Conservation Law Paper (V.05) — Working Notes

## DOI history (cite per draft target)

| Version | Label | Date | DOI |
| --- | --- | --- | --- |
| V.01 | Law Disclosure | Jan 12, 2026 | 10.5281/zenodo.18267279 |
| V.02 | Preprint | Jan 16, 2026 | 10.5281/zenodo.18271102 |
| V.03 | Falsifiability Testing | Jan 16, 2026 | 10.5281/zenodo.18274930 |
| V.04 | Technical Structure Depth | Feb 26, 2026 | 10.5281/zenodo.18792459 |
| V.05 | Follow-on Record + Addendum | Mar 19, 2026 | 10.5281/zenodo.20029607 |

When citing publicly: use V.05 (10.5281/zenodo.20029607). Follow-on
experimental record (EXP-001 through EXP-007) is a separate companion at
DOI 10.5281/zenodo.19105225.

---

## A. What the paper claims and proves (HOW)

### A.1 The conservation claim

**Definition of commitment** (Section 2): the minimal identity-preserving
*canonical invariant* of a signal S, mapped to a representation space K via
an extractor C: S → K.

**Conservation under governed transformation:**

```text
C(T_gov(S)) = C(S)
```

**Operational invariance test:** for an admissible T,
`|| C(T(S)) - C(S) ||_∞ < ε`, where ε is a governance tolerance threshold
enforced by the compression gate.

**Definitional vs empirical split (critical framing — Section 3.4):**

- The conservation principle is **definitional in structure** — once
  commitment is defined as the minimal content preserved under
  identity-preserving transformation, conservation follows from the definitions.
- The **scientific claim is not** that the definition is true. The
  scientific claim is that **real-world lossy transformations** (summarization,
  paraphrase, compression) **empirically preserve an independently extractable
  commitment kernel** when gating is applied, and **fail to preserve it** when
  gating is absent.
- That empirical asymmetry — gated vs ungated — is the substantive contribution.
- This is why the paper labels propositions as *propositions* (definitional)
  vs theorems (with structural assumptions) vs empirical claims (Section 7).

**Why this matters:** when reviewers push "isn't this circular / tautological,"
the answer is in §3.4: the compression gate does NOT output C(S) by
construction; it applies a lossy compression *without prior access to C(S)*,
and the extractor evaluates the output *after* transformation. Falsifiable.

### A.2 The equivalence relation ∼ is intentionally external and swappable

The whole architecture rests on an external judge of "did this transformation
preserve identity." The paper pins three reference oracles (Section 2.1):

| Domain | Oracle | Reference instantiation |
| --- | --- | --- |
| Text | Bidirectional entailment | `microsoft/deberta-v3-base-mnli` (transformers v4.35.0), threshold P > 0.85 both directions |
| Code | Behavioral equivalence | Full pass on public test suite; AST-normalized equivalence as fallback |
| Proofs | Logical entailment | Lean 4 or Coq kernel check; or canonical normal-form |

**Critic-proof design:** critics can substitute stricter oracles. A result
that holds under a stricter oracle *strengthens* the claim. A result that
fails under a reasonable oracle *falsifies* it. The framework parameterizes
itself against the oracle by design.

### A.3 The mechanism (compression gate)

**Section 5 Theorem 5.3:** In a compression regime, commitment is conserved
under any transformation T. Proof flows from the gate operating on T_c(S)
rather than S directly.

**Section 5 Lemma 5.4:** Non-committal collapse — under projection onto the
commitment subspace, N(T_c(S)) = 0. Compression acts as a filter:
T_c: S → C(S).

**Gate pseudocode (Section 8.1):** the only public-layer specification of
the actual gate logic:

```text
COMPRESS_GATE(S, C_0, epsilon, L):
    S_c   = compress(S)              // lossy compression
    C_new = extract_commitment(S_c)  // independent extractor
    delta = || C_new - C_0 ||
    if delta > epsilon:
        emit_ghost_token(delta)
        REJECT(S, reason="commitment drift exceeds threshold")
        return NULL
    L' = append_lineage(L, hash(S_c), C_new, timestamp())
    return (S_c, C_new, L')
```

The gate is **stateless wrt model internals** — operates on S, not on
weights/activations. That's what makes MO§ES™ model-agnostic.

### A.4 The recursion result

**Section 6 Theorem 6.4 (Probabilistic Transformations Fail Under Recursion):**

Probabilistic sampling without compression introduces variance at each step.
Modeling each iteration as i.i.d. perturbation with variance σ² > 0, the
random-walk variance accumulation result yields Var(S^(n)) = nσ², so drift
grows as **O(√n)** in norm. Without compression to enforce invariance, the
expected deviation `|| C(S^(n)) - C(S) ||` is bounded below by Ω(√n),
eventually exceeding any fixed conservation threshold.

**Bound (analytic form):** if per-step drift variance σ² exceeds the squared
commitment margin δ² = `|| C(S) ||² / || S ||²`, then `n ≥ δ²/σ²` suffices
for drift to overwhelm the commitment signal.

The autocorrelation caveat is acknowledged: LLM outputs aren't perfectly
i.i.d. in practice; the result holds for sufficiently mixing chains.

### A.5 The empirical numbers (Section 7)

**Corpus:** 100 NL sentences (50–200 words; Reuters/AP/Wikipedia/FAR-DFARS),
50 code snippets (10–50 lines; MIT/Apache GitHub repos, >100 stars), 25
mathematical proofs (5–20 steps; Rudin + AMC/AIME). 175 signals total.

**Results table (n = 10 iterations):**

| Metric | Compression + Lineage | Probabilistic |
| --- | --- | --- |
| Commitment stability | **0.94 ± 0.03** | **0.42 ± 0.12** |
| Identity preservation | **92%** | **38%** |
| Drift rate per iteration | **0.006** | **0.058** |

**Correlation** between identity preservation and commitment stability:
**r = 0.89, p < 0.001**.

**Capacity estimate:** preliminary C_c ≈ 50–80% compression reduction (or
depth d_c ≈ 8–12) before sharp fidelity drop in unconstrained cases;
enforced flattening preserves Fid ≥ 0.9.

### A.6 The concrete example (Section 7.4) — the "$100 Friday" demo

**Test signal:** "You must pay $100 by Friday if the deal closes. This is
a binding obligation." (18 tokens). Hard commitments: obligation
("must"), amount ($100), deadline (Friday), condition ("if the deal closes").

**Protocol:** 5 turns each, Meta AI as the model. Baseline = recursive
free-response. Enforcement = commitment kernel extracted between turns and
re-input.

**Results:**

| | B1 | B2 | E1 | E2 | E3 |
| --- | --- | --- | --- | --- | --- |
| Total tokens (5 turns) | 230 | 316 | 156 | 120 | 154 |
| Turn-5 total tokens | 37 | 69 | 17 | 12 | 5 |

**Punchline:** under baseline, the model exhibits **token bloat**
(conversational filler "Got it," "No wiggle room, right?" dilutes
commitment density). Under enforcement, the model exhibits **commitment
convergence** — by turn 5 Enforcement-3 produces a total of 5 tokens:
"$100 Friday." The signal converges to its kernel. Hard commitments
preserved across all turns; only non-committal content discarded.

**This is the cleanest one-paragraph demo of the framework to use in
applications.** It shows the conservation principle in action — preserves
C(S), collapses N(S) — exactly as predicted by Lemma 5.4.

### A.7 Follow-on experimental record (EXP-001 through EXP-007)

| EXP | Focus | Key finding |
| --- | --- | --- |
| 001 | Initial smoke test | Phase signal observed under recursive transformation |
| 002 | Full corpus pass | Conservation manifests differently across signal classes — regime variation, not falsification |
| 003 | Step B correction | Separated implementation bugs from structural limits |
| 004 | Adversarial rule test | Early predictive rule broke; system is governed by preservation + anchoring + symmetry |
| 005 | Mechanism isolation | Compression and extraction are **separable bottlenecks** |
| 006 | Paper recursion test | Tested the theory on itself; core claims stable, formal/conditional structure more fragile |
| 007 | NP-negation edge cases | Extractor asymmetry exists, but semantic preservation holds in most cases — **proxy-measurement gap, not conservation failure** |

**Critical insight:** none of EXP-001 through EXP-007 falsified the law.
What they did was **separate bottleneck types** — compression bottleneck vs
extraction bottleneck vs proxy-measurement gap — so apparent failures could
be attributed to a specific layer rather than to the law itself.

### A.8 Falsification protocol (Section 4)

**Public harness:** github.com/SunrisesIllNeverSee/commitment-conservation
**Replication contract pinned by commit hash 1bcba8ff.**

**Refutation conditions:**

1. Compression + lineage system yields F_10(S) < 0.85 for non-trivial
   fraction of samples → conservation refuted for this regime.
2. Attractor collapse to generic boilerplate while failing to preserve
   extracted commitments → counted as falsification.
3. Probabilistic system without compression maintains stability > 0.9 at
   n=10 → falsifies the contrast.
4. Alternative mechanism (not compression-or-lineage based) achieves
   comparable stability → invalidates the necessity claim.

**Anti-Goodhart design:** observable F_n is **min-aggregated** across
Jaccard + cosine + NLI, so optimizing against one proxy gets penalized by
the others. Lineage DAG provides independent verification channel.

### A.9 Where the paper sits vs related work (Section 1.3)

| Lineage | What they do | What this paper adds |
| --- | --- | --- |
| Semantic info theory (Bar-Hillel, Floridi, Tishby) | Semantic content as optimization target | Treats commitment as **constitutional constraint**, not optimization |
| Language Invariant Properties (Bianchi 2022) | Evaluates which properties survive transformation | Extends from evaluation to **enforcement**, single-step to **recursive** |
| Conservation in computation (Atkey 2014, Kunin 2021) | Conservation of resources / training dynamics | Property of the **signal**, not model or type system |
| Provenance (C2PA, Numbers Protocol, Starling Lab) | Verify *that* content came from a source | Verifies **what survived transformation** — provenance + semantic fidelity fused in lineage DAG |
| Constitutional AI (Bai 2022) | Model-internal self-feedback for harmlessness | **Model-external** conservation law, architecture-independent |
| GaaS (Gaurav 2025) | Policy enforcement at agent output level | Operates on **invariant extracted from the signal itself**, not policy at output |
| SimpleMem (Chen 2026) | Memory normalization + abstraction inside an agent pipeline | Architecture-agnostic invariant over transformations of stored commitments |

### A.10 MO§ES™ architecture (Section 8)

**The paper's expansion of the acronym:**
> MO§ES™ = "Minimal Orthogonal Subset to Essential Structure"

(⚠️ This **differs from** the field-sheet expansion: "Modus Operandi System
for Signal Encoding and Scaling Expansion." Either canonical or marketing
variant, but they're not identical. Flagged for user decision below.)

**Architecture components:**

1. **Compression Gate** — all signals pass through T_c before propagating;
   compression as projection onto essential structure manifold;
   non-committal N(S) orthogonally separated and discarded.
2. **Lineage DAG** — Merkle DAG; nodes contain h(S^(k)); edges = transformation
   relationships; root anchored to hardware timestamp.
3. **Hardware Anchoring** — TPM, secure enclaves, or blockchain; initial
   signal S^(0) stamped with immutable hardware signature.
4. **Orthogonal Projection** — P: S → C(S) minimizes ||S - P(S)||.

**Theorem 8.4 (MO§ES™ Preserves Commitment):** C(S) = C(T(S)) by construction.
**Theorem 8.5 (MO§ES™ Recursively Stable):** by induction from 8.4.

### A.11 Ghost token accounting

`G_t = G_0 * e^(-λt)` — residual semantic mass modeled as exponential decay.
"Auditable residue" of lossy processing. λ is **not universal** — it's a
measurable property of the transformation regime, calibrated per domain.

**Recovery Cost:** `RC = E_drain + T_terrace + R_risk` — frames lost meaning
as **recoverable but priced**.

### A.12 The nine failure modes under ungoverned transformation

(From the second-law structure / Proposition 6 in the Prospectus, also
referenced in this paper.)

1. Obligation escalation ("may" → "shall")
2. Scope widening ("room A" → "any room")
3. Exception dropping ("unless undue hardship" → omitted)
4. Modal frame inversion ("shall not" → "shall")
5. Co-degraded invariance
6. NP-negation blindness
7. Formal collapse
8. Self-referential collapse
9. Lexical scope widening

Each failure mode has direct legal, operational, or ethical consequences.
**Use these in applications targeting legal/regulatory/healthcare/insurance
reviewers — they're concrete and verifiable.**

---

## B. What the paper DOESN'T cover (where products + governance extend)

Per the user: "the paper only focuses on how i do it... not what i do with
it... which is where the products and governance come in."

The paper explicitly draws this boundary in several places:

### B.1 Section 4.3 — "IP-safe replication boundary"

> **Intentionally public:** the conservation claims, the pinned
> falsification contract (suite/observable/refutation). The replication
> harness interface is also public.
>
> **Intentionally withheld:** details of specific production implementations
> of enforcement, compression gating, lineage systems, and hardware
> anchoring covered by provisional patents/trademarks.

**So:** the paper publishes the law + the falsification contract + the
public proxy extractor. The PRODUCTION enforcement layer is patent-protected
and not in the paper.

### B.2 Section 2.2 — "Scope and limitations of the ABBA instantiation"

> The embedding of semantic content S into the quaternion algebra H is
> the implementation-specific step; the conservation claims in this paper
> are defined and tested at the signal level and do not depend on any
> particular algebraic substrate. **ABBA is an example, not the foundation.**

**So:** the math substrate (ABBA / quaternion algebra / trace-zero kernel)
is *one* concrete instantiation. The law doesn't depend on it. Different
products can use different kernels.

### B.3 Section 4.5 — "Extractor role: proxy vs. canonical C(S)"

> The modal-pattern sieve (Fig. 4) is a **public proxy extractor** E(·)
> used to make the falsification protocol runnable without proprietary
> components. It is **not** claimed to be the unique or canonical
> implementation of C(S).

**So:** the public extractor in the paper is a sieve, not the production
extractor. The real one stays private (covered by patents).

### B.4 Lineage/hardware threat model (Section 4.5)

The paper explicitly says hardware anchoring prevents replay/equivocation/
rollback/insider edits — but does **NOT** solve:

- semantic attacks that pass a weak ∼ oracle
- failures of the ∼ oracle itself (NLI brittleness)
- model collapse from data/optimization issues

> It is governance for **provenance/identity verification**, not "full alignment."

**So:** the paper establishes the substrate. The full governance picture
(rules for what to do when the gate rejects, how to handle disputes, how
to settle payments, how to assign trust tiers) lives outside the paper.
That's where Signomy + CIVITAE + COMMAND live.

### B.5 What the products + governance layer adds on top

The paper gives the **law**. The product/governance layer gives:

- **Specific gate implementations** in production (patent 63/877,177)
- **Signal Compression System engine** (patent 63/883,018)
- **Civic infrastructure** — SIGRANK, SigEconomy, Agent City-State (patent 19/426,028)
- **Commitment Conservation patent** itself (63/991,282)
- **Six-Gate Protocol** as the operational sequence (from the Prospectus)
- **Vault Artifacts + Fidelity Seal** as the contractual deliverable
- **Trust tier assignments** as the marketplace mechanic (Signomy)
- **Constitutional governance in HTTP** as the deployment surface (Signomy/CIVITAE)
- **Wave cascade pricing** as the economic model (COMMAND)
- **402 challenges + agent-speed settlement** as the payment surface

The paper deliberately stops at "this is the law, this is how you falsify
it." Everything from "and here's how you sell it, govern it, settle on it"
is downstream.

---

## C. Verbatim hooks for application drafts

### C.1 One-line framings that hold up

- "What TCP/IP accomplished for data transmission, this framework achieves
  for meaning fidelity."
- "Information theory tells you how reliably symbols can be transmitted
  under noise. This work tells you what survives transformation when
  symbols become meaning."
- "Conservation law for commitment in language under transformative
  compression and recursive application."
- "Drift is measurable theft. Each unit of drift is quantifiable
  commitment degradation, traceable to a specific transformation step and
  attributable through the lineage DAG."
- "Zero is not absence; it is the attractor state where signal and source
  coincide under enforced conservation."
- "Governance is not policy; it is enforcement of invariants at each
  transformation step."

### C.2 Numbers safe to cite

- **0.94 vs 0.42** commitment stability at n=10 (compression+lineage vs probabilistic)
- **92% vs 38%** identity preservation
- **r = 0.89, p < 0.001** correlation between identity preservation and stability
- **0.006 vs 0.058** drift rate per iteration
- **175 signals** in current corpus (100 NL + 50 code + 25 proofs)
- **EXP-001 through EXP-007** follow-on validation, no falsification
- **DOI 10.5281/zenodo.20029607** — published preprint
- **Patent portfolio: 63/877,177 + 63/883,018 + 19/426,028 + 63/991,282 + TM 99408355**
- **5 versions across 67 days** (Jan 12 → Mar 19, 2026) — publication velocity is itself a signal

### C.3 Stories that land

- **The "$100 Friday" demo** — under baseline, 230 → 316 tokens with
  conversational bloat. Under enforcement, converges to 5 tokens ("$100
  Friday") at turn 5. Hard commitments preserved, non-committal content
  collapsed. Most concrete demo of the framework available.
- **The meta-refinement story** (Section 8.6) — the paper's own iterative
  development is itself an example of the framework. Recursive AI-assisted
  rephrasing without gating produced bloat; manual editorial gating
  (analogous to MO§ES™ lineage validation) suppressed drift and converged
  to a stable kernel.
- **The bottleneck separation insight** (EXP-005) — when something fails,
  you can tell whether it's compression, extraction, or proxy-measurement.
  This is a sophistication signal that distinguishes serious framework
  work from black-box claims.

### C.4 Reviewer-pleasing rigor signals

- The **definitional vs empirical split** is rare and worth quoting:
  "The conservation principle is definitional in structure; the scientific
  claim is empirical."
- The **external oracle ∼ is swappable** — critics can substitute stricter
  oracles. Result that holds under stricter oracle strengthens claim.
- **Pinned reference instantiations** (deberta-v3-base-mnli, threshold > 0.85,
  commit hash 1bcba8ff) make replication exact.
- **Anti-Goodhart design** — min-aggregation across Jaccard + cosine + NLI
  + lineage DAG audit. Adversary that beats one proxy gets penalized by others.
- **DOI-backed empirical companion archive** — full experimental lineage
  preserved separately, not buried in supplementary material.

### C.5 Where the paper says "left for future work" (good answers to "what's next")

- Large-scale validation on corpora >10,000 samples across diverse domains
- Speech and multimodal signal extension (currently only text/code/proofs
  have empirical results)
- Adversarial robustness testing (specific attack designs targeting oracle
  weaknesses)
- Multi-agent governance protocols built on commitment conservation
- Tighter bounds on commitment stability and drift rates
- Whether achievable rates under zero-drift can be characterized as a
  **semantic capacity** (analogue to Shannon zero-error capacity)

### C.6 What NOT to claim from the paper

- ❌ Don't claim conservation under arbitrary adversarial transformation.
  The paper covers identity-preserving lossy transforms, not transforms
  engineered to delete commitments.
- ❌ Don't claim ABBA's cryptographic properties transfer to semantic domain.
  They govern the algebraic scheme; semantic fidelity is governed by the
  conservation law separately.
- ❌ Don't claim the paper validates at production scale. The corpus is 175
  signals; the paper itself calls this "proof-of-concept, not validation"
  and explicitly invites large-scale replication.
- ❌ Don't claim MO§ES™ solves alignment. The paper says it's "governance
  for provenance/identity verification, not full alignment."
- ❌ Don't call it "McHenry's Law" — per the repo CLAUDE.md rules. Use
  "Conservation Law of Commitment."

---

## D. Open questions for the user (flagged for resolution before any draft)

### D.1 MO§ES™ acronym tension

The paper expands it as **"Minimal Orthogonal Subset to Essential Structure"** —
descriptive of the architecture (compression onto the orthogonal kernel
subspace).

The field-sheet expands it as **"Modus Operandi System for Signal Encoding
and Scaling Expansion"** — descriptive of the governance/operations layer.

Both are coherent. They might be intentional dual-expansion (technical /
operational). But for any application I draft, I need to know which one to
lead with, or whether to acknowledge both.

### D.2 V.05 dated March 19, 2026 — anything updated since?

The paper history shows 5 versions across 67 days (Jan 12 → Mar 19). It's
been ~2 months since V.05. Are there material updates not yet in a V.06?
If so, flag them in context/ before I draft anything.

### D.3 EXP-008 onward?

The paper documents EXP-001 through EXP-007. Are there newer experiments
worth citing? If yes, drop them into `context/` so I can incorporate.
