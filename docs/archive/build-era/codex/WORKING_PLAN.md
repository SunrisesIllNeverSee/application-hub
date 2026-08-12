# My Working Plan — Application Hub Next Phase

_Personal notes. Claude Sonnet 4.6. Updated 2026-05-12._
_Read this before touching anything._

---

## What this product actually is

Not a SaaS tool. Not a feature list. One thing:

**The more you use it, the more valuable it becomes — for you, for the community, and for programs.**

Every feature is an expression of this. The onboarding gate teaches the system who you are. Your behavior teaches it more. The answer bank is a record of your thinking over time. The hash makes that record trustworthy. The persona profile is what the record becomes when enough of it exists. The recruiter scoring surface is what that profile is worth to someone with a budget.

The community dashboard is public because the numbers are the proof of the pool. The days transfer mechanic is distribution. The lineage system is free archive growth. The competitor recon on ATS platforms (Greenhouse, Lever, Ashby) identifies partners, not competitors — those are the workflows programs are already paying for.

---

## The flywheel

```
Onboarding gate → intent data → answer bank (timestamped, hashed)
      ↓                                 ↓
 organic theme growth          persona profile (distilled)
      ↓                                 ↓
 community dashboard ←→     recruiter scoring surface → B2B revenue
      ↑
 lineage system + category seeding (parallel, self-growing archive)
```

Nothing is standalone. Every mechanic feeds the loop.

---

## What's built vs. what's needed

| Layer | Status | Notes |
|---|---|---|
| Schema + migrations (001–039) | ✅ | Solid foundation |
| Intelligence (significance, DNA, fit) | ✅ | Synthetic now, observed data later |
| Answer bank (basic) | ✅ | Exists but conceptually wrong — needs rethink |
| BYOK + drafting | ✅ | Needs to become part of split-screen |
| Credits + days + transfer mechanic | ✅ Partial | Transfer not built yet |
| Embeddings (225q, 768d) | ✅ | Done |
| applicant_mode enum + identity flags | ✅ | In place — ready for organic theme growth |
| Onboarding gate | ❌ | P0 — nothing downstream works without it |
| Organic theme growth | ❌ | Infrastructure ready, behavior signal not wired |
| Answer bank as timestamped captures | ❌ | Phase 2 |
| Split-screen editor | ❌ | Phase 3 — reframes workspace entirely |
| Hub free tier rotation | ❌ | Phase 4 |
| Lineage system | ❌ | Phase 5 |
| Submission: PDF/image + template paths | ❌ | Phase 5 |
| Days transfer mechanic | ❌ | Phase 5 |
| Community dashboard (public) | ❌ | Phase 6 |
| Profile abilities that grow | ❌ | Phase 6 |
| GitHub-style public profile | ❌ | Phase 6 |
| Persona profile | ❌ | Phase 7 — gate: real data first |
| Competitor recon (ATS + job boards) | ❌ | Research track |
| Category seeding (universities, grants, jobs) | ❌ | Parallel track, no users needed |
| B2B program surface | ❌ | Future — gate: 100+ active founders |

---

## Phase 1 — Onboarding Gate (P0)

Hard gate. Nothing opens until completed.

**Two paths:**
- Path A: fill out "our application" (5–10 questions we define)
- Path B: upload or paste an application they are actively working on

**What stays closed:** Hub, Today, Bank, Workspace — everything.

**Technical implementation:**
- `user_profiles.onboarding_complete: boolean` — false by default
- Middleware redirects to `/onboarding` if false
- On completion: stores answers to `profile_answers`, sets `active_identity`, flips flag
- V1: manual review acceptable. Correctness matters more than automation.

**What it produces on day one:**
- Who this user is
- What they're applying for
- What their answers actually look like
- A grounded starting point for every downstream score and match

---

## Phase 2 — Answer Bank Rethink

Each answer = a captured moment. Not an editable form field.

**What to build:**
- Timestamped on creation
- Hashed (SHA-256 of content + timestamp) — verifiable provenance
- Versions preserved when updated — old answer never deleted, just superseded
- Left panel: VS Code-style scrollable index (by theme / by date / by program)
- Right panel: answer text, read-only by default, edit creates new version

**Why hashing matters:** When a recruiter evaluates your persona profile, "I had this answer before I applied to YC" is verifiable. That's a trust layer no one else has thought to build.

---

## Phase 3 — Split-Screen Editor

Replaces the current workspace. Makes BYOK coherent.

**Left panel:** answer bank index + persona profile (accumulated answers, organized)
**Right panel:** the application being filled — questions visible, answers injected from left

AI draft operates with context of both panels simultaneously. "Apply this answer" replaces copy-paste. Model: Overleaf / Prism.

**Don't build until Phase 2 is solid.** Left panel only works if the answer bank is right.

---

## Phase 4 — Hub Free Tier Gating

Free tier shows less, not more.

- **Free:** 50 programs, rotated/randomized every 4–12 hours (deterministic per user per window)
- **Pro:** full archive, search, filter, best-fit ranking
- **Column layout tabs:** check_size · equity · paid/unpaid · remote · travel · audience
- Sidebar column should be collapsible — working toward real dashboard layout

---

## Phase 5 — Submissions, Lineage, Days Transfer

**Three submission paths:**
- URL → auto-files with timestamp, lineage locked to first submitter
- PDF / image upload → stored, processed into questions
- Template → fill out our template, system ingests it

**Lineage lock:** First submitter owns it. Timestamped, immutable. Prior art system for program discovery. People race to submit = free archive growth. Nobody else is doing this.

