# Application Hub — Product Vision

> A living document. The product is built schema-first; vision lives downstream of that asset.
> Every aspiration here translates eventually to a database column, a UI surface, or a paywall.

---

## North star

**The smartest founder in the world has filled out 1,000 applications. Most founders fill out their first.**

Application Hub closes that gap by treating every application question as data — archived, scored, reusable — so a single thoughtful answer becomes the founder's permanent asset, not a one-time effort that disappears into a Google Doc.

---

## Positioning — what this actually is in the landscape

Application Hub is **infrastructure for the application graph**, not an AI writer.

Every other "application platform" is either a form builder (JotForm, Typeform) or a tracker (Airtable, Notion templates). Nobody else has:

- A **question archive** with semantic deduplication and significance scoring
- An **answer bank** with cross-program reuse — answer once, apply everywhere
- **MCP-first architecture** — power users can query the archive from Claude/Cursor/Windsurf without touching the UI
- **Stress testing** as product philosophy — applications as living, validated artifacts, not static one-shots

The AI writing space is saturated. The application intelligence space is empty. We're not competing with AI writers — we're building the data structure and intelligence layer that AI writing depends on.

**The moat is the application graph itself.** Questions as reusable assets. Answers as permanent capital. Programs as discoverable nodes. The AI is plumbing — bring your own.

### AI native — not AI-augmented

This isn't a product that added AI features. AI is the spine of the architecture:

- **The database computes intelligence** — significance scores, program DNA, fit scores, composite rankings are SQL functions running in Postgres, not API calls to a model
- **The MCP server is a first-class surface** — 19 tools, 7 resources, 3 prompts. The web app is one client; Claude Desktop, Cursor, and Windsurf are others. Power users may never touch the web UI.
- **Drafting and review are architecturally separate** — hosted drafting (`/api/draft`) is synchronous convenience. Agent-side review (RNS/MO§ES judgment layer) is asynchronous intelligence that runs after the fact over saved answers, not in the request path.
- **RNS is additive, not replacement** — the current scoring formulas are scaffolding. RNS signal purity, commitment conservation metrics, and SigToken contextual scoring layer on top as the answer corpus grows. The database columns become display aliases while the deeper measurement system matures.

The architecture forces a clean separation: Application Hub owns the data graph and the intelligence layer. AI agents — the user's own or the platform's — consume it. This is the correct inversion. Most "AI products" are a model with a UI. This is a data platform with AI as a first-class interface.

### Why this matters for the levelling story

User insight (2026-05-10): "i start at ground zero so the question is how do i have a chance versus a seasoned AI user with money who has all the tools and knows how to use them right."

A novice founder with no AI tools and no money should be able to compete with a polished funded founder with a stack of subscriptions. The platform makes that possible because:

- **The question archive levels the unknown-unknowns** — both founders see the same 225 questions ranked by significance, so the novice can't be tricked by an obscure question the seasoned founder happens to know
- **The answer bank levels the time investment** — the novice answers once, that answer is reusable across 30+ programs; the seasoned founder doesn't get a multiplier for being faster
- **Stress testing levels presentation skill** — the seasoned founder's polished surface gets probed for substance; the novice's rough draft gets its hidden gems surfaced. Both get evaluated on what's actually there, not on writing quality.
- **MoatScore levels the brand-name advantage** — score is computed from quality + survival under stress + outcomes, not from who you know or where you went to school

This is the equity story underneath the product story. **Stress testing is the most important component** — it's the mechanism by which a poorly-presented gem can carry the application through, and the mechanism by which a polished façade can be exposed.

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

### Winning applications marketplace

When a user gets accepted to a program through the platform, two new flows become possible:

**Model A — User sells their application as a template:**
- User opts in to list their accepted application (anonymized or credited, their choice)
- Other founders can purchase access to read the winning answers as a reference
- Revenue split: platform takes a transaction fee, seller keeps the majority
- Buyers get the template + the stress-test transcript + the program DNA context that shaped it
- Not a copy-paste product — the buyer's answers still go through their own bank. This is reference material.

