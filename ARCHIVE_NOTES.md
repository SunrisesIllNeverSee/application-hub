# ARCHIVE NOTES — Application Hub / AQUA

_Frozen: 2026-05-14_

This document closes out the **first build** of Application Hub / AQUA and hands
context cleanly to the **rebuild**.

It exists because:

1. The intelligence engine in this repo is real, working, and worth preserving.
2. The seed data the engine was operated on is synthesized fiction.
3. The communication structure that produced (1) at the cost of (2) needs to
   change for the rebuild — and the spec for that new structure lives here.

This conversation chain is **archival**. Do not continue active development
in the session that produced this. New work starts in a clean session pointing
at the rebuild doc.

---

## 1. The honest split — what survives, what dies

### REAL — survives the rebuild as-is

**Schema & infrastructure** (`migrations/001`–`041`):
- `archived_questions`, `programs`, `program_questions`, `profile_answers`,
  `user_applications`, `user_program_fit`, `program_dna`, `user_subscriptions`,
  `user_integrations`, `community_messages`, `starter_packages`,
  `app_import_sessions`, `answer_reviews`, `answer_stress_tests`,
  `credit_events`, `user_credit_balance`, `user_question_unlocks`,
  `user_achievements`, `recruiter_alerts`, `user_profiles`
- All RLS policies, enums, indexes, triggers, search_path pins, embeddings
  (pgvector + nomic-embed-text 768d), nightly cron jobs

**Intelligence engine — the math:**
- `compute_significance_score()` →
  `asked_by_count × avg_word_limit_weight × theme_prestige × universal_bonus`
- `compute_program_dna()` → aggregates question themes per program into weight
  breakdown
- `compute_user_program_fit()` →
  `coverage × 0.40 + theme_alignment × 0.35 + criteria_match × 0.15 + quality_signal × 0.10`
- `compute_heat_scores()` (migration 037)
- Composite `fit_score × program_value / 100`
- AQUAscore composition (`lib/aquascore.ts` — 3-pillar additive)
- pgvector similarity matching RPC

**MCP server** (`application-hub-mcp-server/`):
- 21 tools, 7 resources, 3 prompts — TypeScript, strict, 69 vitest tests
  passing, plugin-eval 100/100 Grade A
- Two transports: `stdio` (Claude Desktop / Cursor / Windsurf) and `http`
- Both `.logic.ts` extraction and Codex plugin manifest in place
- App-support tools: `hub_get_program_by_slug`, `hub_save_answer`,
  `hub_get_answer_review_context`, `hub_save_answer_review`,
  `hub_stress_test_answer`

**App code** (Next.js):
- Auth: email+password primary, GitHub OAuth, magic-link fallback (Resend SMTP)
- Onboarding gate (migration 040), Starter / Upload paths
- `/dash` (AQUAscore command center), `/applications` (Discover / My Apps /
  Funders tabs), `/questions` (My Questions / Full Archive), `/answers`
  (VS-Code-style tree), `/workspace/[program_id]` (split-screen editor +
  `SubmissionExport`)
- `/workstation` (Import + Export tabs) — the unified input/output page added
  in this session's final cleanup
- `/profile/integrations` BYOK form (Anthropic, OpenAI, Google, Ollama)
- AI drafting (`/api/draft`) with BYOK-first routing, platform fallback, BYOK
  fallback on Ollama via ngrok (with `ngrok-skip-browser-warning` header)
- Import pipeline (`/api/import/paste`) with BYOK Anthropic fallback added
- Stripe live ($19 Pro), beta-mode transition wiring (migration 041)

**User data — all real:**
- Every `profile_answer` written by every real user
- Every `user_application` created
- Every saved BYOK integration
- Every `community_messages` thread
- Every `app_import_sessions` row from real paste-imports

### SYNTHESIZED — gets wiped on rebuild, refilled from real applications

**Rows, not code:**

- `program_questions` for the originally-seeded 30 programs — every row is a
  best-guess question. The schema is right; the contents are fiction.
- `archived_questions` — the table is real and works perfectly, but the rows
  that originated from the synthesized seed are themselves synthetic. Real
  imported questions (via `/workstation` Import) sit alongside them and are
  legitimate.
- `program_dna` — derived from synthesized `program_questions`, so the
  per-program theme weights are computing fiction. RPC is real, output is fake.
- `user_program_fit` — derived from synthesized `program_dna`, so user-to-
  program fit scores are fiction. RPC is real, output is fake.
