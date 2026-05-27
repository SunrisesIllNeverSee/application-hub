## Program

- **Name:** Redbud VC — Pitch Us
- **Apply URL:** https://tally.so/r/mYRD2B  (embedded in https://redbud.vc/pitch-us)
- **Type:** Early-stage VC / pre-seed
- **Thesis (their words):** "Early-stage venture capital fund investing in tech founders strengthened by struggle, supporting them with resources from Middle America."
- **Form host:** Tally
- **Deadline:** Rolling (no deadline shown on form)
- **Extracted from:** `inbox/done/redbudraw.html` (raw DOM dump, 2026-05-23)

## Form structure (~30 fields, grouped by section)

### Section 1 — Founder identity

1. **First Name** (text)
2. **Last Name** (text)
3. **Email** (text)
4. **Your LinkedIn** (text)
5. **Where is home base? (State)** (text)

### Section 2 — Company basics

6. **Company Name** (text)
7. **Website** (text)
8. **Industry** *(e.g., fintech, agtech)* (text)

### Section 3 — Founders

9. **# of Founders** (text/numeric)
10. **Number of companies founded prior** (select / radio — choice field)
11. **Someone technical on the team?** (Yes/No — choice field)
12. **Link to co-founder profile 1** (text)
13. **Link to co-founder profile 2** (text, optional)
14. **Link to co-founder profile 3** (text, optional)
15. **How long have you known your co-founders, and how did you meet?** (textarea)

### Section 4 — The pitch

16. **Idea/company elevator pitch** *(1-2 sentences)* (textarea, short)
17. **Product phase** *(e.g., build, MVP, launched), and if you haven't launched, when will you?* (textarea)
18. **How long have you been tinkering with/working on your idea?** (choice field — duration brackets)
19. **Why you/your team?** (textarea — **founder fit / strengthened-by-struggle thesis fit**)
20. **Traction** *(e.g., customers, waitlist, revenue, etc.)* (textarea)
21. **What is your ideal customer profile, and have you learned anything from speaking to them?** (textarea)
22. **Who are your main competitors, and what do you know they don't?** (textarea)
23. **Revenue opportunity and how does the opportunity expand with your vision?** (textarea)

### Section 5 — Financing

24. **Have you raised capital for your current company?** (Yes/No — choice field)
25. **Have you raised venture capital before?** (Yes/No — choice field)
26. **How much capital have you raised, and any significant investors?** (textarea)

### Section 6 — Deck

27. **Deck or One Pager** (file upload — PDF)
28. **Deck link** (text — URL alternative to upload)

### Section 7 — Referral

29. **How did you find us?** (choice field — referral source)
30. **Who referred you?** (text, conditional on #29)

## Notes for the drafter (what to weight heavily)

- **"Strengthened by struggle / Middle America" is the thesis.** Deric is in
  Buffalo NY — Rust Belt, not Silicon Valley. Whatever the answer to
  Q19 ("Why you/your team?") is, it should be conscious of that framing
  without pandering to it. Solo-founder, self-taught, 5 patents + TM filed
  in eight months as a non-technical founder turned operator — that arc IS
  the strengthened-by-struggle story. Don't soften it.
- **Q19 (Why you/team) is the load-bearing essay.** Everything else is
  table-stakes data. Spend the most word-budget here.
- **Q16 (elevator pitch, 1-2 sentences) is unusually constrained** — the
  whole conservation-law + sovereign-signal-governance pitch has to fit in
  two sentences. The mos2es.com hero line is the cleanest option:
  *"Sovereign Signal Governance. What TCP/IP did for data, MO§ES™ does for
  the preservation of meaning."* — exactly 2 sentences, on-record.
- **Q22 (competitors / what you know they don't)** is where the row-three
  category-gap argument lands hardest — DevOps observability and ML
  observability are the competitive landscape; "did meaning survive?" is
  what nobody else measures.
- **Q23 (revenue opportunity + expanded vision)** is the
  agent-marketplace / headless-software vision question — pull from
  the three articles in `sources/fde-thread-notes.md`.

## Status

- [x] Questions extracted from raw HTML
- [ ] Context cross-referenced (a16z application, mos2es.com sources, McHenry Axioms, FDE positioning)
- [ ] Draft written to `draft/redbud.md`
- [ ] Open questions resolved
- [ ] Reviewed with Deric
- [ ] Submitted