**Model B — Platform purchases and licenses:**
- Platform buys winning applications outright from the founder (one-time payment)
- Platform maintains a premium library of vetted, accepted applications
- Pro+ tier unlocks access to the library as part of the subscription
- Particularly valuable for programs like YC, SBIR, NSF SBIR where the application format rarely changes

**Why this is interesting:**
- Creates a real economic incentive for users to log outcomes (currently the hardest behavior to drive)
- Turns accepted founders into contributors — they get paid, we get signal
- The dataset becomes a moat: no competitor can replicate a library of verified-accepted applications without the same user base
- The privacy architecture supports this: we never stored the content, so the founder owns it cleanly and can sell it

**What never gets sold:** stress-test responses that expose business weaknesses, financial specifics the founder marked private, or anything the founder didn't explicitly approve for release.

### Recruiter agent

- Scheduled job scans new programs against user profile
- Alerts when a high-fit program opens
- Premium: agent applies on user's behalf when fit > threshold + user has slot remaining

### Public API

- Open the program + question dataset to partners (other founder tools, mentors, accelerators)
- Becomes the canonical schema layer for "the application graph"
- Revenue: tiered API access for high-volume consumers

### Answer Bank — the user's ammunition

The Answer Bank is not a history log or an archive. It is **the user's invaluable memory** — built storage that compounds over time. Every answer a founder has ever written becomes reusable ammunition for the next application. The bank is their loadout: the stronger it is, the faster and more accurately they can fire at any new program.

This reframing matters for the UI, the copy, and the product philosophy:
- The bank **grows in value** with every answer added — it's an appreciating asset, not a filing cabinet
- Every time a user opens a new program workspace, the bank pre-loads what they already have — they never start from zero again
- The drip mechanic isn't just "here are questions to answer" — it's **loading new ammunition** into the bank daily
- Pro tier unlocking all 225 questions immediately means unlocking a full arsenal, not just more content

The Answer Bank and the user's profile are **completely separate things**:
- **Answer Bank** = what you've said, how you've framed your story, your actual answers — the working material
- **Profile** = who you are, what stage you're at, what you're building — the metadata that shapes fit scores and drip matching

They live at different routes and serve different purposes. The Answer Bank is a tool. The Profile is your identity.

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

### Community program submission — submit a link, get fit back

User submits a URL to a program they found (accelerator, grant, fellowship) that isn't in the Hub yet.

**What happens:**
- Platform fetches/scrapes the application page
- Extracts questions, word limits, deadlines, equity terms
- Maps questions to existing archived questions (dedup) or creates new entries
- Program appears in the Hub (pending review flag until verified)
- **Submitter gets back immediately**: fit score for this program + which of their banked answers already apply + what's missing

**Why this is the right flywheel:**
- User gets immediate personal value (gap analysis, fit score) — not a charity contribution
- Platform gets a new program in the archive with zero manual curation effort
- The import_queue table (migration 003) already exists for exactly this
- Scales the archive from 30 programs to 300+ without a data team

**Implementation:**
- `/submit` or a "Submit a program" button in the Hub
- Simple form: URL + optional notes
- Background job (Supabase Edge Function or MCP tool) scrapes + extracts
- Maps to `import_queue` with `status = 'pending_review'`
- Returns fit analysis to the submitter immediately

**Quality control:** admin reviews queue before programs go live. Submitter gets notified when their program is approved and live.

### Application indexing — reverse-engineer your history

User uploads or pastes an old application they already submitted (PDF, doc, plain text). Platform reverse-engineers it into the Answer Bank.

**What happens:**
- Parse Q&A pairs out of the document
- Map each answer to the closest archived question using significance scoring + semantic similarity
- Populate the user's Answer Bank with answers they already wrote
- Tag confidence based on whether the program accepted them (if they tell us)

**Why this matters:**
- Cold-start problem solved instantly for anyone who's applied before
- User wakes up with a pre-filled Answer Bank from work they already did
- The platform gets richer answer data, which feeds stress-testing and signal scoring
- Pairs directly with the VS Code extension (paste from editor, import to bank)

