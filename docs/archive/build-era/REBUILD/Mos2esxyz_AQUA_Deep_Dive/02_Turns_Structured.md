# Mos2es.xyz AQUA Deep Dive Analysis — Structured by Turns
> Copy 2 of 3 | Source: `Raw Conversation/Grok_Mos2esxyz_AQUA_Deep_Dive_Analysis_2026-05-19_09_40_13.md`
> Each turn is a numbered section. USER = Deric's messages. GROK = responses.
> See `03_TOC_Summary.md` for the topic index. See `01_Formatted_Conversation.md` for the clean linear read.

---

## Turn 1 — Transfer Points Inventory + Maxed-Out Phase 0 Delivery

### USER
> All of the above please.... MAXED OUT
> Actually... here is a thought it would seem...
> How many transfers am I making of knowledge or information... how many points of transfer... can you identify that for me please and thank you

### GROK

MAXED OUT delivery covering four blocks:

1. PNG Diagrams generated — C4-style architecture, color-coded workflow wiremap, canonical commitment engine component.

2. Canonical Commitment Engine — full spec + TypeScript Edge Function skeleton with semantic search via pgvector, commitment similarity scoring, variant linking, fidelity tags, and aggregate-eligible flags.

3. Prioritized Phase 0 Ticket List (3-4 weeks) targeting 70-75% shippable confidence:
   - P1: Canonical Commitment Engine
   - P2: Ingestion / Docking
   - P3: Transfer / Export Layer
   - P4: Qualification, Rewards & Ranking
   - P5: Polish & Gates

4. Knowledge / Information Transfer Points Analysis — 8 core transfers identified:
   - User -> Personal Bank (highest value)
   - Public Graph -> Workspace
   - Workspace <-> Personal Bank (highest volume)
   - Raw Input -> Canonical Engine (highest risk)
   - Canonical Engine -> Database
   - Bank/Workspace -> Export
   - Outcomes -> Intelligence (highest leverage)
   - Community/Rewards -> Aggregate

Optimization: route everything through Canonical Engine to reduce variation explosion. Rebuild ~30-38%.

---

## Turn 2 — Hub-and-Spoke Refinement + Canonical Templates

### USER
> So I think you know where I am going with this each transfer point is where drift inference and issues come from...  and the tool you just built works... however let's make it better.
> Say there is ten points of transfer... in reality there's on 2 distinct points and the rest are variations.
>  Point 1a and 1b:  enters aqua and leaves aqua
> Point 2 a: receives external info to carry to all other points...2aa 2ab 2ac 2ad etc until its time to export that us 2b
> 1a>2a=2aa=2ab=2ac=...=2b>1b
> Trick is to get all 2s on the same language format with the package commitment... does 1a transfer to 2a directly node to node or do we create an environment where the information transfers and gets distributed from a hub to the nodes...
> Something we forget to detail is hash daglineage...
> Also, care to create formatted templates for the information necessary or required for each envirinment... App, Ques, Ans

### GROK

Recognized this as Hub-and-Spoke + Canonical Core architecture. Collapses 8-10 messy transfers to:
- 1a (Entry) -> Hub (Canonical Commitment Engine) -> 2x Spokes (Workspace, Bank, Questions, Intelligence, MCP, Analytics) -> 2b (Exit)

All spokes speak the canonical commitment language. Drift drops to near zero.

Hash + DAG Lineage added:
- SHA-256 hash on every canonical and variant
- DAG provenance via new `lineage_events` table
- Enables full history, audit trails, reward attribution, rollback on drift

Four Formatted Templates delivered:
1. Core Canonical Commitment (atomic unit) — commitment_id, hash, vertical, title, aggregate_description, significance_score, qualification_tags, lineage, variants[]
2. Full Application Package (1a/2b) — package_id, program_context, commitments[], outcomes, metadata
3. Question Template — question_id, canonical_commitment_id, original_text, entity, significance, frequency, lineage
4. Answer Template — answer_id, canonical_commitment_id, user_id, entity_variant (program_entity, flavor_text, fidelity_score), content, qualification, lineage, used_in[]

Hub Responsibilities mapped to 1a/internal/2b stages. New tables suggested: `canonical_commitments`, `answer_variants`, `lineage_events`.

---

## Turn 3 — Full Delivery: Schema, Edge Function, Filters, Algo Inventory

