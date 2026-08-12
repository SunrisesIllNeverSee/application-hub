# FundingCake Ingest Pipeline — Methodology & Results

_Completed: 2026-05-12 (mcp-eval session, Claude Sonnet 4.6)_

---

## What this doc is

A full audit trail of how Application Hub's FundingCake program shells were enriched.
Covers what we did, why each decision was made, what was found, and what still needs doing.
Written so any session can pick up Phase C (promotion) without re-running discovery.

---

## Background

**819_source** of 843 total programs is `fundingcake` — a curated funding platform that
harvested program metadata. FundingCake captured program names, types, organization info,
and website homepages. What it did NOT capture: the actual intake page (`apply_url`) or
any question wording.

These are not empty shells — they're real funded entities. The gap was purely `apply_url`.

---

## Pipeline overview

```
Phase A — Homepage → apply_url discovery   (10 agents × 79 programs, ~18 min)
Phase B — apply_url → question extraction  (10 agents × 16 programs, ~25 min)
Phase C — Human review → Supabase write    (manual)
```

All output lives in `seed/staging/`. Nothing was written to Supabase yet.

---

## Phase A — apply_url Discovery

### What we did

1. Queried Supabase for all FundingCake programs with `url IS NOT NULL AND apply_url IS NULL` → **782 programs**
2. Prioritized by type: accels first, then fellowships, then VCs, then other
3. Split into 10 batches of ~78 programs each → `seed/staging/batches/batch_NN.json`
4. Launched 10 parallel agents, each scraping homepages via Firecrawl + curl fallback
5. Agents looked for links with text/href patterns matching: apply, apply now, register,
   nominate, pitch, submit application, start application
6. Applied docs/21 policy: VCs only valid if they have a structured intake with real
   questions — not "email your deck" or generic contact forms

### Results

| Confidence | Count | % | Notes |
|---|---|---|---|
| high | 160 | 20% | Clear apply CTA + apply-pattern href confirmed |
| medium | 132 | 17% | Apply surface inferred but form not confirmed |
| low | 66 | 8% | Weak signal, best guess |
| not_found | 395 | 51% | No apply surface found |
| error | 29 | 4% | DNS failures, 403s, LinkedIn-only URLs |

**By type:**

| Type | Total | High | % high |
|---|---|---|---|
| accel | 299 | 71 | 24% |
| other | 190 | 64 | 34% |
| vc | 289 | 25 | 9% |
| fellowship | 4 | 0 | 0% |

The VC not_found rate (72%) is structurally correct — most VCs are intro-driven with no
public application surface. This is consistent with docs/21 policy.

"Other" programs (hackathons, events, competitions) had the highest hit rate because events
need a public registration/apply flow to function at all.

### Known false positives in "high" results