**The agent play:**
When the agent layer (RNS + MCP) is mature, this becomes intelligent — not just mapping answers to questions, but scoring them against program DNA, flagging weak spots, and suggesting where to stress-test first. Upload a rejected YC app and get back: "here's why it likely didn't land, here's what to fix."

**Priority:** P1 for the simple paste/import version. Full document parsing + agent analysis is P2.

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

### Stress testing — the core differentiator

User insight (2026-05-10): "i ran into a lot of brick walls in my applications... they are static... i am looking to end that by creating in RT follow ups... a sort of stress test type of thing."

**The problem**: applications today are one-shot static artifacts. A founder writes 200 words about traction, the program reads it, decides. Two failure modes:
1. **Hidden gem buried in bad presentation** — a great answer with weak phrasing gets bounced because nobody surfaces the actual signal underneath
2. **Polished surface with no substance** — a beautifully-written answer that falls apart on any follow-up makes it through to interview, wastes everyone's time

**The fix**: stress-test every answer in real time. After a user saves an answer (or after submission), the platform asks 3–5 probing follow-ups to validate the claim, surface what's underneath, or expose what's missing.

Mechanically:
- User saves answer to "What's your traction?" — claims "$50k MRR, 30% MoM growth"
- Platform fires stress-test: "Where is that revenue coming from? How many customers? What's churn? What's CAC? When did you hit that MRR?"
- User answers (or skips, or marks "won't share")
- Original answer + stress responses become a **stress-tested artifact** with a confidence layer
- Programs see the original 200 words AND the validation depth — richer signal than either alone

**Two outputs from a stress test**:
- For the founder: discovers what's actually strong vs. what they were bluffing about. Actionable feedback that leads to better answers.
- For the program: a confidence score on each claim. Stress-tested traction at 0.92 confidence is more credible than untested traction at 1.0 polish.

**Connection to moatscore** (see below): stress-tested answers feed the moat assessment. A claim that survives stress contributes to moat strength; a claim that collapses signals overstatement.

**Connection to the Application Hub Fund**: the fund needs to assess merit. Stress-tested applications give the fund a defensible signal beyond polish.

This is **the most differentiated thing about the product**. Every other application platform accepts what's submitted and stops. Stress testing turns the platform into a truth machine — for everyone's benefit, not just one side.

Implementation tiers:
- **Free**: 3 stress tests per month, AI-driven follow-ups
- **Pro**: unlimited stress tests, choice of stress depth (light/medium/deep), can re-stress same answer over time
- **Pro+**: stress test is gated by a community panel (other founders or mentors) for premium signal
- **Funder side** (later): programs pay to have applicants stress-tested as part of the program's intake

### Floating Moat / Standing / FundScore / MoatScore

User has an existing framework — exact specifics TBD. This expands the **Founder Ranking** concept from earlier.

The platform computes a real-time, multi-dimensional score for each founder/company that travels across applications and updates as new data lands.

**Floating** = updates continuously as new evidence comes in (new applications submitted, stress tests completed, traction signals from connected platforms, outcomes logged).

**Moat** = composite measure of competitive defensibility, derived from:
- Answer Bank quality across moat-relevant themes (problem, vision, technical depth, team)
- Stress-test survival rate (claims that hold up under probing)
- External signals (GitHub activity, Stripe MRR if connected, social proof)
- Outcome track record (acceptances, follow-on rounds, exits)

**Standing** = where you rank against other founders (by category, stage, geography, etc.)

**FundScore / MoatScore** = the headline number. A single 0–100 (or 0–1000?) figure that programs and funders can use as a quick assessment.

UI implications:
- Founder profile page surfaces standing + score with breakdown
- Hub list can be sorted by "founders most likely to fit" (uses applicant moat score)
- Program detail page shows distribution: "founders applying to this program have moatscores ranging X–Y"
- Premium: see your delta to the next standing tier ("answer 3 more questions in Vision and you'd jump 12 places")