- `significance_score` on `archived_questions` — same: derived from
  synthesized inputs.
- Theme assignments on synthesized `archived_questions` — guessed at seed time.
- Program metadata: names and URLs are mostly real (YC, TechStars, Antler,
  Sequoia Arc, a16z TxO, etc. all exist), but deadlines, cohort dates,
  criteria fields, and program-specific copy were sketched.

### Reset recipe (one migration, when the rebuild is ready)

```sql
-- Wipe synthesized data only. Real user-generated data is untouched.
DELETE FROM user_program_fit
  WHERE program_id IN (<seeded-30-program-ids>);

DELETE FROM program_dna
  WHERE program_id IN (<seeded-30-program-ids>);

DELETE FROM program_questions
  WHERE program_id IN (<seeded-30-program-ids>);

-- archived_questions: keep rows referenced by real profile_answers or real
-- program_questions rows. Delete orphans created only by the synthesized seed.
DELETE FROM archived_questions aq
  WHERE NOT EXISTS (SELECT 1 FROM profile_answers   WHERE archived_question_id = aq.id)
    AND NOT EXISTS (SELECT 1 FROM program_questions WHERE archived_question_id = aq.id);

-- Programs themselves: keep — name/URL is real. Mark unverified.
ALTER TABLE programs ADD COLUMN IF NOT EXISTS questions_status TEXT
  CHECK (questions_status IN ('unverified', 'partial', 'verified'))
  DEFAULT 'unverified';

UPDATE programs SET questions_status = 'unverified'
  WHERE id IN (<seeded-30-program-ids>);
```

Then real applications get imported via `/workstation` and the engine relights.

---

## 2. Final thoughts

### What was supposed to happen

> Get 10 to 30 real applications.
> Itemize everything on them — blanks, info boxes, questions.
> Aggregate them.
> Build the import/export template out of the aggregate.
> That structure becomes the system.

Five steps. Zero synthesis. The structure of the data falls out of what real
applications actually contain. Deric had 10 applications already saved when
this project began.

### What actually happened

A synthesized 30-program seed was built first to "demonstrate" the schema.
Then the intelligence layer (significance, DNA, fit) was layered on top.
Then the app was built to surface those scores. The intelligence layer
produced real numbers — but the numbers were computed on fictional inputs,
so every score told a story about a world that didn't exist.

The synthesized seed was fine as a one-off demo. Treating it as a foundation
to build the rest of the system on top of is what made it a house of cards.

### What I should have done

Asked for the 10 real applications on day one. Built nothing else until they
were ingested. The schema would have emerged from the actual shape of those
applications. The intelligence layer would have started life with real inputs.
Everything downstream — fit scores, DNA, recommendations, the MCP tools —
would have been meaningful from the first run.

### What the rebuild keeps

The engine. The schema is correct. The math is correct. The MCP server is
correct. The app code is correct. None of that gets thrown away. The rebuild
is a data-layer reset, not a code rebuild.

### What the rebuild changes

Order of operations. **Real data goes in first. Structure validates against
the data. Intelligence runs on the validated structure.** No synthesis at
the foundation layer.

---

## 3. Communication structure for the new build

The pattern below is what the rebuild session should establish on day one.
The previous build's communication failed because there was no explicit
contract for "is this real or synthesized" and no checkpoint that forced
verification before downstream work was layered on. The new structure adds
those checkpoints.

### 3.1 Files the new build must keep updated

| File | Purpose | Update cadence |
|---|---|---|
| `REBUILD.md` | The active rebuild plan. Single source of truth for what's being built right now. Updated when scope changes. | On scope change |
| `CLAUDE.md` | Persistent project context for any Claude/Cowork session. Architecture at a glance, env vars, conventions, what to never do. Replaces this repo's CLAUDE.md when rebuild starts. | On architecture change |
| `STATUS.md` | What's shipped, what's confirmed, what's in flight. Distinguishes "in repo" from "live in DB" from "real data" from "synthesized stub." Every row in every list says which. | After every session |
| `TASKS.md` | Prioritized active task list. Each task has a clear "done" condition. | Daily |
| `DATA_PROVENANCE.md` | **New, mandatory.** A ledger of every seed row's origin. Either "imported from <source>" with a pointer to the import-session id, or explicitly "synthesized — do not build foundational logic on this." | On every seed/import |
| `ARCHIVE_NOTES.md` | This file. Frozen reference for what came before. Never edited after the first commit of the new build. | Never |

