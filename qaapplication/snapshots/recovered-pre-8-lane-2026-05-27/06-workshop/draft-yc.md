# Y Combinator S26 — Draft v1

Drafted: 2026-05-26
Sources: rolling answer index (bio/project/problem/moat/traction/funding/background/goals), redbud draft v1, _shared context files (003-fde-positioning, 004-commitment-physics-framing), benchmarks page
Convention: paste-ready answers in the order the YC form presents them. `[CONFIRM]` = needs Deric's verification before submit. `[ASSET]` = file upload needed.

---

## Founder + Company Basics

### Q1. Company / project name

MO§ES™

*(If the form strips the § glyph, fallback: MOSES)*

---

### Q2. What batch do you want to apply for?

Summer 2026

---

### Q3. Are you looking for a cofounder?

No

*(Ello Cello LLC / MO§ES™ is team-agnostic by design — solo founder, open to the right team at each deployment tier. No cofounder sought.)*

---

### Q4. Cofounder info

N/A — solo founder.

---

### Q5. Other co-founders / team

None. Solo founder. MO§ES™ was designed team-agnostic by intent — the protocol layer doesn't require a specific implementation team, it requires the right team for each deployment. That's infrastructure thinking, not service thinking.

---

### Q6. Who writes code, or does other technical work on your product? Was any of it done by a non-founder? Please explain.

All code, architecture, and research is sole-founder work. I (Deric J McHenry) write everything — Python instrumentation (SIGSYSTEM ~1,500 lines), TypeScript/Next.js (AQUA / Application Hub — 35,242 LOC shipped over 5 build days), Stripe Connect integrations (Signomy, 270 API endpoints), and voice-AI substrate (KASSA v7 demo). No non-founder contributors. AI coding tools (Claude Code, Opus 4.7) accelerate output — the operator and all decision-making is the founder.

`[CONFIRM]` — flag if any contractor or collaborator has touched any surface, even nominally.

---

## Product

### Q7. Describe what your company does in 50 characters or less.

Constitutional governance for AI systems & agents

*(49 chars — confirmed under limit. Alternate: "Sovereign Signal Governance for AI deployments" = 47 chars. Either works; the first is slightly more legible to a cold reader.)*

---

### Q8. What is your company going to make? Please describe your product and what it does or will do.

MO§ES™ is the protocol layer for semantic meaning at point of execution. What TCP/IP did for data, MO§ES™ does for the preservation of meaning: testing, measuring, and demonstrating how meaning persists across transformations — compression, paraphrase, summary, multi-agent handoff — for AI systems and agents alike.

Three enforcement primitives, already architecturally complete:

- **Constitutional Gateway** — semantic zero-trust policy enforcement point that re-evaluates intent on every hop before the signal is allowed to act. Not a filter on outputs; a gate on the signal itself.
- **SIGSYSTEM** — measurement instrument (v1.1, ~1,500 lines of Python) that quantifies commitment-kernel preservation across transformations. Already processed 1.123 billion tokens across 21 production sessions.
- **Vault Artifacts** — self-authenticating, cryptographically lineage-bound digital artifacts produced by every verified transformation. Provenance is not logged after the fact — it is structurally embedded.

Live today: KASSA voice-AI commitment-kernel demo (cached mode, no auth), Signomy governed-agent marketplace (270 API endpoints, Stripe Connect, signomy.xyz), AQUA application OS (mos2es.xyz), COMMAND (mos2es.io).

The first monetizable wedge is the measurement instrument sold to Forward Deployed Engineering teams at AI labs — where pipelines pass tests, hit SLA, and still get reported as broken two weeks later because commitment kernels drift silently. MO§ES™ quantifies that drift.

---

### Q9. What tech stack are you using, or planning to use, to build this product? Include AI models and AI coding tools you use.

