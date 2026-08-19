---
type: Reference
title: REPAIR PLAN v2 — application-hub repo rehabilitation
description: REPAIR PLAN v2 — application-hub repo rehabilitation — documentation in docs/.
tags: [documentation, docs]
timestamp: 2026-08-19
---

# REPAIR PLAN v2 — application-hub repo rehabilitation

> **Regenerated:** 2026-08-12 (v2) by the Devin audit session after the v1 file was lost uncommitted.
> **Living document:** this file is the loop. At each session start, read it top to bottom. At each phase completion, update the status markers and commit this file alongside the phase's work.
> **For:** the assistant/session executing the repair, and Deric (operator) who approves each checkpoint.

## Status board

| Phase | State | Notes |
|---|---|---|
| 1 — Preserve | ✅ **COMPLETE** | commit `33c39a4` on `repair/2026-08-12-preservation`, pushed to origin. Backup: `~/backups/apphub-prerepair-2026-08-12.tgz` (53M) |
| 2 — Re-attach + ff | ✅ **COMPLETE** | `main` fast-forwarded `d101c18` → `bb56cf1`. Runbook v2 committed `e18f608` on repair branch, pushed. |
| 3 — Fresh clone | ✅ **COMPLETE** | Fresh clone at canonical path, fsck-clean, all Checkpoint B gates green (type-check, MCP check, check.py 0 blockers/19 warnings). Old clone renamed `application-hub-CORRUPT-keep`. Preservation merged to main (`c7c2924`). |
| 3.5 — Wolfram review import | ✅ **COMPLETE** | 14-file package at `docs/reviews/2026-08-11-aqua-wolfram/`. Four actions wired: TASKS.md hardening priorities, CLAUDE.md conservation rule, SCRATCH.md FundingCake pre-flight note, regeneration path documented. |
| 4 — Coordination sync | ✅ **COMPLETE** | Two codex claims (047 `7ab4462`, 048 `2378c78`) moved to Recently released in SCRATCH.md + claims.yaml. Stale mcp-eval Appfeeder line removed. "Current state" migration chain fixed to 048/049. check.py: 0 blockers, 19 warnings. |
| 5 — Archival banner | ✅ **COMPLETE** | Deric chose (a) active build. CLAUDE.md + STATUS.md banners reworded: archive event historical, repo is active build, synthesized-data caveat for 30 seeded programs retained. |
| 6 — START_HERE refresh | ✅ **COMPLETE** | "Key facts" replaced with pointer to registry.yaml + STATUS.md. "Seed embeddings" section deleted (done since May, 768d nomic-embed-text). |
| 7 — Legacy migrations doc | ✅ **COMPLETE** | `docs/MIGRATIONS.md` rewritten with legacy root provenance table (022/033 byte-identical, 042/043 collide with canonical). Live-DB verification SQL provided for Deric. Duplicate `26_` doc renumbered: `26_fundingcake_ingest_pipeline.md` → `30_`. References in SCRATCH.md + qaapplication/src/seeding-plan.md updated. |
| 8 — Local-junk decisions | ✅ **COMPLETE** | `qaapplication/.claude/` added to `.gitignore` (tool-local settings). `qaapplication/tmp/` kept in history per Deric's decision. 19 lane warnings out of scope (clear when August outreach lanes completed). | |

---

## §0 — Ground facts (as of v2)

- Repo path: `/Users/dericmchenry/Developer/built/application-hub`
- Remote: `https://github.com/SunrisesIllNeverSee/application-hub.git`
- `main` at `d101c18`; `origin/main` at `bb56cf1` (1 ahead — fast-forward possible, not diverged).
- Object store corrupt (missing commit `f928f4b8…`, broken tree links) → this clone is being **replaced** in Phase 3, not repaired in place.
- Only intentionally-untracked path: `qaapplication/.claude/` (local tool settings).
- Pre-commit hook is **strict mode** → 19 known qaapplication lane warnings block commits. See hook policy below.

### Hook policy (binding for all phases)

1. `--no-verify` is sanctioned for specific commits marked in this plan, with the reason in the commit message.
2. Any other commit blocked by the 19 lane warnings: either `--no-verify` with a note, or Deric approves dropping the hook to default (blocker-only) mode.
3. **Never** create empty/stub lane files to silence warnings — that corrupts tracker semantics to satisfy a linter.

