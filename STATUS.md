# AQUA — Status

> ⚠️ **ARCHIVAL — DATA REALITY CHECK (2026-05-14)**
>
> This repo's state is being preserved as a reference for the deric-led rebuild.
> Active development moves to a new build context. The intelligence engine
> (formulas, RPCs, MCP tools, schema) is REAL. The seed data for the
> originally-seeded 30 programs is SYNTHESIZED (fake `program_questions`,
> derived `program_dna`, derived `user_program_fit`, derived
> `significance_score`). All real user-generated data — `profile_answers`,
> `user_applications`, BYOK integrations, etc. — is REAL.
>
> See `ARCHIVE_NOTES.md` for: engine-vs-data split, final post-mortem, and
> the comms-structure spec for the new build.

---


Last updated: 2026-05-20 (codex canonical rebuild session)

---

## 2026-05-20 — Canonical rebuild scaffold

**Session:** codex-2026-05-20-canonical-rebuild
**Claim:** canonical rebuild file lanes

### What landed

- `REBUILD/CANONICAL_REBUILD_TASKS.md` created as the implementation checklist for the Grok deep-dive rebuild.
- Supabase migrations `042` through `046` added:
  - Canonical commitments, answer variants, application packages, lineage events
  - Canonical RPCs, embedding column, hybrid search, package retrieval, smart matcher search
  - Rewards and payout-ready contribution ledger
  - Aggregate stats/history for high-fidelity variants
  - Seeding entities and manual review gate for real application data
- Migration chain high-water mark in repo is now `001-046` (`047` next).
- `supabase/functions/canonical-hub/` scaffolded with `ingest`, `qualify`, `export`, and `map_variant` actions.
- `supabase/functions/smart-matcher/` scaffolded for persona-aware recommendations.
- Next.js APIs added under `/api/hub/*` plus Stripe payout scaffold.
- Reusable UI components added for ingestion, variant review, highlight refinement, and Smart Matcher feed.
- Chrome MV3 extension scaffold added at `webextension/chrome/aqua-extension/`.
- MCP wrapper tools added under the `aqua.*` namespace.
- `docs/CANONICAL_HUB.md` and `docs/CANONICAL_RESET_RECIPE.md` added.
- Supabase CLI migration history repaired: drift entries `20260512153021` and `20260513011652` marked reverted, local `040` and `041` marked applied, and migrations `042`-`046` pushed to the linked Supabase project.

### Important caveat

The proprietary algorithms are intentionally placeholders and are marked with `TODO: Your IP` in the implementation. Production scoring still needs Deric's exact formulas for commitment similarity, language quantification, fidelity, SigTune/contextual scoring, and variant reduction thresholds.

---

## 2026-05-19 — WebExtension foundation

**Session:** vscode-claude-2026-05-19
**Claim:** webextension/ file lane

### What landed

- `webextension/` folder created — browser-organized structure for all future extensions
- Browser reference folders: `chrome/`, `firefox/`, `safari/` — each with setup guide, store info, deployment log
- **Userscript** (`application-hub/userscript/application-hub.user.js`):
  - Scans all textareas, attaches AH trigger button
  - Opens answer bank panel on click, fetches from Supabase using session JWT
  - DOM-safe rendering (no innerHTML with dynamic data)
  - Connects to existing `ExtensionTokenCard` + `GET /api/auth/token` — already live in settings page
  - Safari install guide via free Userscripts app (Mac App Store, no Xcode needed)
  - Chrome/Firefox install guide via Tampermonkey/Violentmonkey
- WXT scaffold (v0) archived at `_archive/application-hub-v0/` — Chrome + Firefox builds were passing
- `application-hub/` cleared for full rebuild (next session)

### What is next

- Discuss and design the extension rebuild — user wants to rethink the approach
- Safari native extension: blocked on Xcode.app install (~7GB)
- Add `data_collection_permissions` field to Firefox manifest before AMO submission
- Publish pipeline (`@wext/shipit`, store accounts) when ready to ship

This file is the current GitHub-visible source of truth. It separates what is confirmed in this repository from what may exist locally but has not yet been uploaded.

Use this as the canonical fact source for:
- counts
- migration chain
- shipped feature state
- remote/live truth

Other coordination docs should point here rather than restating these facts unless they have a specific reason to do so.

---

## Confirmed in GitHub