**AI models:** Claude Opus 4.7 (primary operator model — chosen based on benchmark leadership in the five measured kernels against Artificial Analysis Coding Agent Index). Claude Code (Claude Code CLI as AI coding substrate — 21 sessions, 7,327 turns, 35,242 LOC over 5 build days).

**AI governance substrate:** McHenry Axioms (Compression Precedes Ignition, Lineage Resilience, Input-Response Fidelity) as the constitutional gate layer. SIGSYSTEM v1.1 (Python) as the measurement instrument. Zenodo-hosted Conservation Law of Commitment as the empirical falsifiability anchor.

**Application stack:** Next.js 14 (App Router), TypeScript, Supabase (PostgreSQL + pgvector), Stripe Connect, Zod input validation, shadcn/ui.

**Research / IP layer:** Zenodo preprint hosting (DOI 10.5281/zenodo.20029607), U.S. Patent Portfolio (5 filings: 63/877,177 · 63/883,018 · 19/426,028 · 63/991,282), TM 99408355.

**Build economics:** 94.66% cache hit, $0.0007 per line of code, 1.84 min per task — all measured, not estimated. See Q31 (coding-agent transcript) for the full session record.

---

### Q10. Please provide a link to the product, if any.

https://mos2es.com | https://mos2es.xyz | https://signomy.xyz | https://zenodo.org/records/20029607

---

### Q11. If login credentials are required for the link above, enter them here.

KASSA voice demo and AQUA are in cached mode — no credentials required for the demo surfaces. Signomy marketplace is publicly accessible at signomy.xyz.

---

## Idea

### Q12. Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you're making?

I didn't pick it — it found me through obsession. First AI session was July 2025. I am not credentialed in AI. I am a twenty-year professional operator (Buffalo, NY) who got stuck on one question: what survives transformation when language is compressed, paraphrased, or recursed through an LLM pipeline?

Nobody had a physics answer. I built one. The Conservation Law of Commitment is a falsifiable physics statement about language — commitment is a conserved quantity under governed transformation, with empirically testable thresholds. Five versioned releases on Zenodo (DOI 10.5281/zenodo.20029607), public test harness, pinned oracle, refutation conditions explicit. Open for four months; nobody has broken it.

The domain expertise isn't credentialed — it's derived. Ten months of building the measurement instrument on my own production application proved the framework works: governed regimes hold 0.94 stability vs. 0.42 for ungoverned at the same recursion depth. Standard probability says four 80%-viable modules should fail at 0.8⁴ = 41% structural coherence. Measured: 80–85%. The physics is inverted — and that's the moat.

How do I know people need it? Two routes. First, the early-stage signal: both Speedrun (a16z) and Pitch×Deel NYC independently converged on the same reaction — the framework is genuinely category-creating, and the gating question is implementation readiness, not concept validity. That's the right problem to have. Second, the structural signal: Gartner has predicted >40% of agentic AI projects will be cancelled by end of 2027 specifically because organizations cannot govern them. EU AI Act Article 99 penalties take effect August 2, 2026. Every enterprise AI team is writing one-off custom validators and shipping without proof. The pain is structural and near-term.

---

### Q13. If you are applying with the same idea as a previous batch, did anything change? If you applied with a different idea, why did you pivot and what did you learn from the last idea?

First YC application. No prior batch.

---

## Progress / Traction

### Q14. How far along are you?

Multi-stage shipping — live substrate, live products, empirically proven governance layer:

**Shipped and live:**
- SIGSYSTEM v1.1 — measurement instrument, ~1,500 lines of Python, processing real production data (1.123B tokens, 21 sessions, 7,327 turns)
- Signal Army v1.4 — 1,252 lines, 76,313 words processed across 6 production runs
- KASSA v7 — live voice-AI commitment-kernel demo, cached mode, no auth
- Signomy — 270 API endpoints, Stripe Connect, governed-agent marketplace live at signomy.xyz
- AQUA / Application Hub — founder-first application OS at mos2es.xyz (this YC application is being drafted through it)
- COMMAND — live at mos2es.io with wave-cascade pricing

