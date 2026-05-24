## Program

- **Name:** The Founding 500 — Submission Form
- **Operator:** Hyperagent
- **Apply URL:** Airtable-hosted form (`hyperagent.com/s/6YBNB4VIO26vErBhadK36w` → Airtable)
- **Type:** Cohort program for agent-first founders
- **Form host:** Airtable
- **Deadline:** Not visible on form (`[CONFIRM]`)
- **Extracted from:** `inbox/done/founding500.html` (raw DOM dump, 2026-05-23)

## Form structure (~13 fields, 4 sections, only 4 essays)

### Section 1 — About You

1. **Full name** (text)
2. **Your title** (text)
3. **LinkedIn URL** (text)

### Section 2 — About Your Company

4. **Company or project name** (text)
5. **Company website** (text)
6. **Team size** (text or numeric)
7. **Company stage** (choice — visible options: Building/not-launched, Launched/early-usage, Paying-customers — and likely more)
8. **Which best describes you?** (choice — visible options include "Reimagining an existing company around agents," and likely "Building net-new agent-first company" etc.)

### Section 3 — Your POV (essay)

9. **What does agent-first look like for your business in 12 months?** (textarea — helper text: *"Unique vantage point, prior experience, specific insight."*)

### Section 4 — Your Work (essays + upload)

10. **What have you built with agents in the last 6 months?** (textarea — helper text: *"Be specific. Agents in production, workflows rebuilt, products shipped."*)
11. **Walk us through what you're showing** (textarea + file upload — *"Drop files here"*; likely paired with a deck or demo asset)
12. **Why you're the right person to build this** (textarea)

### Possibly visible / contextual

13. Mentions of **Claude Code, OpenClaw, Perplexity Computer, Replit Agent** in the form HTML — likely a multi-select field "Which agent tools have you used?" (`[CONFIRM]`)

## Notes for the drafter (what to weight heavily)

- **This is a lean, founder-energy form.** Only 4 essay questions. Each one is doing a lot of work. Hyperagent is filtering for founders who can speak crisply with proof of motion — not founders who write 2,000-word visions.
- **Q9 (POV — agent-first in 12 months):** the helper *"Unique vantage point, prior experience, specific insight"* is a tell. They want a perspective that's NOT the generic AI-VC talking points. Deric's row-three category gap ("did meaning survive?") + the FDE-CC angle from `context/003-fde-positioning.md` is exactly the kind of POV they're filtering for.
- **Q10 (built in last 6 months):** the helper *"Be specific. Agents in production, workflows rebuilt, products shipped."* This is a no-fluff list. Map directly to: SIGSYSTEM, Signal Army, KASSA voice demo, Signomy (270 API endpoints + Stripe Connect), AQUA, COMMAND, plus the 5 patent filings and the Conservation Law preprint (V.05). Be specific with numbers.
- **Q11 (walk through what you're showing):** this is the asset upload. KASSA voice demo + paper PDF + field-sheet is the same trio that worked for cyber.fund. The textarea should be a brief tour: "Here's the demo, here's the paper, here's the operational at-a-glance."
- **Q12 (right person):** this is the founder-essay. The same physics-and-the-operator-both-hold beat that's in the Redbud Q19 draft applies here. Reuse with light edits.

## Cross-references / source files to pull from when drafting

- `context/004-commitment-physics-framing.md` (for Q9 POV)
- `context/003-fde-positioning.md` (for Q9 / category-gap)
- `sources/mos2es-com-field-sheet.md` (for Q10 specifics)
- `sources/mos2es-com-benchmarks.md` (for Q10 numbers)
- `applications/a16z-speedrun.md` (for Q12 bio tone)
- `draft/redbud.md` Q19 (founder-essay beats — already drafted)

## Status

- [x] Questions extracted from raw HTML
- [ ] Context cross-referenced before drafting
- [ ] Draft v1 written to `draft/hyperagent-founding500.md`
- [ ] Open questions resolved
- [ ] Reviewed with Deric
- [ ] Submitted
