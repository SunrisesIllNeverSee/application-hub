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

| Slug | Program | Route | Status | Deadline / next date | Notes |
| --- | --- | --- | --- | --- | --- |
| euclid-ventures | Euclid Ventures | email | drafted — do not send | — | Official route is hello@euclid.vc; ask directly whether operator-measurement infrastructure is within vertical-AI scope |
| daybreak | Daybreak | email | drafted — do not send | — | Official founder contacts: Rex Woodbury and Jared Newman; first-check/proof-of-life framing |
| hannah-grey | Hannah Grey | form | in progress — do not submit | — | Airtable draft is filled for review; C-corp eligibility, exact HQ, sector/fundraising selections, and PDF deck upload remain for founder review |
| twin-track | Twin Track Ventures | form | closed — out of scope | — | European/NATO-aligned defence fund; excluded under the US/North America-only investor constraint |
| belief-capital | Belief Capital | no verified public route | research complete | — | Official site was identified, but no public founder pitch form or official outreach inbox was verifiable; do not guess a contact address |
| modern-technical-fund | Modern Technical Fund | social / no public pitch route | research complete | — | Official site lists X and LinkedIn for solo GP Robby, but no application form or official inbox; US pre-seed developer/data/security software focus |
| zero-shot-fund | Zero Shot Fund | form | ready to draft — do not submit | — | Official Notion “Get in touch” form; pre-seed/seed AI-native fund writing $1–4M first institutional checks |
| general-catalyst | General Catalyst | form | ready to draft — do not submit | — | Official contact page contains a web form; it is a general contact route, not a dedicated investment application |
| main-object | Main Object | social / no public pitch route | research complete | — | Official site exposes X only; no public founder application or official inbox was found |
| xyz-ventures | XYZ Venture Capital | email | ready to draft — do not send | — | Official founder contact route: info@xyz.vc; early-stage fintech, enterprise, and tech-forgotten industries focus |
| upfront-ventures | Upfront Ventures | no verified public route | research complete | — | No official public pitch form or general founder inbox was verified from Upfront’s official site; do not use third-party contact data |
| geek-ventures | Geek Ventures | form | fit-gated — do not submit | — | Official Typeform; immigrant-founder mandate requires a truthful, relevant founder connection |
| park-rangers-capital | Park Rangers Capital | form | eligibility-gated — do not submit | — | Official Connect form; firm currently requires a US-based Delaware C-corp and community-first fit |
| cambrian | Cambrian | form | thesis-fit gated — do not submit | — | Official Airtable deck form; apply only with a defined, credible fintech/compliance buyer and workflow |
| village-global | Village Global | form / email | ready for review — do not submit | — | Official startup submission; global pre-seed/seed investor, with hello@villageglobal.vc as an official contact path |
| everywhere-ventures | Everywhere Ventures | form | ready for review — do not submit | — | Official Airtable application; founders may apply directly |
| surge-peak-xv | Surge by Peak XV | form | ready for review — do not submit | rolling | Official rolling application; requires Dropbox/Google Slides materials link or a Loom |
| pax-vc | Pax VC | email | thesis-fit gated — do not send | — | Official route hello@pax.vc; do not claim defense/industrial fit without supporting product evidence |
| concept-ventures | Concept Ventures | — | closed — out of scope | — | London/UK fund; excluded under the North America-only investor constraint |
| angular-ventures | Angular Ventures | — | closed — out of scope | — | EU/Israel-to-US mandate; excluded under the North America-only investor constraint |
| puzzle-ventures | Puzzle Ventures | — | closed — out of scope | — | Europe-focused fund; excluded under the North America-only investor constraint |
| southpark-commons | South Park Commons | form | drafting | — | Founder-formation / early-stage community application; answers pending |
| yc-fall-2026 | Y Combinator Fall 2026 | form | submitted / in review `[CONFIRM]` | — | Separate application record; preserves current SigRank traction and does not replace the Summer 2026 YC record |
| catalyst-outcast | Catalyst from Outcast Ventures | form | drafting | Apply by 2026-08-02, 11:59pm PT; program Sep 16–Nov 11 in SF | Founder-formation program; references and full-time/no-side-project commitment need founder input |
| anthonya-angel | Anthony Avedissian Angel | email | need-to-apply | — | Seeded and drafted, not filed yet |
| cohort-5 | Solana Incubator Cohort 5 | form | need-to-apply | — | Draft exists; still needs submission |
| 3xcapital | 3xCapital | form | submitted | submitted 2026-05-13 | Processed into archive later |
| a16z-speedrun | a16z Speedrun | form | submitted | — | One rejection recorded; second submission pending |
| cyberfund | cyber.fund | form | submitted | — | Awaiting response |
| yc | Y Combinator Summer 2026 | form | submitted | — | Final archive present |
| redbud | Redbud VC | form | submitted | submitted 2026-05-26 | Archived |
| founding500 | The Founding 500 | form | submitted | submitted 2026-05-27 | Attachment bundle preserved |
| alliance | Alliance | form | submitted | submitted 2026-05-26 | Archived from live browser session |
| solo-fund | Solo Founders Program | form | submitted | submitted 2026-05-22 | Submitted answers not preserved locally |
| unicorn-fund | NextUnicorn.Fund | form | follow-up | 2026-06-02 | 15-minute follow-up scheduled |

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
