# Slide outline — if this becomes a deck

Six slides + a cover. Mirrors the MO§ES™ deck pacing (eyebrow → claim
→ receipt → close).

---

## Slide 1 — Cover

- Title: **Multi-Claude Coordination Substrate**
- Subtitle: *Lane discipline + truth ledger + git as audit*
- One-line: "Multi-AI coordination doesn't need a new transport. It
  needs a lane discipline."
- Visual: a single muted-gold line dividing two session columns

---

## Slide 2 — The wrong substrate

- Eyebrow: THE INDUSTRY IS BUILDING BROKERS
- Headline: *Multi-agent infra is solving transport. The agents
  don't have a transport problem.*
- Two-column compare:
  - **What everyone is building** — message buses · broker protocols ·
    swarm middleware · agent-to-agent permissioning
  - **What agents already have** — filesystem (the repo) · `git`
    history
- Closer: "Filesystem is already the bus. What's left is discipline."

---

## Slide 3 — The substrate

- Eyebrow: THREE FILES + A THREAD
- Diagram: `diagrams/01-architecture.mmd` (sessions → ledgers →
  threads → git)
- Component breakdown table:
  - `claims.yaml` — who's holding which lane
  - `registry.yaml` — what's true right now
  - `SCRATCH.md` — append-only thread
  - `git log` — free durable audit

---

## Slide 4 — Lane lifecycle

- Eyebrow: HOW IT MOVES
- Diagram: `diagrams/02-lane-lifecycle.mmd` (state diagram)
- Below the diagram, the asymmetric-discipline beat:
  *"Reading is mandatory. Writing is conditional."*

---

## Slide 5 — Receipt

- Eyebrow: 2026-05-24 · CLAUDE × CODEX
- Diagram: `diagrams/03-parallel-sessions.mmd` (sequence diagram)
- Stat callouts:
  - 2 sessions, 2 lanes, 0 collisions
  - 22 files restructured + 1 migration shipped, in parallel
  - 0 messages exchanged between sessions
- Closer: "The substrate carried the coordination."

---

## Slide 6 — The substrate frame

- Eyebrow: SAME INSIGHT, DIFFERENT FLOOR
- Two-column compare (mirrors MO§ES™ Slide 2):
  - **AI stack** — volume: tokens through. Signal: commitment
    preserved.
  - **Multi-agent comms** — volume: message buses. Signal: lane state.
- Headline: *Stop measuring volume. Start measuring signal.*

---

## Slide 7 — Roadmap + ask

- Eyebrow: PHASE A LIVE · PHASE B DESIGNED · PHASE C SCOPED
- Three-column timeline:
  - **Phase A · today** — discipline, ledgers, scratch, git audit
  - **Phase B · next** — mechanical enforcement, stale-claim reaping
  - **Phase C · later** — cross-repo claim visibility
- Ask: *Collaboration · work · funding* (consistent with MO§ES™
  governance-vacuum pitch)
- CTA: same channels as MO§ES™ — `mos2es.com`, `burnmydays@proton.me`,
  `@burnmydays`

---

## Cover-back / appendix

- The decision-flow diagram (`diagrams/04-session-start.mmd`)
- Pointer to live `.agents/PROTOCOL.md`
- Pointer to `multi-claude-substrate/` build folder
