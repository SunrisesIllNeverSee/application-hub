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

## Future ratchet

If this protocol proves useful, the next step is an automated checker such as `.agents/check.py` that can validate:
- overlapping file claims
- duplicate unreleased migration claims
- stale sessions
- registry consistency

That enforcement is intentionally deferred for now.
