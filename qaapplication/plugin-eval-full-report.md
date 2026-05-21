# Plugin Eval — Full Command Run: application-hub-mcp-server

**Run date:** 2026-05-11  
**Target:** `~/Desktop/application-hub/application-hub-mcp-server`  
**Plugin-eval binary:** `~/.local/bin/plugin-eval`

---

## Command Map

| Command | Status | Notes |
|---|---|---|
| `start` | ✅ Works | Chat-first router — maps natural language to the right command |
| `analyze` | ✅ Works | Full structural + quality eval |
| `explain-budget` | ✅ Works | Per-file token breakdown |
| `measurement-plan` | ✅ Works | Recommends measurement toolsets |
| `init-benchmark` | ❌ Blocked | "Benchmarking only supports Codex skills and plugins" |
| `benchmark` | ❌ Blocked | Requires `init-benchmark` first; same limitation |
| `report` | ⏳ Deferred | Requires a `result.json` from `benchmark` |
| `compare` | ⏳ Deferred | Requires two `result.json` files from `benchmark` |

> **Limitation:** `init-benchmark`, `benchmark`, `report`, and `compare` are only available for Codex skills and plugins — not bare MCP servers. To unlock these, the MCP server would need to be wrapped as a Claude Code plugin.

---

## `plugin-eval analyze` — Full Evaluation Report

**Score: 68/100 — Grade D — Risk: High**

### Score breakdown

| Category | Check | Finding | Deduction |
|---|---|---|---|
| Budget | `deferred_cost_tokens-budget-high` | 50,990 tokens (baseline ~24k) | **−14 pts (FAIL)** |
| Readability | `ts-function-length-high` | Max function length: 160 lines | −4.5 pts |
| Readability | `ts-long-lines` | 70 lines exceed 120 chars | −4.5 pts |
| Complexity | `ts-complexity-high` | Max cyclomatic complexity: 79 | −4.5 pts |
| Best Practice | `ts-tests-missing` | 0 test files / 33 source files | −4.5 pts |
| Coverage | `coverage-artifacts-unavailable` | No `lcov.info` / `coverage.xml` | −0.25 pts |
| Structural | `generic-target-analysis` | Not a skill/plugin root | −0.25 pts |
| **Total** | | | **−32.5 pts** |

### Key metrics

| Metric | Value | Rating |
|---|---|---|
| `trigger_cost_tokens` | 0 | Good |
| `invoke_cost_tokens` | 0 | Good |
| `deferred_cost_tokens` | 50,990 | **Excessive** |
| `ts_file_count` | 33 | Good |
| `ts_function_count` | 35 | Good |
| `ts_max_cyclomatic_complexity` | 79 | **Heavy** |
| `ts_average_function_length` | 56.66 lines | **Heavy** |
| `ts_max_nesting_depth` | 10 levels | **Heavy** |
| `ts_comment_ratio` | 0.02 | Moderate |
| `ts_test_file_count` | 0 | Moderate |
| `coverage_artifact_count` | 0 | Info |

---

## `plugin-eval explain-budget` — Token Budget Breakdown

**Total: 50,990 deferred tokens (Excessive)**

All tokens are in the `deferred` bucket — nothing is trigger or invoke.

### Top offenders

| File | Tokens | % of Total | Action |
|---|---|---|---|
| `package-lock.json` | **20,186** | **40%** | Exclude from eval scope — auto-generated, zero signal |
| `hub_stress_test_answer.ts` | 4,081 | 8% | Extract inline data to JSON |
| `README.md` | 1,559 | 3% | Accept as-is or trim |
| `hub_get_answer_review_context.ts` | 1,627 | 3% | Refactor handler |
| `hub_save_answer_review.ts` | 1,512 | 3% | Refactor handler |
| `hub_search_programs.ts` | 1,224 | 2.4% | Refactor handler |
| `hub_find_best_programs.ts` | 1,128 | 2.2% | Refactor handler |
| `hub_get_application_readiness.ts` | 1,111 | 2.2% | Refactor handler |
| All other files | ~17,562 | 34% | Normal |

### Projected budget after fixes

| After action | Estimated tokens | Status |
|---|---|---|
| Current | 50,990 | Excessive / FAIL |
| Exclude `package-lock.json` | ~30,804 | Elevated but not failing |
| + Extract `THEME_FOLLOW_UPS` to JSON | ~27,000 | Near-baseline |
| + Refactor long handlers | ~24,000–25,000 | Passing |

---

## `plugin-eval measurement-plan` — What to Measure

**Recommended toolsets:** `token-usage-observer`, `task-outcome-scorecard`

### All toolsets

