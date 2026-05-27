# QA Tracker

Canonical operator tracker for application status, deadlines, and follow-up.

This is the fast-glance layer.
Use it together with:
- `audit-log.md` for append-only history
- `07-apply/` for active drafting
- `08-submitted/` for immutable submitted records

## Status keys

- `seeded` — in the system, not yet actively worked
- `need-to-apply` — ready and should be filed next
- `drafting` — actively being worked
- `submitted` — filed
- `follow-up` — submitted and has a known next milestone

## Current tracker

| Slug | Program | Status | Deadline / next date | Notes |
| --- | --- | --- | --- | --- |
| anthonya-angel | Anthony Avedissian Angel | need-to-apply | — | Seeded and drafted, not filed yet |
| cohort-5 | Solana Incubator Cohort 5 | need-to-apply | — | Draft exists; still needs submission |
| 3xcapital | 3xCapital | submitted | submitted 2026-05-13 | Processed into archive later |
| a16z-speedrun | a16z Speedrun | submitted | — | One rejection recorded; second submission pending |
| cyberfund | cyber.fund | submitted | — | Awaiting response |
| yc | Y Combinator Summer 2026 | submitted | — | Final archive present |
| redbud | Redbud VC | submitted | submitted 2026-05-26 | Archived |
| founding500 | The Founding 500 | submitted | submitted 2026-05-27 | Attachment bundle preserved |
| alliance | Alliance | submitted | submitted 2026-05-26 | Archived from live browser session |
| solo-fund | Solo Founders Program | submitted | submitted 2026-05-22 | Submitted answers not preserved locally |
| unicorn-fund | NextUnicorn.Fund | follow-up | 2026-06-02 | 15-minute follow-up scheduled |

## Operating rule

Update this tracker when any of these happen:
- an application is seeded
- it moves into active applying
- it is submitted
- a deadline or follow-up date becomes known
- the outcome changes

The goal is simple:
- one file to see what is live
- one log to see what happened
