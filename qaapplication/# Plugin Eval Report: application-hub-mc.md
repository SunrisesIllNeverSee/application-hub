# Plugin Eval Report: application-hub-mcp-server

## At a Glance
- Score: 68/100
- Grade: D
- Risk: high
- Checks: 1 fail, 4 warn, 4 info
- Active budget: 0 tokens (good)
- Observed usage: not supplied

## Why It Matters
- 1 failing error check are driving the highest-confidence problems.
- 4 warning signals still need cleanup before this feels polished.
- budget is the largest source of score loss at -14 points.
- Budget pressure is not the dominant issue right now.
- No observed usage is attached yet, so budget conclusions are still based on static estimates.

## Fix First
- [fail/error] deferred_cost_tokens is excessive relative to the current Codex baseline. Why: Budget pressure matters because always-loaded or frequently-loaded text can make the workflow feel expensive fast. Fix: Reduce repeated instruction text and move detail into deferred supporting files.
- [warn/warning] TypeScript source files were found without matching test files. Why: Best-practice gaps usually do not break the workflow immediately, but they make the skill harder to understand and improve. Fix: Add `.test.ts` or `.spec.ts` coverage for the main TypeScript logic.
- [warn/warning] At least one TypeScript function has high cyclomatic complexity. Why: Complexity findings matter because they increase review cost and make generated or helper code harder to change safely. Fix: Split complex functions into smaller branches with clearer responsibilities.

## Recommended Next Step
- Fix the top findings and rerun the report
- Why: A short pass on the highest-value findings will improve trust, readability, and the signal quality of future benchmarks.
- Chat request: "What should I fix first?"
- Local command: `plugin-eval start ~/Desktop/application-hub/application-hub-mcp-server --request 'What should I fix first?' --format markdown`

## Details
<details>
<summary>Watch next</summary>

- [warn/warning] At least one TypeScript function is long enough to hurt readability. Why: Readability issues slow engineers down during review, debugging, and follow-up edits. Fix: Break large functions into smaller helpers with single-purpose logic.
- [warn/warning] Some TypeScript lines exceed 120 characters. Why: Readability issues slow engineers down during review, debugging, and follow-up edits. Fix: Wrap long expressions and object literals to keep scanability high.
</details>
<details>
<summary>Improvement brief</summary>

- Raise the evaluation from grade D (68/100) with a focus on the highest-signal structural and budget issues first.
- Goal: Reduce repeated instruction text and move detail into deferred supporting files.
- Goal: Split complex functions into smaller branches with clearer responsibilities.
- Goal: Break large functions into smaller helpers with single-purpose logic.
- Goal: Wrap long expressions and object literals to keep scanability high.
- Goal: Add `.test.ts` or `.spec.ts` coverage for the main TypeScript logic.
- Measure: token-usage-observer
- Measure: task-outcome-scorecard
- Suggested prompt: Use the skill-creator guidance to improve application-hub-mcp-server. Keep the structure compact and move bulky details into references or scripts. Define success measures with these toolsets: token-usage-observer, task-outcome-scorecard. Address deferred_cost_tokens-budget-high: deferred_cost_tokens is excessive relative to the current Codex baseline. Address ts-complexity-high: At least one TypeScript function has high cyclomatic complexity. Address ts-function-length-high: At least one TypeScript function is long enough to hurt readability. Address ts-long-lines: Some TypeScript lines exceed 120 characters. Address ts-tests-missing: TypeScript source files were found without matching test files.
</details>
<details>
<summary>Budgets and observed usage</summary>

- trigger_cost_tokens: 0 (good)
- invoke_cost_tokens: 0 (good)
- deferred_cost_tokens: 49424 (excessive)
- total_tokens: 49424 (excessive)

- No observed usage supplied.
</details>
<details>
<summary>Measurement plan</summary>

Combine cost, outcome, and trust signals so you can tell whether the skill or plugin is genuinely helping instead of only looking well-structured on paper.

- Token Usage Observer [high] Measure how many tokens the skill or plugin actually burns in representative runs. Signals: observed_usage_sample_count, observed_input_tokens_avg, observed_total_tokens_avg, estimate_vs_observed_input_ratio. Evidence: Responses API usage logs, Codex-like session exports, JSONL traces captured from local benchmarking harnesses.
- Task Outcome Scorecard [high] Measure whether the skill helps users finish the intended job with fewer retries and less cleanup. Signals: task_success_rate, first_pass_success_rate, retry_rate, human_override_rate. Evidence: Task run logs, Structured user acceptance checklist, Before/after comparison runs on the same prompts.
- Tool Call Audit [medium] Check whether the agent uses the right tools, arguments, and sequencing when the skill is active. Signals: tool_call_success_rate, invalid_tool_argument_rate, recoverable_tool_failure_rate. Evidence: Tool invocation traces, Recorded sessions, Golden-path scenario replays.
- Latency And Efficiency [medium] Track whether the skill speeds users up enough to justify its cost. Signals: p50_time_to_first_acceptable_answer_seconds, p95_time_to_task_completion_seconds, tokens_per_successful_run. Evidence: Benchmark harness timings, Manual stopwatch runs on canonical tasks, Responses API timestamps combined with usage logs.
- Human Rubric Review [medium] Capture clarity, trust, and usefulness signals that automated checks will miss. Signals: clarity_score_avg, confidence_score_avg, follow_up_question_rate. Evidence: Reviewer scorecards, Team rubric sheets, Annotated transcripts.
- Regression Suite [medium] Protect the repository behavior that the skill is supposed to improve. Signals: test_pass_rate, lint_pass_rate, regression_escape_count. Evidence: Unit and integration test runs, Coverage deltas, Snapshot or golden-file checks.
</details>
<details>
<summary>Use From Codex Chat</summary>