### Repository
- Public GitHub repository: `SunrisesIllNeverSee/application-hub`
- Default branch: `main`
- Root project documentation is present.
- Root `.gitignore` is present and excludes dependency folders, build output, `.next`, local env files, and editor artifacts.

### Deployment
- App is deployed live at `https://mos2es.xyz`
- Auth (magic link + password escape hatch) confirmed working on live site.
- Smoke test completed 2026-05-10. All core routes load against live Supabase.

### Database
- Supabase migration directory exists.
- Migrations `001` through `041` are the canonical migration chain. Duplicate numeric prefixes resolved: 018_portable_taxonomy → 034, 022_user_integrations_unique_provider → 035. 038_ranking_rpc, 039_program_cycles, 040_onboarding_gate, and 041_beta_mode all applied to Supabase via MCP. Supabase CLI linked, `db push --dry-run` clean.
- `migrations/041_beta_mode.sql` is present and applied. Adds `beta_settings` (single-row config), `starter_packages` + `user_starter_claims` (Founder Starter Pack seeded with the top 10 universal questions), `community_messages` (RLS scoped to sender+recipient), enhanced outcome columns on `user_applications` (`outcome_notes`, `interview_date`, `program_feedback`, `would_recommend`, `outcome_logged_at`), beta columns on `user_subscriptions` (`beta_payment_method_id`, `beta_grace_period_days`, `beta_participant`, `grace_period_ends_at`), the `'starter'` source value on `user_question_unlocks`, and the `claim_starter_package(uuid)` RPC.
- `migrations/008_intelligence_layer_v2.sql` is present and includes:
  - MCP-facing program display columns
  - question significance scoring
  - profile answer alignment columns/triggers
  - draft usage RPC
  - `program_dna`
  - `user_program_fit`
  - pgvector matching RPC
  - nightly cron refresh jobs
- `migrations/009_fix_auth_trigger_search_path.sql` is present. Cowork added it during live smoke testing to pin search_path on the signup trigger chain and fix magic-link signup failures.
- `migrations/010_deadlines_and_program_detail.sql` is present and adds deadline fields and program detail columns.
- `migrations/011_user_profiles.sql` is present and adds the user profiles table.
- `migrations/012_launch_hardening.sql` is present and adds the BYOK metadata contract plus persisted answer stress-test runs.
- `migrations/013_cohort_context.sql` is present and adds `cohort_name`, `program_start_date`, and `cohort_size` to programs. Seeds known values for 8 programs.
- `migrations/014_question_bank_drip.sql` is present and adds `user_question_unlocks`, signup seed logic, and daily drip mechanics.
- `migrations/015_byok_key_storage.sql` is present and adds `key_encrypted` for BYOK key storage.
- `migrations/026_answer_reviews.sql` is present and adds append-only persistence for agent review output plus owner-scoped RLS.
- `migrations/027_recruiter_alerts.sql` is present and adds the `recruiter_alerts` dedup table for the weekly recruiter email agent.
- Migrations through `041` are now the expected app chain (034-035 are renames of duplicate-prefix files; Supabase CLI synced).
- The current strategy is to keep the existing migration chain and layer RNS-backed intelligence above the current scoring fields rather than rolling back to a minimal schema.


### Shipped 2026-05-12 (AQUA Phase)

