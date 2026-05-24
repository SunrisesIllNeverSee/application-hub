# qaapplication — Application Processing Workspace

Capture, document, draft, and submit real-world applications (jobs,
accelerators, grants, fellowships, funds, schools). Then index questions
and answers across programs so the next application is faster to fill out.

## Folder map (sequential by lifecycle)

```text
qaapplication/
├── README.md          ← this file
├── audit-log.md       ← ledger of every received/distributed event
├── inbox/             ← 1. front door for raw captures (incoming + processing)
├── drafts/            ← 2. unfinished applications waiting to be filled and submitted
│   └── _shared/       ← shared drafting resources (context, sources, raw, uploads)
├── submitted/         ← 3. canonical filled records of applications already submitted
├── questions/         ← 4. normalized Q→A index per submitted program
├── answers/           ← 5. raw answer data bank for reuse on next application
├── snapshots/         ← immutable dated/point-in-time captures (orthogonal to lifecycle)
└── src/               ← canonical methodology docs
```

Pipeline order — files flow `inbox/ → drafts/ → submitted/`, then split into
`questions/` (for the question archive) and `answers/` (for filling out
new applications).

## Current state

### Submitted (4)

| File | Program | Status |
| --- | --- | --- |
| [submitted/a16z-speedrun.md](submitted/a16z-speedrun.md) | a16z Speedrun | #1 rejected; #2 pending |
| [submitted/3xcapital.md](submitted/3xcapital.md) | 3xCapital | Submitted 2026-05-13, awaiting |
| [submitted/cyberfund.md](submitted/cyberfund.md) | cyber.fund Monastery | Submitted 2026-05-23, awaiting |
| [submitted/unicorn-fund.md](submitted/unicorn-fund.md) | NextUnicorn.Fund | **L2 escalated, 15-min follow-up 2026-06-02** (warm lead) |

### Drafts (5 — waiting to be filled)

| File | Program | Notable |
| --- | --- | --- |
| [drafts/cohort-5.md](drafts/cohort-5.md) | Solana Incubator (Cohort 5) | **Deadline 2026-06-05** (12 days) |
| [drafts/redbud.md](drafts/redbud.md) | Redbud VC | Draft v1 written, 7 open questions for Deric |
| [drafts/founding500.md](drafts/founding500.md) | Hyperagent Founding 500 | Questions extracted, draft not started |
| [drafts/yc.md](drafts/yc.md) | Y Combinator Summer 2026 | Questions extracted, includes coding-agent-session Q built for MO§ES™ |
| [drafts/solo-fund.md](drafts/solo-fund.md) | Solo Fund | Question-archive capture; `[CONFIRM]` if drafting or just keep for question archive |

### Questions index (4)

`questions/<slug>.md` per submitted program. Same files as `submitted/`,
in uniform Q→A shape regardless of original capture format.

### Answers data bank (4)

`answers/<slug>.md` per submitted program. Raw format per Deric's spec:
ANSWER first, then identification footer (`from: <slug> · <date> · Q: "..."`).

## Conventions

1. **Sequential lifecycle.** Files move forward one direction:
   `inbox/ → drafts/ → submitted/`. From `submitted/`, the same content
   gets re-shaped into `questions/` and `answers/` for reuse.
2. **No `done/` lane.** When something leaves `inbox/`, it leaves. The
   proof lives in `audit-log.md`.
3. **One file per program at each lane.** `<slug>.md` is the same slug
   across `drafts/`, `submitted/`, `questions/`, `answers/`.
4. **`drafts/_shared/` is the drafting toolkit** — context (positioning),
   sources (research captures), raw (original HTML dumps), uploads
   (submission-ready assets). Shared across all in-progress drafts.
5. **`audit-log.md` is append-only.** Once an event is logged, it stays.
   Corrections go in as new lines, not edits to old ones.
6. **`src/` filenames carry no dates.** Date in a filename signals
   snapshot; absence signals canonical.
7. **Files that aren't applications, companies, questions, answers, or
   indexing methodology don't live here.**

## Downstream: parent application-hub's question archive

```text
qaapplication/questions/<slug>.md          ← per-program normalized
qaapplication/answers/<slug>.md            ← per-program raw bank
   ↓ harvesting pass + significance scoring (parent-level work)
application-hub/seed/staging/              ← parent: candidate rows
   ↓ promotion (production SQL)
application-hub/seed/programs/<slug>.sql   ← parent: canonical seed
   ↓ apply migration
Supabase                                   ← live archive
```

Anything inside `qaapplication/` is our responsibility. Anything in
`application-hub/seed/` is parent-scope and only touched on explicit request.
