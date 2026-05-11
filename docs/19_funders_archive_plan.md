# Plan: Funders / Organizations Archive

_Written 2026-05-11. Implementation blocked on repo cleanup (issue #1) first._

---

## Problem statement

The `funders` table exists (migration 023, 30 orgs seeded, programs.funder_id mapped).
There is no UI for browsing funders. There is no public-facing funder profile.
Founders have no way to see "everything YC has ever run" or "all a16z programs."

---

## What needs to happen

### 1. Funders index — `/funders`

Browse all funders. Publicly accessible.

**Layout:**
- Filter by type (accelerator / vc / government / foundation / corporate / nonprofit)
- Filter by domain (founder / grants / education)
- Sort by: number of programs, prestige (brand_score avg), name
- Funder cards showing:
  - Name + type badge
  - HQ location + founded year
  - Program count ("3 programs indexed")
  - Top program(s) as pills
  - Link to funder profile

**Data source:** `funders` JOIN `programs` — all in DB

---

### 2. Funder profile — `/funders/[slug]`

All programs run by this funder, their history, and context.

**Layout:**
- Header: funder name, type, website, HQ, founded year
- Description (if seeded)
- Program list: all programs WHERE funder_id = this funder
  - Cards with deadline, heat score, cohort info
  - Same card style as Hub but scoped to this funder
- "Apply to any program" CTA → Hub filtered by this funder

**Data source:** `programs` WHERE `funder_id = funders.id`

---

### 3. Hub integration

- Program cards: show funder name as a subtle link ("by Y Combinator")
- Program detail: funder section with link to `/funders/[slug]`
- Hub filters: add "By funder type" filter option

---

### 4. Funder claiming (P2 — future)

Funders can claim their profile:
- Verification flow (email domain match or manual review)
- Verified badge on funder card and profile
- Ability to add/update description, logo, programs
- Premium: pay to feature programs, post updates, access applicant signals

**Schema already supports this via `funder_user_id` on funders table.**

---

### 5. Tier implications

| Tier | Funder archive access |
|---|---|
| Free | Browse funders index + profiles |
| Pro | See heat scores + acceptance rates per funder |
| Team | — |
| B2B (funder) | Claim profile, post updates, see applicant fit signals |

---

## Punch list

- [ ] `/funders` index page — filter by type, sort by program count
- [ ] `/funders/[slug]` profile page — programs list, funder details
- [ ] Program card: funder attribution link ("by [Funder Name]")
- [ ] Program detail: funder section with link
- [ ] Hub filter: filter by funder type
- [ ] Funder count in site stats ("30 funders indexed")
- [ ] Funder claiming flow (P2 — after launch)
- [ ] Funder webhook: "notify me when high-fit founder applies" (P3)

---

## Priority

- `/funders` index + `/funders/[slug]`: **P1** — data is ready, just needs UI
- Hub/program attribution links: **P1** — small, high value
- Funder claiming: **P2** — after launch
- Funder webhooks: **P3** — partnership tier feature
