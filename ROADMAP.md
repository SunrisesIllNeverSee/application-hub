# Application Hub — Roadmap

> **We are nonlinear and temporal.** This project doesn't run on weeks or sprints.
> Work happens when Deric is engaged. The roadmap is priority-ordered, not time-ordered.
> No deadlines, no calendars, no "by next month." Just **what's next** when someone shows up.

> **For Cowork (Claude) and Codex**: this is the canonical roadmap. Read at session start.
> When you complete an item, mark it `[x]` and link the commit. When priorities shift, edit it.
> `TASKS.md` has finer-grained items. `VISION.md` has the why. This file is the **what and in what order**.

---

## Where the project stands

### What's solid (done, working, in production-ready shape)

- **Schema**: Migrations 001–009 applied to Supabase. Auth trigger gotcha fixed.
- **Seed**: 30 programs, 225 questions. Significance scores + DNA weights computed.
- **Intelligence layer**: live — `program_dna`, `user_program_fit`, fit scoring, significance scoring.
- **MCP server**: 19 tools, 7 resources, 3 prompts. Including `hub_get_universal_questions`, `hub_get_answer_review_context`, `hub_save_answer`.
- **Next.js app**: Phase 2 complete. Builds clean on 14.2.35. All public routes wired to live Supabase.
- **Auth**: magic link (works) + dev-only password sign-in (escape hatch).
- **CI**: MCP + app jobs in `.github/workflows/ci.yml`.
- **Smoke tested**: Hub, program detail, workspace, profile all render against live data.

### What's known broken or missing

- **Question Bank UI** — concept is foundational (see `docs/04_question_intelligence.md`), MCP tool exists, schema ready, only the Next.js surface is missing.
- **Responsive layout** — sidebar doesn't collapse on mobile; main padding doesn't scale; program detail squeezes at tablet width. Specific fixes scoped (see `TASKS.md`).
- **Real deadlines** — every program shows "Rolling" because seed lacks dates.
- **Program detail page** — long blob description, no TL;DR / pros / cons / "best for X founder" block.
- **User profile** — `/profile` is the Answer Bank; no actual profile page (company, stage, bio, social).
- **Email reliability** — Supabase free-tier rate-limited; needs custom SMTP (Resend/SendGrid).
- **AI draft rate limiting** — `/api/draft` has no enforcement against `ai_usage` / `subscription_plans.ai_drafts_per_month`. Real launch blocker.

---

## P0 — the retention engine

These are the things that change the product's trajectory, not just polish it.

- [ ] **Answer Bank drip mechanic** — *Cowork*  
  Pre-load 5–10 universal questions on signup matched to user profile. Drip 2–5/day on free login. Pro tier unlocks all 225+ immediately. New table `user_question_unlocks`. See `VISION.md` for full reasoning. **This is the daily-engagement loop the platform doesn't have today.**

- [ ] **Question Bank UI surface** — *Cowork*  
  `/bank` route. Combines with the Drip mechanic. Shows unlocked questions ready to answer + locked previews + countdown to next unlock. Calls existing MCP tool `hub_get_universal_questions`. Becomes the natural daily landing page. **Backend already exists; only the Next.js page is missing.**

- [ ] **Rate-limit `/api/draft` properly** — *Cowork or Codex*  
  Insert into `ai_draft_runs` after each successful Anthropic call. The existing trigger `track_ai_usage_on_draft` will then enforce monthly limits per `subscription_plans.ai_drafts_per_month`. Without this, every draft costs Anthropic spend with no ceiling.

---

## P1 — visible polish that makes it feel done

Bug fixes and feature gaps that, once fixed, raise the launch-readiness perception by a level.

- [ ] **Fix responsive layout** — *Cowork*  
  Three specific fixes from background-agent investigation:  
  1. `app/components/Sidebar.tsx:91` — `hidden md:flex` + mobile drawer toggle  
  2. `app/app/(app)/layout.tsx:23` — `px-4 md:px-6 py-4 md:py-8` + `min-w-0` on `<main>`  
  3. `app/app/(app)/hub/[slug]/page.tsx:152` — tablet squeeze fix

- [ ] **Seed real deadlines + sort by urgency** — *Cowork*  
  Today every program shows "Rolling" because seed lacks dates. Real deadlines on YC, Techstars, SBIR cycles, etc. Default sort: closest non-rolling deadline first, then composite_score within Rolling.

- [ ] **Program detail TL;DR / pros / cons / "best for X founder" block** — *Cowork*  
  Either static seed columns (`tldr`, `pros[]`, `cons[]`, `best_for_founder_type`), or AI-generated on first view. Static ships faster, AI is more unique.

- [ ] **Build proper user profile page** — *Cowork*  
  Split `/profile` into `/profile/answers` (current Answer Bank) + `/profile/about` (real profile: company, stage, bio, industry tags, social) + `/profile/settings` (account, billing, integrations). Unblocks: better fit scores, smarter drip, Founder Ranking, Application Hub Fund eligibility.

- [ ] **Set up custom SMTP (Resend)** — *Codex*  
  Supabase Authentication → Emails → "Set up custom SMTP." Resend is the path of least resistance — 3,000 emails/month free, zero-config integration. Unblocks reliable magic-link auth + future transactional emails.

- [ ] **Smoke-test `POST /api/draft` end-to-end** — *Cowork*  
  Deferred until user has an Anthropic key. Verify the AnswerEditor "Draft with AI" button → `/api/draft` → Anthropic → response → text inserted flow.

---

