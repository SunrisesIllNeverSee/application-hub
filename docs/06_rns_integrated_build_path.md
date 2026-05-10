# RNS-Integrated Build Path

Application Hub should ship as a practical product first: a question archive, answer bank, program workspace, hosted drafting, and external apply path. RNS is not a reason to restart or simplify the current repo. It is the deeper intelligence layer that can sit on top of the existing Supabase + MCP + Next.js spine.

The older "migrations 001-002 only" path is useful for understanding the minimum viable mechanism, but it is outdated for this repository. Application Hub already has migrations 001-009, seeded programs, MCP tools, and live app wiring in progress. Keep that spine. Hide or defer advanced scoring in the product UI when needed, but do not roll back the architecture.

---

## Phase 1: Product Core

Goal: ship the loop founders can use immediately.

- Maintain the canonical question archive in Supabase.
- Let users build a reusable answer bank.
- Show live programs with basic filters and detail pages.
- Pre-fill program workspaces from matching profile answers.
- Provide a hosted "Draft with AI" path for first-pass answer generation.
- Keep "Apply" as an external link until direct submission is validated.

This phase is mostly CRUD plus good UX. It should not depend on full RNS implementation, calibrated fit scores, autonomous scrapers, or Stripe.

The key boundary: drafting is not the same as reviewing. The launch app can call `POST /api/draft` to produce text, then save the answer. Review comments, answer grading, fidelity checks, and certification can come from Deric's side through MCP/RNS workflows that inspect saved answers after the fact.

---

## Phase 2: RNS Intelligence Upgrade

Goal: replace hand-tuned scoring assumptions with signal-aware judgment.

The current formulas are useful scaffolding, but they are under-powered relative to RNS. Keep pgvector for retrieval, because it is good at "what looks similar?" Add RNS above it for "what preserves intent, signal, and commitment?"

- Use Word Vault taxonomy for question classification.
- Add RNS signal purity analysis for question significance.
- Derive theme weights from commitment conservation instead of static prestige multipliers.
- Add SigToken-style contextual scoring for answer quality.
- Introduce answer fidelity checks before presenting an answer as reusable.
- Add RNS-backed review/comment output for saved drafts before embedding it directly into the hosted app flow.

This should be additive. Existing fields such as `significance_score`, `program_dna`, and `quality_signal` can remain display aliases while RNS-backed measurements mature behind them.

---

## Phase 3: CIVITAE / MO§ES Agent Layer

Goal: add governed automation only after the core workflow is usable.

- Deploy program discovery and question scrapers using CIVITAE agent deployment patterns.
- Use MO§ES governance for scraper posture, permission boundaries, and review requirements.
- Track scrape provenance with audit trail patterns.
- Reuse real-time monitoring patterns for agent runs and import review.
- Let agent-side review workflows read saved answers, produce comments, and write back review metadata only after the schema contract is explicit.

Scraping is a tax unless it is governed and observable. Manual seed data remains acceptable until the volume of requested programs proves automation is worth the maintenance load.

---

## Phase 4: Research Differentiation

Goal: turn Application Hub from an application helper into a signal intelligence system.

- Add SDOT for answer evolution tracking across drafts and submissions.
- Integrate SigTune-style input quality measurement for draft readiness.
- Measure answer stability with commitment conservation metrics.
- Add Signal Harness-style fidelity certificates for important answers.
- Use Global Arena-style ranking only after program and outcome data are rich enough to support it.

These features are the moat, not the MVP. They should be introduced as visible trust signals once users already understand the core workflow.

---

## Phase 5: Monetization

Goal: charge after the workflow is proven.

- Start with standard Stripe subscriptions.
- Gate high-usage AI drafting, exports, advanced scoring, and team workflows.
- Keep paid program listings as a later B2B feature, not the first monetization bet.

The first product promise is not "pay to browse a directory." It is "write once, apply everywhere, and know which answers are strong enough to reuse."

---

## Operating Principle

Ship the Application Hub spine first. Layer RNS on top. Do not replace the working product with the research system; let the research system make the product meaningfully smarter over time.
