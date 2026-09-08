# Application Canon — Process Map

**Status:** Planning document, open for edits
**Created:** 2026-09-06
**Owner:** Deric / Ello Cello
**Purpose:** Map the full application process, the AQUA product turns, internal archiving, and gaps before designing the SKU system.

---

## 1. The User Process

The full flow a user (or Deric) takes to fill out an application, regardless of domain (jobs, funding, college).

```
DISCOVER → INDEX → CAPTURE → CATEGORIZE → MATCH → DRAFT → FILL → STRESS TEST → SUBMIT → ARCHIVE OUTCOME
```

| Step | What the user does | What they need |
|---|---|---|
| **Discover** | Find an opportunity (job posting, accelerator, college, grant) | A URL, a PDF, or pasted text |
| **Index** | The system records who is asking (company/funder/school) | A company profile gets created or matched |
| **Capture** | The system pulls questions out of the posting/application | Questions extracted from the source |
| **Categorize** | Each question gets tagged by domain + universal theme | Domain (jobs/funding/college), theme (background, competency, etc.) |
| **Match** | The system finds existing answers that already fit this question | Answer bank search by theme + significance |
| **Draft** | User writes or refines an answer for this specific target | A variant of an existing answer, or a new one |
| **Fill** | The answer goes into the actual application form | Browser extension or manual paste |
| **Stress test** | The answer gets probed for weak spots | RNS/MO§ES review layer |
| **Submit** | The application goes out | Status logged |
| **Archive outcome** | Accepted / rejected / waitlisted gets recorded | Outcome feeds back into fit scoring |

### Notes

- This process is the same whether the user is applying to YC, a job at Google, or Harvard MBA.
- The domain changes the surface (what the application looks like) but not the steps.
- Steps 1-4 are ingestion. Steps 5-6 are reuse. Steps 7-9 are execution. Step 10 is feedback.

---

## 2. The Three Application Domains

| Domain | What it covers | Example entities | Example questions |
|---|---|---|---|
| **Jobs** | Job applications, cover letters, role-specific prompts | Google, Stripe, a startup, Ello Cello (when hiring) | "Tell me about yourself", "Why this role?", "Describe a challenge you overcame" |
| **Funding** | Accelerators, VC, grants, fellowships for startups/projects | Y Combinator, Techstars, NSF SBIR, Echoing Green | "What's your traction?", "What problem are you solving?", "Why this program?" |
| **College** | College, grad school, MBA, scholarship applications | Harvard, Stanford, Columbia MBA, Rhodes Scholarship | "Personal statement", "Why this school?", "Describe your research interests" |

### Universal themes (cross-domain)

These normalize questions across domains so the same concept links even when the wording differs:

| Universal theme | Jobs | Funding | College |
|---|---|---|---|
| `background` | experience | team | academic_background |
| `competency` | skills | traction | activities |
| `problem` | challenge | problem | research_gap |
| `approach` | methodology | solution | research_plan |
| `impact` | scope | market | contribution |
| `motivation` | culture_fit | vision | goals |
| `personal` | personal | personal | personal_statement |
| `fit` | role_fit | program_fit | program_fit |
| `general` | (other) | (other) | (other) |

---

## 3. AQUA Product Turns (Current State)

What the AQUA app and MCP server can actually do today, mapped to the user process.

| Process step | MCP tool / API route | App surface | What it does | Status |
|---|---|---|---|---|
| **Discover** | `hub_search_programs`, `hub_get_program_rankings`, `hub_find_best_programs`, `hub_get_heat_scores` | `/hub`, `/today`, `/funders` | Search and rank 842 programs | Working (founder domain only) |
| **Index** | `hub_get_program_by_slug`, `hub_get_program_detail` | `/funders` (partially) | Look up a program by slug | Partial — no "create company" tool, no separate funders table |
| **Capture** | `hub_intake_application` | `/api/import` | Ingest pasted application text, extract questions | Working but only pasted text — no PDF, no URL scrape, no bulk import |
| **Categorize** | `hub_get_program_dna`, `hub_get_program_questions`, `hub_find_similar_questions`, `hub_get_universal_questions`, `hub_get_question_significance` | `/questions`, `/archive` | Tag questions by theme, score significance, find duplicates | Working for founder domain. Jobs and college domains in taxonomy but not populated |
| **Match** | `hub_search_answer_bank`, `hub_get_profile_answers`, `hub_rank_my_answers`, `hub_get_fit_score`, `hub_get_application_readiness` | `/answers`, `/smart-matcher` | Find existing answers, compute fit, rank by coverage | Working within single domain. Cross-domain matching designed but not surfaced |
| **Draft** | `hub_save_answer`, `hub_log_draft_run` | `/workspace`, `/api/draft` | Save answer, track AI draft usage | Working but no variant tracking — one answer per question, no "YC version" vs "job version" |
| **Fill** | `hub_fill_application` | Browser extension | Fill application fields from answer bank | Extension exists but only manual assist mode. No auto-fill from bank |
| **Stress test** | `hub_stress_test_answer`, `hub_get_answer_review_context`, `hub_save_answer_review`, `hub_set_borrow_threshold` | `/api/stress-test` | Probe answers, persist reviews | Working |
| **Submit** | (none) | (none) | No submit tracking | **GAP — no tool, no table, no UI** |
| **Archive outcome** | `hub_get_acceptance_stats` | (none in UI) | Aggregate stats only | **GAP — no per-application outcome log** |

