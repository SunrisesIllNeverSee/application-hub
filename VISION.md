# Application Hub — Product Vision

> A living document. The product is built schema-first; vision lives downstream of that asset.
> Every aspiration here translates eventually to a database column, a UI surface, or a paywall.

---

## North star

**The smartest founder in the world has filled out 1,000 applications. Most founders fill out their first.**

Application Hub closes that gap by treating every application question as data — archived, scored, reusable — so a single thoughtful answer becomes the founder's permanent asset, not a one-time effort that disappears into a Google Doc.

---

## The Answer Bank as a Living Asset

The core retention mechanic, not an afterthought.

### Drip-fed onboarding (the killer feature)

Today: user logs in → sees an empty Answer Bank → has no idea what to do.

Tomorrow:

- **Day 1 sign-up**: bank is pre-loaded with 5–10 high-significance archived questions matched to their profile (industry tags, stage, founder type). They start filling out their bank immediately, no application required.
- **Free tier daily login**: 2–5 new questions appear in the bank each day they log in. Streak-style.
- **Free tier weekly cap**: maybe 20–30 total questions accessible. Bank visibly grows.
- **Pro tier ($19/mo)**: full access to all 225+ archived questions immediately. No drip cap.
- **Team tier ($49/mo)**: shared bank across co-founders with diff/merge.

