# 03 · Case Studies

Real parallel-session runs through the substrate. These are the
receipts — actual git history, actual claim entries, actual outputs.

---

## Case 1 — Claude × Codex (2026-05-24)

**Surfaces:** vscode-claude (Opus 4.7) on qaapplication/ + Codex CLI on
supabase/migrations/

**Goal in flight:**
- Claude: restructure qaapplication into the canonical pipeline
  (numbered lanes, bare-form-vs-filled split, themed answer index)
- Codex: ship migration 047 (manual-first intake workflow — staged
  submissions, gate reviews, append-only intake events)

**Disjoint lanes:**
- Claude lane: `qaapplication/**`
- Codex lane: `supabase/migrations/047_*`, `.agents/registry.yaml` for
  `migrations.next` bump

**Sequence:**

1. Claude opens repo, reads `.agents/registry.yaml` — sees
   `migrations.next: 47`. Notes Codex active on the migration chain.
2. Codex opens repo, reads `claims.yaml` — sees no claim on
   qaapplication.
3. Claude appends a claim line:
   `qaapplication/* — restructure into pipeline lanes`.
4. Codex appends a claim line:
   `supabase/migrations/047_*`.
5. Both work in parallel.
6. Codex lands migration 047, commits, bumps `registry.migrations.next`
   to 48 in the same commit.
7. Claude commits qaapplication restructure separately.
8. Both push. No merge conflict — disjoint paths.
9. Both release claims with `released_at` markers.

**Result:**
- 22 files changed in qaapplication, 1235 insertions / 664 deletions
  (commit `c0f0e2a`).
- Migration 047 landed (`047_manual_intake_workflow.sql`).
- Zero coordination overhead beyond the claim line.
- `.agents/check.py` passed clean on both commits.

**Lesson:**
Two sessions never spoke. Coordination happened entirely through the
ledger. The merge graph in git shows the interleave; both branches
were always rebase-able onto each other because the file lanes never
touched.

---

## Case 2 — Claude × Cowork (2026-05-11)

**Surfaces:** vscode-claude + Cowork (Anthropic's parallel agent
surface)

**Goal in flight:**
- Both sessions exploring the same registry but operating on different
  feature surfaces (intelligence layer RPC work vs. plugin-eval CI
  fix).

**Lane shape:**
- Claude lane: `app/intelligence/*` + RPC scaffolding
- Cowork lane: `plugin-eval/*` + `.github/workflows/`

**Coordination event of note:**
Cowork session noticed a stale claim on `app/intelligence/` from a
prior wrapped session and *did not* touch it until the heartbeat was
manually marked `wrapped` in `claims.yaml`. This is the substrate
working: the stale-claim cost was a 30-second human glance, not a
silent race condition.

**Lesson:**
Heartbeat staleness is a feature, not a bug. A claim that hasn't been
released yet is a warning sign: either the session is still active
(check the timestamp) or it crashed (manually reap). Either way, the
discipline keeps work safe.

---

## Case 3 — Claude × mcp-eval (2026-05-11)

**Surfaces:** vscode-claude + mcp-eval session (Claude Opus 4.7 on the
MCP server's plugin-eval surface)

**Goal in flight:**
- mcp-eval: plugin-eval 100/100, logic extractions, CI fix
- Claude: continuing app-layer work

**Lane shape:**
- mcp-eval lane: `application-hub-mcp-server/`
- Claude lane: `app/`

**Outcome:**
Both sessions wrapped clean. mcp-eval added a note to its claim entry:
"Claude Opus 4.7 — plugin-eval 100/100, logic extractions, CI fix,
coordination sync." That note is now durable history in
`claims.yaml` — future sessions can see *what* the prior session
considered done, not just *that* it wrapped.

**Lesson:**
Claim entries are cheap places to record the *substance* of what
shipped, not just the fact of release. This compounds. Future sessions
reading the ledger get a curated changelog "for free."

---

## What every case shows

1. **No transport was invented.** Sessions never messaged each other.
2. **Truth was always pullable.** Any session, opened cold, could
   read the registry + claims and know enough to act safely.
3. **The receipts are in `git`.** Every coordination event is a
   commit. The audit log is free.
4. **Stale claims surface as warnings**, not silent races. Recovery
   is cheap.
5. **Notes on claims compound.** The ledger doubles as a curated
   changelog when sessions write meaningful release notes.