**Status (2026-05-10)**: User has an existing framework. Once they bring the spec into the repo, we'll customize from there. Until then, we use the Founder Ranking shape as a placeholder for downstream design (e.g., the MoatScore display surface in ROADMAP P3) — but the actual computation is reserved for the user's brought-in spec.

### Bring Your Own Key (BYOK) — AI provider integrations

User direction (2026-05-10): "users will be able to plug in their own key... my key will be added later or we will find another solution. i have no money and i am not paying for other people's AI use."

**This is not just an architectural preference — it's a financial necessity.** Today `/api/draft` uses a platform-owned `ANTHROPIC_API_KEY` which would charge the platform per token. The platform owner is bootstrapping. Subsidizing users' AI calls bankrupts the project before it ships. **BYOK is therefore P0** — the only way `/api/draft` ships at all.

**Reframe**: Application Hub is the integration/orchestration layer, not the AI provider. Users connect their Anthropic / OpenAI / Google / Ollama keys; Application Hub routes requests through their provider. We provide the question archive, the answer bank, the program intelligence, the stress-test prompts. They provide the compute.

Why this is right:
- Removes the platform's largest variable cost (Anthropic API spend per draft)
- Lets users pick their preferred provider — Claude, GPT-5, Gemini, Mistral, local Ollama
- Premium users who don't want to manage keys can use the platform's pooled key (Pro feature)
- **Privacy architecture**: the platform never stores answer content or application text. We track metrics, lineage, and scoring signals — encrypted, with provenance — but the actual words belong to the user and travel only to their chosen provider. BYOK is what makes this possible at the structural level.

**What we keep vs. what we don't:**
- **We never store**: answer content, draft text, application submissions, prompt text
- **We do track**: word count, confidence level, update timestamps, significance-weighted metadata, stress-test outcomes (scores, not content), submission events
- Everything tracked is encrypted and carries lineage — who produced it, when, from what source
- Users who delete their account have all tracked metadata deleted with them

**Schema** (future migration):
```sql
CREATE TABLE user_integrations (
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,       -- 'anthropic' | 'openai' | 'google' | 'ollama' | etc
  encrypted_key    TEXT NOT NULL,       -- pgsodium or vault-encrypted
  default_for      TEXT[],              -- ['draft', 'stress_test', 'critique']
  added_at         TIMESTAMPTZ DEFAULT NOW(),
  last_used_at     TIMESTAMPTZ,
  PRIMARY KEY (user_id, provider)
);
```

**Routing logic in `/api/draft`**:
1. Check user's `user_integrations` for a key matching the request type
2. If found, decrypt + use
3. If not found AND user is Pro/Team, fall back to platform pooled key (rate-limited)
4. If not found AND user is Free, return 402 with "add a key in Settings or upgrade to Pro"

**UI**: new `/profile/integrations` page where users paste API keys for whichever providers they want. Visible "test connection" button per provider.

**Free tier policy** (decided 2026-05-10): **Option A — Free tier requires user to BYOK.** No platform fallback. The platform isn't going to subsidize users' AI consumption.

Implications for the user journey:
- Free user signs up → lands on `/profile/integrations` early in onboarding
- "Connect an AI provider to enable drafting and stress testing" — pasted Anthropic / OpenAI / Google / Ollama key
- Without a connected key, AI features are visible but disabled with "Connect a provider →" hover hint
- Pro users (when Stripe is wired) optionally get pooled platform-key access on top of their own — not a subsidy, a convenience baked into the price

This also positions Application Hub correctly: **integration platform, not AI middleman.** We orchestrate, the user pays the compute provider directly.

Premium pricing matrix below reflects this.

### Integration roadmap — what to connect, in what order

**Architectural rule** (user direction 2026-05-10): integrations attach to the **user profile**, not to specific applications. A user connects GitHub once on their profile; that data flows into every application's traction-relevant questions. This keeps the application surface focused on content, not config, and means a user only configures each integration once.

User insight: "how to connect this with other platforms... vs code github llms what other ideas do we have"

