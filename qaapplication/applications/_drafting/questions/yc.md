## Program

- **Name:** Y Combinator — Application
- **Batch:** Summer 2026
- **Apply URL:** ycombinator.com/apply (form behind login)
- **Type:** Top-tier accelerator
- **Form host:** YC's own (custom React-ish form, well-structured field names)
- **Deadline:** Summer 2026 batch — `[CONFIRM deadline; typically Feb/March for S-batch]`
- **Extracted from:** `inbox/done/yc.html` (raw DOM dump, 2026-05-23)

## Form structure (~25 fields, including Summer 2026's experimental coding-agent question)

### Founder + company basics

1. **Company / project name** (text) — backend field: `name`
2. **What batch do you want to apply for?** (radio — Summer 2026 / A batch after Summer 2026)
3. **Are you looking for a cofounder?** (yes/no)
4. **Cofounder info** (textarea, if applicable) — field: `cofounder`
5. **Other co-founders / team** (textarea) — field: `others2`
6. **Who writes code, or does other technical work on your product? Was any of it done by a non-founder? Please explain.** — field: `techstack` (or similar)

### Product

7. **Describe what your company does in 50 characters or less.** (text, hard 50-char limit) — field: `describe`
8. **What is your company going to make? Please describe your product and what it does or will do.** (textarea) — field: `make`
9. **What tech stack are you using, or planning to use, to build this product? Include AI models and AI coding tools you use.** (textarea) — field: `techstack`
10. **Please provide a link to the product, if any.** (URL) — field: `productLink`
11. **If login credentials are required for the link above, enter them here.** (text) — field: `productCreds`

### Idea

12. **Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you're making?** (textarea) — field: `ideas`
13. **If you are applying with the same idea as a previous batch, did anything change? If you applied with a different idea, why did you pivot and what did you learn from the last idea?** (textarea)

### Progress / traction

14. **How far along are you?** (textarea) — field: `howfar`
15. **How long have each of you been working on this? How much of that has been full-time? Please explain.** (textarea) — field: `since`
16. **Have you formed ANY legal entity yet?** (yes/no) — `incyet`
17. **Are people using your product?** (yes/no) — `stage`
18. **Do you have revenue?** (yes/no) — `revenue`
19. **Worked together before?** (yes/no) — field: `worked`

### Money

20. **How do or will you make money? How much could you make?** (textarea) — field: `make` (likely sub-question)
21. **Have you taken any investment yet?** (yes/no) — `investyet`
22. **Are you currently fundraising?** (yes/no) — `currentlyraising`
23. **Other ideas considered?** (textarea) — field: `ideas`

### Competition + market

24. **Who are your competitors? What do you understand about your business that they don't?** (textarea)

### Location

25. **Where do you live now, and where would the company be based after YC?** (text) — field: `where`
26. **Explain your decision regarding location.** (textarea) — field: `wherewhy` — *"This may be in the United States, in your home country or in another country."*

### Source / motivation

27. **How did you hear about Y Combinator?** (textarea) — field: `howhear`
28. **What convinced you to apply to Y Combinator? Did someone encourage you to apply? Have you been to any YC events?** (textarea) — field: `whyapply`

### Assets

29. **Please record a one minute video introducing the founder(s).** (file/link upload — required)
30. **If you have a demo, attach it below.** (file/link upload — optional) — *"Anything that shows us how the product works. Please limit to 3 minutes / 100 MB."*
31. **Optional: attach a coding agent session you're particularly proud of.** (file upload) — **NEW for Summer 2026.** Helper: *"Many coding agents (e.g. Claude Code, Cursor, etc) have a `/export` command, or otherwise include a button allowing you to export a transcript. Can be text or markdown. This is an experimental question for the Summer 2026 batch to give people a chance to show off their skills with AI coding tools."*
32. **If you have already participated or committed to participate in an incubator, "accelerator" or "pre-accelerator" program, please tell us about it.** (textarea)

## Notes for the drafter (what to weight heavily)

- **Q7 (50-char description)** is the single hardest question on the form. 50 characters is *severely* constrained. Candidate: **"Sovereign Signal Governance for AI deployments"** = 47 chars ✓. Or **"Constitutional governance for AI systems & agents"** = 49 chars ✓. Either works. The hero tagline ("Sovereign Signal Governance") was designed for exactly this kind of constraint.
- **Q9 (Tech stack with AI models/tools)** is a hidden differentiator question. Most YC applicants list `Next.js / Supabase / OpenAI`. Deric should list the full sovereign stack — including Claude Opus 4.7 (per benchmarks), the McHenry Axioms as a substrate, the McHenry-Axiom-gated compression pipeline, Zenodo for paper hosting, Stripe Connect for Signomy, and the SIGSYSTEM measurement instrument. **This is where the 5 measured kernels go** — YC will read this question carefully because it's how they assess whether you've actually built anything or just talked about building.
- **Q12 (Why this idea + domain expertise + how do you know people need it)** is the classic YC litmus question. Domain-expertise answer = the row-three category gap ("did meaning survive?") + the operator angle (20-year operator, Buffalo, "I came in without academic priors").
- **Q24 (Competitors + what you know they don't)** is the same answer-shape as Redbud Q22 — already drafted in `draft/redbud.md`. Reuse with light edits.
- **Q26 (Why this location)** — Buffalo. Strengthen the Middle America / Rust Belt angle that Redbud's thesis explicitly rewards. YC is location-agnostic but they're going to ask whether you'll relocate to SF. Be honest.
- **Q31 (Coding agent session — NEW for Summer 2026)** is the MO§ES™ home-court question. **The entire SIGSYSTEM benchmarks page IS a coding-agent-session export.** 21 sessions, 7,327 turns, 35,242 LOC in 5 build days, $0.0007/LOC, 94.66% cache hit, #1 across all five measured kernels. This question was *designed for Deric*. Upload the benchmarks markdown + a select Claude Code session transcript and let it land.
- **Q29 (1-min founder video)** — `[ASSET NEEDED]` — likely the heaviest non-essay lift; YC reads/watches all of them.

## Cross-references / source files to pull from when drafting

- All four `context/` files (especially `004-commitment-physics-framing.md` and `003-fde-positioning.md`)
- All `sources/` (paper notes, axioms, benchmarks, field-sheet, FDE thread)
- `draft/redbud.md` (Q19 + Q22 already drafted, structurally reusable)
- `applications/a16z-speedrun.md` (bio + tone reference)

## Status

- [x] Questions extracted from raw HTML
- [ ] Context cross-referenced before drafting
- [ ] Draft v1 written to `draft/yc.md`
- [ ] 1-minute founder video recorded (HIGH PRIORITY — separate asset)
- [ ] Coding-agent session transcript selected for Q31
- [ ] Open questions resolved
- [ ] Reviewed with Deric
- [ ] Submitted
