# 2-minute pitch

> Every multi-agent infra paper right now is solving the wrong problem.
> They're inventing transport — message buses, broker protocols,
> orchestration daemons, "agent-to-agent" permissioning. The framing
> is: how do agents *talk to each other*?
>
> But agents already share two things. A filesystem — the repo. And a
> durable history — `git`. They don't need a new transport. They need
> a place to claim, a place to check what's true, and a place to talk.
> That's three text files.
>
> Here's the live setup. `claims.yaml` — who's holding which lane
> right now. `registry.yaml` — what's actually true right now: counts,
> migration chain, shipped state. `SCRATCH.md` — append-only thread
> between sessions. Plus `git log` — free durable audit. That's the
> whole coordination layer. No broker. No daemon. No leader election.
>
> The discipline is asymmetric on purpose. **Reading is mandatory.**
> Every session, on start, reads the registry and the claims. **Writing
> is conditional.** A session only writes back when it claims a lane
> or when truth shifts. Conflicts resolve through `git` itself — merge
> conflicts on `claims.yaml` are loud and visible, never silent.
>
> Receipts. On May 24 this year, Claude was restructuring one project
> lane while Codex was shipping a database migration in parallel.
> Two sessions, two claims, two disjoint lanes. Neither session ever
> messaged the other. The substrate carried the coordination — Claude
> read Codex's claim on the migration chain, picked a non-overlapping
> lane, worked it, released. Codex did the same in reverse. Both
> committed, both pushed, zero collision. The `git log` shows the
> interleave; the substrate is the audit.
>
> This is what governance-at-substrate looks like applied to the
> developer-coordination layer. Same insight as MO§ES™ at the
> agent-execution layer: stop measuring volume, start measuring signal.
> Volume here is messages between agents. Signal is the lane state.
> One claim line resolves a whole feature surface. You don't need a
> bus to coordinate AI sessions. You need to know who's holding what,
> what's true, and where to write it down.
>
> The pattern is small enough to memorize, durable enough to survive
> compaction, model swap, or operator absence. Any session that reads
> the substrate cold can pick up where the last one left off. The
> continuity isn't in the session — it's in the repo.
>
> We're building this up the stack. Phase A is the discipline — live.
> Phase B is mechanical enforcement — refuse commits that touch a
> claimed lane without holding the claim, reap stale claims on a
> heartbeat. Phase C is cross-repo visibility — a shared `.agents/`
> repo that any project pulls and pushes claims against. Same
> substrate, wider radius.
>
> What we're showing is that the interesting frontier in multi-agent
> infra isn't transport. It's lane discipline + truth ledger + git as
> audit. Everything else is implementation detail that emerges
> naturally once you accept the substrate.

## Pacing notes

| Beat | Duration | Cue |
| --- | --- | --- |
| Wrong-problem reframe | 0:00 – 0:20 | open hard, no setup |
| What agents actually share | 0:20 – 0:35 | filesystem + git |
| The three files | 0:35 – 0:55 | name them concretely |
| The asymmetric discipline | 0:55 – 1:10 | reading mandatory, writing conditional |
| **Receipts** (Claude × Codex 2026-05-24) | 1:10 – 1:35 | this is the load-bearing moment |
| Substrate frame tie-in | 1:35 – 1:50 | echo MO§ES™ volume-vs-signal |
| Roadmap (Phase A/B/C) | 1:50 – 2:00 | quick, only if time |
| Close | 2:00 | "lane discipline + truth ledger + git as audit" |

If they want to cut it to 90 seconds: drop the roadmap. If they want
to cut to 60: drop the roadmap AND the asymmetric-discipline beat,
and tighten the receipts.
