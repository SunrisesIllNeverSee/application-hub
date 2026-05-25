# 04 · Roadmap

The substrate is currently in **Phase A**. The shape of Phase B and C
is known; the work is sequencing, not invention.

---

## Phase A — Discipline (current)

**Status:** ✅ Live and load-tested.

What exists:

- `.agents/PROTOCOL.md` — the human-readable rulebook
- `.agents/registry.yaml` — machine-readable truth ledger
- `.agents/claims.yaml` — machine-readable claim ledger
- `.agents/check.py` — pre-commit hook validating registry consistency
- `STATUS.md` — human-readable mirror of the registry
- `SCRATCH.md` — repo-local append-only thread
- `~/Desktop/MULTI_CLAUDE.md` — cross-workspace bus on operator machine

What sessions are expected to do (by convention, not enforcement):

1. Read `registry.yaml` + `claims.yaml` + `SCRATCH.md` on start
2. Claim a lane before touching it
3. Update `registry.yaml` if counts / migration chain / shipped state
   shifts
4. Release claim with `released_at` on completion
5. Append meaningful release notes when wrapping

**Receipts:**
- 2026-05-11 → Claude × Cowork × Codex × mcp-eval × Devin parallel run
- 2026-05-24 → Claude × Codex parallel run (qaapplication restructure
  + migration 047)

**Limit:**
Discipline is human (or AI-following-instructions). Nothing
mechanically prevents a session from skipping the claim step.

---

## Phase B — Enforcement

**Status:** ⬜ Designed, not built.

What it adds: mechanical enforcement of the Phase A discipline.

| Capability | Mechanism | Cost to build |
| --- | --- | --- |
| Refuse commits that touch a claimed lane without holding the claim | Pre-commit hook extends `check.py` to diff staged paths against active claims | low (few hundred LOC) |
| Reap stale claims after a heartbeat timeout | A "claim health" job — runs on every session start, marks claims stale after N hours, surfaces them for explicit human/AI reaping | low |
| Validate claim shape on commit | Pre-commit JSON-schema validation of `claims.yaml` | trivial |
| Auto-update `registry.yaml` heartbeat when a session commits | Git hook updates `sessions[<id>].heartbeat` to current UTC on every commit | trivial |
| Visible lane map | A `make lanes` or `scripts/lanes.py` command renders the current claim state as a tree | low |

**Why it matters for the pitch:**
Phase A is a discipline. Phase B turns the discipline into a guard
rail. The leap from "agents follow protocol" → "agents physically
cannot violate protocol" is the difference between trust and
verification.

---

## Phase C — Cross-repo visibility

**Status:** ⬜ Future, scope-open.

What it adds: claims and registries that span multiple repos.

Today, `.agents/` lives inside one repo. If Claude is in repo A and
Codex is in repo B and they're coordinating on a multi-repo refactor,
the substrate doesn't reach across the gap. Today's workaround is
`~/Desktop/MULTI_CLAUDE.md` — a single text file on the operator
machine that any session can read and write to.

What Phase C could look like:

| Option | Shape | Trade-off |
| --- | --- | --- |
| **Operator-side bus** (current) | One markdown file on the operator's filesystem | Works today; doesn't survive operator-machine boundary |
| **Shared `.agents/` repo** | A separate git repo (`agents-coordination`) that every project pulls/pushes claims to | Survives machine boundary; adds a sync step |
| **Hosted registry service** | A small HTTP service backed by sqlite that any session can `claim` / `release` against | True cross-machine; introduces a service to operate |
| **Linear / GitHub Issues as the ledger** | Use existing project-mgmt tooling as the claim store | Zero new infra; loses the git-as-audit property |

The pragmatic Phase C is probably the **shared `.agents/` repo** —
preserves the git-as-audit property, no new service to run, sync is
just `git pull` / `git push`.

---

## Phase D (speculative) — Cross-vendor

**Status:** ⬜ Speculative.

If the substrate ever generalizes beyond Claude / Codex / Cowork /
Devin to include sessions from other vendors (OpenAI agents, custom
LangChain runs, etc.), the discipline doesn't change — only the
client-side adapter for "how does this session read/write the
ledger" changes. The substrate itself is vendor-neutral by
construction. It's just text files in a git repo.

---

## Decision points for the operator

1. **Build Phase B now or after more Phase A receipts?** Phase A has
   2 documented parallel-session pairs. More receipts make the pitch
   stronger but delay enforcement. Recommend: build Phase B *just*
   far enough to catch the obvious failure modes (claim-shape
   validation + heartbeat auto-update) — leave reaping manual until
   it actually hurts.
2. **Phase C now or never?** Phase C only matters if multi-repo
   coordination becomes regular. Today the
   `~/Desktop/MULTI_CLAUDE.md` workaround is fine. Defer.
3. **Pitch the live Phase A first?** Yes. Phase A is the surprising
   part. Phase B / C are obvious extensions once you accept the
   premise.
