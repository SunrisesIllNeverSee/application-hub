# Application Hub — Status

_Last updated: 2026-05-10_

This file is the current GitHub-visible source of truth. It separates what is confirmed in this repository from what may exist locally but has not yet been uploaded.

---

## Confirmed in GitHub

### Repository
- Public GitHub repository: `SunrisesIllNeverSee/application-hub`
- Default branch: `main`
- Root project documentation is present.
- Root `.gitignore` is present and excludes dependency folders, build output, `.next`, local env files, and editor artifacts.

### Deployment
- App is deployed live at `https://application-hub-chi.vercel.app`
- Auth (magic link + password escape hatch) confirmed working on live site.
- Smoke test completed 2026-05-10. All core routes load against live Supabase.

### Database
- Supabase migration directory exists.
- Migrations `001` through `015` are the canonical migration chain.
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
- Migrations through `015` are now the expected app chain.
- The current strategy is to keep migrations `001` through `015` and layer RNS-backed intelligence above the existing scoring fields rather than rolling back to a minimal schema.

### SMTP / Email
- Resend SMTP is wired to Supabase Auth and confirmed working.
- Magic-link emails are delivered via Resend.
- Supabase Auth custom SMTP setup is documented at `docs/08_resend_smtp_setup.md`.

### MCP server
- `application-hub-mcp-server/` exists.
- TypeScript MCP server is present.
- Server registers:
  - 20 tools
  - 7 resources
  - 3 prompts
- Supports two transports:
  - `stdio` for Claude Desktop / Cursor / Windsurf
  - `http` for remote deployment
- Build script exists: `npm run build`.
- Typecheck script exists: `npm run typecheck`.
- Strict TypeScript config exists.
- New app-support tools are present:
  - `hub_get_program_by_slug`
  - `hub_save_answer`
  - `hub_get_answer_review_context`
  - `hub_stress_test_answer`

### Next.js app
- `app/` exists as a Next.js App Router application.
- Package and lockfile are present.
- Current app surfaces include:
  - Hub directory
  - Question Bank route
  - Program detail route
  - Workspace route
  - Profile split routes (`/profile/about`, `/profile/answers`, `/profile/settings`, `/profile/integrations`)
  - Supabase auth callback/login scaffolding
- Magic-link redirects now land at real path `/auth/callback`; Cowork moved the callback route out of the `(auth)` route group during live smoke testing.
- Live Supabase data wiring is present and build-verified.
- Hosted AI drafting is wired through `POST /api/draft`; successful drafts are logged to `ai_draft_runs` so the database trigger updates `ai_usage`.
- BYOK integrations are implemented through `/profile/integrations` plus `/api/integrations`.
- `/api/draft` now routes BYOK-first and returns a provider-required error when no user key is available and platform drafting is disabled.
- Deeper review/comments are intentionally reserved for agent-side RNS/MCP workflows until the contract is hardened.
- RNS-integrated build-path documentation is present at `docs/06_rns_integrated_build_path.md`.
- The active launch roadmap is `ROADMAP.md`; older duplicate planning docs have been moved to `docs/archive/`.

### CI
- GitHub Actions workflow exists at `.github/workflows/ci.yml`.
- CI has separate jobs for:
  - MCP server install, typecheck, build
  - Next.js app install, typecheck, build

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
| Heat scores + applicant counts | Still 0 — synthetic compute job needed |
| Live BYOK draft verification | Still needs final end-to-end validation |

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

1. **Live BYOK draft verification** — save a real provider key, draft from workspace, confirm live end-to-end success
2. **Heat scores + applicant counts** — synthetic compute job needed; currently 0 across all programs
3. **Copy button on answer boxes** — workspace and bank UX polish
4. **OTP 6-digit login path** — support code-entry flow in addition to magic link click
5. **Seed real deadlines + urgency sort**
6. **Program detail TL;DR / pros & cons block**
7. **Cohort context polish** — ensure workspace/header consistently shows cohort metadata
8. **Stripe integration** — Phase 3

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
- `VISION.md` — new product vision doc
- `TASKS.md` — captured 16 follow-ups from smoke test
- `ROADMAP.md` — reframed around Launch Milestones 1/2/3
- `docs/archive/` — created for superseded planning docs
- `app/.env.local` (worktree + main) — populated with Supabase URL + publishable key
