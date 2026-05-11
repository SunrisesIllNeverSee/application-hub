# Scratch — active work in progress

> **Both agents check this BEFORE picking up a task from `TASKS.md`.**
> Claim by appending your line. Release by removing it (or moving to "recently released").
> Stale claims = no commits touching the claimed paths since the claim landed.
> See also: `~/Desktop/MULTI_CLAUDE.md` for cross-workspace coordination.
> `SCRATCH.md` is for repo-local active claims only. It is not the main status doc; factual current-state truth lives in `STATUS.md`.

---

## Current state (2026-05-11)

P1 sprint complete. Migrations 001-027 applied to Supabase. Build is clean. Site live at mos2es.xyz.

### What's actually deployed

- Hub (842 programs), Question Bank + drip, BYOK, draft routing, import flows
- Stripe skeleton (code done — Deric needs to add price IDs to Vercel)
- Dark mode, outcome tracking, funders schema (026 applied), deadline alerts (cron live)
- Team mode (schema + API — no UI beyond settings tab)
- Answer review persistence + stress-test persistence
- Reviewer family: `.claude/agents/rns-answer-reviewer.md`, `program-fit-reviewer`, `fidelity-certifier`, `stress-test-conductor`
- **NEW (2026-05-11 second session)**: Home dashboard `/today`, StressTestPanel, DnaRadarChart, SignificanceStars, workspace opportunity ranking, recruiter agent (migrations/027 + /api/cron/recruiter + edge function)

### Remaining open work

- Funders index UI `/funders` (Cowork)
- Stripe activation (Deric: add price IDs to Vercel env vars)
- CRON_SECRET to Supabase edge function env vars (Deric: manual — recruiter agent step 2)
- Recruiter agent schedule activation (Deric: Supabase dashboard → Edge Functions → recruiter-agent → Schedule → `0 9 * * 1`)
- MoatScore / FundScore signal (P2)
- Internal applicant ranking (P2)
- Plugin sibling layout restructure — defer until after repo clean-out (see `~/Desktop/mcp_eval/plugin-eval-session-summary.md`)
- ~~MCP token-budget / plugin-eval~~ ✅ 100/100 Grade A, 69 tests, CI green

---

## For Codex — most recent context

Updated 2026-05-11 — plugin-eval complete, CI green.

Read in order:
1. `~/Desktop/MULTI_CLAUDE.md` — cross-workspace state, what's live, what's next
2. `STATUS.md` — confirmed repo state
3. `TASKS.md` — concrete remaining items
4. `~/Desktop/mcp_eval/plugin-eval-session-summary.md` — full plugin-eval session notes

### Your open lane
- **Reviewer-family follow-through** — run the fit/certification/stress-test agents on real saved answers and tighten the rubric.
- **MCP server rebuild** — 21 tools now, rebuild dist before any power users connect.
- ~~MCP token budget~~ — Done. Plugin-eval 100/100. Sibling layout deferred to post-clean-out.

### What Cowork (Claude) landed today
- Migrations 013-026 all applied
- Multi-provider draft (Anthropic/OpenAI/Ollama), dark mode, outcome tracking
- Funders schema (30 orgs), deadline alerts (edge fn + pg_cron), team mode
- Portable taxonomy (domain + universal_theme), application import UI
- MULTI_CLAUDE.md created at ~/Desktop/

---

## Currently claimed

| Agent | Task | Files / paths | Claimed at | Notes |
|---|---|---|---|---|

---

## Recently released

| Cowork | Home dashboard, StressTestPanel, DnaRadarChart, SignificanceStars, workspace opportunity ranking, recruiter agent | `app/app/(app)/today/page.tsx`, `app/components/DnaRadarChart.tsx`, `app/components/SignificanceStars.tsx`, `app/components/StressTestPanel.tsx`, `app/app/api/stress-test/route.ts`, `app/app/api/cron/recruiter/route.ts`, `supabase/functions/recruiter-agent/index.ts`, `migrations/027_recruiter_alerts.sql`, `docs/22_recruiter_agent.md` | Released 2026-05-11 (second session) | P1 sprint complete |
| Cowork | Migration 026 applied, MULTI_CLAUDE.md created, SCRATCH.md synced | `SCRATCH.md`, `MULTI_CLAUDE.md` | 2026-05-11 | Full cross-agent sync after major feature burst |
| Codex | Answer review persistence + reviewer family + stress-test persistence + repo cleanup pass | `migrations/026_answer_reviews.sql`, `.claude/agents/`, `.claude/commands/`, `application-hub-mcp-server/src/tools/user/hub_stress_test_answer.ts`, `docs/07_agent_review_contract.md`, `docs/12_stress_test_persistence.md`, `docs/16_mcp_agent_plugin_gap_review.md`, `README.md`, `docs/MIGRATIONS.md` | Released 2026-05-11 | |
| Cowork | Dark mode, outcome tracking, funders, deadline alerts, team mode | `app/components/ThemeProvider.tsx`, `app/components/OutcomeTracker.tsx`, `migrations/023-025`, `supabase/functions/deadline-alerts/` | Released 2026-05-11 | |

---

## How to use this file

### When you start a task
Append a row to "Currently claimed". Commit SCRATCH.md BEFORE starting work.

If the task includes a new migration:
- claim the next migration number here before writing the SQL file
- this is the lightweight guardrail against duplicate numeric prefixes from parallel sessions

### When you finish
Remove your row, move to "Recently released", commit with the work.

### Stale claims
No commits touching claimed paths since claim landed + other agent needs those paths = stale. Take it, leave a one-line note.
