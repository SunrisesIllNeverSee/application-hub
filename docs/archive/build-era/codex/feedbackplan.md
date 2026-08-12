# Product Direction Plan — from feedback.md

_Derived from Deric's feedback + Claude addendum. 2026-05-12._

---

## The Model (non-negotiable framing)

**Applicants are the product. Programs are the customer.**

Free for applicants is permanently correct — their volume is what programs pay for. Every feature decision flows from this. The applicant flywheel:

```
Onboarding gate → answer questions → answer bank → persona profile → programs pull ranked lists → B2B revenue
```

The archive, lineage system, and credits mechanic all feed this loop. Nothing is a standalone feature.

---

## Phase 1 — Onboarding Gate
_Solves overwhelm. Creates the data foundation. Nothing else works without this._

**What to build:**
- New user lands → two paths: (a) fill out "our application" (5-10 questions) OR (b) upload an application they're working on
- Nothing opens — no Hub, no Today, no Bank — until one path is completed
- System reads their answers and sets their theme/context (founder, student, researcher, job seeker)
- Manual review acceptable for V1 — correctness matters more than automation at this stage

**Why this is P0:**
- Day one you know who this user is, what they're applying for, what their answers look like
- Solves the "filing cabinet on day one" problem
- Every downstream score, match, and persona data point is grounded in real intent

---

## Phase 2 — Answer Bank Rethink
_Current Answer Bank is functional but wrong conceptually._

**What to build:**
- Each answer = a timestamped captured moment, not an editable form field
- Possibly hashed (document integrity — the answer you gave on May 12 is locked to that date)
- Left panel: scrollable VS Code-style index of all captured answers (by theme, by date, by program)
- Right panel: the answer text in a clean editor
- This is the left side of the eventual split-screen

**Why this matters:**
- When the persona profile becomes something a recruiter evaluates, the answer bank is the audit trail
- Timestamping = provenance. "I had this answer before I applied to YC" is meaningful.

---

## Phase 3 — Split-Screen Editor
_Makes BYOK and drafting a coherent workflow instead of a bolted-on feature._

**What to build:**
- Left panel: answer bank + persona profile (your accumulated answers and distilled identity)
- Right panel: the application being filled (live, the actual form questions)
- Draft with AI operates in context of both panels — it sees your answer bank AND the question
- Copy-paste injection becomes "apply this answer" not "copy from here, paste over there"

**Model**: Overleaf / Prism. Work on one side, compiled output on the other.

---

## Phase 4 — Hub Free Tier Gating
_Free tier should show less, not more._

**What to build:**
- Free: 50 opportunities, rotated/randomized every 4-12 hours
- Pro: full archive, search, filter, best-fit ranking
- Tab header columns: check_size · equity · paid/unpaid · remote · travel · audience
- Quick-view column layout → click to expand right panel (same split-screen pattern)

---

## Phase 5 — Lineage System
_Crowdsourced data collection disguised as a gamification feature._

**What to build:**
- Submit a URL → auto-files a submission with a timestamp locked to that user
- First submitter owns the lineage — no one else can claim it
- This is a prior art system for program discovery
- People race to submit programs = free archive growth

**Why this is underrated:** Nobody else is doing this. It creates a moat that self-reinforces.

---

## Phase 6 — Persona Profile
_The headline feature. The endgame._

**What to build:**
- Layer 1: Answer bank (raw capture) — already exists
- Layer 2: Persona profile (distilled output) — derived from answers across applications
- Layer 3: Recruiter scoring surface (monetization) — programs access ranked hit lists

**When it's mature:**
- Applicants don't fill out applications. Their profile is the application.
- Programs don't broadcast into the void. They pull from a live ranked pool.
- This breaks gatekeeping on both sides.

**Gate**: Don't build Layer 2 until Layer 1 has real data from real users. The onboarding gate feeds this.

---

## Category Seeding (parallel track)
_Data moat. Doesn't require users. Can start now._

| Category | Seeding Strategy |
|---|---|
| Universities | Top 250 by specialty (science, business, law, tech, medical). Sub-layers: community college, 4-year public/private/ivy, grad, PhD. Pull 20% of applications per list. |
| Grants | Academic research, student scholarships, business grants, federal/private. |
| Jobs | 30-50 applications per sector (federal, public, private, finance, manufacturing, tech). **Static historic archive** — research/reference framing, not competing with Indeed. |

Jobs archive is deliberately static. Legal safety + more academically interesting. Living only if companies pay to host/process through the platform.

---

## B2B Layer (future — do not build yet)
_This is what the applicant flywheel is building toward._

Programs currently run application cycles manually or with expensive ATS software. What they get here:
- Their application archived and discoverable
- Questions standardized and indexed
- Submissions pre-screened and scored before a human reviewer touches them
- A ranked applicant pool they can pull from instead of broadcasting into the void

**When to build**: After 100+ active founders with real persona profile data. The applicant pool is the product. Build the pool first.

---

## What This Means for Current Decisions

| Decision | Direction |
|---|---|
| Free tier | Less data, not more. Rotation/randomization, not full access. |
| BYOK charge | Frame as "power lane" upgrade, not a gate. $10 one-time. |
| Answer bank UI | VS Code index model, not a form. Timestamps matter. |
| Onboarding | Gate is P0. Nothing opens without it. |
| Vision tier | Do NOT prune. Persona profile and B2B surface are the destination. Defer them explicitly with a gate condition (100+ active founders). Remove nothing — just stop building them until the gate is met. |
| Jobs | Static archive only until companies pay to process through the platform. |