**Days transfer:** Users can transfer earned days to other users — founders, students, anyone. "I'm giving 30 days to the most compelling cold outreach I receive this month." This is distribution.

---

## Phase 6 — Community Dashboard + Profile Growth

**Community dashboard (public-facing):**
- Global stats: questions uploaded, answers given, applications filled
- Leaderboard: who's answering, submitting, filling applications, interacting
- Rate/rank answers — community signal on quality
- Funny/notable answers surface
- Personal stats alongside global
- Daily challenges + reminders + to-dos (logged-in layer)

This is public because the numbers are the proof. Programs see a live, active, scored applicant pool before they ever pay for access.

**Profile abilities that grow:**
- GitHub-style workspace that develops with usage
- Best answers surfaced on public profile
- As profile matures: recruiter points an application at your profile → gets a genuine assessment back, not a match % 
- Profile becomes institutional over time

---

## Phase 7 — Organic Theme Growth (infrastructure already in place)

The system figures out who you are from behavior, not self-declaration.

- Upload 5 applications → experience gravitates toward that vertical
- Upload 10 → experience moves more
- Upload 15–20 → premium benefits unlock automatically as reward for feeding the system

`applicant_mode` enum, identity flags, and question filtering are already built. Just need the behavior signal wired in. **Not asking for this now — noting that it's ready when we are.**

---

## Phase 8 — Persona Profile (gate: real data from real users)

Three layers:
1. Answer bank (raw capture) — exists
2. Persona profile (distilled output) — derived from answer patterns
3. Recruiter scoring surface — programs pull ranked hit lists

**Gate:** Do not build Layer 2 until the onboarding gate has produced real answer banks from real users. Building a persona engine against sparse data produces garbage.

---

## Parallel Track — Category Seeding

Does not require users. Can start anytime.

| Category | Strategy |
|---|---|
| Universities | Top 250 by specialty (science, business, law, tech, medical). Sub-layers: community college → 4-year public/private/ivy → grad → PhD. Pull 20% of applications per list. |
| Grants | Academic research / student scholarships / business grants / federal / private |
| Jobs | 30–50 per sector (federal, public, private, finance, manufacturing, tech). **Static historic archive.** Research/reference framing. Living only if companies pay to process through the platform. |

---

## Research Track — Competitor Landscape

Map before positioning. Who to partner with, who to pull from.

- **Job boards:** Monster, Indeed, LinkedIn, Glassdoor
- **ATS platforms:** Greenhouse, Lever, Ashby, Indeed, LinkedIn (these are the workflows programs already pay for — partnership targets, not competitors)
- **Adjacent:** resume writing services, career coaching, anything in the application prep space

The hostile takeover framing: programs stop broadcasting into the void and start pulling from a live ranked pool that already exists here. ATS platforms become integration partners, not obstacles.

---

## B2B Layer (gate: 100+ active founders with persona data)

Programs get:
- Pre-screened, scored applicant pool
- Application archived and discoverable
- Submissions scored before a human reviewer touches them
- Ranked hit list instead of inbox flood

**Do not build yet.** The applicant pool is the product. Build the pool first.

---

## Architecture note

Hot DB (Supabase): user experience data — answers, profiles, applications, scores, credits.
Cold / archive: heavy program data, question archive, historic applications — eventually separate concern as volume grows.
pgvector embeddings: the bridge between them.

This is already correct. Don't change it. Let it grow into the separation naturally.

---

## Locked decisions

| Decision | Direction |
|---|---|
| Free for applicants | Permanent. Non-negotiable. Applicant volume = the product. |
| Programs as customer | The revenue ceiling. Long-term destination. |
| Onboarding gate | Hard gate. Nothing opens without it. P0. |
| Vision tier | Do NOT prune. Defer with explicit gate conditions. |
| Jobs | Static archive until companies pay to process through the platform. |
| BYOK framing | "Power lane" upgrade. $10 one-time. Not a gate — an upgrade. |
| Answer bank | Timestamped captures. Versions preserved. Hashed. Not a form. |
| Organic theme growth | Infrastructure ready. Wire behavior signal when ready. Don't rush it. |
| Persona profile | Layer 2 gated behind real Layer 1 data. Don't build early. |
| Community dashboard | Public. Global + personal stats. Daily challenges. Proof of pool. |


---

## Competitor Notes

### AcceleratorApp (acceleratorapp.co)
Purpose-built SaaS for accelerator application management. The ATS equivalent for accelerator intake. Already used by programs in our archive: UofT Entrepreneurship, The Hub, Treefrog, ONRamp, Black Founders Network, and others.

Their forms are fully JS-rendered — field labels never appear in static HTML, which is why our Phase B scraper couldn't extract questions from their programs. The browser extension was specifically flagged as the fix for this.

**Competitive position**: They are on the program side — they sell to accelerators to manage their intake process. We are on the applicant side — we aggregate questions and build applicant profiles. This makes them a **partnership target**, not a head-to-head competitor. If we integrate with AcceleratorApp, their programs get pre-screened scored applicants and their applicants get their answers pre-filled from the answer bank.

**The hostile takeover framing applies here directly**: their programs are currently managing intake manually through their platform. If we have the applicant pool, programs pull from us through their existing AcceleratorApp workflow. We don't replace them — we become upstream of them.

**Note for browser extension**: AcceleratorApp URLs follow `[subdomain].acceleratorapp.co/application/new?program=[name]`. This should be a V1 portal in the browser extension whitelist alongside YC, Techstars, a16z, 500 Global, and Solofounders.
