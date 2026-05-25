# Talking points — Q&A prep

When the pitch lands, these are the most likely follow-ups and the
sharpest answers.

## "Why doesn't this need a broker?"

The broker exists to solve transport. Transport is solved — sessions
share a filesystem. The broker also exists to resolve write conflicts.
That's solved too — `git` does it deterministically. What's left after
those two are removed isn't enough to justify a broker. It's a few
text files.

## "What happens when two sessions claim the same lane?"

Merge conflict on `claims.yaml`. Loud, visible, surfaces on the next
push. Whichever session loses re-reads, picks a different lane, or
walks the other one through SCRATCH. Conflicts surface in seconds, not
hours, because every session reads the ledger on start.

## "What if a session crashes mid-work?"

Its claim sits stale until manually reaped. The next session sees the
stale heartbeat, checks whether the work landed, and either marks the
claim wrapped (if it landed) or picks up the lane (if it didn't). The
operator-on-recovery cost is one glance at the ledger — cheap compared
to designing automated reaping correctly. Phase B will add a stale
threshold to make this mechanical.

## "Couldn't you do this with Linear / GitHub Issues?"

Yes, but you'd lose the git-as-audit property. Linear's history is
opaque to the agents — they can't read it on session start without an
API call. The point of the substrate is that **the same artifact the
agents work on (the repo) is also the coordination ledger.** Adding a
second source of truth re-introduces the synchronization problem you
just removed.

## "How does this scale to N agents?"

It doesn't, in the "thousands of agents per second" sense. It's not
designed to. The substrate scales to "many sessions per day across a
small number of cooperating projects." If you need higher concurrency
than that, you need a real broker, but you also probably don't need
true coordination — you need a job queue, which is a different
problem.

## "Is this a product?"

Not yet. It's a substrate pattern. Productizable shapes:
- A starter `.agents/` template + pre-commit hook bundle other repos
  can drop in
- A small CLI (`agents claim <lane>`, `agents release <lane>`,
  `agents status`) that wraps the file writes
- A hosted Phase C registry for cross-repo coordination
- A VS Code / Cursor extension that surfaces active claims in the
  status bar

The interesting question isn't "should we productize this?" — it's
"is the substrate the right pitch, or is the product?" The substrate
is more defensible (it's the insight). The product is more
investable (it's the surface).

## "How is this different from CRDT / OT?"

CRDT / OT solve concurrent edits to *the same artifact*. We solve
parallel work on *disjoint artifacts*. Different problem. CRDT is for
the case where two sessions both have to write line 47 of the same
file. The substrate is for the case where session A writes file X and
session B writes file Y and they need to know each other exists. The
substrate doesn't try to merge concurrent edits — it tries to prevent
them from being concurrent in the first place via lane claims.

## "How is this different from Aider / Cursor's multi-file workflows?"

Aider / Cursor are *single-session* tools. They operate one editor at
a time. The substrate is *between* sessions. Orthogonal axis — you
can use Aider inside a session that's also reading the substrate.

## "What's the moat?"

Two layers:

1. **Insight moat** — the volume-vs-signal frame applied to
   multi-agent coordination. Most teams are still building brokers.
   Naming this category and getting credit for the substrate
   reframing is a position.
2. **Receipt moat** — running this pattern in production with multiple
   AI surfaces for months gives you operating knowledge no slide
   deck can match. The case studies in `03-case-studies.md` are
   already differentiated from anyone running their first multi-agent
   experiment.

Neither layer is a code moat. They don't need to be — this is
substrate work, not product work.

## "Why am I hearing about this from you and not from Anthropic / OpenAI?"

Because the agent labs are still solving model capability. The
coordination layer is downstream of capability and orthogonal to it.
It doesn't get touched until someone is running multiple agents in
anger. Operators feel this before researchers.

## "What if Anthropic builds this?"

Then the pattern is validated and we still have the receipts and the
operating knowledge. The substrate isn't a code asset that gets
disrupted — it's a discipline that gets adopted. The right outcome is
*everyone* using this pattern. The wedge is being the team that named
it and showed the receipts first.