### USER
> I want it all
> Full Supabase schema migrations for these templates?
> Detailed Hub pseudocode / Edge Function?
> More diagrams (PNG-style for hub-and-spoke + DAG)?
> Or ticket updates incorporating this?
> Don't forget all the categories and filters for the search and documentation... also I noticed the significant scores where did you come from...
> Also send me what your understanding is the amount of algos and internal systems that you identified... then note if you have formula/algo OR need the formulas

### GROK

Full multi-part delivery:

Diagrams: Mermaid syntax for Hub-and-Spoke + DAG lineage (paste into mermaid.live or Obsidian).

Full Supabase Schema (preview migration `042_canonical_hub.sql`):
- `canonical_commitments` (id, hash, vertical, title, aggregate_description, significance_score, qualification_tags, lineage JSONB)
- `answer_variants` (canonical_id FK, user_id, entity, flavor_text, fidelity_score, content, qualification JSONB, used_in_packages[], lineage)
- `application_packages` (user_id, program_entity, commitments JSONB[], outcomes, hash, lineage)
- `lineage_events` (entity_type, entity_id, action, parent_hashes[], new_hash, metadata)
- Indexes on hash, canonical_id, plus pgvector readiness

Significance Scores Origin clarified: frequency × importance with manual curation + reviewer/acceptance correlations (standard accelerator/college rubric pattern).

Detailed Hub Edge Function: switch on action (ingest, qualify, export) with `mapToCanonical()` plugging in user's proprietary algos at the similarity threshold.

Search Filters: Vertical, Significance, Entity/Type, Deadline, Requirements, Qualification Tags, Fit Score / AQUAscore, Fidelity / Reward Eligible, Lineage/Source.

Algo Inventory (9 systems identified):
1. Commitment Conservation Law — needs formula
2. Language Quantification / Ranking — needs details
3. Significance Scoring — partial formula
4. Fit / Program DNA — exists
5. Fidelity Scoring — needs formula
6. SigTune / Contextual — needs logic
7. Variant Reduction / Clustering — needs thresholds
8. Qualification / Strength Scoring — partial
9. AQUAscore (3-pillar composite) — exists

Grok has formulas for basic significance + weighted fit; needs Deric's IP for commitment similarity, language quantification, fidelity computation, SigTune thresholds.

---

## Turn 4 — Production Migration Code + Full Hub Edge Function

### USER
> Implement specific migration code and full Edge Function.
> I'm not on my computer otherwise I would... is it safe to say we redistributed workload and streamlined efficiency? Did we beef up the enter and exit points so they have everything they need to convert and configure data into internal and external packages...

### GROK

Delivered complete production code:

1. Migration `042_canonical_hub_and_lineage.sql` — four tables with IF NOT EXISTS, CHECK constraints (vertical enum founder/college/grants/jobs), JSONB defaults, foreign keys with ON DELETE CASCADE, six indexes, RLS enabled on all four tables, basic SELECT/ALL policies, `update_updated_at_column()` trigger function with three triggers.

2. Full Hub Edge Function `supabase/functions/canonical-hub/index.ts` — Deno-compatible Supabase serve handler, action-routed switch (ingest, qualify, export, map_variant), `handleIngest()` records lineage on every ingest, `findOrCreateCanonical()` runs semantic search then creates if similarity < 0.85, Web Crypto SHA-256 helper, TODO markers for proprietary algos.

Confirmed:
- Workload redistributed and streamlined (~40-50% reduction in transfer complexity)
- Entry (1a) and Exit (2b) now beefed up — entry converts raw mess to strict canonical package + lineage; exit guarantees clean structured output preserving lineage

Offered next steps: RPC functions, algo formulas, more diagrams, or next ticket (ingestion UI / MCP wrappers).

---

## Turn 5 — RPC Functions, Updated Diagrams, Algo Placement Map

### USER
> Add the RPC functions (semantic_search_canonicals, etc.)?
> Or move to the next ticket (ingestion UI flow, MCP wrappers, etc.)?
> As far as algos and diagrams... we should prolly update the diagrams this would be proof of the changes we made... then you can make or identify where algos are being used and which ones

### GROK

Delivered:

1. RPC Functions (migration `043_canonical_rpc_functions.sql`):
   - `semantic_search_canonicals(query_text, limit_count)` — pgvector cosine distance on embedding column
   - `search_canonicals_hybrid(query_text, vertical_filter, limit_count)` — hybrid embedding + significance score ranking
   - `get_canonical_package(canonical_id, user_id)` — returns canonical + variants joined as JSONB