## P2 — once the launch surface is clean

- [ ] **Three-layer schema: Funders / Programs / Applications** — *Cowork*  
  YC runs W26 and S26 separately. Techstars runs Boulder, Seattle, NYC. New `funders` table, `programs.funder_id` FK. New `/funders` index. Foundation for funder-side product.

- [ ] **Collapsible sidebar** — *Cowork*  
  Chevron toggle, collapses to icon-only ~56px width, persist in localStorage.

- [ ] **Workspace discoverability** — *Cowork*  
  Sidebar shows "My Applications" but docs/code use "Workspace." Pick one term and align everywhere.

- [ ] **Heat scores + applicant counts** — *Cowork (data) + Codex (compute)*  
  Every program currently shows "0 heat" / "0 applicants." Real heat: scrape acceptance rates, social mentions, portfolio company GitHub stars. Real applicants: program partnerships or own telemetry. MVP: synthetic heat from prestige + cohort exclusivity.

- [ ] **Stripe integration** — *Cowork (UI) + Codex (webhook)*  
  Free / Pro ($19/mo) / Team ($49/mo). Webhook handler updates `user_subscriptions`. Gates: unlimited AI, export, heat scores, acceptance rates behind Pro.

- [ ] **Information architecture review** — *Cowork (design)*  
  Timeline as separate sidebar tab vs. view mode within Hub. Defer until after Drip mechanic ships and reshapes the daily flow.

---

## P3 — premium features and platform layer

- [ ] **"Golden Opportunities" premium rail** — *Cowork (design) + Codex (data)*  
  Combines days-until-deadline (urgency), applicant count (low competition), DNA-fit (high match), recency. Pro-only rail at top of `/hub`.

- [ ] **Significance score display** — *Cowork*  
  Star rating (1–5) on each question. Sort questions by significance within each section. "Asked by N programs" tooltip.

- [ ] **DNA radar chart on program detail** — *Cowork*  
  Compare user's profile coverage against program DNA visually.

- [ ] **TypeScript types regeneration** — *Cowork*  
  `npx supabase gen types typescript --project-id betcyfbzsgusaghriptz > app/lib/database.types.ts` after schema settles further.

- [ ] **Outcome tracking** — *Cowork*  
  User logs "got in" / "rejected" / "waitlisted." Closes feedback loop on fit scores and DNA calibration.

- [ ] **Deadline alerts** — *Cowork (UI) + Codex (cron)*  
  30d / 7d / 24h warnings per program when readiness > 60%. Email via Supabase Edge Function + Resend.

- [ ] **Recruiter agent** — *Codex*  
  Scheduled job scans new programs against user profile. Alerts on high-fit matches.

---

## Vision tier — the platform plays (see VISION.md for full detail)

- [ ] **Question Databank as a service**  
  Already partially built (MCP server). Founders connect their own Claude/Cursor/Windsurf, query the question archive programmatically. Power-user flow. *(A) MCP/API endpoint or (B) embeddable widget for partner sites — both worth pursuing.*

- [ ] **Application Hub Fund**  
  Platform-as-backer. Direct micro-grants, revenue-share fund (1–3% capped), acceptance bonuses, community fund. Inverts every other founder tool's incentive: we make money only when founders succeed.

- [ ] **Founder Ranking / credit-score**  
  Multi-weighted score that travels with founders across programs. Public leaderboard ("Top 100 funding seekers this month"). Programs use it for proactive outreach.

- [ ] **Host applications directly**  
  Become the canonical submission portal for partner programs. We own the application data. Massive structural advantage.

- [ ] **Application ranking + feedback**  
  "Your application ranks 10,000 of 15,000." Premium: detailed feedback on what's missing. Premium: "If you raise your Traction score 20%, your rank improves to 6,500."

- [ ] **Live application updates**  
  Allow updates post-submit (programs that opt in). Pull GitHub stars, MRR, customer counts automatically.

- [ ] **Application automation**  
  Auto-fill from bank. Auto-submit to qualified programs (Pro feature, with caps on free).

- [ ] **Outcome tracking + cohort intelligence**  
  Public-good dataset for the founder community. "Founders with traction scores >80 got into YC at 3× the rate."

- [ ] **Public API**  
  Open the program + question dataset to partners. Tiered API access. Becomes the canonical "application graph."

---

## Working principles

- **Schema-first**: every feature ask becomes a column or table before it becomes UI.
- **MCP-first**: every data access pattern becomes an MCP tool before it becomes a Next.js route. Power users live in their own agent.
- **Free tier builds value daily**: a founder using only the free tier should still have something growing in their bank every day they show up.
- **Two-agent collaboration**: Cowork drives user-facing surface; Codex drives infrastructure/governance/specs. Coordinate via `SCRATCH.md` (active claims) + `AGENTS.md` (file ownership).
- **Document before you build, build before you optimize.** Every P0/P1 item should have a paragraph in `TASKS.md` describing the why before code lands.
- **Nonlinear and temporal**: no calendar deadlines. Work happens when there's energy for it.

---

## How this doc gets maintained

- **When a P0 or P1 ships**: change `[ ]` to `[x]`, add commit SHA reference.
- **When something new comes up**: add it to the right priority bucket (P0–P3 or Vision).
- **When a priority shifts**: move the item between buckets.
- **When something gets fully done and isn't relevant to ongoing work**: archive into a "Done" section at the bottom or remove.
- **Keep this file under ~300 lines**: prune as you go. `TASKS.md` is for granular detail; this file is for direction.