### MCP tool inventory (21 tools)

**Programs (5):**
- `hub_search_programs`
- `hub_get_program_by_slug`
- `hub_get_program_detail`
- `hub_get_program_rankings`
- `hub_get_heat_scores`

**Questions (4):**
- `hub_get_program_questions`
- `hub_get_program_dna`
- `hub_find_similar_questions`
- `hub_get_universal_questions`

**Intelligence (2):**
- `hub_get_question_significance`
- `hub_get_acceptance_stats`

**User (10):**
- `hub_find_best_programs`
- `hub_get_fit_score`
- `hub_get_application_readiness`
- `hub_get_profile_answers`
- `hub_search_answer_bank`
- `hub_rank_my_answers`
- `hub_save_answer`
- `hub_log_draft_run`
- `hub_fill_application`
- `hub_intake_application`
- `hub_stress_test_answer`
- `hub_get_answer_review_context`
- `hub_save_answer_review`
- `hub_set_borrow_threshold`

---

## 4. Internal Archiving (What the Database Holds)

| Table | What it holds | Archiving behavior | Gaps |
|---|---|---|---|
| `programs` | 842 opportunities | Company + program in one row | No separate funders/companies table. Company data embedded in program row. |
| `archived_questions` | 225 deduplicated questions | Significance scored, universal flagged, theme tagged | Only founder domain populated. Jobs and college questions not archived. |
| `program_questions` | Per-program phrasing/limits | Links questions to programs with word limits | Works. No cross-domain question linking. |
| `program_dna` | Theme weight breakdown per program | Computed from questions via cron | Works for founder. No DNA for jobs or college. |
| `profile_answers` | User's answer bank | Per-user, per-question | No variant tracking. One answer per question. No "this is the YC version." |
| `user_program_fit` | Fit scores | Per user × program | Works for founder. No fit scoring for jobs or college. |
| `answer_reviews` | Persisted review output | Per answer | Works. |
| `answer_stress_tests` | Stress test runs | Per answer | Works. |
| `ai_draft_runs` / `ai_usage` | Draft tracking | Per user | Works. |
| `user_integrations` | BYOK metadata | Per user | Works. |
| **(missing)** | **Application submissions** | **—** | **No table. No way to log "I submitted this application on this date."** |
| **(missing)** | **Application outcomes** | **—** | **No table. No way to log "YC W26: rejected" or "Google SWE: accepted."** |
| **(missing)** | **Answer variants** | **—** | **No table. No way to store multiple versions of an answer for different targets.** |
| **(missing)** | **Companies/funders** | **—** | **No table. Company data trapped inside program rows. VISION doc calls for this but not built.** |

---

## 5. Gap Analysis

### By process step

| Step | Gap | Impact |
|---|---|---|
| **Discover** | Only founder domain has programs. No job board integration, no college program catalog. | High — blocks jobs and college domains entirely |
| **Index** | No separate company/funder entity. Company data embedded in programs. | High — can't profile a company independently of its programs |
| **Capture** | Only pasted text. No PDF parsing, no URL scraping, no bulk import. | Medium — manual paste works but doesn't scale |
| **Categorize** | Jobs and college domains in taxonomy but not populated. No questions archived for those domains. | High — blocks cross-domain answer reuse |
| **Match** | Cross-domain matching designed but not surfaced. Same question across domains not linked. | Medium — works within founder, blocks the portability moat |
| **Draft** | No variant tracking. One answer per question. Can't store "YC version" vs "job version" of the same answer. | High — user has to re-write for every target |
| **Fill** | Extension exists but only manual assist. No auto-fill from answer bank. | Medium — manual works but slow |
| **Stress test** | Works. | None |
| **Submit** | No tracking at all. No tool, no table, no UI. | High — can't track what's been submitted |
| **Archive outcome** | Only aggregate stats. No per-application outcome log. | High — can't close the feedback loop |