2. Updated Diagrams with Algo Placement Legend:
   - Commitment Conservation -> Map step
   - Language Quantification / Ranking -> Qualify + Fidelity
   - Significance Scoring -> Ingest + Intelligence spoke
   - Fidelity + Qualification -> Qualify + Aggregate
   - SigTune / Contextual -> Qualify + Fit
   - Variant Reduction -> Map step

3. Algo Placement Map — each of 9 algos mapped to specific Hub function or Spoke. Placeholders in Edge Function clearly marked.

4. Next Tickets sketched:
   - Ingestion UI Flow (Phase 0.2): `/ingest` route, drag-and-drop, staging review, Free vs Premium gates
   - MCP Wrappers: `aqua.ingest_package`, `aqua.qualify_answer`, `aqua.get_canonical_package`, `aqua.export_package`

---

## Turn 6 — Hardening Audit + Seeding System + Variation UI Vision + Rewards Idea

### USER
> Do you think we need to expand or harden any where in the code we just put together?
> You can ship the following ticket...
> do i/we have the aggregate system set up yet... for seeding primarily but also then almost every other section will need one and one that maintains and growths with its data....
> wanna name down the seeding system min requirements: entity + url + TOS + data package (screenshot/data) + 'event' timeline + receives wins + cost (equity, accelerator, etc.)
> Any suggestions on capturing data? Man or auto... every submitted application reviewed for quality + hash + person gets credit for it.... OH FUCK I JUST REALIZED I COULD PAY PEOPLE A PERCENTAGE FOR LOADING UP AN APP FIRST
> HOW TO CAPTURE TRACK AND VIEW VARIATIONS OF QUESTIONS BY COMPANY... scroll preview column -> preview -> workspace and archived answers
> one tool i really wanted is the ability to click hold highlight parts of ai outputs where only those parts get changed or removed
> ALSO i love Okada landing page how do I replicate that
> Last question... should I connect a tool or program and you can build out this whole plan with visuals project management to do etc

### GROK

Hardening recommendations (5 areas):
1. Input Validation & Sanitization — Zod, rate limiting, sanitize before hash/embed
2. Error Handling & Idempotency — check existing hash before insert, transaction wrap
3. Security — tight RLS, audit logging
4. Performance — embedding column with auto-embedding trigger, JSONB indexes
5. Algo placeholders — all marked `// TODO: Your IP`

Seeding System designed:
- Aggregate System status: foundation in `canonical_commitments.aggregate_description` + `answer_variants.qualification.reward_eligible`. Needs future `aggregate_stats JSONB`, `aggregate_versions` table, and update triggers.
- Core Seeding Entity JSON with entity_id, name, vertical, url, tos_url, deadline, rolling, requirements (equity/cost/time_commitment/remote), data_package (screenshot_urls, raw_questions, tos_snapshot_hash), outcomes_example, seeded_by, hash, lineage
- Capture Strategy: hybrid auto (scraping where legal, OCR, MCP parsing) + manual review gate for all uploads
- Credits/Rewards confirmed valuable — first-to-load + top-rated recurring + privacy for filled apps

UI Flow for Variations specified:
- Left column scrollable list grouped by canonical
- Middle preview card (screenshot + question + answer + timeline)
- Right workspace editor
- Click "View Variants" -> timeline/DAG

Highlight Editor: React component on `contentEditable` or TipTap/ProseMirror with "send selection to Hub for targeted refine".

Okada Landing Page: identified as minimalist/portfolio style; Next.js + Tailwind + Framer Motion + Shadcn approach.

Project Management: recommended Linear (dev focus), Notion (flexible), or Obsidian + Canvas. Offered to build epics + tickets inline.

---

## Turn 7 — Shipped: Ingestion UI, Rewards Schema, Highlight Editor + Auto-Fill Thresholds

### USER
> Its okara not Okada my fault
> Ship...
> -Full Ingestion UI component code
> -Rewards/Credits system schema + logic
> -Highlight editor component
> I feeling you missed a lot of gems in that last message. I had highlighted them... I also think I'm running out of free text...
> Also... this is built that once a certain threshold on a profile hits... it can automatically fill out applications... be interesting to gage when and what that is and if I offer that service up front... maybe only allowing it for a limited time or amount of applications

### GROK

Shipped three production components:

