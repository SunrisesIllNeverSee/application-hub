# Agent Coordination Protocol

This repo operates in a nonlinear and temporal way, but the coordination rules should still be crisp.

The goal is simple:
- machine-readable truth
- machine-readable claims
- humans spend judgment on direction, not bookkeeping

## Current mode

This is the **Phase A scaffold**:
- `.agents/registry.yaml` is the machine-readable truth ledger
- `.agents/claims.yaml` is the machine-readable claim ledger
- `STATUS.md` is the human-readable truth report
- `~/Desktop/MULTI_CLAUDE.md` is the cross-workspace coordination bus on the operator machine

There is **no automated enforcement yet**. Sessions should still follow this protocol manually.

## On session start

1. Read `.agents/registry.yaml`
   - if you mention counts, migration chain, or shipped-state facts, use these values
2. Read `.agents/claims.yaml`
   - identify active sessions and unreleased claims
3. Read `SCRATCH.md`
   - repo-local active claims only
4. Read `STATUS.md`
   - human-readable truth and confirmed live state

## To work on a file lane

1. Check `.agents/claims.yaml` for overlapping unreleased `file_lane` claims.
2. If overlap exists, avoid the lane or coordinate first.
3. If clear, append a new claim entry and commit it with a small claim commit.
4. Release the claim by setting `released_at` once the work lands.

## To add a migration

1. Read `migrations.next` in `.agents/registry.yaml`.
2. Claim that number in `.agents/claims.yaml` **before** writing SQL.
3. Land the migration.
4. Update:
   - `migrations.next`
   - `migrations.applied`
5. Release the claim.

Do not rename already-applied migration files just to resolve old duplicate prefixes.

## To release a claim

- set `released_at`
- add landed commit ids if known
- commit the release

## Heartbeat

For longer-running sessions, update `heartbeat` when work resumes after a meaningful gap.

If a session is obviously stale, the next session may mark it wrapped or released with a note.

## Truth policy

- quantitative facts live in `.agents/registry.yaml`
- `STATUS.md` is the readable mirror/report
- other docs should summarize or link instead of keeping their own competing fact tables

## Review-gate policy

Use a review gate when a change crosses:
- repo docs
- desktop coordination
- README/public framing
- active memory / session protocol

Do not require a heavy multi-reviewer gate for every archive move or tiny doc cleanup.

## Phase B — Enforcement (landed 2026-05-11)

`.agents/check.py` is the automated checker. Run from repo root:

```bash
python3 .agents/check.py             # human-readable report
python3 .agents/check.py --strict    # treat warnings as blockers (CI mode)
python3 .agents/check.py --json      # machine-readable
```

What it validates:

- migrations on disk match `registry.yaml.migrations.applied`
- `migrations.next` is one greater than the highest applied number
- no two active claims hold the same file lane
- no active migration-number claim duplicates an applied number
- sessions marked `active` have heartbeat within 24h
- released claims have at least one `landed_commits` entry
- `STATUS.md` migration chain reference matches the registry high-water mark

Exit codes: `0` clean, `1` warnings (advisory), `2` blockers (CI red).

Suggested workflow: run `python3 .agents/check.py` before opening a PR. Pipe to `--strict` in CI once the registry is brought fully into sync with the filesystem.

## Stripe smoke helper

`.agents/stripe-smoke.sh` checks that all 8 Stripe + cron env vars are set in Vercel production and prints the next-step manual verification steps (test card flow + SQL to confirm subscription sync). Run any time you want to confirm the env layer is intact without making real charges.

## Phase C — Hardening (landed 2026-05-11)

The Phase B checker is now wired into both git and CI.

### Pre-commit hook

Install once per clone:

```bash
.agents/install-hook.sh             # default — only blockers fail
.agents/install-hook.sh --strict    # warnings also fail
.agents/install-hook.sh --uninstall # remove
```

The hook runs `python3 .agents/check.py` before every commit. Skip for a single commit with `git commit --no-verify` (use sparingly — that's how the registry drifts in the first place).

### CI workflow

`.github/workflows/agents-check.yml` runs on every PR + push to main. Currently in advisory mode (blockers fail, warnings annotate). Once the existing warnings are reconciled by the registry owner, flip the workflow step from `python3 .agents/check.py` to `python3 .agents/check.py --strict` and warnings become blockers.

### Stale-session policy

The checker flags `active` sessions with heartbeat older than 24h. By policy: any session may mark another session `wrapped` if its heartbeat is more than 7 days stale, with a short note in the YAML comment. Not auto-corrected (intentionally human-in-the-loop).

### Phase D — possible next ratchet

If Phase C proves useful:

- auto-reconcile mode (`check.py --fix`) that rewrites `registry.yaml.migrations.applied` to match the filesystem
- registry-as-canonical pre-commit hook that refuses commits introducing migrations not claimed in `claims.yaml`
- session activity heatmap in a Grafana-style status page
