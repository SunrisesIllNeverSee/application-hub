# Repo Cleanup Review Gate

_Published 2026-05-11_

This document is the **canonical cleanup spec** for the next repo-organization pass.

No cleanup implementation starts until Claude/Cowork and Devin have had a chance to review and comment on this plan.

---

## Summary

Create a single canonical cleanup plan for the repo and cross-workspace coordination layer, then place the work under a **full review hold** before any mutations begin.

This cleanup effort will cover:

- repo-tracked documentation and coordination files
- `~/Desktop/MULTI_CLAUDE.md` cross-workspace coordination
- root-level repo organization
- documentation consolidation / archival
- a polished product-forward README with real badges and cleaner entrypoints

**Execution rule:** no cleanup edits, file moves, rewrites, or archival actions begin until Claude/Cowork and Devin have had a chance to review and comment on this plan.

---

## Review Gate

### Mandatory hold

Before any implementation starts:

1. Publish this plan as the canonical cleanup spec.
2. Point Claude/Cowork and Devin to it for review.
3. Collect comments on:
   - canonical source-of-truth files
   - archive moves
   - root-level doc structure
   - README framing and audience
   - coordination file responsibilities
4. Resolve disagreements in the plan itself.
5. Only after that, begin implementation.

### What is blocked during the hold

Until review is complete:

- no file edits
- no file moves/renames
- no archive promotions
- no README rewrite
- no coordination-doc rewrites
- no cleanup commits

### Expected review outcome

The plan should emerge with agreement on:

- which docs are canonical
- which docs are archived or renamed
- what lives in repo vs `~/Desktop/MULTI_CLAUDE.md`
- README audience and section structure
- commit sequencing for implementation

---

## Key Changes

### 1. Coordination and project-memory sync

Normalize the project-memory layer so repo docs and desktop coordination stop drifting.

Files in scope:

- `CLAUDE.md`
- `AGENTS.md`
- `SCRATCH.md`
- `STATUS.md`
- `TASKS.md`
- `ROADMAP.md`
- `README.md`
- `~/Desktop/MULTI_CLAUDE.md`

Target outcomes:

- all files agree on **21 MCP tools**
- all files agree on migration chain through **026**
- all files reflect:
  - `answer_reviews`
  - `hub_save_answer_review`
  - persisted stress-test support via `persist_result=true`
  - first reviewer agent
  - `/review-answer` command
- repo-local memory and desktop memory have distinct jobs:
  - `SCRATCH.md` = repo-local active claims
  - `~/Desktop/MULTI_CLAUDE.md` = cross-workspace/session coordination

### 2. Documentation structure cleanup

Reduce clutter and duplication in docs.

#### Keep active and canonical

- `README.md`
- `ROADMAP.md`
- `TASKS.md`
- `STATUS.md`
- `VISION.md`
- `AGENTS.md`
- `CLAUDE.md`
- `SCRATCH.md`
- active operational docs in `docs/06` through `docs/16`

#### Consolidate or rename ambiguous docs

The current obvious cleanup target is the duplicate `docs/15_*` pair:

- `docs/15_application_intake_taxonomy.md`
- `docs/15_curated_ingest_lane.md`

Review should decide one of:

- keep both, but rename them so their purposes are unmistakable
- keep one canonical and archive the other
- merge them if one is mostly subsumed by the other

#### Archive policy cleanup

Expand `docs/archive/README.md` so it defines:

- what qualifies for archive
- naming conventions for archived files
- when to archive vs revise in place
- which active docs should never be duplicated elsewhere

### 3. Root-level repo organization

Reduce top-level noise while preserving important entrypoints.

Recommended root-level keep set:

- `README.md`
- `ROADMAP.md`
- `TASKS.md`
- `STATUS.md`
- `VISION.md`
- `AGENTS.md`
- `CLAUDE.md`
- `SCRATCH.md`
- `CONTRIBUTING.md`

Review should decide whether any of these are stale enough to:

- move under `docs/`
- merge into another file
- stay root-level because they are session-critical

Likely review targets:

- `ARCHITECTURE.md`
- `PROGRAMS.md`
- `SECURITY.md`

### 4. README redesign

Replace the current README with a more intentional **polished product** README.

#### Badge set

Use real, low-noise badges only:

- GitHub Actions CI
- Next.js
- Supabase
- TypeScript
- MCP
- Vercel

Avoid vanity or manually maintained status badges.

#### Target README structure

1. Project name + one-line thesis
2. badges row
3. product framing
4. what the platform does
5. who it is for
6. current live state
7. architecture at a glance
8. quick start
9. repo guide
10. MCP / agent surface
11. contributing / operating links
12. portability / vision note

#### README constraints

- product-forward, not overly dev-heavy
- no duplication of `TASKS.md` or `ROADMAP.md`
- short sections
- clean links to deeper docs
- one concise architecture diagram at most

### 5. Review and implementation workflow

After review approval, implementation should happen in small commits:

1. `coordination-sync`
   - memory docs
   - counts
   - source-of-truth alignment

2. `docs-structure`
   - archive README
   - doc renames / moves / consolidation

3. `readme-redesign`
   - badges
   - new structure
   - public-facing polish

4. `final-memory-pass`
   - `CLAUDE.md`
   - `AGENTS.md`
   - `SCRATCH.md`
   - `~/Desktop/MULTI_CLAUDE.md`

Use:

- `claude-md-management` for memory/doc quality checks
- GitHub issue or PR for centralized comments/review
- `Superpowers` discipline for phased execution after approval

---

## Test Plan

### Before implementation

- reviewers confirm canonical active docs
- reviewers confirm archive policy
- reviewers confirm README audience and structure
- reviewers confirm repo vs desktop coordination split

### After implementation

- search for stale references:
  - `20 tools`
  - `001–015`
  - “stress-test is read-only”
  - outdated open-gap language for review write-back
- verify all internal links in README resolve
- verify `docs/archive/README.md` matches actual archive usage
- verify no duplicated “source of truth” claims remain across active docs

### Hygiene checks

- `git diff --check`
- `cd application-hub-mcp-server && npm run check`
- run app build checks only if implementation changes app-facing claims enough to warrant revalidation

---

## Assumptions and defaults

- Scope includes both the repo and `~/Desktop/MULTI_CLAUDE.md`.
- Cleanup is under a **full hold** until others review.
- README target is **polished product**, not dev-first or investor-first.
- Archive should preserve history, not erase it.
- `SCRATCH.md` remains repo-local active memory.
- `~/Desktop/MULTI_CLAUDE.md` remains cross-workspace coordination memory.
- No implementation should begin until Claude/Cowork and Devin have had a chance to weigh in on this exact plan.
