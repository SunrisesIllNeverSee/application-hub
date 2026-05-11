# Polish List

_Last updated: 2026-05-11_
_Implementation order: after repo cleanup (issue #1) is complete._

Items in rough priority order within each tier.

---

## P1 — Ship before broad launch

- [ ] **Questions archive UI** — `/archive/questions` browse page, filter by theme/domain, significance sort, locked/unlocked state. Full plan: `docs/18_questions_archive_plan.md`
- [ ] **Funders index UI** — `/funders` index + `/funders/[slug]` profile. Data is in DB. Full plan: `docs/19_funders_archive_plan.md`
- [ ] **Questions pipeline gap** — 800 FundingCake programs have no questions mapped. Empty workspace state + "submit questions" CTA. Admin import_queue review flow.
- [ ] **Program card funder attribution** — "by Y Combinator" link on program cards pointing to `/funders/[slug]`
- [ ] **Stripe activation** — Deric: add price IDs + CRON_SECRET to Vercel env vars
- [ ] **Pro Plus tier decision** — pricing structure locked, then schema migration + Stripe products

---

## P2 — Polish pass

- [ ] **Home dashboard / Today view** — unlocked questions today, closest deadlines, in-progress applications, answers needing review
- [ ] **DNA radar/chart** — program detail: radar or bar chart of `program_dna` weights vs user profile coverage
- [ ] **Significance score display** — star/importance indicator on questions, "asked by N programs" tooltip, sort by significance within sections
- [ ] **Stress-test UI** — entry point from workspace/bank, quota display, results view (Codex lane: persistence already done)
- [ ] **Workspace empty state** — when program has no questions indexed, show helpful message + submit form URL link
- [ ] **Question count on program cards** — "12 questions indexed" badge

---

## P3 — After launch feedback

- [ ] **MoatScore / FundScore / Standing** — deferred to Deric's spec. `/about/scoring` page has placeholder.
- [ ] **Founder Ranking** — public percentile display, opt-in
- [ ] **Outcome analytics** — aggregate accepted/rejected signals once users start logging outcomes
- [ ] **Funder claiming** — verification flow, verified badge, profile editing
- [ ] **Funder webhooks** — "notify me when high-fit founder applies"
- [ ] **VS Code extension** — sidebar with question bank, command palette for drafting
- [ ] **Public API** — open program + question graph to partners
- [ ] **Embeddable widget** — question + draft assistant for partner sites
- [ ] **Mobile apps** — if analytics show mobile usage

---

## Done (reference)

- [x] Dark mode toggle
- [x] Outcome tracking UI (workspace)
- [x] Scoring overview page `/about/scoring` + inline tooltips
- [x] Funders schema (migration 023, 30 orgs seeded)
- [x] Deadline alerts (edge function + pg_cron)
- [x] Team mode (schema + API)
- [x] Answer review persistence (migration 026)
- [x] Multi-provider draft (Anthropic, OpenAI, Ollama)
- [x] Application import + program submission
- [x] Portable taxonomy (domain + universal_theme)
- [x] SEO — metadataBase, robots.txt, sitemap.xml
- [x] Stripe skeleton (code complete)