| Toolset | Priority | Measures | Evidence sources |
|---|---|---|---|
| **Token Usage Observer** | High | Actual tokens burned in real runs vs. static estimate | Responses API usage logs, JSONL traces |
| **Task Outcome Scorecard** | High | Does the server help users complete tasks first-pass? | Task run logs, before/after prompt comparisons |
| Tool Call Audit | Medium | Correct tool args and sequencing | Tool invocation traces, recorded sessions |
| Latency & Efficiency | Medium | Speed-to-value vs. cost | Benchmark harness timings |
| Human Rubric Review | Medium | Clarity and trust signals | Reviewer scorecards |
| Regression Suite | Medium | Do fixes break existing behavior? | Unit/integration tests, snapshot checks |

> **Note:** The static token estimate (50,990) is heavily inflated by `package-lock.json`. Running the Token Usage Observer would validate whether the budget concern reflects real workflow cost or is a tooling artifact.

---

## `plugin-eval start` — Routing Behavior

`start` is a natural language router. It maps a `--request` or `--goal` to the right command sequence. It does not run analysis itself.

### Goal → command mapping

| `--goal` | Routes to | Full sequence |
|---|---|---|
| `evaluate` | `analyze` | `analyze` |
| `next` | `analyze` | `analyze` |
| `budget` | `explain-budget` | `explain-budget` |
| `measure` | `init-benchmark` | `init-benchmark` → `benchmark` → `analyze --observed-usage` |
| `benchmark` | `init-benchmark` | `init-benchmark` |

### Natural language → command mapping

| Request phrase | Routes to |
|---|---|
| "What should I fix first?" | `analyze` |
| "Evaluate this target." | `analyze` |
| "What should I run next?" | `analyze` |
| "Give me a full analysis including benchmark setup." | `analyze` → `init-benchmark` → `benchmark` |
| "Explain the token budget." | `explain-budget` |
| "Measure the real token usage." | `init-benchmark` → `benchmark` → `analyze --observed-usage` |
| "Help me benchmark this." | `init-benchmark` |

---

## `init-benchmark` / `benchmark` / `report` / `compare` — Blocked

```
Error: Benchmarking only supports Codex skills and plugins.
```

These four commands require the target to be a Codex skill or Claude Code plugin — not a standalone MCP server directory.

### To unlock benchmarking

Wrap the MCP server as a Claude Code plugin by adding a `plugin.json` manifest at the repo root. Once it's recognized as a plugin, all four commands become available:

```bash
# After adding plugin.json:
plugin-eval init-benchmark ~/Desktop/application-hub/application-hub-mcp-server
plugin-eval benchmark ~/Desktop/application-hub/application-hub-mcp-server \
  --config .plugin-eval/benchmark.json \
  --usage-out .plugin-eval/usage.jsonl \
  --result-out .plugin-eval/result-before.json

# After fixes:
plugin-eval benchmark ~/Desktop/application-hub/application-hub-mcp-server \
  --result-out .plugin-eval/result-after.json
plugin-eval compare .plugin-eval/result-before.json .plugin-eval/result-after.json --format markdown
plugin-eval report .plugin-eval/result-after.json --format markdown
```

---

## Analysis: Root Causes

### Why the score is D

Two separate problems stacked to cause the FAIL:

**1. Package scope problem (−14 pts alone)**  
`package-lock.json` is 20,186 tokens — 40% of total budget — and carries zero plugin quality signal. The eval scans the full directory, so lockfiles, README, and `tsconfig.json` all count. Pointing the analyzer at `src/` or adding an eval ignore file would eliminate this.

**2. Inline data in TypeScript (complexity + length + budget)**  
`hub_stress_test_answer.ts` (396 lines) hardcodes 8 themes × 2–3 follow-up objects each in `THEME_FOLLOW_UPS`, plus `GENERAL_FOLLOW_UPS` — pure data embedded in TypeScript. This inflates:
- The file's token count (4,081 — the largest tool file by far)
- Cyclomatic complexity (the evaluator counts object keys/branches)
- Function length (the handler is ~150 lines of auth + DB + assembly + rendering)

**3. No tests**  
33 files, 0 tests. Pure-logic functions (`buildFollowUps`, `compactSignals`, `followUpCount`) have no coverage at all.

---

## Proposed Fixes — Prioritized

### Fix 1 — Scope: exclude `package-lock.json` (5 min, +14 pts)

Run eval against `src/` only, or check if plugin-eval supports an ignore file:

```bash
plugin-eval analyze ~/Desktop/application-hub/application-hub-mcp-server/src --format markdown
```

If pointing at `src/` causes structural check failures, explore a `.pluginevalignore` or `--metric-pack` config to exclude lockfiles.

**Files changed:** none in the codebase — eval invocation only.

---

### Fix 2 — Extract inline data to JSON (30 min, ~+3 pts)

Move `THEME_FOLLOW_UPS` and `GENERAL_FOLLOW_UPS` out of `hub_stress_test_answer.ts` into a new data file.

