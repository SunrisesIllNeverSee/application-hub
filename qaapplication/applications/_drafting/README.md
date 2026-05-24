# _drafting — Current Application Fill Workspace

Temporary workspace for filling out applications in progress. Files in
this folder are working state, not canonical captures.

The structure supports **multiple programs in flight at once** and
**multiple context drops over time** (initial bio, project updates,
third-party answers, etc.).

## Folder layout

```text
_drafting/
├── README.md          ← this file
├── sources.md         ← external sources + outreach protocol
├── questions/         ← one file per program (e.g. palantir-fellowship.md)
├── context/           ← source material, accumulating drops (numbered files)
├── draft/             ← my output: one file per program, matching questions/
└── sources/           ← cached fetches from live sites (created on demand)
```

Each subfolder has its own `README.md` explaining what to drop and how to
name it. Read those first.

## Workflow

1. **You drop the program's questions** into `questions/<program-slug>.md`.
2. **You drop context** into `context/` (bio updates, project info, voice
   preferences, anything that shapes the answer).
3. **You tell me to draft** a specific program (`"ready to draft palantir-fellowship"`).
4. **I fetch** the live sources listed in [sources.md](sources.md), read
   the matching `questions/` + all `context/` files + your a16z application,
   and write a filled draft to `draft/<program-slug>.md`.
5. **I flag open questions** at the bottom of the draft for anything I
   couldn't resolve.
6. **You answer** open questions in `context/` (directly or by asking a
   third party and pasting their reply back).
7. **I re-draft.**
8. **Loop until done**, then we move the final out of `_drafting/` into
   `applications/<program-slug>.md` (or `applications/<program-slug>/` if
   you want to keep the context+sources alongside the final).

## Sources I'll draw from when drafting

1. **`context/` files in this workspace** (highest priority — newest info)
2. **`applications/a16z-speedrun.md`** (your already-filled a16z application
   — strong reference for tone, founder background, MO§ES™ pitch). The
   May 2026 snapshot; outranked by live sources where they diverge.
3. **Live sources** — GitHub `SunrisesIllNeverSee`, `mos2es.com`,
   `mos2es.xyz`, `signomy.xyz` — see [sources.md](sources.md) for the
   full fetch protocol.
4. **The target program's DNA** — inferred from the questions themselves.

When I can't determine an answer from any of the above, I add it to the
**Open questions** block at the bottom of the relevant `draft/` file. You
can answer directly, ask a third party (cofounder / advisor / customer /
mentor) and paste their reply back into `context/`, or tell me to ship
with my best guess (flagged `[ASSUMED]`). Full protocol in
[sources.md](sources.md).

## Current state

- [ ] At least one `questions/<program>.md` populated
- [ ] At least one `context/*.md` dropped
- [ ] First draft written to `draft/<program>.md`
- [ ] Open questions resolved
- [ ] Reviewed with you
- [ ] Submitted + moved out of `_drafting/`
