# Plan: Questions Archive

_Written 2026-05-11. Implementation blocked on repo cleanup (issue #1) first._

---

## Problem statement

The question archive has 225 manually seeded questions across 30 programs. 800+ additional programs were imported from FundingCake but have zero questions mapped to them — they're shells. Founders who open workspaces for those programs see empty question lists.

There is no UI for browsing the question archive directly.

---

## What needs to happen

### 1. Questions archive UI — `/archive/questions`

A public-facing (or free-tier accessible) browse surface for the full question archive.

**Layout:**
- Search bar (search question text)
- Filter by theme (team / traction / problem / solution / market / vision / personal / fit)
- Filter by domain (founder / jobs / education / grants)
- Sort by significance (default), asked_by_count, theme
- Question cards showing:
  - Question text
  - Theme badge
  - Significance stars (1–5)
  - "Asked by N programs"
  - Locked/unlocked state for the logged-in user
  - Link into Answer Bank to answer it

**Gating:**
- Free: see all questions, answer unlocked ones only
- Pro: see + answer all immediately

**Data source:** `archived_questions` table — 225 rows, all already scored

---

### 2. Questions pipeline — filling the 800-program gap

**The problem:** 800 FundingCake programs have no questions mapped.

**Short-term (manual/semi-automated):**
- Admin tool to review `import_queue` and promote submissions to `archived_questions`
- For the FundingCake programs: scrape their application pages or use submitted questions via `/hub/submit`

**Medium-term (automated):**
- When a user pastes an old application via `/profile/import`, extracted questions that don't match anything in the archive get proposed for addition (with `confidence_score` threshold)
- `import_queue` entries with `status='pending'` reviewed by admin → `archived_questions`

**Long-term (MO§ES pipe):**
- Governed ingestion pipeline maps raw program form data → deduplicated archive entries
- This is the "everything is piped in" layer from the partnership vision

---

### 3. Question-to-program mapping gap

**The problem:** Even when a question is in the archive, it needs to be linked to programs via `program_questions`.

**What's missing:**
- `program_questions` table maps `(program_id, archived_question_id)` with program-specific phrasing and word limits
- The 225 questions are mapped to the 30 seeded programs
- The 800 FundingCake programs have no `program_questions` rows

**Fix:** When questions are extracted from a program (via import or admin), insert into both `archived_questions` (deduplicated) and `program_questions` (program-specific instance).

---

## Punch list

- [ ] `/archive/questions` browse page — search, filter, significance sort
- [ ] Locked/unlocked state display for logged-in users
- [ ] Question count on program cards ("12 questions indexed")
- [ ] Admin review UI for `import_queue` → promote to `archived_questions`
- [ ] `program_questions` gap for FundingCake programs (pipeline question, not UI)
- [ ] "Suggest a question" flow from program workspace when none are mapped
- [ ] Wire question count into workspace empty state ("No questions indexed yet — submit the form URL to help build the archive")

---

## Priority

- `/archive/questions` browse UI: **P1** — founders need to see what's in the archive
- Import pipeline + program_questions gap: **P2** — important but requires semi-manual work
- Admin review UI: **P2** — needed before scale, fine to do manually in Supabase for now
