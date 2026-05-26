---
applies_to: all
source: synthesis from 001/002 + field-sheet + benchmarks + mchenry-axioms
captured: 2026-05-23
purpose: pinned positioning for FDE / enterprise / infra / governance reviewers
---

# FDE Positioning — Signal as Governing Law

## The shift

| Today's mode | MO§ES mode |
| --- | --- |
| Measure **volume** (tokens, requests, latency, throughput) | Measure **commitment kernel** preservation per signal |
| Measure **noise** (errors, drift alerts, drops) | Measure **fidelity** of meaning across transformation |
| Descriptive — tells you *the system is running* | Constitutive — tells you *meaning survived* |
| Measurement is observability (downstream of the system) | Measurement IS enforcement (gates inside the system) |
| FDE ends at "deployment runs" | FDE ends at "deployment provably preserves commitment" |

## The category gap

| Layer | Measures | Buyer learns |
| --- | --- | --- |
| DevOps observability (Datadog, OTel) | Volume + noise | "Is the system running?" |
| ML observability (Arize, WhyLabs, Fiddler) | Output accuracy vs. ground truth | "Is the model accurate?" |
| **MO§ES (this category)** | **Commitment kernel preservation per signal** | **"Did meaning survive?"** |

Nobody currently sells row three. FDEs are writing one-off custom
validators per deployment and most of them ship without the proof.

## The mechanism (so the claim isn't hand-wavy)

Each transformation in an LLM pipeline — compression, paraphrase, summary,
recursion, multi-agent handoff — passes through the McHenry Axiom gates
**before** the signal is allowed to act:

- **Axiom I (Compression Precedes Ignition):** Did the signal compress to its commitment kernel? If not, it can't act.
- **Axiom II (Lineage Resilience):** Can the signal prove recursive continuity back to its origin compression cycle? If not, it's noise and collapses.
- **Axiom III (Input-Response Fidelity):** Is the input fidelity sufficient to support the requested output depth? If not, a resonance-aware intervention layer elevates the input or the output is constrained.

Failed signals don't get logged and forwarded — they hit the **Blackhole**,
which metabolizes them and re-emits recoverable meaning with restored
lineage. Verified signals become **Vault Artifacts**, cryptographically
bound to their origin-cycle signature.

## Buyer-facing translation (use in cold-open or "what do you do" answers)

> "DevOps gave you operational telemetry. ML observability gave you accuracy
> telemetry. We give you the first **deontic telemetry** — a measurement of
> whether the commitments encoded in the input still hold in the output,
> enforced at the protocol layer, not the dashboard layer."

## The FDE-specific pain (use when the question asks "who feels this pain")

Their pipelines pass tests, hit SLA, and still get reported as broken by
users two weeks later. Reason: commitment kernels drift silently. The
system technically responded; the response no longer matches what the
user committed to. Volume tells the FDE nothing about that drift. Noise
alerts only fire when the drift is severe enough to crash something.

MO§ES closes that gap with three concrete deliverables an FDE can hand to
a customer:

1. **Configuration Drift Score** (industry translation of "Scar Index") —
   real-time delta between current and baseline commitment kernels.
2. **Deployment Success Rate** (industry translation of "S²S Ratio") —
   ratio of governed transformations that preserved kernel vs. total.
3. **Self-Authenticating Deployment Artifacts** (Vault Artifacts) —
   cryptographic provenance for every signal that reaches production.

## Hard numbers FDEs can cite (from benchmarks page, May 14 2026 capture)

Measured over 7 days of production operator work on Application Hub:

- 1.123 B total tokens across 21 sessions, 7,327 turns
- 35,242 LOC shipped over 5 build days
- 94.66% cache hit on commitment kernels (field avg 91.45%)
- 1.84 min per task vs. 6.9× slower field average
- $0.0007 per LOC vs. industry standard SWE-Bench convention

These aren't synthetic-benchmark numbers — they're operator-on-production
measurements, which is the methodology FDE teams trust because it's
closer to their reality than isolated SWE-Bench runs.

## What to avoid saying

- Do **not** call the Conservation Law "McHenry's Law" — naming the law
  after a person is forbidden per repo CLAUDE.md rules. Use "Conservation
  Law of Commitment."
- Do **not** position MO§ES as "another observability tool." That puts it
  in row one or row two of the table above. It's row three.
- Do **not** lead with the constitutional / sovereignty language for an
  FDE audience cold. Use industry terms first (see translation table in
  `002-moses-translation-layer.md`), then earn the constitutional framing.