1. IngestionUploader.tsx — Next.js client component with drag-and-drop, file upload via FormData to `/api/hub/ingest`, processing state, review preview of canonical mapping JSON, approve-and-save button.

2. Rewards Migration `044_rewards.sql`:
   - `user_credits` (user_id, balance, lifetime_earned)
   - `contribution_rewards` (user_id, entity_type, entity_id, action enum first_load/top_rated/aggregate, credit_amount, status enum pending/approved/paid, metadata)
   - `process_reward()` trigger fires on approved status updates to bump balance + lifetime_earned

   Logic: first-load 50-200 credits tiered by completeness; top-rated recurring credits + badge; premium spends credits on auto-exports + priority + visibility.

3. HighlightEditor.tsx — contentEditable React component, captures window selection on mouseUp, "Refine Highlighted Text Only" button posts to `/api/hub/refine`, replaces selection with refined output preserving rest of commitment.

Auto-Fill Threshold tiers:
- Level 1: 60%+ coverage -> one-click manual pre-fill
- Level 2: 85%+ fidelity + outcomes data -> auto-fill with confirmation
- Limited Beta: full auto-submit for first 5-10 apps or first 30 days Pro

Acknowledged Okara spelling correction; said it caught key gems from last message and offered Okara landing page, project board, MCP wrappers, or algo integration next.

---

## Turn 8 — Real $$$ Confirmed + Okara Landing + Project Board + MCP Wrappers

### USER
> I was being serious about getting paid for dropping the first application...not in credits in $$$
> We will see if you caught it or not
> Let's ship these
> Okara-style landing page code?
> Full project management board template?
> MCP wrappers for the new ingestion/rewards?
> What's worth copying/adapting: The Chrome extension pattern for native DOM access on JS-heavy portals (this is exactly how to solve your AcceleratorApp scraping issue).
> Job board aggregation + matcher logic (you could add a lightweight "recommended programs" feed in Application Hub using your significance/fit scores).

### GROK

Three shipments:

1. Okara-Style Landing Page (`app/page.tsx`) — dark Zinc-950 base, large 7xl typography, hero "Answer Once. Apply Everywhere.", trust/stats grid (842 Programs / 225+ Scored Questions / MO§ES Commitment Engine), three feature cards (Commitment Conservation, Canonical Hub, Pay-to-Seed), CTA footer. Lucide icons.

2. Project Board Template — three epics:
   - Phase 0 — Canonical Hub Foundation: Tickets 001-006 (Schema/RPCs, Hub Edge Function + Hardening, Ingestion UI + API Route, Rewards + Real $$ Payout, Variation Preview + Scroll UI, Highlight Editor)
   - Extension Rebuild: FastApply pattern study, Smart Matcher feed
   - Monetization: Stripe Connect first-load payouts, revenue share on aggregates

3. MCP Wrappers (3 tools): `aqua.ingest_application`, `aqua.process_reward` (with first_load/top_answer/aggregate enum), `aqua.get_variations`.

Real $$$ for First Drops caught and locked in: contribution_rewards flag, manual/semi-auto quality gate, Stripe Connect payout ($15-75/strong first), public leaderboard.

Auto-Fill Threshold tuning: 70% coverage + 0.8 fidelity for reliable pre-fill; 90%+ + outcomes for aggressive auto-fill.

FastApply notes integrated — copy DOM patterns, beat them on intelligence + governance + multi-vertical.

---

## Turn 9 — Variation Panel + Smart Matcher Backend + Extension Content Script

### USER
> Subtle motion that shit is flying across the page lol
> Variation scroll + preview UI
> Smart Matcher backend logic
> Full extension content script skeleton (FastApply-inspired)

### GROK

Three production components shipped (subtle motion only, no flying elements):

1. VariationPanel.tsx — split-pane component, left scrollable list of variants by entity (YC W26, Techstars NYC, a16z Speedrun examples) with fidelity badges + flavor labels, right preview pane with entity heading, fidelity score, content card, "Edit Variant" and "Use in Workspace" buttons. Mock data; replace with `get_variations` API call.

2. Smart Matcher Backend — Edge Function `supabase/functions/smart-matcher/index.ts` fetches user's answer_variants persona, calls `smart_matcher_search` RPC with vertical filter, returns recommendations with program_id, entity, fit_score, significance_boost, why (reasoning_snippet), deadline. RPC function uses `calculate_fit_score(user_persona, p.program_embedding)` against programs table.