- **Rebrand: Application Hub → AQUA** (Applications · Questions · Answers). Sidebar consolidated from 7 items to 4 pillars (Dash · Applications · Questions · Answers). Logo, OG image, page titles, landing, scoring docs all rebranded. Profile demoted to footer (credit badge link remains).
- **Routes restructured** with permanent redirects: /today→/dash, /hub→/applications (incl. nested), /bank→/questions, /archive/questions→/questions?view=archive, /funders→/applications?view=funders. Workspace stays at /workspace/[program_id] but lights up Applications in nav.
- **Feature 1 — Split-screen editor**: /workspace/[program_id] rebuilt as left-tree + right-editor. New QuestionTree (collapsible by section, theme tag, significance, answered indicator) and CompiledOutput (inline-markdown render, copy-to-clipboard). Selection state in URL.
- **Feature 2 — VS Code answer bank**: /answers rebuilt as folder/file tree by theme. New AnswerFileNode shows confidence dot, preview, last-updated, word count. Detail pane shows captured-on / updated-on dates + answer ID provenance footer.
- **Feature 3 — Dash command center**: /dash now opens with the AQUAscore hero (composite + pillar bars + tier label + breakdown link), Active Challenges derived from nextTierDelta + gap signals, Rewards Unlocked chips from user_achievements, deadlines/in-progress sections preserved.
- **Feature 4 — Workspace into Applications tabs**: /applications now has Discover / My Applications / Funders top-level tabs via ?tab= and ?view= params. My Applications lists user_applications with status, deadline, fit.
- **Feature 5 — Funders as filter**: standalone /funders index lifted into FundersDirectory component, rendered under /applications?view=funders. Detail page /funders/[slug] retained.
- **Feature 6 — Archive as Questions tab**: /questions now has My Questions / Full Archive tabs via ?view=. Archive page logic lifted into QuestionsArchiveView component; standalone /archive/questions removed (redirect handles incoming links).
- **Feature 7 — Onboarding Gate** (migration 040 applied): hard /onboarding gate before any (app) route opens. Two paths — Starter (≥5 of 8 high-significance archive questions) or Upload (paste in-progress application). Saves to profile_answers / applicant_context, sets active_identity via light heuristic, flips onboarding_completed_at. Legacy users grandfathered via backfill.
- **Feature 8 — Persona Profile + AQUAscore**: new lib/aquascore.ts (additive 3-pillar composite + nextTierDelta + tier classification). /profile/persona page shows headline AQUAscore with tier, pillar breakdown bars, three-layer status cards (Answer Bank → Persona Profile → Recruiter Surface), theme strengths radar (reuses DnaRadarChart), and boost-layer slots for GitHub / LinkedIn / FMS / FundScore (additive only, never subtractive).
- **Brand IS the scoring system**: AQUAscore composition maps directly to the three pillars. Applications + Questions + Answers → composite, weighted by active_identity (future). MoatScore = AQUAscore + optional boost layers (FMS + FundScore + Portfolio); V1 ships MoatScore == AQUAscore until FMS/FundScore wire up.

### Shipped 2026-05-12 (this session)

