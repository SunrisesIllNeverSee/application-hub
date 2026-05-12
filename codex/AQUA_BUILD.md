# AQUA — Build Foundation

_Claude Sonnet 4.6. 2026-05-12._
_This file is my grounding document for the AQUA restructure. It combines my understanding of the product direction, the UX vision, and the technical landscape before any instructions are added._

---

## What AQUA is

Applications. Questions. Answers.

The name is the product. Three pillars, one acronym, zero ambiguity. A user who has never heard of this before understands what it does from the brand alone. That's the right name.

The rebrand isn't cosmetic. It's a structural realignment. The current app is called "Application Hub" which describes a category. AQUA describes the mechanism — you bring applications, extract questions, build answers. That's the loop.

---

## What I understand about this build

This is a surface restructure, not a rebuild. Everything underneath stays. The schema, intelligence layer, BYOK, credits, embeddings — untouched. What changes is how users navigate and what they see when they arrive.

**The four pillars and what they actually contain:**

**Dash** — the engagement layer. State (where you are), challenges (what to do next), rewards (what you've earned), deadlines (what's coming). The credits/achievements system already backs this. MoatScore will eventually live here as a real number. This is also the public community surface — global stats visible to anyone.

**Applications** — program discovery + your active applications, unified. The Hub and Workspace are the same thing from two angles: finding programs and working on them. Funders folds in here as a filter or sub-view. The split-screen editor (future) lives here.

**Questions** — the question database from two angles: your unlocked drip questions (Bank) and the full archive (Archive). These were always the same thing. Merging them removes a navigation decision users shouldn't have to make.

**Answers** — your answer bank. Timestamped captured moments. Eventually VS Code-style file tree. This is the asset that grows over time and eventually becomes the persona profile.

---

## What this restructure sets up

The four pillars are not just navigation — they're the product architecture made visible. When the split-screen editor exists, it will live inside Applications with Questions on the left and the answer editor on the right. The Dash will surface MoatScore when it's real. The Answers section will grow into the persona profile surface.

This restructure creates the foundation without building those future layers prematurely. It's the right move to make now because:

1. New users need a clear mental model from day one
2. The current nav has too many items with unclear hierarchy
3. AQUA as a brand needs the UI to match — you can't call it AQUA and then show a sidebar that doesn't reflect AQA

---

## Technical landscape (what I know about the current codebase)

**Routes that exist today:**
- `/today` → becomes `/dash`
- `/hub` → becomes `/applications`
- `/bank` → becomes `/questions`
- `/answers` → stays `/answers`
- `/archive/questions` → redirects into `/questions`
- `/funders` → redirects into `/applications`
- `/workspace/[program_id]` → stays, back link updates to `/applications`

**Key files:**
- `app/components/Sidebar.tsx` — NAV array, logo, mobile bar, isNavActive()
- `app/app/(app)/layout.tsx` — app shell, auth guard
- `app/app/layout.tsx` — root metadata, OG config
- `app/api/og/route.ts` — OG image, "Application Hub" branding needs update
- `next.config.mjs` — redirects go here

**Things to watch:**
- HubFilters component references `/hub` — needs update
- Internal links in empty states, CTAs, email templates, recruiter agent
- The `metadata` export on each page — titles need to reflect AQUA
- The `about/scoring` page links from Hub — stays, just update referrer route
- ModeSelector pushes to `/hub` on mode switch — needs to push to `/applications`

---

## What this build does NOT do

- Does not build split-screen editor
- Does not build VS Code-style answer bank
- Does not build Dash command center with challenges
- Does not merge workspace tabs into Applications (future)
- Does not merge Funders as a real filter (future — just redirect for now)
- Does not change any database schema
- Does not change any MCP tools
- Does not touch the intelligence layer

---

## Brand notes

- Logo: "AQUA" — short, bold, tracked tight
- Tagline: "Applications. Questions. Answers."
- Full description: "A structured intelligence system for reusable applications. Fill once, improve continuously, apply everywhere."
- OG title: "AQUA — Applications. Questions. Answers."
- Domain stays mos2es.xyz for now

---

## Open question before executing

Route redirects: Next.js redirects in `next.config.mjs` are permanent (308) by default. Using temporary (307) initially gives us room to change our minds without cache issues on the old URLs. My instinct is permanent given this is a clean cutover — but worth noting.


---

## Deeper read — things that matter for execution

### isNavActive() — workspace maps to Applications
When a user is in `/workspace/[program_id]`, the Applications nav item must stay highlighted. The workspace is conceptually inside Applications. The isNavActive() function needs to match `/applications` AND `/applications/*` AND `/workspace/*`. This is a subtle UX detail that makes the nav feel coherent.

### Questions is a tabbed merge, not just a rename
`/questions` gets two tabs: **My Questions** (the former Bank — drip/unlocked) and **Full Archive** (the former `/archive/questions`). This is a UI addition inside the renamed route. The tab state can be driven by `?view=archive` param — which is also what the redirect from `/archive/questions` passes.

### ?view= params on redirects
- `/funders` → `/applications?view=funders`
- `/archive/questions` → `/questions?view=archive`

These params need to not break the destination pages even if the view logic isn't fully built yet. At minimum: ignore unknown view params gracefully.

