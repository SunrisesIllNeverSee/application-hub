# 30-second pitch

> Most multi-agent infra papers are inventing transport — message
> buses, broker protocols, swarm middleware. They're solving a problem
> the agents don't have. Claude in one window and Codex in another
> already share a filesystem and a git history. What they need is a
> *lane discipline*: a place to claim, a place to check what's true,
> and a place to talk. We've been running parallel AI sessions in
> production on three text files and an append-only thread. `git log`
> is the audit. No broker, no daemon, no scheduler. Two sessions on
> the same repo, never colliding, because the substrate carries the
> coordination instead of a protocol.

## Beat structure

1. **The premise everyone is reaching for** — message buses, brokers.
2. **The reframe** — agents already share filesystem + git.
3. **The substrate** — three files + a thread.
4. **The receipt** — parallel sessions in production, never collided.
5. **The frame** — "the substrate carries the coordination instead of
   a protocol."

## Delivery notes

- Don't rush the reframe beat — it's the load-bearing one.
- "Receipts" is the word. Avoid "case study" / "use case" — sounds
  like a deck.
- Land on the "substrate carries the coordination" closer. It echoes
  the broader MO§ES™ frame.