Several university-affiliated incubators were flagged high confidence with university
admissions URLs, not the incubator's own intake:
- `biomedical-zone`, `brampton-venture-zone`, `clean-energy-zone` → `torontomu.ca/admissions/`
- `bengal-entrepreneurship-program` → `buffalostate.edu/apply`
- `babson` (Centre for Women's Entrepreneurial Leadership) → `babson.edu/undergraduate/how-to-apply`
- `2bx` → `/jobs/` (jobs board, not startup intake)

These were correctly caught in Phase B and marked `none_found`. The staging review step
exists precisely for this.

### Output file

`seed/staging/fundingcake_apply_urls.csv` — 782 rows
Columns: `slug, name, type, homepage_url, discovered_apply_url, confidence, notes`

---

## Phase B — Question Extraction

### What we did

1. Took the 160 high-confidence apply_urls from Phase A → `seed/staging/phase_b_queue.csv`
2. Split into 10 batches of 16 programs → `seed/staging/phase_b_batches/batch_NN.json`
3. Launched 10 parallel agents, each:
   - Scraped the apply_url via Firecrawl + curl fallback
   - Extracted substantive question text (textarea labels, numbered prompts, "Tell us /
     Describe / What / Why / How" patterns)
   - Skipped non-questions: name, email, company name, phone, file upload, funding stage
     dropdowns, checkbox fields
   - Queried Supabase `archived_questions` (225 rows, ordered by significance_score)
   - Matched each extracted question to the archive by text similarity

### What "AcceleratorApp" is

AcceleratorApp (acceleratorapp.co) is a purpose-built SaaS platform that many accelerators
use as their dedicated application management system — the equivalent of an ATS for
accelerator intake. Programs like UofT Entrepreneurship, The Hub, Treefrog Accelerator, and
ON Ramp use it. The form is fully React/JS-rendered: field labels never appear in static
HTML and require a real browser session to access. The browser extension (Phase C) will
handle AcceleratorApp natively when users visit these portals.

### The JS-rendering wall

~70% of apply pages use JS-rendered form platforms:

| Platform | Extractable? | Notes |
|---|---|---|
| Formstack | Yes | Returns static HTML with field labels |
| GravityForms | Yes | Standard HTML form embedded in WordPress |
| FormAssembly | Yes | Static HTML |
| Pardot (Salesforce) | Partial | Some form fields visible in HTML |
| Tally.so | Partial | Some static content accessible |
| Typeform | No | Full JS — only if ID embedded in page source |
| Airtable | No | Full JS, requires browser |
| AcceleratorApp | No | Full JS, requires browser |
| Google Forms | No | Requires sign-in or JS execution |
| Microsoft Forms | No | Full JS |
| F6S | No | Bot-protected |

The browser extension (Phase C) is the clean answer to all the JS-gated platforms.

### Results

| Outcome | Count |
|---|---|
| Programs with extractable questions | 21 |
| Total questions extracted | 88 |
| **Promote-ready (high confidence)** | **39** |

**Programs with the most complete applications found:**

| Program | Type | Questions | Similarity range | Source platform |
|---|---|---|---|---|
| MaRS Discovery District | accel | 13 (9 promote-ready) | 0.38–0.98 | Formstack |
| Greentown Labs | accel | 8 | 0.72+ | FormAssembly |
| Bethnal Green Ventures | vc | 6 | 0.90–0.98 | Static HTML |
| District 3 Innovation | accel | 6 | — | Typeform (JS extraction) |
| eLab Cornell University | accel | 6 | 0.74+ | FormAssembly |
| Startup Garage | accel | 6 | 0.37–0.70 | Monday.com static |
| Women in Cleantech RBC | accel | 5 | 0.83–0.98 | MaRS Formstack |
| The Forum | accel | 5 | 0.78–0.85 | Static HTML |
| Creative Destruction Lab | accel | 4 | — | Pardot |
| MaRS IAF | vc | 4 | — | Formstack |
| 1984 Ventures | vc | 3 | 0.82–0.91 | Static HTML |
| GreenSky Ventures | vc | 3 | — | Static HTML |
| Storm Ventures | vc | 3 | — | Typeform (JS extraction) |
| Fuel Venture Capital | vc | 5 | — | SPA JS extraction |

### Complete applications (all major intake questions captured)

These programs had enough questions extracted to constitute a near-complete application
audit — meaning a founder could use the archived questions to prepare for the real form:

- **Bethnal Green Ventures** — 6 questions, 0.90–0.98 similarity. Covers: venture
  description, tech scale, impact evidence, inequality, team, stage/prototype.
- **1984 Ventures** — 3 questions, 0.82–0.91. Covers: team, problem, solution advantage.
- **Women in Cleantech RBC** — 5 questions, 0.83–0.98. Covers: company overview, stage,
  market, team, support needed.
- **MaRS Discovery District** — 13 extracted (9 promote-ready, 4 low similarity). Full
  intake: description, MVP, value prop, differentiation, competitors, milestones, market,
  validation, product/solution.

### Output files

- `seed/staging/fundingcake_questions.csv` — 88 rows (all extracted questions)
- `seed/staging/fundingcake_questions_promote.csv` — 39 rows (high confidence matches)

Columns: `slug, program_name, type, apply_url, extracted_question, matched_question_id,
matched_question_text, similarity, confidence, recommendation`

**Citation:** every row has `apply_url` as the source URL (the exact page scraped),
`matched_question_id` linking to `archived_questions.id`, and `similarity` score.

### Known issues to fix before promotion

1. **MaRS similarity scores are low** (0.38–0.46) despite being classified as promote.
   MaRS uses heavily paraphrased question wording. Recommend manual review of all 9 MaRS
   rows before promoting — they should be `review` not `promote`.

2. **Some university admissions URLs slipped through** Phase A high-confidence list.
   Phase B agents correctly returned `none_found` for these — they will not appear in
   the promote CSV. No action needed.

3. **Firecrawl credits exhausted** mid-Phase-B. Agents fell back to curl. JS-rendered
   forms missed as a result. These programs are not lost — the browser extension will
   capture them when users visit. Alternatively, a targeted Firecrawl headless-browser
   re-run on the top 20 AcceleratorApp/Airtable URLs would cover the remainder.

---

## Phase C — Promotion (not yet done — requires human review)

### Step 1 — Review the promote CSV

Open `seed/staging/fundingcake_questions_promote.csv` (39 rows). For each row:
- Does the extracted question match the original portal wording? (check `apply_url`)
- Does the archive match make sense? (check `matched_question_text` + `similarity`)
- Flag: MaRS rows with similarity <0.50 should be downgraded to `review`

### Step 2 — Update programs.apply_url

For each program in the promote CSV, run:

```sql
UPDATE programs
SET apply_url = '<discovered_apply_url>'
WHERE slug = '<slug>';
```

Source: `seed/staging/fundingcake_apply_urls.csv` (column: `discovered_apply_url`)

### Step 3 — Insert program_questions

For each promote-ready question:

```sql
INSERT INTO program_questions (
  program_id, archived_question_id, asked_as, source, source_url
)
SELECT
  p.id,
  '<matched_question_id>',
  '<extracted_question>',
  'fundingcake_ingest',
  '<apply_url>'
FROM programs p
WHERE p.slug = '<slug>'
ON CONFLICT DO NOTHING;
```

Only insert for similarity ≥ 0.70 unless manually verified.

### Step 4 — Medium-confidence follow-up

132 programs had medium-confidence apply_urls but weren't scraped in Phase B.
These are worth a targeted pass once the extension is live — users visiting those portals
will trigger organic extraction. Alternatively, a manual pass on the top 20 accels in
the medium-confidence list.

---

## What the browser extension covers that this pipeline couldn't

Phase B was blocked by JS-rendered forms (~70% of the 160 apply pages). The extension
solves this because it runs in a real browser session with the user already logged in.
When a user visits any of the following via the extension:

- AcceleratorApp portals (UofT, The Hub, Treefrog, ON Ramp, etc.)
- Airtable forms (Everywhere, Front Row Ventures, Capitalize VC, etc.)
- Typeform portals (New Ventures BC, eCommerce North, Founders Factory, etc.)
- Google Forms (Catalyze CU, Transmedia Zone, etc.)
- Microsoft Forms (Launch NY, UTEST, etc.)

...the extension's content script will detect the field labels and call `/api/match-question`
to surface archived answers. That's when question mapping for these programs happens
organically, without any manual seeding pass.

---

## Related docs

- `docs/21_curated_ingest_lane.md` — ingest policy and boundary rules
- `docs/23_v1_automation_plan.md` — browser extension V1 spec
- `seed/staging/README.md` — staging lane usage
- `seed/staging/fundingcake_apply_urls.csv` — Phase A master (782 rows)
- `seed/staging/fundingcake_questions_promote.csv` — Phase B promote queue (39 rows)