## §0.1 — Rules for the executing assistant

1. Read `AGENTS.md`, `.agents/PROTOCOL.md`, `SCRATCH.md` first (repo protocol).
2. **No `git push` without Deric's explicit go**, except the already-approved preservation branch updates.
3. Never rename files under `migrations/` or `supabase/migrations/`.
4. Delete nothing except where explicitly marked; the corrupt clone is kept until Checkpoint C.
5. Commit style: `chore(repair): …` so this operation is greppable.

---

## Phase 1 — Preserve ✅ COMPLETE

Done: tarball `~/backups/apphub-prerepair-2026-08-12.tgz`; branch `repair/2026-08-12-preservation` (`33c39a4`, 99 files — August qaapplication work, path fixes) pushed to origin. `qaapplication/.claude/settings.local.json` intentionally untracked.

## Phase 2 — Finish re-attaching main 🔶

```bash
cd /Users/dericmchenry/Developer/built/application-hub
git fetch origin
git merge --ff-only origin/main   # must fast-forward to bb56cf1; if not, STOP
git log --oneline -3              # expect bb56cf1 on top
```

**v2 addition — commit this runbook to the repair branch** (keeps the loop document in git, rides the Phase 3e merge into the fresh clone):

```bash
git switch repair/2026-08-12-preservation
git add REPAIR_PLAN.md
git commit -m "chore(repair): regenerate runbook v2 — status board, wolfram import phase, hook policy"
git push
git switch main
```

## Phase 3 — Replace the corrupt clone ⬜

```bash
cd /Users/dericmchenry/Developer/built
git clone https://github.com/SunrisesIllNeverSee/application-hub.git application-hub-verified
cd application-hub-verified
git fsck --no-progress | head -5    # expect NO missing/broken errors

# carry local-only state
OLD=/Users/dericmchenry/Developer/built/application-hub
NEW=/Users/dericmchenry/Developer/built/application-hub-verified
cp "$OLD/app/.env.local" "$NEW/app/.env.local"
cp -R "$OLD/qaapplication/.claude" "$NEW/qaapplication/"
# check for any other .env files in OLD root / mcp server and copy if present

# reinstall + verify
cd "$NEW" && npm install
cd "$NEW/app" && npm install && npm run type-check
cd "$NEW/application-hub-mcp-server" && npm install && npm run check
cd "$NEW" && .agents/install-hook.sh --strict && python3 .agents/check.py

# land the preserved work + runbook on main
git switch main
git merge --no-ff repair/2026-08-12-preservation \
  -m "chore(repair): merge preserved Aug 2026 qaapplication work + runbook into main"
```

**Checkpoint B — all must pass in the NEW clone before swap:** fsck clean · app type-check green · MCP check green · check.py 0 blockers (19 lane warnings expected) · tree clean except `?? qaapplication/.claude/` · spot-check `qaapplication/07-apply/yc-fall-2026.md` + `tracker.md` contain Aug 2026 content.

```bash
cd /Users/dericmchenry/Developer/built
mv application-hub application-hub-CORRUPT-keep
mv application-hub-verified application-hub
```

**Checkpoint C (Deric sign-off):** after a few days of confirmed work in the new clone — delete `application-hub-CORRUPT-keep` (tarball remains), push `main` (CI will run).

## Phase 3.5 — Wolfram review import ⬜ NEW IN v2

First content commit of the fresh clone. The package is a dated, immutable audit artifact — import verbatim, hand-edit nothing.

```bash
cd /Users/dericmchenry/Developer/built/application-hub   # the NEW clone, post-swap
mkdir -p docs/reviews
cp -R "/Users/dericmchenry/Downloads/aqua-wolfram-review 2" docs/reviews/2026-08-11-aqua-wolfram
git add docs/reviews/2026-08-11-aqua-wolfram REPAIR_PLAN.md
git commit --no-verify -m "docs(review): import Aqua x Wolfram structural review (2026-08-11 snapshot)

14-file package: entity inventory, relation matrix, transformation registry,
state/conservation/dependency/crosswalk/phase models, wolfram prompt pack,
findings, computational results, integrated review. Files 01-08 are derived
snapshots (rot on next migration); 09-13 are durable method + invariants."
```

Then wire the four actions (separate commit):