- **Applicant modes (PR #2 closed)**: migration 030 applied, 3 reviewer findings resolved, CHANGES_REQUESTED review dismissed, handoff doc updated. Mode selector, RFC badges, contribution rewards, `isModeDeeplyCurated()` as single source of truth.
- **Credits & achievements system**: migration 032. `credit_events` append-only ledger, `user_achievements`, `user_credit_balance` view. Sidebar balance badge (§Xd), Supabase Realtime earn toast, redemption stub, personalized OG share card at `/profile/credits`.
- **OG image** `/api/og`: MO§ES™ branded edge route, personalized `?stat=` + `?name=` params, wired into layout metadata.
- **Supabase CLI linked**: all 35 migrations in `supabase/migrations/`, duplicate prefixes resolved (034/035), `db push --dry-run` clean, migration lint CI job blocks duplicate prefixes.
- **Archive page rebuilt**: `/archive/questions` — lock/unlock state per user, Universal tab, theme tabs (All · Universal · Team · Traction · Problem · Solution · Market · Vision · Technical · Business · Fundraising · Personal · Fit · Impact), prominent Answer button for unlocked questions, "Unlocks via daily drip" hint for locked.
- **Landing page archive**: replaced static single-question teaser with live top-12 questions fetched from DB on every render.
- **Stress test white text fixed**: `warning` Tailwind palette was missing 400/700/800 stops — Risk banner text was invisible. Full amber spectrum added.
- **Type-check at 0 errors**: `database.types.ts` regenerated from live schema, `composite_score` → `fit_score` (column never existed), `QuestionTheme` widened, null guards added across 6 files.
- **FundingCake documented**: `docs/28_fundingcake_shells.md` — 812 programs, real funded entities, gap is `apply_url` not captured. Fill path documented.
- **Ingest lane VC policy clarified**: `docs/21_curated_ingest_lane.md` — VCs with structured application intake are included, pure deal flow is excluded.

### SMTP / Email
- Resend SMTP is wired to Supabase Auth and confirmed working.
- Magic-link emails are delivered via Resend.
- Supabase Auth custom SMTP setup is documented at `docs/08_resend_smtp_setup.md`.

### MCP server
- `application-hub-mcp-server/` exists.
- TypeScript MCP server is present.
- Server registers:
  - 21 tools
  - 7 resources
  - 3 prompts
- Supports two transports:
  - `stdio` for Claude Desktop / Cursor / Windsurf
  - `http` for remote deployment
- Build script exists: `npm run build`.
- Typecheck script exists: `npm run typecheck`.
- Strict TypeScript config exists.
- Plugin-eval score: **100/100 Grade A, Risk Low** (0 fail, 0 warn, 2 info).
  - Plugin metadata restructured into `application-hub-mcp-server/application-hub-mcp-server/` (thin subdir) — deferred budget 0 tokens.
  - 3 `.logic.ts` modules extract pure testable logic: `hub_stress_test_answer`, `hub_find_best_programs`, `hub_get_acceptance_stats`.
  - Test suite: 69 tests, all passing. `vitest` installed.
  - Codex plugin manifest at `application-hub-mcp-server/.codex-plugin/plugin.json` — see session notes at `~/Desktop/mcp_eval/plugin-eval-session-summary.md`.
- New app-support tools are present:
  - `hub_get_program_by_slug`
  - `hub_save_answer`
  - `hub_get_answer_review_context`
  - `hub_save_answer_review`
  - `hub_stress_test_answer`
- The stress-test MCP bridge is implemented and registered. The web UI (`StressTestPanel`) is now live in the app.
- Agent review output now has a persisted write-back path through `answer_reviews` plus MCP tool `hub_save_answer_review`.
- Reviewer agent family now includes:
  - `.claude/agents/rns-answer-reviewer.md`
  - `.claude/agents/program-fit-reviewer.md`
  - `.claude/agents/fidelity-certifier.md`
  - `.claude/agents/stress-test-conductor.md`

### Next.js app
- `app/` exists as a Next.js App Router application.
- Package and lockfile are present.
- Current app surfaces include:
  - Hub directory
  - Question Bank route
  - Program detail route
  - Workspace route
  - Profile split routes (`/profile/about`, `/profile/answers`, `/profile/settings`, `/profile/integrations`)
  - Home dashboard (`/today`)
  - Supabase auth callback/login scaffolding
- Magic-link redirects now land at real path `/auth/callback`; Cowork moved the callback route out of the `(auth)` route group during live smoke testing.
- Live Supabase data wiring is present and build-verified.
- Hosted AI drafting is wired through `POST /api/draft`; successful drafts are logged to `ai_draft_runs` so the database trigger updates `ai_usage`.
- BYOK integrations are implemented through `/profile/integrations` plus `/api/integrations`.
- `/api/draft` now routes BYOK-first and returns a provider-required error when no user key is available and platform drafting is disabled.
- Draft UX now links founders directly to `/profile/integrations` when no provider is connected, and confirms when drafting used the founder's own Anthropic key.
- Deeper review/comments are intentionally reserved for agent-side RNS/MCP workflows until the contract is hardened.
- Review context is readable through MCP today, and agent-side review results can now be persisted through `answer_reviews` using `hub_save_answer_review`.
- RNS-integrated build-path documentation is present at `docs/06_rns_integrated_build_path.md`.
- Launch-surface polish notes are documented at `docs/14_launch_surface_polish.md`.
- The active launch roadmap is `ROADMAP.md`; older duplicate planning docs have been moved to `docs/archive/`.

### CI
- GitHub Actions workflow exists at `.github/workflows/ci.yml`.
- CI runs three jobs in order:
  1. `agent-check` — runs `python3 .agents/check.py --strict`; blocks the other two jobs on any registry drift or collision.
  2. `mcp-server` — install, typecheck, build.
  3. `next-app` — install, typecheck, build.
- CI is **green** as of commit `494a60e` (2026-05-11).
  - `app/app/sitemap.ts` — added `export const dynamic = 'force-dynamic'` so `/sitemap.xml` renders per-request instead of at build time. Fixes Supabase-client-missing-env error during static prerender.
- Pre-commit hook installed in strict mode via `.agents/install-hook.sh --strict`.

### Environment documentation
- `application-hub-mcp-server/.env.example` exists.
- Required variables are documented:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ANON_KEY`
  - `TRANSPORT`
  - `PORT`
- Supabase Auth custom SMTP setup is documented at `docs/08_resend_smtp_setup.md`.
- Milestone 3 launch checks are documented at `docs/09_launch_checklist.md`.
- BYOK and hosted draft policy are documented at `docs/10_byok_and_draft_policy.md`.
- Deadline update handoff is documented at `docs/11_deadline_seed_handoff.md`; SQL helper lives at `seed/01_deadline_updates_template.sql`.
- Stress-test persistence is documented at `docs/12_stress_test_persistence.md`.
- SMTP launch handoff is documented at `docs/13_smtp_launch_handoff.md`.
- Resend SMTP credentials are dashboard secrets, not frontend environment variables.

---

## Current product status

The repo has the MVP spine plus most of Milestone 3. Remaining gaps:

| Item | Status |
|---|---|
| App live at vercel | Done |
| Resend SMTP wired and confirmed | Done |
| Auth (magic link + password escape hatch) | Done on live site |
| Smoke test | Done 2026-05-10 |
| Question Bank `/bank` route UI | Done |
| Drip mechanic | Done |
| BYOK `/profile/integrations` UI | Done |
| Workspace index (`user_applications` query) | Done |
| Profile split | Done |
| Sidebar IA redesign | Done |
| Heat scores + applicant counts | Launch-surface fallback labels landed; deeper synthetic compute job still needed |
| Live BYOK draft verification | Done — confirmed live |
| Copy actions in bank/workspace | Done |
| OTP code-entry login path | Done |
| Cohort context in workspace/detail | Done |
| Home dashboard (`/today`) | Done |
| Stress-test UI (`StressTestPanel`) | Done |
| DNA radar chart on program detail | Done |
| Significance stars display | Done |
| Workspace opportunity ranking | Done |
| Recruiter agent (weekly email + dedup) | Done — edge function deployed 2026-05-12 |
| Question archive `/archive/questions` | Done — theme tabs, Universal tab, lock/unlock state per user, prominent Answer CTA, sort by significance or popularity |
| Funders index `/funders` | Done — grid with type filter |
| Funder profile `/funders/[slug]` | Done — program list, breadcrumb, website link |
| `database.types.ts` | Done — regenerated from live schema (migrations 001–041) |
| CI agents-check | Done — flipped to `--strict` mode 2026-05-12 |
| Question embeddings (768d, nomic-embed-text) | Done — all 225 questions seeded via Ollama |

---

## Not currently confirmed in GitHub

These may exist locally, but are not confirmed by the current GitHub-visible repository state:

- Root `package.json`
- Stripe webhook implementation
- Browser smoke testing beyond 2026-05-10 session

---

## Current remote truth

The GitHub-visible repo should be treated as:

```text
Database schema + seed data + MCP server are present.
Next.js app is present, wired to live data, build-verified, and deployed.
Auth is confirmed working on the live site.
SMTP is confirmed working via Resend.
CI covers MCP and app packages separately.
RNS is the planned additive judgment layer, not a launch blocker.
```

---

## Immediate priorities (launch roadmap)

P1 sprint is complete as of 2026-05-11 (second session). Moving to P2:

1. **Live BYOK draft verification** — save a real provider key, draft from workspace, confirm live end-to-end success
2. **Heat scores + applicant counts** — synthetic compute job still needed; launch-surface fallbacks landed, but deeper computed signal is still open
3. **Seed real deadlines + urgency sort**
4. **MoatScore / FundScore** — placeholder cards are in the Today dashboard; signal computation still open
5. **Plugin-eval observed benchmark baseline** — static analysis is installed; observed-usage benchmarking still needs setup
6. **Recruiter agent activation** — migration 027 applied, edge function deployed; Deric needs to add `CRON_SECRET` to edge function env and activate the schedule

## What landed 2026-05-11 (P1 sprint, second session)

- `app/app/(app)/today/page.tsx` — Home dashboard at `/today`: greeting, 4 stat cards, in-progress apps, deadline alerts, question bank nudge, top program matches, pro upsell
- `app/components/DnaRadarChart.tsx` — Pure SVG radar chart for `program_dna` themes; renders when 4+ themes have weight
- `app/components/SignificanceStars.tsx` — Shared 0-1 score to 1-5 stars component; replaces 3 inline implementations
- `app/components/StressTestPanel.tsx` — Stress-test UI: depth selector, calls `/api/stress-test`, shows follow-up cards
- `app/app/api/stress-test/route.ts` — Deterministic stress-test POST route; fetches question + DNA, returns themed follow-ups
- `app/app/api/cron/recruiter/route.ts` — Recruiter email cron route, CRON_SECRET auth, dedup via `recruiter_alerts`
- `supabase/functions/recruiter-agent/index.ts` — Deno edge function trigger for recruiter agent (Monday 9am UTC)
- `migrations/027_recruiter_alerts.sql` — Dedup table + RLS for recruiter agent
- `app/data/stress_test_follow_ups.json` — Theme-specific follow-up templates used by `/api/stress-test`
- `app/components/Sidebar.tsx` — "Today" added as first nav item; logo and mobile links updated to `/today`
- `app/components/AnswerEditor.tsx` — `StressTestPanel` wired into view + editing mode when answer has content
- `app/app/(app)/hub/[slug]/page.tsx` — `DnaRadarChart` added to DNA card; `SignificanceStars` replaces inline SVG loop
- `app/app/(app)/bank/page.tsx` — Uses shared `SignificanceStars`
- `app/app/(app)/workspace/page.tsx` — Rewritten with opportunity ranking (`opportunityScore()`), `OppScoreBadge`, ranked active apps, best-unopened section
- `app/app/(app)/workspace/[program_id]/page.tsx` — `SignificanceStars` replaces text badge on question rows
- `docs/22_recruiter_agent.md` — Deployment and operations guide for the recruiter agent

## What landed during the 2026-05-10 hardening burst

- `migrations/009_fix_auth_trigger_search_path.sql` — fixed Supabase auth signup
- `app/app/auth/callback/route.ts` — moved out of `(auth)` route group
- `app/components/ThemeBar.tsx` — fixed DNA % display (was showing 2290%)
- `app/components/Sidebar.tsx` — fixed active-state matching for child routes
- `app/app/(auth)/login/page.tsx` — added dev-only password sign-in escape hatch
- `app/app/(app)/layout.tsx` — reverted experimental dynamic export (cookies trigger dynamic on their own)
- `app/package.json` — bumped Next.js 14.2.0 → 14.2.35 (CVE chain + dev-mode regressions)
- `app/app/api/draft/route.ts` — hosted draft metering through `ai_draft_runs`
- `app/app/api/draft/route.ts` — BYOK-first routing and provider-required failure path
- `migrations/012_launch_hardening.sql` — BYOK metadata + stress-test persistence
- `migrations/014_question_bank_drip.sql` — Question Bank unlocks + daily drip
- `migrations/015_byok_key_storage.sql` — encrypted BYOK key storage column
- `seed/01_deadline_updates_template.sql` — source-verified deadline update helper
- `docs/09_launch_checklist.md` through `docs/13_smtp_launch_handoff.md` — Milestone 3 handoff docs
- `docs/21_curated_ingest_lane.md` — narrow curation contract for application/funding/question targets
- `docs/MIGRATIONS.md` — policy for the logical 001–037 chain and duplicate numeric prefixes
- `docs/16_mcp_agent_plugin_gap_review.md` — current MCP/agent/plugin gap review, installed tooling, and next implementation plan
- `migrations/026_answer_reviews.sql` — append-only persisted review output for agent workflows
- `application-hub-mcp-server/src/tools/user/hub_save_answer_review.ts` — authenticated MCP write-back tool for answer reviews
- `.claude/agents/rns-answer-reviewer.md` — general saved-answer review and persistence
- `.claude/agents/program-fit-reviewer.md` — program-specific fit review and persisted scoring
- `.claude/agents/fidelity-certifier.md` — answer fidelity/certification review
- `.claude/agents/stress-test-conductor.md` — deterministic stress-test orchestration and persistence
- `.claude/commands/review-answer.md`, `.claude/commands/review-answer-fit.md`, `.claude/commands/certify-answer.md`, `.claude/commands/stress-test-answer.md` — command entrypoints for the reviewer family
- `VISION.md` — new product vision doc
- `TASKS.md` — captured 16 follow-ups from smoke test
- `ROADMAP.md` — reframed around Launch Milestones 1/2/3
- `docs/archive/` — created for superseded planning docs
- `seed/staging/application_targets_watchlist.csv` — staging lane for candidate targets before seed promotion
- `app/.env.local` (worktree + main) — populated with Supabase URL + publishable key