Ranked by leverage and proximity to ship:

**Tier 1 — connects directly to the moat thesis (highest priority)**

| Integration | What it does | Why first |
|---|---|---|
| **GitHub App** | Pull stars, commits, contributors, public repo activity for a connected company | Auto-populates traction questions, feeds moatscore |
| **BYOK AI providers** | Anthropic, OpenAI, Google, Ollama (local) | Architectural prerequisite for `/api/draft` going forward |
| **MCP server (existing)** | Founders connect their own Claude/Cursor/Windsurf to query archive + draft answers | Already partly built — power-user surface |
| **Stripe** | Subscription billing for Pro/Team | Monetization unlock |
| **Resend (or equivalent SMTP)** | Transactional email — magic link, deadline alerts, drip notifications | Removes Supabase free-tier email dependency |

**Tier 2 — enriches the data and reduces user friction**

| Integration | What it does | Why |
|---|---|---|
| **VS Code / Cursor extension** | Founders see and answer application questions inside their editor | "Power user lives in their dev environment" — same MCP backend |
| **LinkedIn import** | Auto-pull founder profile, company experience | Reduces manual profile setup |
| **Crunchbase / AngelList** | Auto-populate company data (founding date, team size, stage) | Saves user time |
| **Notion sync** | Read/write Answer Bank to a Notion database | Power users keep their stuff in Notion |
| **Google Calendar** | Deadline alerts as calendar events | Surfaces app outside the app |
| **Stripe data integration** | Read live revenue/MRR from connected Stripe accounts | Auto-validates traction claims, feeds stress-test |

**Tier 3 — workflow and team features**

| Integration | What it does | Why |
|---|---|---|
| **Slack** | Notifications: new program matches user, deadline alerts, team-mode comments | Engaged co-founder teams live in Slack |
| **Linear / Jira / Asana** | Track applications as tasks | Some founders prefer their existing PM tool |
| **Zapier / Make / n8n** | "When I save an answer, sync to Notion" type automations | Long-tail integrations without building each one |
| **Dropbox / Google Drive** | Export applications as PDF / Markdown | Backup, sharing |

**Tier 4 — specialized verticals**

| Integration | What it does |
|---|---|
| **Grants.gov / SAM.gov APIs** | Auto-pull federal grant opportunities |
| **Carta** | Cap table data for fundraising-themed questions |
| **Mercury / Ramp** | Banking data for runway/burn-rate questions |
| **HubSpot / Mixpanel / Amplitude** | Product analytics for traction validation |
| **Twitter/X, LinkedIn social** | Mention/sentiment signal for moatscore |

**Funder-side (later)**:
- Direct partnerships with accelerators (YC, Techstars) for hosted submissions
- Webhooks programs subscribe to ("notify me when high-fit founder applies")

### Home dashboard — fixing the IA

User direction (2026-05-10): "want to make sure we address the home dashboard... the program hub and timeline thing"

**Current sidebar**: Program Hub / Timeline / My Applications / Answer Bank — four entries, none of which is a "home."

**Problems**:
- New user lands on `/hub` (programs) but doesn't know what to do
- Timeline is a sort/view of programs, not a separate destination
- Engaged user has no place that synthesizes "what should I focus on today"

**Proposed home dashboard** (`/` or `/home` or `/today`):

```
┌────────────────────────────────────────────────────────────┐
│ Today                                          [moatscore] │
│                                                             │
│ ▸ 3 new questions unlocked in your Question Bank →          │
│ ▸ 2 deadlines in the next 14 days (Y Combinator W26, …)     │
│ ▸ Your application to Pear VC is 60% complete →             │
│ ▸ One of your saved answers needs a stress test →           │
│                                                             │
│ ────────── Suggested next steps ──────────                  │
│                                                             │
│ [Answer 3 questions]   [Open Pear VC app]   [Stress test]   │
└────────────────────────────────────────────────────────────┘
```

**Sidebar reorg** (proposal):

