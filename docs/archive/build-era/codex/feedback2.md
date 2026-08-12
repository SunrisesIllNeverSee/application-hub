Found it. This is the original product vision document that many of the deferred features in `AFTER_LAUNCH.md` were drawn from. It includes a recent addendum (2026-05-12) with strategic commentary.

## Key Sections:

**Addendum — Claude's Commentary (2026-05-12):**
- **ICP correction**: The customer is programs/schools/accelerators creating applications, not applicants. Applicants are the product. Programs have real budgets for application cycle management [2-cite-0](#2-cite-0) 
- **Hostile takeover**: Not competing with Indeed/Glassdoor — making their customers come here instead because of the pre-vetted applicant pool [2-cite-1](#2-cite-1) 
- **Onboarding gate**: "You can't enter until you've submitted an application" — gives every downstream data point context [2-cite-2](#2-cite-2) 
- **Retention**: Users already have 9+ applications to fill out — the pressure of the application cycle drives return visits [2-cite-3](#2-cite-3) 
- **Persona profile**: Three-layer stack (answer bank → persona profile → recruiter scoring) is the headline feature [2-cite-4](#2-cite-4) 
- **Split-screen interface**: Overleaf/Prism-style — left panel for answer bank/persona, right panel for application being filled [2-cite-5](#2-cite-5) 
- **Archive seeding**: Top 100 schools, top 50 grants, 30-50 job templates per sector — immediately actionable [2-cite-6](#2-cite-6) 
- **Lineage system**: First person to submit a URL gets credit/timestamp — prior art system for program discovery [2-cite-7](#2-cite-7) 

**Original Vision Sections:**
1. **Onboarding** — Application-first entry gate, 5-10 questions to trigger experience, system conforms to user's answers [2-cite-8](#2-cite-8) 
2. **Answer Bank** — Should be text-box form with timestamps, scrollable index like VS Code [2-cite-9](#2-cite-9) 
3. **Profile & User Growth** — GitHub-style workspace, community dashboard with leaderboards, profile abilities that grow with usage [2-cite-10](#2-cite-10) 
4. **Hub & Opportunity Display** — Free tier rotates 50 opportunities every 4-12 hours, premium gets search/filter/best-fit [2-cite-11](#2-cite-11) 
5. **Program Submission** — URL auto-filing with lineage, PDF/image upload, template ingestion [2-cite-12](#2-cite-12) 
6. **The Archive** — World's first application database for every category and version [2-cite-13](#2-cite-13) 
7. **Category Breakdown** — Universities (top 100-250 by specialty), Grants (academic/student/business/federal/private), Jobs (top companies by sector) [2-cite-14](#2-cite-14) 
8. **Jobs & Competitive Landscape** — Don't compete with Indeed/Glassdoor, lean into archiving applications instead [2-cite-15](#2-cite-15) 
9. **Monetization** — Charge to connect API keys ($10), Overleaf/Prism-style split-screen editor [2-cite-16](#2-cite-16) 
10. **Infrastructure** — Dashboard that develops with user, external databank for heavy data [2-cite-17](#2-cite-17) 

## Connection to Current State:

This document is the source of truth for the deferred features in `AFTER_LAUNCH.md`. The Claude addendum (2026-05-12) provides strategic validation and refinement of the original ideas. The key insight is the ICP flip — programs are the customer, applicants are the product — which changes the monetization strategy from B2C to B2B.

The current repo has shipped the foundational layers (Answer Bank, BYOK, credits, embeddings) but hasn't yet implemented the onboarding gate, persona profile system, or split-screen interface that would tie it all together.