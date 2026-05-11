# Polish List

_Last updated: 2026-05-11_
_Implementation order: after repo cleanup (issue #1) is complete._

---

## P1 — Data ready, just needs UI

- [x] **Home dashboard / Today view** — unlocked questions today, closest deadlines, in-progress apps, answers needing review. All data live.
- [x] **Stress-test UI** — button in AnswerEditor → structured pushback + scores. Backend fully done (Codex). Just needs UI wire-up.
- [x] **Significance stars on questions** — star/importance indicator on question cards in `/bank` and workspace. `significance_score` computed for all 225 questions. ScoreTooltip already built. One afternoon.
- [ ] **Application ranking** — rank founders per program by composite_score, show position. Data exists. Needs enough user volume to be meaningful, but UI can be built now.
- [ ] **Recruiter agent** — nightly job: query `user_program_fit` for high composite_score matches, email via Resend. Infrastructure (pg_cron, Resend, fit scores) all live. Just needs the job + template.
- [x] **DNA radar/chart** — radar or bar chart of `program_dna` theme weights vs user profile coverage on program detail. 183 DNA rows in DB.
- [ ] **Floating Moat Standard / MoatScore / FundScore** — Deric's spec incoming. `/about/scoring` page has placeholder. Architecture is ready to receive it.

---

## P2 — Needs scale, partnerships, or real data first

- [ ] **Heat scores from observed data** — replace provisional labels with real acceptance rates, applicant volumes, social signals. Requires data pipeline + partnerships.
- [ ] **GitHub traction integration** — repo stars, commits, contributors into profile + fit scoring. Needs OAuth.
- [ ] **Public API** — formalize MCP HTTP as a documented partner API. REST wrapper or MCP-native. Build when first partner asks for it.
- [ ] **Winning applications marketplace** — opt-in founders release successful apps. Needs critical mass of logged outcomes first.
- [ ] **Live application updates** — status push from programs after submission. Requires active program partnerships.
- [ ] **Host applications directly** — become canonical submission portal. Requires partner integrations.

---

## Vision tier

- [ ] **Application automation (autonomous)** — fully autonomous form submission. Complex, legal exposure, anti-bot protections per portal. Watch for MCP-based intelligent pre-fill path (Version 1) which is buildable now via browser extension + existing workspace.

---

## Full item notes (reviewed 2026-05-11)

### Public API
Already partially real — MCP HTTP mode is a typed, authenticated API with 21 tools. Gap is REST formalization, API key UI, versioning, public docs. MCP is the right API for AI-native partners. REST wrapper when a non-AI partner asks for it. Moving to P2.

### Application automation — two versions
- **Version 1 (P2):** Intelligent pre-fill via browser extension + MCP. Detects form fields, matches to Answer Bank, pre-fills for user review. MCP tool already exists for question matching. Extension is the missing piece.
- **Version 2 (Vision):** Fully autonomous submission. Anti-bot, TOS, legal complexity. Not near-term.

### Recruiter agent
`user_program_fit` computed nightly, Resend wired, pg_cron available. The job itself is maybe 50 lines — query high-fit matches not yet applied to, send email. Moved to P1.

### Application ranking
`fit_score` + `composite_score` per (user, program) exist. Ranking against other founders requires other founders. UI can be built now — rank display, percentile, "raise X to move up" feedback loop. Populate with real data as users grow. Moved to P1.

### MoatScore / FundScore / Floating Moat Standard
Philosophy and placeholder on `/about/scoring`. Architecture ready. Computation is Deric's IP — will slot in when spec arrives. Moved to P1 because it's imminent.

### Data privacy / security / vault
Flagged for separate deep dive. Reference: mirror GitHub (SunrisesIllNeverSee/MOS2ES). Existing: AES-256-GCM encryption on BYOK keys, RLS on all tables, domain-isolated data. Full vault and commitment conservation layer is the MO§ES™ infrastructure conversation.

---

## Done (reference)

- [x] Today dashboard (`/today`) — stat cards, in-progress apps, deadline alerts, top matches
- [x] Stress-test UI — `/api/stress-test` + `StressTestPanel` in AnswerEditor
- [x] Significance stars — shared `SignificanceStars` component, wired in Bank, Workspace, Program Detail
- [x] DNA radar/chart — `DnaRadarChart` pure-SVG component, wired in Program Detail DNA card

- [x] Dark mode toggle
- [x] Outcome tracking UI (workspace)
- [x] Scoring overview page `/about/scoring` + inline tooltips
- [x] Funders schema (migration 023, 30 orgs seeded, heat scores fixed)
- [x] Deadline alerts (edge function + pg_cron, 8am UTC)
- [x] Team mode (schema + API)
- [x] Answer review persistence (migration 026)
- [x] Multi-provider draft (Anthropic, OpenAI, Ollama)
- [x] Application import + program submission
- [x] Portable taxonomy (domain + universal_theme)
- [x] SEO — metadataBase, robots.txt, sitemap.xml
- [x] Stripe (live — price IDs + webhook confirmed)
- [x] BYOK (Anthropic, OpenAI, Ollama — end-to-end confirmed)
- [x] Question bank + drip mechanic
- [x] Profile split, sidebar IA, workspace index
