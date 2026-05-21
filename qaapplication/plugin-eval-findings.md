# Plugin Eval Findings: application-hub-mcp-server

**Eval date:** 2026-05-11  
**Score:** 68/100 — Grade D, Risk: High  
**Target:** `~/Desktop/application-hub/application-hub-mcp-server`  
**Checks:** 1 fail · 4 warn · 2 info

---

## plugin-eval Command Reference

All commands operate against a local path. The target here is `~/Desktop/application-hub/application-hub-mcp-server`.

| Command | What it does | Example |
|---|---|---|
| `start <path>` | Chat-first entrypoint — routes to the right command based on your request | `plugin-eval start <path> --request "evaluate this" --format markdown` |
| `analyze <path>` | Full structural + budget + code-quality report | `plugin-eval analyze <path> --format markdown` |
| `explain-budget <path>` | Token-by-token budget breakdown per file | `plugin-eval explain-budget <path> --format markdown` |
| `measurement-plan <path>` | Recommends which toolsets to use to measure real-world quality | `plugin-eval measurement-plan <path> --format markdown` |
| `init-benchmark <path>` | Generates a `benchmark.json` starter config for scenario-based runs | `plugin-eval init-benchmark <path>` |
| `benchmark <path>` | Runs benchmark scenarios and produces usage + result JSONL | `plugin-eval benchmark <path> --config benchmark.json` |
| `report <result.json>` | Renders a benchmark result file as a formatted report | `plugin-eval report result.json --format markdown` |
| `compare <before.json> <after.json>` | Diffs two benchmark results to show improvement/regression | `plugin-eval compare before.json after.json --format markdown` |

**Aliases:** `guide` → `start` · `recommend-measures` → `measurement-plan`

---

## Score Breakdown

| Category | Deduction | Check | Severity |
|---|---|---|---|
| Budget | -14 pts | `deferred_cost_tokens` is 50,990 (baseline ~24k) | **FAIL** |
| Readability | -4.5 pts | Max function length: 160 lines | WARN |
| Readability | -4.5 pts | 70 lines exceed 120 characters | WARN |
| Complexity | -4.5 pts | Max cyclomatic complexity: 79 | WARN |
| Best Practice | -4.5 pts | 0 test files across 33 source files | WARN |
| Coverage | -0.25 pts | No `lcov.info` / `coverage.xml` artifact | INFO |
| Structural | -0.25 pts | Target is not a skill/plugin root (generic analysis only) | INFO |
| **Total** | **-32.5 pts** | | |

---

## Issue 1 — FAIL: Token Budget (50,990 tokens)

### What the eval sees

The eval counts every file in the directory toward `deferred_cost_tokens`. The top offenders by token count:

| File | Tokens | Notes |
|---|---|---|
| `package-lock.json` | **20,186** | Auto-generated lockfile — **should be excluded from analysis scope** |
| `hub_stress_test_answer.ts` | **4,081** | Largest tool file; bloated by inline data |
| `hub_get_answer_review_context.ts` | 1,627 | |
| `hub_save_answer_review.ts` | 1,512 | |
| `hub_search_programs.ts` | 1,224 | |
| `hub_find_best_programs.ts` | 1,128 | |
| `hub_get_application_readiness.ts` | 1,111 | |
| `README.md` | 1,559 | Counts toward budget |
| All other files | ~17k | |

**After removing `package-lock.json`:** ~30,804 tokens — still above baseline but no longer a FAIL.  
**After also extracting inline data from `hub_stress_test_answer.ts`:** estimated ~27,000 tokens — borderline passing.

### Root cause

Two separate problems stacked together:

1. **`package-lock.json` is in scope.** The eval scans the full directory. `package-lock.json` alone is 20k tokens and carries zero signal about plugin quality. It should be excluded or the analysis should be run against a `dist/` or `src/`-only path.

2. **`hub_stress_test_answer.ts` embeds 200+ lines of hardcoded data.** The `THEME_FOLLOW_UPS` constant (8 themes × 2–3 follow-up objects each, with 4 fields per object) and `GENERAL_FOLLOW_UPS` are pure data — they don't benefit from being in TypeScript and inflate the file to 396 lines.

### Proposed fix

**Step 1 — Exclude `package-lock.json` from eval scope (quick win).**  
Either point `plugin-eval` at `src/` instead of the root, or add an eval ignore config if supported.  
Expected impact: drops budget from ~51k → ~31k tokens.

**Step 2 — Extract inline data to a JSON file.**  
Move `THEME_FOLLOW_UPS` and `GENERAL_FOLLOW_UPS` out of `hub_stress_test_answer.ts` into `src/data/stress_test_follow_ups.json`. Import and type it in the TS file.  
Expected impact: `hub_stress_test_answer.ts` drops from 4,081 → ~1,200 tokens. Budget drops ~3k additional.

**Files to change:**
- `src/tools/user/hub_stress_test_answer.ts` — remove inline data constants, add JSON import
- `src/data/stress_test_follow_ups.json` — new file with the extracted data

---

## Issue 2 — WARN: High Cyclomatic Complexity (max: 79)

### What the eval sees

At least one function scores 79 on cyclomatic complexity. The industry threshold for "high risk" is typically 10–15. The eval flags anything "heavy."

### Root cause

`hub_stress_test_answer.ts` is the likely source. The `THEME_FOLLOW_UPS` object has 8 top-level keys each with arrays of objects — the eval's complexity counter may be treating each key/branch in the data structure as a decision point. The `buildFollowUps` function also iterates with nested conditionals.