1. **TASKS.md** — new entries: promotion registry (intake→archive identity bridge); representation crosswalk contract; provenance bridge (intake_events ↔ lineage_events); `algorithm_version` on derived scores.
2. **CLAUDE.md** — one line under "Don't do these things": no downstream statement may carry stronger factual status than its strongest upstream source (link to the review).
3. **FundingCake Phase C** — the review's #1 critical boundary (`finalized → promoted` identity bridge) becomes the pre-flight check before promoting the 39 staged rows. Note this in SCRATCH.md next to the HOLD item.
4. Regeneration path — `09_wolfram_analysis_prompts.md` is the instrument to re-run after the next migration batch.

## Phase 4 — Coordination sync ⬜

1. **SCRATCH.md** — move the two landed codex claims (047 manual intake, 048 security invoker; landed `2378c78` for 048, find 047 via `git log --oneline -- supabase/migrations/047_manual_intake_workflow.sql`) to Recently released; remove stale mcp-eval Appfeeder line; fix "Current state" migration chain to 048 applied / next 049.
2. **`.agents/claims.yaml`** — append released entries for both codex claims with `released_at` + `landed_commits`; bump `updated_at`.
3. `python3 .agents/check.py` → expect 19 lane warnings, 0 blockers.
4. Commit (hook policy applies): `chore(coordination): release landed codex claims, sync SCRATCH state with registry`.

## Phase 5 — Archival banner ⬜ DECISION REQUIRED (Deric)

CLAUDE.md + STATUS.md still carry the 2026-05-14 "ARCHIVAL" banner, but the rebuild (migrations 042–046) and all later work landed in this repo.

- **(a) Repo is the active build** → reword banners: archive event is historical; synthesized-data caveat for the original 30 seeded programs still applies; drop "do not develop here".
- **(b) Repo remains the archive** → then `qaapplication/` and post-May work need a home decision. Do not move anything without Deric.

## Phase 6 — START_HERE.md refresh ⬜

Replace the stale "Key facts" section (claims migrations 001–031, 843 programs, "embeddings not done", BYOK without Google) with pointers to `.agents/registry.yaml` + `STATUS.md`. Delete the "Seed embeddings (one-time, not done yet)" section — done since May (768d, nomic-embed-text).

## Phase 7 — Legacy root migrations documentation ⬜

Root `migrations/` holds 4 tracked files; `042_persona_profiles.sql` / `043_smart_matcher.sql` numerically collide with canonical `supabase/migrations/042/043` (different content). **Do not rename.** Instead: extract object names from both files → check live DB (Supabase MCP `execute_sql` on `information_schema`, or ask Deric) whether they were applied → record outcome in `docs/MIGRATIONS.md` (root = frozen legacy; canonical chain = `supabase/migrations/`). Also renumber the duplicate `26_` doc prefix in `docs/` (docs are safe to rename).

## Phase 8 — Local-junk decisions ⬜ DECISION REQUIRED (small)

- `qaapplication/.claude/` → recommend adding to `.gitignore`.
- `qaapplication/tmp/` (3.6M, committed in Phase 1 for safety) → keep in history, or `git rm -r --cached` + `.gitignore`.
- 19 lane warnings → out of scope here; they clear when the August outreach lanes are actually completed.

---

## Final checklist

- [x] New clone at canonical path, fsck-clean, hook installed, all verifications green
- [x] August work + runbook merged to main; pushed after Checkpoint C (preservation branch pushed; main push pending Deric sign-off)
- [x] Wolfram package imported at `docs/reviews/2026-08-11-aqua-wolfram/` + four actions wired
- [x] SCRATCH/claims synced; check.py shows only the 19 known lane warnings
- [x] Banner resolved per Phase 5; START_HERE fact-free; MIGRATIONS.md records legacy provenance
- [x] `~/backups/apphub-prerepair-2026-08-12.tgz` kept until Deric deletes it

### Remaining (Deric's call)

- [ ] Checkpoint C: after a few days of confirmed work in the new clone, delete `application-hub-CORRUPT-keep` (tarball remains as fallback)
- [ ] Checkpoint C: push `main` to origin (CI will run agents-check + build jobs)
- [ ] Phase 7 follow-up: run the live-DB verification SQL in `docs/MIGRATIONS.md` to confirm whether legacy 042/043 objects exist on Supabase