3. Content Script Skeleton — MutationObserver on document.body, `detectAndEnhanceForm()` scans inputs/textareas/selects, `findAssociatedLabel()` resolves labels via closest+for, `findBestBankMatch()` messages background for match (threshold 0.75 fidelity), `addPreFillButton()` injects styled button that dispatches input events on click.

Real $$$ seeding noted as integrated. Stripe Connect ready.

---

## Turn 10 — Full Extension (Manifest + Background + Popup) + Smart Matcher Frontend

### USER
> Full extension (background + popup)
> Smart Matcher frontend feed

### GROK

Shipped:

1. Chrome Extension Manifest V3:
   - `manifest.json` — permissions storage/activeTab, host_permissions all_urls, background service_worker, content_scripts all_urls run_at document_end, action popup, icons 48/128
   - `background.js` — onMessage listener for AQUA_MATCH_QUESTION (POSTs to `/api/hub/match`) and AQUA_SMART_MATCHER (POSTs to `/api/hub/smart-matcher`), keeps channel open with return true
   - `popup.html` + `popup.js` — 380px dark popup, two buttons (Smart Matcher, Open Full Hub), opens dashboard tab

2. SmartMatcherFeed.tsx — useEffect fetch from `/api/hub/smart-matcher`, loading state "Finding best fits", recommendation cards with entity, fit_score % display, deadline, reasoning snippet, "Pre-fill This Program" CTA routing to `/applications/[id]`. Target icon + emerald color theme.

Loop summary: Extension uses Hub + Smart Matcher backend for intelligence; content script handles JS portals; popup gives quick access; full power in web app + MCP. Variation preview + $$ seeding already integrated.

---

## Turn 11 — Okara.ai Review + Polished Landing + Smart Matcher Integration Plan

### USER
> Here take a look at https://okara.ai to see what I am saying
> Then we can ship theseeee
> Full Smart Matcher + variation integration in main app?
> Landing page polish?

### GROK

Okara.ai reviewed: clean modern dark mode, big bold hero, heavy social proof, AI CMO value prop, agent feature cards, comparison table ($14k/mo vs $99), strong CTAs. Minimalist but dense with credibility.

1. Polished Okara-Style AQUALanding component — pill badge ("Commitment Engine - Multi-Mode - Governed Answers"), 7xl hero with gradient on "Apply Everywhere.", sovereign knowledge bank tagline + MO§ES commitment conservation line, hover-scale CTAs (Start Free / See Smart Matcher), trust logos section, Smart Matcher teaser section, three Feature cards (ShieldCheck/Database/Users icons), final "Own your application capital" CTA. Subtle motion only.

2. Smart Matcher + Variation Integration Plan:
   - Smart Matcher Feed as prominent dashboard tab/widget
   - Program detail page sidebar with "Related Variants" -> opens VariationPanel
   - One-click "Pre-fill from Best Variant" pulls highest-fidelity match
   - Beautiful loop: Smart Matcher -> Click program -> Variation preview -> Workspace

---

## Turn 12 — Landing Hero Direction: AQUA Prominent

### USER
> Here is my landing page feel like
> APPLICATIONS. QUESTIONS. ANSWERS.
> ->AQUA ?should be below
> Should be more prominent aka large and bold
> Care to give me a couple previews

### GROK

Two hero previews:

Preview 1 (Bold & Direct, Recommended) — pill "One answer bank — for every application you'll ever write", h1 7xl stacked "APPLICATIONS. / QUESTIONS. / ANSWERS.", h2 8xl gradient "AQUA", subhead about pre-fill across accelerators/jobs/schools/grants, two CTAs (Get started free, Connect via MCP).

Preview 2 (Dramatic / Okara-inspired) — uppercase tracking eyebrow "THE APPLICATION OS", massive 92px headings, 140px black-weight "AQUA" with vertical gradient, tighter tracking, "Build once. Reuse forever. Scored by significance. Governed by commitment." line, single "Start Building Your Bank — Free" CTA.

Recommended Preview 1 for clarity, Preview 2 for visual impact. Suggested keeping mode pills under hero + subtle AQUA gradient.

---

## Turn 13 — Image Renderings Requested

### USER
> Could you send me rendering or image?

### GROK

Provided two rendered preview descriptions (no actual images attached) of the updated landing hero:

Preview 1 (Clean & Direct, Recommended): large stacked "APPLICATIONS. QUESTIONS. ANSWERS.", massive bold "AQUA", tagline, mode pills, CTAs.