### Proposed fix

1. **Move the data out** (same as Issue 1 Step 2) — this immediately removes all the counted branches from the TypeScript complexity score.
2. **Split `buildFollowUps`** into two functions:
   - `collectThemeTemplates(themes: string[]): FollowUpTemplate[]` — merges theme-specific templates
   - `applyDepthLimit(templates: FollowUpTemplate[], depth): FollowUp[]` — slices and shapes for output

---

## Issue 3 — WARN: Long Functions (max: 160 lines)

### What the eval sees

The longest function is 160 lines. The eval flags anything above ~50–80 lines as hurting readability.

### Root cause

The handler callback inside `registerStressTestAnswer` runs from line 245 to ~395 — about 150 lines in a single async arrow function. It does: auth → DB fetch (answer) → DB fetch (archived question) → DB fetch (program questions) → DB fetch (program DNA) → data normalization → output assembly → markdown rendering.

### Proposed fix

Extract into named helper functions in the same file or a co-located `hub_stress_test_answer.helpers.ts`:

```
fetchAnswerWithOwnerCheck(answer_id, user_id)  → answer row or null
fetchArchivedQuestion(archived_question_id)     → question row or null  
fetchProgramScope(archived_question_id, program_id) → { questions, dna }
buildOutput(answer, question, scope, depth)     → output object
formatMarkdown(output, follow_ups)              → string
```

The `registerStressTestAnswer` handler then becomes ~20 lines of orchestration.

---

## Issue 4 — WARN: Long Lines (70 lines > 120 chars)

### What the eval sees

70 lines exceed the 120-character limit.

### Root cause

Primarily:
- Supabase `.select()` chains with long field lists (e.g. `"id, user_id, archived_question_id, question_text, theme, ..."`)
- Object property lines in the inline `THEME_FOLLOW_UPS` data

### Proposed fix

1. Extracting the data (Issue 1) eliminates most of the object-property long lines.
2. For `.select()` chains, extract field lists to named constants:

```ts
const ANSWER_FIELDS = "id, user_id, archived_question_id, question_text, theme, answer_content, content, confidence, word_count, version, updated_at, last_updated, created_at";
```

---

## Issue 5 — WARN: No Test Files (0 of 33 source files covered)

### What the eval sees

33 TypeScript source files, 0 `.test.ts` or `.spec.ts` files.

### Root cause

Tests haven't been written yet. This is the most time-consuming fix but also the most important for long-term trust.

### Proposed fix (minimum viable coverage)

Start with the pure-logic functions — they don't need a DB or MCP server running:

| Test file | What to test |
|---|---|
| `src/tools/user/hub_stress_test_answer.test.ts` | `buildFollowUps()`, `compactSignals()`, `followUpCount()` |
| `src/services/cache.test.ts` | cache hit/miss/expiry logic |
| `src/services/rate_limit.test.ts` | rate limit enforcement |

Use `vitest` (compatible with the existing TypeScript setup) or `jest` with `ts-jest`. Add a `test` script to `package.json`.

---

## Measurement Plan (from `plugin-eval measurement-plan`)

The eval recommends two high-priority toolsets before spending time on more fixes:

| Toolset | Priority | What it measures | How to collect |
|---|---|---|---|
| **Token Usage Observer** | High | Actual tokens burned in real runs vs. static estimate | Responses API usage logs, JSONL traces |
| **Task Outcome Scorecard** | High | Does the server actually help users complete tasks? | Task run logs, before/after prompt comparisons |
| Tool Call Audit | Medium | Are tools being called with correct args and sequence? | Tool invocation traces, recorded sessions |
| Latency & Efficiency | Medium | Is it fast enough to be worth the cost? | Benchmark harness timings |
| Human Rubric Review | Medium | Clarity and trust signals | Reviewer scorecards |
| Regression Suite | Medium | Does a fix break existing behavior? | Unit/integration test runs |

> Note: The static estimate (50,990 tokens) is likely inflated by `package-lock.json`. Running `plugin-eval init-benchmark` to get observed usage is the fastest way to validate whether the budget concern is real in practice.

---

## Recommended Fix Order

| Priority | Action | Est. score gain | Effort |
|---|---|---|---|
| 1 | Point eval at `src/` only or exclude `package-lock.json` | +14 pts (FAIL → PASS) | 5 min |
| 2 | Extract `THEME_FOLLOW_UPS` data to JSON | +2–4 pts | 30 min |
| 3 | Split handler into helper functions | +4.5 pts | 1 hr |
| 4 | Extract `.select()` field strings to constants | +4.5 pts | 1 hr |
| 5 | Add `vitest` + 3 test files for pure-logic functions | +4.5 pts | 3 hrs |
| 6 | Run `plugin-eval init-benchmark` to get observed usage | Validates all estimates | 30 min |

**Projected score after all fixes: ~90–95/100 (A range)**

---

## Commands to Re-evaluate After Fixes

```bash
# Full re-evaluation
plugin-eval analyze ~/Desktop/application-hub/application-hub-mcp-server --format markdown

# Budget check only (fast)
plugin-eval explain-budget ~/Desktop/application-hub/application-hub-mcp-server --format markdown

# Compare before/after (save a result.json first)
plugin-eval benchmark ~/Desktop/application-hub/application-hub-mcp-server --config benchmark.json --result-out before.json
# ... make changes ...
plugin-eval benchmark ~/Desktop/application-hub/application-hub-mcp-server --config benchmark.json --result-out after.json
plugin-eval compare before.json after.json --format markdown
```