Start with a natural chat request, then let plugin-eval show the exact local command sequence behind it.

Start with this chat request: "Evaluate this target."
Why this path: Plugin Eval recommended Evaluate Skill from the current local state for this target.
Quick local entrypoint: plugin-eval start ~/Desktop/application-hub/application-hub-mcp-server --request 'Evaluate this target.' --format markdown
Plugin Eval will run first: plugin-eval analyze ~/Desktop/application-hub/application-hub-mcp-server --format markdown

Other chat requests you can use:
- Full Skill Analysis: say "Give me a full analysis of this target, including benchmark setup." -> plugin-eval analyze ~/Desktop/application-hub/application-hub-mcp-server --format markdown
- Evaluate Skill: say "Evaluate this target." -> plugin-eval analyze ~/Desktop/application-hub/application-hub-mcp-server --format markdown
- Explain Token Budget: say "Explain the token budget for this target." -> plugin-eval explain-budget ~/Desktop/application-hub/application-hub-mcp-server --format markdown
- Measure Real Token Usage: say "Measure the real token usage of this target." -> plugin-eval init-benchmark ~/Desktop/application-hub/application-hub-mcp-server
- Benchmark With Starter Scenarios: say "Help me benchmark this target." -> plugin-eval init-benchmark ~/Desktop/application-hub/application-hub-mcp-server
- Start Here: say "What should I run next?" -> plugin-eval analyze ~/Desktop/application-hub/application-hub-mcp-server --format markdown
</details>
<details>
<summary>Checks</summary>

- [INFO] generic-target-analysis: The target is not a skill or plugin root, so only generic code, coverage, and budget analysis will run. Evidence: /Users/dericmchenry/Desktop/application-hub/application-hub-mcp-server Remediation: Point the analyzer at a skill directory or plugin root for richer structural checks.
- [FAIL] deferred_cost_tokens-budget-high: deferred_cost_tokens is excessive relative to the current Codex baseline. Evidence: Value: 49424 tokens Baseline samples: skills=24, plugins=116 Remediation: Reduce repeated instruction text and move detail into deferred supporting files.
- [WARN] ts-complexity-high: At least one TypeScript function has high cyclomatic complexity. Evidence: Max complexity: 79 Remediation: Split complex functions into smaller branches with clearer responsibilities.
- [WARN] ts-function-length-high: At least one TypeScript function is long enough to hurt readability. Evidence: Max function length: 160 lines Remediation: Break large functions into smaller helpers with single-purpose logic.
- [WARN] ts-long-lines: Some TypeScript lines exceed 120 characters. Evidence: Long lines: 70 Remediation: Wrap long expressions and object literals to keep scanability high.
- [WARN] ts-tests-missing: TypeScript source files were found without matching test files. Evidence: Source files: 33 Remediation: Add `.test.ts` or `.spec.ts` coverage for the main TypeScript logic.
- [INFO] coverage-artifacts-unavailable: No coverage artifacts were found for this target. Evidence: application-hub-mcp-server Remediation: Generate `lcov.info`, `coverage.xml`, or an Istanbul coverage JSON file if you want coverage scoring.
</details>
<details>
<summary>Metrics</summary>

- trigger_cost_tokens: 0 tokens (good)
- invoke_cost_tokens: 0 tokens (good)
- deferred_cost_tokens: 49424 tokens (excessive)
- ts_file_count: 33 files (good)
- ts_function_count: 35 functions (good)
- ts_max_cyclomatic_complexity: 79 score (heavy)
- ts_average_function_length: 56.66 lines (heavy)
- ts_max_nesting_depth: 10 levels (heavy)
- ts_comment_ratio: 0.02 ratio (moderate)
- ts_test_file_count: 0 files (moderate)
- coverage_artifact_count: 0 files (info)
</details>
<details>
<summary>Score details</summary>

- Starting score: 100
- Total deductions: -32.5
- Final score: 68
- Risk: Contains 1 failing error check (deferred_cost_tokens-budget-high).
- Risk: Overall score is below 70, which the evaluator treats as high risk.

- -14 points: deferred_cost_tokens-budget-high [fail/error] deferred_cost_tokens is excessive relative to the current Codex baseline.
- -4.5 points: ts-complexity-high [warn/warning] At least one TypeScript function has high cyclomatic complexity.
- -4.5 points: ts-function-length-high [warn/warning] At least one TypeScript function is long enough to hurt readability.
- -4.5 points: ts-long-lines [warn/warning] Some TypeScript lines exceed 120 characters.
- -4.5 points: ts-tests-missing [warn/warning] TypeScript source files were found without matching test files.
- -0.25 points: coverage-artifacts-unavailable [info/info] No coverage artifacts were found for this target.
- -0.25 points: generic-target-analysis [info/info] The target is not a skill or plugin root, so only generic code, coverage, and budget analysis will run.

- budget: -14 points across 1 check
- readability: -9 points across 2 checks
- best-practice: -4.75 points across 2 checks
- complexity: -4.5 points across 1 check
- coverage: -0.25 points across 1 check
</details>