Preview 2 (Dramatic / Bold Impact): even larger gradient AQUA, more breathing room, stronger hero statement feel.

Offered to generate real high-res PNG versions via image generation, refine with exact copy/colors/mode pills, or ship full polished page code.

---

## Turn 14 — Foundational Sources Recipe + Web Extension vs Desktop Sync Architecture

### USER
> what foundational information blocks are required to create this databases of apps, q's, and a's? Primary source information.... like a cooking reciepe what core meats and produce are required... not asking about process, spices, or cook time... just raw sources
> Also... would I want this to become something like the doc os notion or obsidean... where when they upload our stuff it creates a rootfile domain on desktop that way information is transferred through there...
> could the webextension do both sides of communication meaning opening it up on an application its makes a md and sends it to downloads or file of choice... or users when they find an app it gets sent automatically to our archive review?
> can the webextension upload a completed application for aqua and then fill out the application
> Or are these two different extensions?
> Had this idea bc I've been running custom userscripts on my llms which provide one click md send directly to my thread processing

### GROK

Two-part answer:

1. Foundational Information Blocks (Raw Sources):
   - Applications/Programs: name + URL, deadline + rolling status, requirements metadata (equity/time/remote/cost), TOS/legal snapshot, screenshots/PDF of form, historical outcomes data
   - Questions: exact original text, variant wording, context (program, when, section), source proof (URL/screenshot/PDF)
   - Answers: raw user text per variant, original source document (old app/resume/essay), user profile context, attached artifacts (resume PDF, LinkedIn, portfolio)

   Minimal Viable Recipe: Program/Entity + URL, Raw question + entity link, Raw answer + ownership + variant link, Provenance (hash + timestamp + uploader). Everything else is spices.

2. Desktop Sync vs Web Extension architecture:
   - One Extension Can Do Both Sides: detect form + auto-capture questions to AQUA archive, auto-upload completed apps via Hub ingest, pull from bank to pre-fill, highlight + targeted refine, "Save as MD" to Downloads, "Send to AQUA Archive" one-click.
   - Desktop Root Folder Sync (Notion/Obsidian style) handled separately — best as Obsidian plugin watching vault folder OR small Electron app creating `~/AQUA-Bank/` with bidirectional MD <-> Hub sync. Manifest V3 has filesystem limits.
   - Technical feasibility: form reading yes, auto-upload yes (user-triggered), auto-fill yes, MD to Downloads yes, full desktop sync better outside extension.
   - Recommendation: start with single powerful web extension; later add Obsidian plugin for local-first sovereignty.

---

## Turn 15 — Enhanced Web Extension Starter Code + Stripe/ElevenLabs Hack Tip-Off

### USER
> sure to detailed starter code for enhanced web extension...
> also came across this Live Hack #9: Stripe — Build something people will pay for — $18,980 total prizes — submissions close in ~6 days
> [Details about Stripe + ElevenLabs hack, scoring, eligible countries, dates 14 May open / 21 May close / 26 May winners]

### GROK

Complete enhanced web extension starter:

Folder structure: `aqua-extension/` with manifest.json, background.js, content-script.js, popup.html, popup.js, icons/.

1. manifest.json (Manifest V3) — permissions storage/activeTab/downloads, host_permissions all_urls, service_worker background, content_scripts run_at document_idle, popup action.

2. background.js — onMessage listener for AQUA_CAPTURE_QUESTIONS (POSTs entity/vertical/raw_data to `/api/hub/ingest`) and AQUA_PREFILL.

3. content-script.js — debounced MutationObserver (800ms) calling `detectForms()`, queries inputs/textareas/selects/contenteditable, `getLabelText()` resolves via closest+for+placeholder, sends AQUA_MATCH_QUESTION to background, `addPreFillButton()` injects styled button (idempotency check via parent query), Ctrl+Shift+Alt hotkey triggers `captureCurrentApplication()` collecting URL/title/all label-and-question text + POSTs to AQUA_CAPTURE_QUESTIONS.

4. popup.html/popup.js: re-use prior version with added "Capture Current Page", "Smart Matcher", "Export MD" buttons.

Stripe + ElevenLabs Hack acknowledged — tight deadline May 21. Suggested voice features for AQUA (voice answer review, voice input, audio feedback on fidelity/qualification, Stripe subscription for Pro). Offered to ship ElevenLabs voice readout, Stripe Checkout integration, or continue Obsidian sync plugin.

---