### 3.2 Reality-check banner — required at top of CLAUDE.md and STATUS.md

Every persistent doc that downstream sessions read first must carry a banner
in the first 10 lines that answers:

- What's REAL right now?
- What's SYNTHESIZED right now?
- When was this last verified?
- Which file holds the row-level provenance ledger?

If the banner is missing, the assumption is "everything in this doc is
unverified" and the session pauses to verify before proceeding.

### 3.3 Hard checkpoints before building anything downstream

The rebuild adopts three explicit checkpoints. Each one **blocks** further
work until cleared.

**CHECKPOINT 1 — Schema validation**
- Does the schema accommodate every field that appears in the 10+ real
  imported applications?
- No fields invented for the schema that aren't present in real inputs.
- No fields present in real inputs that the schema can't hold.
- Sign-off: `DATA_PROVENANCE.md` shows ≥10 import-session rows of source =
  "real_application" and the schema covers all observed fields.

**CHECKPOINT 2 — Intelligence engine inputs**
- Significance, DNA, and fit RPCs only run after Checkpoint 1 clears.
- Output of each RPC is sanity-checked against a human-readable
  expectation derived from the real seed.
- Sign-off: a short markdown table in STATUS.md showing "for the 5 most
  asked questions across the real seed, here's their significance ranking
  — does this match intuition?" answered "yes."

**CHECKPOINT 3 — UI surfaces**
- No score, no badge, no ranking, no recommendation surfaces in the UI
  until Checkpoint 2 clears.
- Until then, the UI shows the underlying data only — questions, answers,
  programs as plain lists.

### 3.4 The "synthesize only with permission" rule

Code may be written without explicit permission. **Data may not.** Any time
the agent is about to write rows that represent real-world entities
(programs, questions, applications), it must:

1. Identify the rows as "synthesized" or "real-source."
2. If synthesized, get explicit per-batch permission from the user.
3. Tag every synthesized row with `provenance = 'synthesized:<session-id>'`
   so it can be queried and removed cleanly.
4. Log the batch into `DATA_PROVENANCE.md`.

A "synthesized for testing only, demo-grade" tag is acceptable; promoting
those rows to foundational status requires re-running through Checkpoint 1.

### 3.5 Session-start ritual

Every new Claude/Cowork session in the rebuild starts by:

