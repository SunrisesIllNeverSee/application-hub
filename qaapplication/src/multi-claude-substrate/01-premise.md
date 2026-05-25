# 01 · Premise

> **Multi-AI coordination doesn't need a new transport.
> It needs a lane discipline.**

## The wrong substrate

Every multi-agent infrastructure paper currently being written treats
the problem as transport: how do agents *talk to each other*? The
answers all reach for the same toolbox — message buses, broker
protocols, orchestration daemons, swarm middleware, "agent-to-agent"
permissioning frameworks.

This solves a problem the agents don't actually have. AI sessions —
Claude in one window, Codex in another, Cowork on a third surface —
already share two things:

1. **A filesystem** (the repo).
2. **A durable history** (`git`).

They don't need a new transport. They need a **place to claim**, a
**place to check what's true**, and a **place to talk**.

## The right substrate

Three text files and an append-only thread:

| File | Role |
| --- | --- |
| `.agents/claims.yaml` | Who is holding which lane right now |
| `.agents/registry.yaml` | What is true right now (counts, migrations, shipped state) |
| `SCRATCH.md` / `MULTI_CLAUDE.md` | Append-only conversation between sessions |
| `git log` | Free, durable audit of every claim / release / truth change |

That's the whole coordination layer. No daemon. No broker. No
scheduler. No leader election.

## Why it works

- **Filesystem is already the bus.** Every file change is observable
  via `git status`. No new transport needed.
- **Git history is the durable audit log.** Every claim, release, and
  truth update is a commit. Provenance is free.
- **Lane-level granularity beats message-level granularity.** Sessions
  don't need to negotiate fine details. They need to know who's
  holding what. One claim line resolves a whole feature surface.
- **First-write-wins resolves conflicts deterministically.** Merge
  conflicts on `claims.yaml` are loud and visible. No silent races.
- **The human stays in the loop without being on the critical path.**
  Operator reads `STATUS.md` once a day; sessions read the registry
  every start. Decoupled.

## The substrate frame

This is the same pattern as MO§ES™ at the agent-coordination layer:

| | Volume view | Signal view |
| --- | --- | --- |
| **AI stack** | Tokens through, latency, MRR | Commitment preserved, lineage continuity |
| **Multi-agent comms** | Message buses, brokers, "swarm" orchestration | Lane claim, truth ledger, git audit |
| **What it measures** | Activity | Whether work survives parallel execution |
| **What you build** | Middleware | A few text files + a discipline |

The multi-claude substrate is what governance-at-substrate looks like
when applied *to the developer-coordination layer* instead of the
agent-execution layer. Same insight, different floor.

## Receipt

The qaapplication restructure (this lane) ran *in parallel* with
Codex's Supabase migration 047 work on 2026-05-24 without colliding.
Two sessions, two claims, two disjoint lanes. Neither session ever
needed to know what the other was doing in detail — they only needed
to know the lane boundary. The substrate carried the rest.

See [`03-case-studies.md`](03-case-studies.md) for the run-through.