### By domain

| Domain | Current state | What's missing |
|---|---|---|
| **Funding** | Working. 842 programs, 225 questions, fit scoring, stress testing. | Variant tracking, submit logging, outcome logging, separate funders table |
| **Jobs** | Taxonomy exists. Nothing populated. | Everything — programs, questions, answers, fit scoring, capture, fill |
| **College** | Taxonomy exists. Nothing populated. | Everything — programs, questions, answers, fit scoring, capture, fill |

---

## 6. SKU Design Questions (To Resolve Before Formatting)

### Q1: What entity types need SKUs?

Based on the process, the candidate entities are:

| Entity | Description | Needs SKU? |
|---|---|---|
| Domain | jobs / funding / college | Maybe — could be a prefix rather than a standalone SKU |
| Company | The entity creating the application (YC, Google, Harvard) | Yes |
| Application | A specific cycle or posting (YC W26, Google SWE job posting, Harvard MBA 2026) | Yes |
| Question | An archived question ("Tell me about yourself") | Yes |
| Answer | A user's answer to a question | Yes |
| Answer Variant | A target-specific version of an answer (YC version, job version) | Yes |
| Outcome | The result of a submitted application (accepted/rejected/waitlisted) | Maybe — could be a status field on Application |
| Review | A stress test or review of an answer | Maybe — could be a child of Answer |

**Open question:** Should Domain, Outcome, and Review get their own SKUs, or are they attributes of other entities?

### Q2: What does each SKU reference?

The traceability chain:

```
Domain → Company → Application → Question → Answer → Answer Variant
                                                    → Review
                                                    → Stress Test
```

- An Answer Variant references its Question
- A Question references its Application (or multiple applications)
- An Application references its Company
- A Company references its Domain

**Open question:** Should a Question reference an Application, or should the Application reference Questions? Currently `program_questions` is a join table — the link goes both ways. Which direction is canonical for the SKU?

### Q3: Where does the SKU live?

| Option | Source of truth | Sync target | Tradeoff |
|---|---|---|---|
| A | Database (Supabase column) | Canon files (frontmatter) | DB is authoritative, canon is projection. Matches current architecture. |
| B | Canon files (frontmatter) | Database (Supabase column) | Canon is authoritative, DB is projection. Matches social profile canon pattern. |
| C | Both (bidirectional sync) | Either can initiate | Most flexible but most complex. Risk of conflicts. |

**Open question:** The social profile canon uses Option B (canon is source of truth). AQUA's architecture doc says "database remains the source of truth." Which wins for the application canon?

### Q4: Does a SKU survive across domains?

"Tell me about yourself" appears in jobs, funding, and college. Options:

| Option | Behavior | Tradeoff |
|---|---|---|
| A | One Question, one SKU, tagged with `domain: general` | Simple. But can't track domain-specific phrasing or word limits. |
| B | Three Questions, three SKUs, linked by `universal_theme: background` | Preserves domain-specific metadata. But the same question exists 3 times. |
| C | One Question SKU + per-domain "phrasing" records | Question is universal, phrasing is per-domain. Matches `program_questions` pattern. |

**Open question:** Option C matches the existing `archived_questions` + `program_questions` pattern. Should the SKU follow that, or simplify?

### Q5: What about the user's identity?

The social profile canon (CURRENT_PROFILE_CANON.md) holds Deric's identity — name, title, bio, links. The SEO profile holds business context. Where does the resume/cover letter identity live?

| Option | Location | Tradeoff |
|---|---|---|
| A | In the application canon (new file) | Self-contained. But duplicates identity from social profile canon. |
| B | Reference the social profile canon | No duplication. But the application canon depends on another canon. |
| C | A shared "identity canon" that both reference | Cleanest separation. But adds another layer. |

**Open question:** The resume is identity material. The social profile is identity material. Are they the same canon or different canons that share a root?

---

## 7. Next Steps

1. **Resolve SKU questions** (Section 6) — these block the SKU format design
2. **Decide canon location** — AQUA docs/ (current) vs. neutral Codex location vs. both
3. **Design SKU format** — after Q1-Q5 are answered
4. **Build the gap features** — submit tracking, outcome logging, answer variants, separate companies table
5. **Populate jobs and college domains** — archive questions, seed programs, compute DNA
6. **Wire the canon to the database** — sync layer between files and Supabase

---

## Changelog

- 2026-09-06: Initial process map created. Covers user process, AQUA turns, internal archiving, gap analysis, and SKU design questions.