1. Reading `CLAUDE.md` reality-check banner.
2. Reading `STATUS.md` last-session summary.
3. Reading `DATA_PROVENANCE.md` top section ("current REAL vs SYNTHESIZED
   ratio for each table").
4. Reading the active `TASKS.md` top 3 items.
5. Confirming the active checkpoint state (1, 2, or 3 cleared).
6. Asking the user one question only if any of the above is unclear —
   never proceeding on assumption.

### 3.6 Session-end ritual

Every session ends by:

1. Updating `STATUS.md` with what shipped this session (one paragraph),
   distinguishing code changes from data changes.
2. Updating `DATA_PROVENANCE.md` if any rows were added/removed.
3. Updating `TASKS.md` (mark done, add new, re-prioritize).
4. Committing all of the above in the same commit as the code changes.

Code commit without doc commit = incomplete session.

### 3.7 Explicit anti-patterns from this build, to be avoided

- Building intelligence formulas before real input data exists.
- "Demoing" the engine against synthesized data and then forgetting to swap
  in real data before downstream work continues.
- Letting documentation lag behind code (this is how "what's real" gets lost).
- Conflating schema correctness with data correctness in status docs.
- Assuming an earlier agreement covers a current decision when the data
  state has changed underneath.

### 3.8 What the agent owes the user

- Honesty about what's real, every time, without being asked.
- Refusing to layer downstream work on a foundation marked "synthesized."
- Surfacing the synthesized/real split in every status update without
  hiding it behind progress claims.
- Asking before generating data that represents real-world entities.
- Treating a 10-application seed as 10x more valuable than a 30-program
  synthesized seed, because it is.

---

## 4. What to point the new session at on day one

```
1. Open a fresh Claude / Cowork session in a new directory or branch.
2. Paste in:
   a. The REBUILD.md you've already designed.
   b. The 10 real applications (PDFs, screenshots, pasted text — whatever).
   c. A pointer to this ARCHIVE_NOTES.md as background only ("read for
      context — do not treat as active state").
3. The first task in TASKS.md is: "Import the 10 applications. Build
   schema if needed. Pass Checkpoint 1."
4. Nothing else gets touched until Checkpoint 1 clears.
```

That's the handoff. Engine survives. Data resets. Communication structure
levels up. The order of operations finally matches the order Deric asked for
on day one.

---

_End of archive._

---

## 5. Investment ledger — what this build actually cost

Recorded for the rebuild's reference, so the next session knows the scale of
what came before.

### Token spend on this project

| Period | Cost | Tokens |
|---|---|---|
| Feb 2026 | $10 | 14M |
| Mar 2026 | $68 | 112M |
| Apr 2026 | $608 | 891M |
| May 2026 (through 05-14) | $901 | 1.5B |
| **Total** | **~$1,587** | **~2.51B** |

Total sessions: ~355,920. Models used: opus-4-7, sonnet-4-6, haiku-4-5,
opus-4-6 (early).

### Peak days

| Date | Cost | Theme |
|---|---|---|
| 05-10 | $164.75 | AQUA rebrand, onboarding gate, applications restructure |
| 05-11 | $209.95 | Beta-mode plan, intelligence layer, MCP polish |
| 05-12 | $207.81 | AQUAscore, BYOK integrations, paste-import pipeline |
| 05-04 | $97.58 | Intelligence layer iteration |
| 05-01 | $113.03 | Schema work, fit-scoring RPCs |

### Honest accounting

A non-trivial fraction of that spend was layered on top of the synthesized
seed. The engine, schema, MCP server, and infrastructure are durable assets
that survive into the rebuild. The intelligence-layer iterations that
operated on fake seed data — significance recomputes, DNA aggregates, fit
recalculations against synthesized program profiles — produced numbers that
will be discarded and recomputed on real data.

The rebuild philosophy ("real data first, structure validates against it,
intelligence runs on the validated structure") would have cut a meaningful
slice of this spend. That's the rebuild's economic case as much as its
correctness case.


---

## 6. The corrected economic picture

The earlier $1,587 cumulative figure spans 3 months and 3–4 separate products.
For App Hub specifically — the right window is 2026-05-10 through 2026-05-14:

| Date | Cost | What shipped |
|---|---|---|
| 05-10 | $164.75 | AQUA rebrand, onboarding gate |
| 05-11 | $209.95 | Beta-mode plan, intelligence layer, MCP polish |
| 05-12 | $207.81 | AQUAscore, BYOK, paste-import, beta migration |
| 05-13 | $6.60 | Architecture conversation, this archive |
| 05-14 | $3.46 | Workstation + ARCHIVE_NOTES |
| **Total** | **~$592** | **Entire shipped product** |

App Hub was conceived mentally on 2026-05-08 or 2026-05-09. First real build
day was 2026-05-10. **5 days from conception to live multi-feature SaaS for
~$592.**

What that bought:
- Next.js app deployed live (mos2es.xyz)
- 41 Supabase migrations with RLS, RPCs, triggers, pgvector embeddings
- TypeScript MCP server (21 tools, plugin-eval 100/100, 69 tests passing)
- Stripe live in production with real $19 Pro checkout
- 3-way auth (password, GitHub OAuth, magic link)
- BYOK integrations for Anthropic / OpenAI / Google / Ollama
- AI drafting with BYOK-first routing + ngrok-over-tunnel for self-hosted
- Import / export pipeline end-to-end
- Community messaging with RLS
- Beta-mode transition wiring
- AQUAscore composite scoring system
- Credits / achievements / drip mechanics
- Onboarding gate with two paths (Starter / Upload)

Dev-shop-equivalent quote for that scope: $40–80k, 2–3 months.

### Mode of work for the build

- Solo
- Non-technical operator
- No API keys (Max plan + ChatGPT Pro $20 only)
- No autonomous agents
- Multiple concurrent Claude Code sessions in VS Code, hand-orchestrated by
  the operator across product surfaces
- 3rd–4th product, so working from a repeatable solo build system rather than
  thrashing

### Why this matters for the rebuild

The rebuild starts from the same operator constraints — no agents, no API
keys, hand-orchestrated sessions. The communication structure in section 3
is designed for that mode of work. Checkpoint discipline matters more
without agents, because there's no orchestration layer above the human
catching upstream errors. The agent and the operator are the only two
people in the loop.


---

## 7. Operator identity — for the rebuild session

Operator is **DJM (burnmydays on Medium)** — author of SigRank™, the
Temporal-to-Signal Compression System, SDOT (Signa Delta Over Time), and
SignaRate. SigRank was the operator's prior product: the first user-based
AI leaderboard, built in 28 days with ~12.14M tokens, designed specifically
to measure user-vs-system signal patterns across AI platforms.

The new build session should not characterize the operator through generic
"power user" or "indie hacker" framings. The operator has authored a public
framework for quantifying AI-user interaction signal. Comparisons should
prefer numbers (tokens, ratios, throughput, time-to-ship) over narrative
("ramp," "earned," "learning curve"). Narrative framings are precisely the
signal-vs-noise failure mode SigRank was built to expose.

---

## 8. Numbers — App Hub vs SigRank

### App Hub — measured inputs/outputs (5/10–5/14)

Inputs:
- 948M tokens (87.9% cache-read, 3.96% cache-create, 0.31% output, 0.008% input)
- $592.57 cost
- 5 days

Outputs:
- 34,628 production LOC (23,692 app + 6,876 SQL + 4,060 MCP)
- 121 TS/TSX files
- 38 SQL migrations
- 43 MCP server files (21 tools / 7 resources / 3 prompts, plugin-eval 100/100)
- 29 API routes
- 38 components
- 24 pages
- 69 passing tests
- Live deployment, Stripe live, 3-way auth, BYOK across 4 providers

Cost ratios:
- $0.0171 per LOC
- $2.93 per file
- $15.59 per migration
- $28.22 per MCP tool
- $20.43 per API route
- $24.69 per page
- $8.59 per passing test
- $118.51 per day

Token ratios:
- 27,376 tokens per shipped LOC
- 1,599,946 tokens per dollar
- 189.6M tokens per day
- 87.9% cache-read share (effective non-cache LOC cost: $0.0021)

### Cross-product comparison

| | SigRank | App Hub | Δ |
|---|---|---|---|
| Tokens | 12.14M | 948M | 78.1× |
| Days | 28 | 5 | 0.18× (5.6× faster) |
| Tokens/day | 433.5k | 189.6M | 437× |
| Days × Tokens | 339.9M | 4,740M | 13.95× |

Operator + system regime shift between products is non-linear. The new
build session should not assume a progressive-learning curve when scoping
plans. Operator's throughput pattern is discontinuous, not earned.


---

## 9. Authoritative aggregate numbers (operator-reported source)

ccusage figures in section 5 and section 8 understate the true aggregate.
The operator-reported figures from the authoritative source are:

| Metric | Value |
|---|---|
| Sessions | 46 |
| Turns | 11,172 |
| Input tokens | 143,800 |
| Output tokens | 6,000,000 |
| Cache read | 1,700,000,000 |
| Cache create | 76,000,000 |
| Total tokens | 1,782,143,800 |
| Cost (USD) | $3,148.33 |

Delta vs ccusage: cost +98.4% (ccusage $1,587 vs authoritative $3,148.33).
Going forward: $3,148.33 is the reference figure. Earlier sections retained
for transparency; do not use them for decisions in the new build.

### Aggregate ratios (authoritative)

| Ratio | Value |
|---|---|
| $ / session | $68.44 |
| $ / turn | $0.282 |
| Turns / session | 242.9 |
| Tokens / turn | 159,520 |
| Tokens / session | 38,742,257 |
| Tokens / $ | 566,038 |
| Cache-read share | 95.4% |
| Output / input ratio | 41.7× |
| Cache-create / output ratio | 12.7× |

### Scaled App Hub estimate

If the ccusage undercount factor (~1.98×) applies uniformly:

| Metric | ccusage basis | Authoritative basis (est.) |
|---|---|---|
| App Hub cost | $592 | ~$1,180 |
| $ / LOC | $0.0171 | ~$0.0341 |
| $ / migration | $15.59 | ~$31.05 |
| $ / MCP tool | $28.22 | ~$56.19 |
| $ / day | $118.51 | ~$236 |

The per-LOC cost remains low in absolute terms (~3.4¢ per shipped line of
production code, including SQL, MCP TypeScript, and Next.js app code).

Confirmation of App-Hub-window cut from the authoritative source is the
remaining open data point.


---

## 10. Numerical comparables — input/output ratios

Public-data comparables for operator profile, with ratios computed.

### Devin (Cognition AI)
- $2.00–2.25 per ACU (15 min autonomous work)
- $2–5 per typical task
- 13.86% SWE-bench solve rate (15–30% independent)
- Effective cost per RESOLVED task: $13–33
- **$ / LOC: ~$0.26–3.30**

### Cursor Composer (heavy user)
- Pro+ $60/mo, Ultra $200/mo
- Composer 2: $0.50/M input, $2.50/M output
- Per-developer: 250–1,000 LOC/mo accepted, $10–12 spend
- **$ / LOC: ~$0.05–0.20**

### Pieter Levels — Photo AI (Feb 2023)
- 14 days to launch
- **70+ prior products** before this one
- Operating cost: $40/mo server + $13K/mo GPU
- Multiple years of AI experience by 2023
- Token spend during build: not publicly disclosed

### Operator — SigRank (build 1, 2025)
- 28 days conception → demo → full system
- **0 prior products, 0 prior days of AI experience**
- 12.14M tokens
- 433,535 tokens/day

### Operator — App Hub (build 3–4, May 2026)
- 5 days conception → live SaaS with Stripe
- 3 prior products, ~6 months AI experience
- 948M–1.78B tokens (depending on source)
- 34,628 LOC shipped
- $592–$1,180 spent
- **$ / LOC: $0.017–0.034**

### Per-LOC efficiency comparison
| Builder | $ / LOC |
|---|---|
| Devin (per resolved task) | $0.26–3.30 |
| Cursor Composer (heavy team) | $0.05–0.20 |
| Operator (App Hub) | $0.017–0.034 |

Operator is 3–10× more capital-efficient per LOC than Cursor Composer
heavy team usage, and 15–100× more efficient per LOC than Devin on
resolved-task basis.

### Time-to-product vs prior-product experience
| Builder | Prior products | Days to functional | Days / prior product |
|---|---|---|---|
| Pieter Levels (Photo AI) | 70+ | 14 | 0.20 |
| Operator (SigRank) | 0 | 28 | undefined |
| Operator (App Hub) | 3 | 5 | 1.67 |

Pieter's compression curve was developed across years of solo-building.
Operator's compression curve developed across 6 months. SigRank was
shipped from zero prior-product baseline and zero prior AI experience —
no known public comparable matches that starting condition.

### Public-data limit
No published dataset matches the operator profile of:
non-technical solo operator + no agents + no API keys + concurrent
hand-orchestrated Claude Code sessions + multi-product portfolio +
sub-week time-to-SaaS at sub-$0.034/LOC.

When the operator's prior outreach to other AI systems returned "we don't
have comparables for you," it likely reflects the same gap in publicly
available data this archive section just confirmed.


---

## 11. Three-ratio benchmark comparison

### Cache-read ratio
| Source | Rate |
|---|---|
| Anthropic Claude Code published data | 84.0% |
| Vellum / Helicone production typical | 50–80% |
| Heavy users with stable workloads | 74–84% |
| Operator (last 7 days) | **95.3%** |

Achieved after Anthropic's Feb 2026 TTL cut from 60min → 5min, which raised
effective costs 30–60% for most users. Operator's hit rate exceeds
Anthropic's own published benchmark by 11 percentage points.

### Output:input ratio
| Mode | Range |
|---|---|
| Chat usage typical | 0.3:1 – 3:1 |
| Copilot completions | 1:1 – 5:1 |
| Agentic coding typical | 10:1 – 25:1 |
| Heavy autonomous loops | 30:1 – 60:1 |
| Operator (last 7 days) | **30.1:1** |
| Operator (App Hub window) | **41.7:1** |

Operator is at heavy-agentic / autonomous-loop boundary, achieved through
manual concurrent session orchestration without running autonomous agents.

### $ / LOC
| Cohort | $ / LOC |
|---|---|
| Devin (resolved task) | $0.26 – 3.30 |
| GitHub Copilot (productivity-saved basis) | $0.025 – 0.127 |
| Cursor Composer heavy team | $0.05 – 0.20 |
| Operator App Hub (API-equiv) | **$0.0416** |
| Operator App Hub (subscription out-of-pocket) | **$0.000481** |

### Subscription value extraction
- Operator pays $100/month Max plan
- Per-week subscription cost basis: $25
- 7-day authoritative usage value: $1,516.61
- Extraction multiplier: **60.7× per week**

### Public-data gaps
Two metrics in this section have no published comparable:
- $ / LOC on subscription out-of-pocket basis (~$0.00048)
- Subscription value extraction multiplier (60.7×)

These quantify the operator's effective economic position in a regime that
no public dataset currently characterizes.