| Today | Sidebar entry | Proposed | Lives at |
|---|---|---|---|
| Program Hub | Programs | Hub | `/hub` (with view tabs: Cards / Timeline / Map) |
| Timeline | (folded into Hub view tabs) | — | — |
| My Applications | Applications | Apps | `/apps` |
| Answer Bank | (split) | Bank | `/bank` (Question Bank + Drip + Answer Bank merged) |
| (none) | (new) | Today | `/` (home dashboard, default) |
| (none) | (new) | Profile | `/profile` (real profile, not Answer Bank) |

This reduces cognitive load (4 entries → 5 but each has a clearer job), gives engaged users a daily landing page, and folds Timeline into a more natural place.

---

## Scoring philosophy — we are not the arbiters of truth

This needs to live in the product itself, not just in documentation.

Every time a score appears — significance, fit, composite, heat, MoatScore — the UI should make this explicit:

> *"We are not the arbiters of truth, nor do we wish to be. Our scoring systems measure mathematical signals derived from the words themselves and their sources. Two founders can submit identical answers and receive different scores — because the meaning of words comes from their source: their history, their track record, their context. We measure signal against source, compared with other sources. The final decision on who gets chosen belongs to the programs. We are making sure the right people are in the right rooms, and the data presents it."*

**What this means structurally:**

The scores are not subjective judgments. They're internally formulated measurements. The significance formula (`asked_by_count × word_limit_weight × theme_prestige × universal_bonus`) derives from what programs collectively weight, not from our opinion. The fit formula measures coverage and alignment against existing data. The composite is a function of fit and program value.

More importantly: once RNS integrates, scoring derives from the words and their sources — commitment conservation, signal-to-noise ratios, dual-weight analysis. Two founders with identical surface answers will score differently because their underlying signal is different. The platform surfaces that difference mathematically, not editorially.

**UI implication:** every score needs:
1. A one-line description of what it measures
2. A "how is this calculated?" tooltip with the high-level formula
3. A "what does this range mean?" label (e.g., "0.8+ = strong signal in this theme")
4. The platform philosophy statement — short version: *"Mathematical signal, not judgment"*

A `/intelligence` or `/about/scoring` page should exist that explains the full system — all scoring dimensions, the source-aware philosophy, the RNS upgrade path — in plain language. This is also IP defense: showing that our scoring is methodologically grounded, not arbitrary, matters when programs stake decisions on it.

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

One product, governors removed per tier. Not separate products.

| Feature | Free | Pro ($19/mo) | Pro+ ($49/mo) | Team ($99/mo) |
|---|---|---|---|---|
| Programs visible | All 30+ | All | All | All |
| Answer Bank size | Drip (~30 cap) | All 225+ unlocked | All 225+ | All + shared library |
| AI drafts | 10/month (BYOK required) | Unlimited | Unlimited | Unlimited |
| Answer history | Last 5 versions | Unlimited | Unlimited | Unlimited |
| Heat scores + acceptance rates | Hidden | Visible | Visible | Visible |
| Application ranking | Rank only | Rank + feedback | Rank + feedback + predictions | Rank + feedback + predictions |
| Stress testing | 3/month | Unlimited | Unlimited + community panel | Unlimited |
| MoatScore / FundScore / Standing | Hidden | Basic score | Full breakdown + standing | Full breakdown |
| Founder Ranking percentile | Hidden | Hidden | Visible | Visible |
| Live application updates | No | Yes | Yes | Yes |
| Auto-submit | No | 5/month | Unlimited | Unlimited |
| Recruiter agent | Manual | Auto | Auto | Auto |
| Winning applications library | No | No | Access included | Access included |
| Multi-seat | 1 | 1 | 1 | Up to 5 |
| Export | No | PDF, Notion | PDF, Notion, Markdown | PDF, Notion, Markdown |
| API access | No | Read-only | Read-only | Full read/write |
| Priority support | No | Email | Email | Email + Slack |

**B2B stream (separate):**
- Standard listing: Free
- Verified listing: $299/cycle
- Featured listing: $999/cycle
- Hosted applications: Custom
- Funder webhooks: Custom

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