**Why this works**:
- Solves cold-start problem (empty Answer Bank → no value)
- Builds daily habit (log in, see new questions, answer 1–2)
- Visible asset growth (count goes up, makes the user feel they're banking something real)
- Pro upgrade has a clear hook ("unlock all 225 questions instead of waiting weeks")

### Premium answer-bank features

- **AI-augmented drafting** (already built behind `/api/draft`): unlimited on Pro, 10/mo on Free
- **Answer history with diff view** (already built): see how an answer evolved
- **Export bank as PDF / Notion / Markdown**: for offline use, board prep
- **Cross-application reuse score**: shows the user how many programs they can pre-fill if they answer a particular question

---

## Future aspirations — captured before they evaporate

### Host applications directly

Instead of linking out to YC's typeform or Techstars's portal, Application Hub becomes the canonical submission portal for partner programs.

- Programs (funders, accelerators, grants) integrate via API
- Founders submit through Application Hub
- Programs get cleaner data, founders get one workflow
- **Massive structural advantage**: we own the application data, not the program

### Application ranking / leaderboard

Once we host applications, ranking becomes possible:

- "Your application ranks **10,000 of 15,000**" for YC W26
- Premium feature: detailed feedback on what's missing, where to be stronger
- Premium feature: "If you raise your Traction score by 20%, your rank improves to ~6,500"
- Free users see only their rank percentile, not feedback

### Live application updates

Currently most application portals lock you out after submit. We could:

- Allow updates post-submit (premium feature) — programs that opt in get living applications
- Pull GitHub stars, MRR, customer count automatically into traction sections
- Notify the user when a metric they cite has materially changed

### Application automation

- **Auto-fill from bank**: pre-populate any new application from existing answers (already designed)
- **Auto-submit to qualified programs** (Pro): user opts in, we file applications when fit score > threshold
- **Free tier limit**: 3 auto-submits per month, Pro tier unlimited
- **Approval gate**: user reviews before submission unless they explicitly trust the auto-submit

### Outcome tracking + cohort intelligence

When users log "got in" / "rejected" / "waitlisted":

- Closes the feedback loop on fit scores and DNA weights
- Surfaces patterns: "Founders with traction scores >80 got into YC at 3× the rate"
- Becomes a public-good dataset for the founder community
- Premium: "your acceptance probability for this program is X%"

### Recruiter agent

- Scheduled job scans new programs against user profile
- Alerts when a high-fit program opens
- Premium: agent applies on user's behalf when fit > threshold + user has slot remaining

### Public API

- Open the program + question dataset to partners (other founder tools, mentors, accelerators)
- Becomes the canonical schema layer for "the application graph"
- Revenue: tiered API access for high-volume consumers

### Question Bank as a first-class surface

This is **not a new concept** — it's been the foundation of the platform from day one. Documented in `docs/04_question_intelligence.md` as "the moat," planned in `docs/02_build_plan.md` Phase 4 ("answer universal questions first"), implemented as the MCP tool `hub_get_universal_questions`, and supported by the schema (`archived_questions.is_universal`, `significance_score`). The 225 archived questions are scored, the universal flag is computed, the data is ready.

**What's missing is only the user-facing UI layer.** The Drip mechanic (user idea, 2026-05-10) is the missing *delivery mechanism* for the Question Bank — converting a static "here's all 225 questions" into an active daily-engagement loop.

The Question Bank surface combines both:
- The page where users see what's unlocked + what's locked + what unlocks tomorrow
- The natural daily landing page for engaged free users (more compelling than an empty Answer Bank)
- The discovery layer for the question archive itself — searchable, filterable by theme, sortable by significance
- The onboarding flow surface (per `04_question_intelligence.md` mockup): "Answer these 5 questions and you'll be ready for 60% of open programs"

Information architecture:
- `/bank` (or `/questions`) — unlocked questions ready to answer + locked previews + drip schedule
- `/profile` (Answer Bank) — your saved answers (what we have today)
- `/hub` — programs that aggregate questions (what we have today)
- A user's daily flow: open Bank → answer 1–2 newly-unlocked questions → check Hub for any timely programs

This collapses the "show me my answers" / "show me program questions" / "show me everything" mental model into one coherent loop — and finally renders the question intelligence layer that already exists in the database and MCP server.

### Companies / Funders / Programs — three-layer schema

User feedback (2026-05-10): "i see program hub... however thats for applications... there should be a hub index of businesses, companys, ie the create of the applications."

Real observation. Today we conflate two things:
- **Funders / Companies** — Y Combinator, Techstars, NEA, Pear (the entities)
- **Programs** — YC W26, Techstars Boulder Spring 2026, NEA Venture Studio (specific application cycles)

YC runs W26 *and* S26 *and* W27 — three programs from one funder. Techstars runs separate Boulder, Seattle, NYC programs. Pear runs PearX. Right now we treat each as a separate row in `programs`.

Schema implications (future migration 010+):
- Add `funders` (or `companies`) table — name, description, type (VC, accelerator, gov, foundation), homepage, brand assets
- `programs.funder_id` foreign key
- A new `/companies` or `/funders` route — index of all funders, drill-down shows their programs
- Founders can "follow" a funder, get notified when new program cycles open
- Funders can claim their profile (premium funder feature later — they pay to feature programs, post updates)

Why this matters:
- Cleaner data model long-term
- Better SEO and discoverability ("find all YC programs" makes sense; "find all Pear VC programs" surfaces PearX even when no current cycle is open)
- Foundation for the Funder-side product (programs paying to list, post updates, see applicants in aggregate)

### Information architecture rethink

User feedback (2026-05-10): "i am not sure why the timeline is its own tab."

Fair question. Currently `/hub/timeline` is a separate sidebar entry but it's just a different sort/view of the same programs in `/hub`. Two cleaner approaches:

**(A) Timeline as a view mode within Hub**
- Single sidebar entry "Hub" or "Programs"
- Hub page has tabs at the top: `Cards | Timeline | Map (later)`
- Same data, different lens

**(B) Sidebar reorganized around founder workflow stages**
- "Discover" = current Hub (browse programs)
- "Schedule" = current Timeline (deadline-focused)
- "Apply" = current Workspace / My Applications
- "Bank" = current Profile / Answer Bank + new Question Bank merged
- "Funders" = new index of companies (per Companies/Funders/Programs above)

Option B is more opinionated and makes the workflow feel less like a tool and more like a flow. Option A is incremental. Defer decision until drip mechanic ships.

### User Profile — proper buildout

User feedback (2026-05-10): "need to build out user profile section."

Currently `/profile` is the Answer Bank. There is **no actual user profile page** — the user can't set their company name, founder bio, stage, industry tags, social links, etc.

The user's profile should be:
- The data we use to compute fit scores (industry, stage, themes-of-interest)
- The data the Drip mechanic uses to pick which questions to unlock
- The data the future Founder Ranking uses
- The thing an embeddable widget / partner site reads when the user shows up

Schema additions (future migration):
- `user_profiles` table or columns on `auth.users`-linked `users` table
- Fields: company_name, founder_bio, stage (idea/MVP/revenue/scaling), industry_tags[], geography, founded_at, team_size, notable_metrics (jsonb), social_handles (jsonb), avatar_url, public_profile_slug
- `/profile` route splits: `/profile/answers` (Answer Bank) + `/profile/about` (the actual profile) + `/profile/settings` (account, billing, integrations)

This unblocks: better fit scores, smarter drip, Founder Ranking, the Application Hub Fund (need profile data to assess grant eligibility), public founder pages.

### Question Databank as a service (interpretation TBD)

User idea: "a databank of questions that a user would plug their system into to get answer."

Two possible interpretations — both worth pursuing:

**(A) Question Archive as MCP / API endpoint** — already partially built (`application-hub-mcp-server/`). A founder using Claude Desktop, Cursor, or Windsurf can connect to our MCP server, query the question archive, and draft answers programmatically. The platform becomes infrastructure for any founder workflow, not just our own UI.
- Free MCP read access (lookup questions, see significance scores)
- Pro tier MCP write access (save answers to bank, generate drafts, log usage)
- Power users live entirely in their own agent and never visit our web UI

**(B) Embeddable widget for partner sites** — accelerator portals, founder communities, mentor platforms drop in our widget and their users get the question + draft assistant in-context. We white-label the answer bank.

Worth asking the user which one they meant; both are real products. (A) is closer to shipping (MCP server already exists).

### Application Hub Fund — direct support for founders

User idea: "open up a fund for new founders... support system... possible percentage sharing."

The platform itself becomes a financial backer. Mechanics to explore:

- **Direct micro-grants** to founders who hit certain milestones (completed answer bank, applied to N programs, got into Y Combinator, etc.) — funded by Pro/Team subscription revenue
- **Revenue-share fund**: founders opt in to take a small grant from the fund (say $500–5k) in exchange for a tiny % of future revenue (1–3%, capped). Caps and clauses founder-favorable. Fund grows from successful repays.
- **Acceptance bonus**: when a user gets into a program through our platform, the platform takes a small finder's fee from the program (if program opts in) — and rebates a portion back to the founder
- **Community fund** — paid users contribute optionally (à la Patreon), pool goes to monthly grants for high-need founders

Why this is interesting:
- Most "founder tools" extract value; this puts skin in the game
- Aligns the platform's incentives with founder outcomes — we make money only if they succeed
- Massive PR + community moat (no other application platform funds founders)
- Could partner with existing funds (Indie.vc, Backstage, Hustle Fund) for co-investment

### Founder ranking — public leaderboard of funding seekers

User idea: "users accounts will and/or can become ranked or scored with a list of top funding seekers... not just ideas... spectrum of weighted mechanics."

Distinct from application ranking (which is per-program). This is **founder-level reputation** — a "credit score" that travels with them across programs.

Weighted signals (early proposal):
- **Answer Bank completeness** (how thoroughly they've answered the archive)
- **Answer quality** (significance-weighted depth, AI-graded specificity, presence of metrics/numbers)
- **Application volume** (programs they've applied to via the platform)
- **Outcome track record** (acceptances, waitlists, post-mortem learnings)
- **Velocity** (how fast they iterate after rejection)
- **Theme strength** (DNA-style breakdown — "85th percentile in Traction, 60th in Vision")
- **Verification signals** (LinkedIn, GitHub, Twitter, domain ownership)
- **Community contribution** (mentor others, share patterns, contribute to question archive — see Community section)

Public output:
- "Top 100 funding seekers this month" rail
- Founder profile pages with score, badges, themes-of-strength
- Programs can browse the leaderboard for proactive scout-style outreach
- Premium tier: see who's ranked above you, study what they did differently

Risks to think through:
- Gaming (founders padding answers for score) — graders need to weight quality, not volume
- Demoralization (low-ranked founders give up) — show personalized improvement paths, not absolute rank, by default
- Privacy (who can see what?) — opt-in for public profiles, opt-out for anonymous use

This is the **founder credit score** play — and if we own the data, programs eventually trust our ranking more than résumés.

---

## Free vs Paid Philosophy

The pricing matrix is downstream of a principle. Naming the principle helps:

**Free tier exists to make the founder's life materially better even without paying.** A founder using only the free tier should still have:
- Their own growing answer bank (drip mechanic)
- AI drafts (10/mo — enough to draft a single full application)
- Access to all 30+ programs with full descriptions, DNA, and links
- Their own application progress tracking
- Magic-link sign-in, no credit card required

**Paid tier exists to remove friction for founders who are actively in flight.** Pro features should fall into one of three categories:

1. **Volume removal** — unlimited drafts, unlimited history, unlimited auto-submits. Free has caps that are sane for occasional use; Pro has no cap.
2. **Information asymmetry** — heat scores, acceptance rates, application ranking with feedback. Information that we have, that helps the founder make better decisions, that we charge for because it costs us to compute and maintain.
3. **Time savings** — auto-submit, recruiter agent, live updates, multi-seat. Things that save founder hours, not unlock content.

**What stays free forever:**
- The question archive itself (every question, every word)
- Program directory and program descriptions
- The Answer Bank (with drip cap on free)
- AI drafts (with monthly cap)
- Application progress tracking

**What is gated:**
- Volume past sane caps
- Computed intelligence layers (heat, ranking, feedback)
- Automation (auto-submit, recruiter agent, live updates)
- Multi-seat / shared library
- Data export

### Community + comparison

(Defer until data layer is real — community without signal is noise.)

- Anonymous benchmarking: "Founders with similar fit scores answered this question in ~180 words on average"
- Mentor matching based on DNA fit
- "Companies who got into YC after similar struggles" examples

---

## Premium pricing structure (working draft)

| Feature | Free | Pro ($19/mo) | Team ($49/mo) |
|---|---|---|---|
| Programs visible | All 30+ | All | All |
| Answer Bank size | 5–10 to start, drip 2–5/day, ~30 cap | All 225+ unlocked | All + shared library |
| AI drafts | 10/month | Unlimited | Unlimited |
| Answer history | Last 5 versions | Unlimited | Unlimited |
| Heat scores + acceptance rates | Hidden | Visible | Visible |
| Application ranking + feedback | Rank only | Rank + feedback | Rank + feedback |
| Live application updates | No | Yes | Yes |
| Auto-submit | No | 5/month | Unlimited |
| Recruiter agent | Manual | Auto | Auto |
| Multi-seat | 1 | 1 | Up to 5 |
| Export | No | PDF, Notion | PDF, Notion, Markdown |
| Priority support | No | Email | Email + Slack |
| API access | No | Read-only | Full read/write |

---

## What we're explicitly NOT building (yet)

- Full application management for programs (Y Combinator's internal tools — that's a separate product)
- Founder networking / dating / co-founder match — noise without outcomes data
- Generic AI chat — we're a specialized tool, not a chatbot
- Traction dashboards — until programs require structured traction, hand-rolled blurbs win

---

## Editing this doc

- Add aspirations as they come up — don't filter at write-time
- Tag with `[ ] Phase X` once it has a place in the roadmap
- When something ships, add `[x]` and link the commit
- Every six weeks: prune what's gone stale, promote what's nearly here