**Create:** `src/data/stress_test_follow_ups.json`

```json
{
  "themeFollowUps": {
    "traction": [...],
    "market": [...],
    ...
  },
  "generalFollowUps": [...]
}
```

**Update:** `hub_stress_test_answer.ts`

```ts
import followUpData from "../../data/stress_test_follow_ups.json" assert { type: "json" };
const THEME_FOLLOW_UPS = followUpData.themeFollowUps as Record<string, FollowUpTemplate[]>;
const GENERAL_FOLLOW_UPS = followUpData.generalFollowUps as FollowUpTemplate[];
```

**Impact:** `hub_stress_test_answer.ts` drops from 4,081 → ~1,200 tokens. Complexity score drops significantly. Budget drops ~3k tokens.

---

### Fix 3 — Split handler into helpers (1 hr, +4.5 pts)

The `registerStressTestAnswer` handler is ~150 lines doing auth + 4 DB fetches + data assembly + markdown rendering.

**Extract to named functions in same file:**

```ts
async function fetchAnswer(answer_id: string, user_id: string)
async function fetchArchivedQuestion(archived_question_id: string)
async function fetchProgramScope(archived_question_id: string, program_id?: string)
function buildOutput(answer, question, scope, depth): StressTestOutput
function formatMarkdown(output: StressTestOutput, followUps): string
```

The registered handler becomes ~20 lines of orchestration. Apply same pattern to `hub_get_answer_review_context.ts` (156 lines) and `hub_save_answer_review.ts` (176 lines).

**Files changed:**
- `src/tools/user/hub_stress_test_answer.ts`
- `src/tools/user/hub_get_answer_review_context.ts`
- `src/tools/user/hub_save_answer_review.ts`

---

### Fix 4 — Extract long `.select()` field strings (1 hr, +4.5 pts)

Supabase `.select()` calls with 10+ fields in one string are the main source of long lines.

**Pattern:**

```ts
const ANSWER_FIELDS = [
  "id", "user_id", "archived_question_id", "question_text",
  "theme", "answer_content", "content", "confidence",
  "word_count", "version", "updated_at", "last_updated", "created_at"
].join(", ");

// Usage:
.select(ANSWER_FIELDS)
```

Define field constants at the top of each tool file or in a shared `src/services/fields.ts`.

---

### Fix 5 — Add test files (3 hrs, +4.5 pts)

Install `vitest` (zero-config with TypeScript), add a `test` script to `package.json`, write tests for pure-logic functions that require no DB or MCP server.

**Priority test files:**

| Test file | Functions to cover |
|---|---|
| `hub_stress_test_answer.test.ts` | `buildFollowUps()`, `compactSignals()`, `followUpCount()` |
| `hub_get_fit_score.test.ts` | Score calculation logic |
| `cache.test.ts` | Cache hit/miss/expiry |
| `rate_limit.test.ts` | Rate limit enforcement |

**`package.json` additions:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```

---

### Fix 6 — Wrap as Claude Code plugin (unlocks benchmark/report/compare)

Add a `plugin.json` manifest at the repo root to register as a proper plugin. This is what unlocks `init-benchmark`, `benchmark`, `report`, and `compare`.

Once wrapped:
1. Run `plugin-eval init-benchmark` to generate scenario configs
2. Run `plugin-eval benchmark` before any fixes to establish a `result-before.json` baseline
3. After fixes, run again to produce `result-after.json`
4. Run `plugin-eval compare` for a before/after diff
5. Run `plugin-eval report` for a final formatted summary

---

## Re-evaluation Commands

Run these after each fix to measure progress:

```bash
# Quick budget check (fastest feedback)
plugin-eval explain-budget ~/Desktop/application-hub/application-hub-mcp-server --format markdown

# Full re-eval
plugin-eval analyze ~/Desktop/application-hub/application-hub-mcp-server --format markdown --output ~/Desktop/mcp_eval/plugin-eval-recheck.md

# If/when wrapped as plugin — before/after compare
plugin-eval benchmark ~/Desktop/application-hub/application-hub-mcp-server --result-out ~/Desktop/mcp_eval/result-after.json
plugin-eval compare ~/Desktop/mcp_eval/result-before.json ~/Desktop/mcp_eval/result-after.json --format markdown
```

---

## Projected Score After All Fixes

| Fix | Score gain | Cumulative |
|---|---|---|
| Baseline | — | 68 |
| Fix 1: Scope `package-lock.json` | +14 | 82 |
| Fix 2: Extract data to JSON | +3 | 85 |
| Fix 3: Split handlers | +4.5 | 89.5 |
| Fix 4: Long line cleanup | +4.5 | 94 |
| Fix 5: Add test files | +4.5 | 98.5 |

**Target: ~95–98/100 (A)**