### Profile moves to footer
Profile is absent from the 4-pillar nav entirely. It needs to move to the sidebar footer (alongside sign out / settings). This is a deliberate demotion — profile is account management, not a primary workflow. The build needs to handle this explicitly, not leave Profile hanging in the old nav position.

### Keywords include "common app"
The metadata keywords position AQUA alongside Common App. This is intentional SEO positioning — we're not just an accelerator tool, we're the reusable application layer for every category.

### Specific line numbers to hit in Sidebar.tsx
- 26-97: NAV array replacement
- 132-144: isNavActive() update
- 149-159: Logo — "AQUA" + tagline
- 298: Mobile top bar branding

### Workspace back link
Line 113 of workspace page — update from `/workspace` (or `/hub`) to `/applications`.

### Hard requirement
Zero feature regression. Every route rename preserves 100% of existing functionality. The restructure is navigation and branding only.


---

## The 8 Features (devanbuild2.md)

### Phase 1 — Foundation (Features 4, 5, 6 — parallelizable, structural)

**Feature 4: Merge Workspace into /applications with Tabs**
- Discover tab (existing Hub) + My Applications tab (workspace list)
- Clicking an application opens workspace inline (modal or slide-over)
- Keep /workspace/[program_id] for direct links
- New: ApplicationsTab, MyApplicationsTab, ApplicationWorkspaceModal components

**Feature 5: Merge Funders as Filter within Applications**
- Funders as filter tab/dropdown in /applications
- Keep /funders/[slug] detail page for now
- Redirect /funders → /applications?view=funders
- Reuse existing funders page logic as a component

**Feature 6: Merge Archive as Tab within Questions**
- "My Questions" tab (Bank) + "Full Archive" tab (Archive)
- Redirect /archive/questions → /questions?view=archive
- Reuse existing archive page logic as a component

---

### Phase 2 — Core UX (Features 1, 2 — major UX overhauls, do in order)

**Feature 1: Split-Screen Editor** ← establishes two-panel pattern
- Left: collapsible question tree (theme tag, significance stars, answered status)
- Right: Editor tab + Compiled Output tab (Markdown rendered, ready to paste)
- Resizable panels via drag handle. Mobile: vertical stack with toggle.
- New: SplitScreenWorkspace.tsx, QuestionTree.tsx, CompiledOutput.tsx

**Feature 2: VS Code-Style Answer Bank** ← follows two-panel pattern from Feature 1
- Left: file tree by theme — confidence badge (Draft/Solid/Locked), timestamp, preview
- Right: full question + AnswerEditor + version history
- Each answer shows as captured moment with hash, timestamp, version count
- Search/filter by text or theme
- New: AnswerFileTree.tsx, AnswerFileNode.tsx

---

### Phase 3 — Engagement (Features 3, 7)

**Feature 7: Onboarding Gate** ← builds on existing schema, feeds Feature 8
- /onboarding route + middleware guard in layout.tsx
- Path A: 5-10 questions from `archived_questions WHERE is_universal = true AND significance_score is high`
- Path B: upload/paste existing application
- Saves to profile_answers via existing mechanism
- Detects theme profile, stores in user_profiles
- Grandfather existing users: skip if user has any profile_answers
- Transition: "Based on your answers, here's what we found for you"

**Feature 3: Dash as Full Command Center** ← depends on Feature 8 for MoatScore
- YOUR STATE: apps in progress, questions answered this week, credits earned, MoatScore
- ACTIVE CHALLENGES: dynamic, derived from user profile gaps
- REWARDS UNLOCKED: from user_achievements (migration 032)
- DEADLINES: next 14 days with urgency indicators
- New: DashStateCard.tsx, DashChallengeCard.tsx, DashRewardCard.tsx

---

### Phase 4 — Intelligence (Feature 8)

**Feature 8: Persona Profile** ← the culmination, gate: needs real user data
- /profile/persona route
- Three-layer display: Answer Bank (raw) → Persona Profile (distilled) → Recruiter Scoring (future B2B)
- Theme strengths radar chart (reuse/extend DnaRadarChart)
- Profile Strength meter
- "Delta to next tier: Answer 3 more questions in Vision to jump 12 places"
- Links to fit scoring and program recommendations
- New: PersonaStrengthMeter.tsx

---

## Dependencies (locked)

- Features 4, 5, 6 are independent — can run in parallel
- Feature 1 before Feature 2 — split-screen establishes the two-panel pattern
- Feature 8 before Feature 3 — Dash needs MoatScore from Persona
- Feature 8 before Feature 7 in production — onboarding detects persona themes, needs the engine
- Feature 8 needs real user data — don't build persona engine against sparse/fake data

---

## Session split decision

**Session A → vscode-claude (repo)**
AQUA restructure (devanbuild1) + Features 4, 5, 6
Pure structure. Routing, nav, tab merges, redirects. No new intelligence. Ships fast. Parallelizable.

**Session B → me**
Features 1, 2, 3, 7, 8 in phase order.
These must be held by one brain — the split-screen establishes the pattern the answer bank follows, the onboarding feeds the persona, the persona feeds the Dash. Coherence across all five is non-negotiable.