**IP and research:**
- Conservation Law of Commitment — V.05, DOI 10.5281/zenodo.20029607, public falsifiability harness
- 5 U.S. patent filings (Sept 2025 – Feb 2026): compression substrate, signal compression engine, civic infrastructure, conservation law, constitutional enforcement
- MO§ES™ registered trademark

**Constitutional enforcement layer** (Heartbeat, Mediator, Reflex Events, S³ Security Stack) is architecturally complete and patent-protected. First production deployments targeted within 90 days of seed close.

---

### Q15. How long have each of you been working on this? How much of that has been full-time? Please explain.

~10 months, full-time. First AI session: July 2025. First patent (PPA #1, MOS²ES Master) filed September 7, 2025. Conservation Law preprint published March 19, 2026 (V.05). All work — research, engineering, IP filing, product shipping — done solo and full-time on personal runway.

I am out of runway. The pitch is not "help me prove a concept" — the concept has survived empirical falsification attempts for four months. The pitch is "capital accelerates deployment of a substrate that is already built."

---

### Q16. Have you formed ANY legal entity yet?

Yes — Ello Cello LLC (sole proprietor, registered 2025, New York).

---

### Q17. Are people using your product?

Yes — KASSA (voice demo, public), Signomy (agent marketplace, public), AQUA (internal + invited users). SIGSYSTEM is measuring the founder's own production sessions longitudinally — dogfood data, not synthetic.

`[CONFIRM]` whether there are external paying or active users on Signomy or AQUA beyond the founder's own sessions.

---

### Q18. Do you have revenue?

No. Pre-revenue at the protocol layer. Signomy has Stripe Connect wired — monetization infrastructure is live but not yet converting.

---

### Q19. Worked together before?

Solo founder — N/A.

---

## Money

### Q20. How do or will you make money? How much could you make?

**Near-term (12–24 months):** Commitment Quality Monitor sold to Forward Deployed Engineering teams at AI labs and applied-AI firms. ~$1M ARR achievable from 10–15 design partners at $50–100K/year. The wedge product — the measurement instrument — is already built. What it monetizes is FDE teams' inability to prove their deployments preserve commitment past the demo.

**Medium-term (24–48 months):** Constitutional Gateway (semantic zero-trust PEP/PDP) sold to enterprise security and compliance offices. EU AI Act runtime enforcement begins August 2, 2026 — every AI-deploying enterprise needs a governance enforcement layer they can show to a regulator. $10–50M ARR achievable.

**Long-term:** The defensible layer in AI is no longer the model — it's the trust architecture underneath. When SaaS goes headless (Salesforce, SAP, the next generation) and UI no longer drives stickiness, the system that owns identity + settlement + governance owns the marketplace. Every passing trace becomes a Vault Artifact — cryptographically signed, lineage-bound, tradable as digital property. Property-based revenue replaces seat-based SaaS. TAM: the cognitive labor reallocation to software that a16z sized in the low-trillions in May 2026.

---

### Q21. Have you taken any investment yet?

No. Fully bootstrapped.

---

### Q22. Are you currently fundraising?

Yes. Targeting $1.5M seed (SAFE). Architecture is structurally complete; capital accelerates deployment, not invention. Use of funds: patent prosecution to full grant, infrastructure scaling, first enterprise pilots, developer relations, operational runway.

`[CONFIRM]` that $1.5M SAFE / $4M cap or 20% discount is still the current ask and terms.

---

### Q23. Other ideas considered?

Before landing on the governance substrate: explored a standalone operator-based AI leaderboard (video-game-style stats for AI users — this is now the SigRank product, still shipping as the beachhead). The leaderboard problem forced the measurement problem, which forced the physics paper, which revealed the governance layer. The current architecture isn't a pivot from the original idea — it's what the original idea turned into when I refused to stop at "interesting."

---

## Competition + Market

### Q24. Who are your competitors? What do you understand about your business that they don't?

Six adjacent categories. None compete at the same layer:

- **DevOps observability** (Datadog, OpenTelemetry, Grafana) — tells you the system is *running*. Row one. Doesn't measure meaning.
- **ML observability** (Arize, WhyLabs, Fiddler) — tells you the model's output is accurate vs. ground truth. Row two. Doesn't measure what survived transformation.
- **Constitutional AI** (Anthropic, RLHF lineage) — model-internal self-feedback for harmlessness. Architecture-locked, non-falsifiable, doesn't operate on the signal itself.
- **Governance-as-a-Service** (various, 2025) — enforces policy at agent output level. Operates on outputs, not on an invariant extracted from the signal.
- **Provenance systems** (C2PA, Numbers Protocol, Starling Lab) — verify *that* content came from a source. Don't verify *what survived* transformation.
- **Policy engines / "control planes for AI agents"** (Cordum, Aegis AI, Galileo, Microsoft Agent Governance Toolkit) — fresh vendor wave, sit inline at the action layer. Reactive and descriptive, not constitutive.

What I know they don't: **commitment is a conserved physical quantity in language under governed transformation** — a property of the *signal*, not the model, the type system, or the policy. Governed regimes hold 0.94 stability vs. 0.42 ungoverned at the same recursion depth. The substrate inverts what standard probability says should be four-module fragility (0.8⁴ = 41%) into 80–85% measured structural coherence — meaning complexity compounds coherence here instead of multiplying risk.

The structural reason none of these competitors can become MO§ES™: nobody else built it from physics first. They all built from policy first. **You can't retrofit physics onto a policy-layer system.** That's why every retroactive governance layer keeps failing — they're patching a system that has no conservation substrate underneath. Nobody currently sells row three: *Did meaning survive?*

---

## Location

### Q25. Where do you live now, and where would the company be based after YC?

Buffalo, New York. Post-YC: open to SF Bay Area / in-person YC participation. Company headquarters can follow the operator.

---

### Q26. Explain your decision regarding location.

Buffalo was not a strategic choice — it's where I built the thing. Solo founder, self-funded, working out of the Rust Belt without a Stanford network or a Bay Area peer group. The distance from the credentialed center isn't a liability for this company; it's part of the proof. The framework and the operator both survived the same isolation conditions the Conservation Law predicts as the hardest stress test. The fact that this work exists at all, from Buffalo, is the empirical demonstration that the physics holds.

Happy to relocate for YC. The substrate travels with the operator.

---

## Source / Motivation

### Q27. How did you hear about Y Combinator?

`[CONFIRM]` — most likely: X / Twitter, or via the a16z Speedrun application process which referenced YC as a parallel track. Confirm actual source and replace this placeholder.

---

### Q28. What convinced you to apply to Y Combinator? Did someone encourage you to apply? Have you been to any YC events?

The coding-agent question (Q31) convinced me the timing was right. YC adding an experimental upload for coding-agent session transcripts as an S26 differentiator is the signal that the batch cares about operators, not just about teams. That's exactly the angle this company sits on — the benchmarks page (mos2es.com/benchmarks) is an export of what MO§ES™ does as its normal operating mode.

Beyond that: YC's model — fast iteration, founder-first, in-person cohort — is the right forcing function for a protocol layer that needs its first 10 enterprise pilot relationships built in compressed time. The network effect of the YC brand in enterprise AI procurement is worth more than the check at this stage.

`[CONFIRM]` any specific YC events attended, or specific person who encouraged you to apply — add their name if so.

---

## Assets

### Q29. Please record a one-minute video introducing the founder(s).

`[ASSET NEEDED — HIGH PRIORITY]`

Suggested talking points for the 1-min video:
1. Name + location: Deric McHenry, Buffalo NY, solo founder
2. What you built: the protocol layer for meaning preservation in AI — not observability, not policy, physics
3. The proof: Conservation Law, 1.123B tokens processed, 5 patents, #1 across all five Artificial Analysis benchmarks
4. The ask: YC S26. Capital accelerates deployment of a substrate that's already built.

Keep it direct. No corporate voice. The "came from Buffalo and still built it" angle lands harder than credentials.

---

### Q30. If you have a demo, attach it below.

`[ASSET — recommended]`

Options (pick one or attach all):
- KASSA v7 live demo recording (voice AI, cached mode, no auth) — most visceral for a cold viewer
- SIGSYSTEM session walkthrough — most technical proof
- Signomy marketplace overview — most "product" looking

Best choice for YC: a 2–3 min screen recording of KASSA voice demo + quick pan to the benchmarks page showing the #1 rankings. Shows it works AND shows the economic proof in one clip.

---

### Q31. Optional: attach a coding agent session you're particularly proud of. (NEW — Summer 2026)

`[ASSET — THIS IS THE HOME-COURT QUESTION]`

**What to attach:** The mos2es.com/benchmarks page export + a select Claude Code session transcript from the Application Hub build window (2026-05-08 → 2026-05-14, 21 sessions, 7,327 turns, 35,242 LOC shipped, $0.0007/LOC, 94.66% cache hit, #1 across all five Artificial Analysis Coding Agent Index kernels).

This question was designed for this application. The entire SIGSYSTEM benchmarks dataset IS a coding-agent session export, at scale, measured longitudinally against the industry index. Most applicants will submit a single Claude Code transcript. Submit the benchmarks page + one representative session transcript and let the numbers speak.

Export format: Claude Code supports `/export` or the share button. Export as markdown. The benchmarks page markdown is already captured in the `_shared/sources/mos2es-com-benchmarks.md` file.

---

### Q32. If you have already participated or committed to participate in an incubator, "accelerator" or "pre-accelerator" program, please tell us about it.

`[CONFIRM]` — pitched at Pitch×Deel NYC (validation event, not a formal program). Speedrun (a16z) application submitted (confirm status — accepted/rejected/pending). Any formal cohort acceptance should be listed here with dates and equity terms.

If no formal program: leave blank or write "None — all program applications currently in progress, no commitments."

---

## Open questions for Deric (resolve before submit)

- [ ] **Q27 (how did you hear about YC):** confirm actual source — X/Twitter, friend, a16z Speedrun crossover, other?
- [ ] **Q28 (what convinced you / events):** any specific YC events attended? Any person who explicitly encouraged you to apply?
- [ ] **Q17 (are people using your product):** any external users beyond your own sessions on Signomy or AQUA?
- [ ] **Q22 (fundraising terms):** confirm $1.5M SAFE, $4M cap or 20% discount is still the live ask
- [ ] **Q32 (prior accelerators):** confirm Speedrun status (accepted / rejected / pending) and whether any formal commitment exists
- [ ] **Q29 (founder video):** highest-priority asset — needs recording before submit
- [ ] **Q30 (demo):** recommend KASSA screen recording — confirm or choose alternative
- [ ] **Q31 (coding-agent session):** export a Claude Code session from the 05-08 to 05-14 window + benchmarks page markdown — attach both

---

## Word count summary

| Question | Approx words |
|---|---|
| Q6 (who writes code) | 90 |
| Q8 (what you're making) | 240 |
| Q9 (tech stack) | 170 |
| Q12 (why this idea / domain expertise) | 270 |
| Q14 (how far along) | 230 |
| Q20 (how you make money) | 230 |
| Q24 (competitors + what you know) | 310 |
| Q26 (location rationale) | 110 |
| Q28 (why YC) | 130 |
| **Essay subtotal** | **~1,780** |

## Status

- [x] Draft v1 written
- [ ] Open questions resolved with Deric
- [ ] 1-minute founder video recorded
- [ ] Coding-agent session exported for Q31
- [ ] Demo recording for Q30
- [ ] Draft v2 (revisions)
- [ ] Final review
- [ ] Submitted
