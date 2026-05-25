---
source_capture: open-tabs-safari-2026-05-21T22-09-49-989Z.md
captured_at: 2026-05-21T22:09:49Z
triaged_at: 2026-05-22
triaged_by: claude (opus-4.7)
indexing_scope: company + application URL only (questions are a second pass)
total_tabs: 21
program_candidates: 14
references: 2
skip: 5
---

# Safari Tabs (2026-05-21) — Triage TODO

Each row is one tab. Status meaning:

- `[ ]` candidate, not yet researched
- `[~]` researched, stub written to `seed/staging/`
- `[x]` promoted to `seed/programs/` (production SQL)
- `[-]` rejected (see Verdicts section)

## Program candidates

### Accelerators / cohort programs

- [ ] **Alliance** — apply page
  - url: https://alliance.xyz/apply/1
  - type: accelerator
  - signal: "Accelerator Application | Alliance"
  - notes: looks like a numbered apply step page — confirm canonical apply URL on visit

- [ ] **cyber•Fund — Monastery for AI-native Founders**
  - url: https://cyber.fund/content/monastery
  - type: accelerator (founder residency)
  - signal: "The First Monastery for AI-native Founders"
  - notes: positioning suggests residency / fellowship hybrid; check application format

- [ ] **Hyperagent — Founding 500**
  - url: https://hyperagent.com/s/6YBNB4VIO26vErBhadK36w
  - type: cohort program (unclear — possibly founder collective)
  - signal: "founding-500.html | Hyperagent"
  - notes: hash-tokened URL — likely an invite link; capture the canonical apply URL behind it

### Jobs (essay-driven careers)

- [ ] **Palantir — Neurodivergent Fellowship**
  - url: https://jobs.lever.co/palantir/61eaa54c-e1b7-4064-afad-f7df3d48d652/apply
  - type: job (fellowship-track role)
  - signal: dedicated fellowship listing on Lever
  - notes: high essay likelihood; index Palantir as parent org if not already

- [ ] **Steel — Member of Technical Staff, Applied AI**
  - url: https://jobs.ashbyhq.com/steel/c5a1ec46-5507-4c5b-9fed-f15ce25fd7be/application
  - type: job
  - signal: Ashby application page
  - notes: confirm essay questions on apply page

- [ ] **Pokee AI — Careers**
  - url: https://pokee.ai/careers
  - type: job (careers index)
  - notes: index company once; expand role pages later

- [ ] **Nous Research — Careers**
  - url: https://nousresearch.com/careers
  - type: job (careers index)
  - notes: high-signal AI research lab; likely essay-driven roles

- [ ] **DeepSeek (High-Flyer) — Recruitment**
  - url: https://app.mokahr.com/social-recruitment/high-flyer/140576#/job/ec402ff5-47fe-4e32-820c-b04884fca585
  - type: job
  - signal: "DeepSeek招聘" (DeepSeek recruitment)
  - notes: Chinese-language portal; may require translation pass

### Grants / prizes / funding

- [ ] **Thinking Machines Lab — Interactivity Research Grants**
  - url: https://thinkingmachines.ai/news/interactivity-research-grants/
  - type: grant
  - notes: announcement page — find linked application form

- [ ] **Google XPRIZE — Build with Gemini ($2M)**
  - url: https://xprize.devpost.com/?utm_source=moonshot&utm_medium=landingpage&utm_campaign=cta
  - type: prize / hackathon
  - notes: Devpost-hosted; index XPRIZE as org, this as one program

- [ ] **Devpost — Google for Startups AI Agents Challenge**
  - url: https://devpost.team/hackathon_guest_invites/4fb181b4-2722-415d-a442-285a57dcaba5
  - type: hackathon
  - signal: guest invite link (utm: google-for-startups-ai-agents-challenge)
  - notes: capture canonical hackathon page (strip invite token)

- [ ] **ARIA — Safeguarded AI (Funding)**
  - url: https://aria.org.uk/opportunity-spaces/mathematics-for-safe-ai/safeguarded-ai/funding/
  - type: grant
  - notes: UK ARIA opportunity space; multiple funding calls likely

### VC / fund applications

- [ ] **LvlUp VC — First Check Fund**
  - url: https://www.lvlup.vc/fund/first-check-fund
  - type: vc (pitch-application)
  - notes: confirm form vs gated DM

- [ ] **Hashgraph Ventures**
  - url: https://hashgraphvc.com/
  - type: vc
  - notes: landing page — find pitch / apply CTA

## References (keep for context, do not index as program)

- LangSmith observability quickstart — https://docs.langchain.com/langsmith/observability-quickstart
- NodeOps CreateOS Skills marketplace — https://nodeops.network/createos/skills

## Skip (not actionable)

- https://x.com — social home
- https://smith.langchain.com/o/b0477e34-... — private LangSmith workspace
- https://app.devin.ai/org/sunrisesillneversee/wiki/.../RNS — private Devin wiki
- https://app.devin.ai/sessions/8691a27b... — private Devin session
- https://app.devin.ai/search/the-main-engine-... — private Devin search result

## Next actions (in order)

1. Run a research pass on the 14 candidates: confirm canonical apply URL, org
   name, program type, visible deadline. Existing repo helpers live in
   `seed/staging/` (`apply_url_results/`, `extract_batch03.py`).
2. For each confirmed candidate, write a YAML stub under
   `01-inbox/processing/candidates/` mirroring the fields in
   `seed/programs/*.sql` (slug, name, type, url, host, applies_open_at).
3. Promote validated stubs to `seed/staging/`, then write production SQL in
   `seed/programs/<slug>.sql` using an existing file as a template.
4. Move this capture + verdicts to `01-inbox/done/`.

## Verdicts (filled in as items resolve)

_(empty — fill as candidates are researched / rejected)_
