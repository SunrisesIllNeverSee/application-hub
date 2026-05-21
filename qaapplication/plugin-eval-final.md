# Plugin Eval Report: application-hub-mcp-server

## At a Glance
- Score: 54/100
- Grade: F
- Risk: high
- Checks: 2 fail, 4 warn, 2 info
- Active budget: 607 tokens (moderate)
- Observed usage: 3 samples

## Why It Matters
- 2 failing error checks are driving the highest-confidence problems.
- 4 warning signals still need cleanup before this feels polished.
- budget is the largest source of score loss at -28 points.
- Budget pressure is not the dominant issue right now.
- Observed usage is available from 3 samples.

## Fix First
- [fail/error] deferred_cost_tokens is excessive relative to the current Codex baseline. Why: Budget pressure matters because always-loaded or frequently-loaded text can make the workflow feel expensive fast. Fix: Reduce repeated instruction text and move detail into deferred supporting files.
- [fail/error] Static budget estimates differ meaningfully from observed input token usage. Why: Budget pressure matters because always-loaded or frequently-loaded text can make the workflow feel expensive fast. Fix: Trim repeated instructions or supporting text if the observed value is higher than expected. If the static estimate is intentionally conservative, record that assumption in the skill or plugin references.
- [warn/warning] The plugin did not expose any discoverable skills. Why: Manifest issues reduce trust because Codex may not discover or represent the plugin correctly. Fix: Add at least one skill under the configured skills path.

## Recommended Next Step
- Review the measurement plan
- Why: You already have observed usage, so the highest-value next step is deciding what to instrument or improve.
- Chat request: "What should I run next?"
- Local command: `plugin-eval start ~/Desktop/application-hub/application-hub-mcp-server --request 'What should I run next?' --format markdown`

## Details
<details>
<summary>Watch next</summary>

- [warn/warning] At least one TypeScript function has high cyclomatic complexity. Why: Complexity findings matter because they increase review cost and make generated or helper code harder to change safely. Fix: Split complex functions into smaller branches with clearer responsibilities.
- [warn/warning] At least one TypeScript function is long enough to hurt readability. Why: Readability issues slow engineers down during review, debugging, and follow-up edits. Fix: Break large functions into smaller helpers with single-purpose logic.
- [warn/warning] Some TypeScript lines exceed 120 characters. Why: Readability issues slow engineers down during review, debugging, and follow-up edits. Fix: Wrap long expressions and object literals to keep scanability high.
</details>
<details>
<summary>Improvement brief</summary>

- Raise the evaluation from grade F (54/100) with a focus on the highest-signal structural and budget issues first.
- Goal: Add at least one skill under the configured skills path.
- Goal: Reduce repeated instruction text and move detail into deferred supporting files.
- Goal: Trim repeated instructions or supporting text if the observed value is higher than expected.
- Goal: If the static estimate is intentionally conservative, record that assumption in the skill or plugin references.
- Goal: Split complex functions into smaller branches with clearer responsibilities.
- Measure: task-outcome-scorecard
- Measure: tool-call-audit
- Suggested prompt: Use the skill-creator guidance to improve application-hub-mcp-server. Keep the structure compact and move bulky details into references or scripts. Define success measures with these toolsets: task-outcome-scorecard, tool-call-audit. Address deferred_cost_tokens-budget-high: deferred_cost_tokens is excessive relative to the current Codex baseline. Address observed-usage-estimate-drift: Static budget estimates differ meaningfully from observed input token usage. Address plugin-skills-missing: The plugin did not expose any discoverable skills. Address ts-complexity-high: At least one TypeScript function has high cyclomatic complexity. Address ts-function-length-high: At least one TypeScript function is long enough to hurt readability. Address ts-long-lines: Some TypeScript lines exceed 120 characters.
</details>
<details>
<summary>Budgets and observed usage</summary>

- trigger_cost_tokens: 93 (moderate)
- invoke_cost_tokens: 514 (moderate)
- deferred_cost_tokens: 69898 (excessive)
- total_tokens: 70505 (excessive)

- samples: 3
- observed_input_tokens_avg: 952856
- observed_output_tokens_avg: 6909
- observed_total_tokens_avg: 959765
- estimated_active_tokens: 607
- estimate_vs_observed_input_delta: 952249
- estimate_vs_observed_input_ratio: 1568.78 (wide-drift)
</details>
<details>
<summary>Measurement plan</summary>

Combine cost, outcome, and trust signals so you can tell whether the skill or plugin is genuinely helping instead of only looking well-structured on paper.

- Token Usage Observer [medium] Measure how many tokens the skill or plugin actually burns in representative runs. Signals: observed_usage_sample_count, observed_input_tokens_avg, observed_total_tokens_avg, estimate_vs_observed_input_ratio. Evidence: Responses API usage logs, Codex-like session exports, JSONL traces captured from local benchmarking harnesses.
- Task Outcome Scorecard [high] Measure whether the skill helps users finish the intended job with fewer retries and less cleanup. Signals: task_success_rate, first_pass_success_rate, retry_rate, human_override_rate. Evidence: Task run logs, Structured user acceptance checklist, Before/after comparison runs on the same prompts.
- Tool Call Audit [high] Check whether the agent uses the right tools, arguments, and sequencing when the skill is active. Signals: tool_call_success_rate, invalid_tool_argument_rate, recoverable_tool_failure_rate. Evidence: Tool invocation traces, Recorded sessions, Golden-path scenario replays.
- Latency And Efficiency [medium] Track whether the skill speeds users up enough to justify its cost. Signals: p50_time_to_first_acceptable_answer_seconds, p95_time_to_task_completion_seconds, tokens_per_successful_run. Evidence: Benchmark harness timings, Manual stopwatch runs on canonical tasks, Responses API timestamps combined with usage logs.
- Human Rubric Review [medium] Capture clarity, trust, and usefulness signals that automated checks will miss. Signals: clarity_score_avg, confidence_score_avg, follow_up_question_rate. Evidence: Reviewer scorecards, Team rubric sheets, Annotated transcripts.
- Regression Suite [medium] Protect the repository behavior that the skill is supposed to improve. Signals: test_pass_rate, lint_pass_rate, regression_escape_count. Evidence: Unit and integration test runs, Coverage deltas, Snapshot or golden-file checks.
</details>
<details>
<summary>Use From Codex Chat</summary>

Start with a natural chat request, then let plugin-eval show the exact local command sequence behind it.

Start with this chat request: "Measure the real token usage of this plugin."
Why this path: Plugin Eval recommended Measure Real Token Usage from the current local state for this plugin.
Quick local entrypoint: plugin-eval start ~/Desktop/application-hub/application-hub-mcp-server --request 'Measure the real token usage of this plugin.' --format markdown
Plugin Eval will run first: plugin-eval benchmark ~/Desktop/application-hub/application-hub-mcp-server --config ~/Desktop/application-hub/application-hub-mcp-server/.plugin-eval/benchmark.json

Other chat requests you can use:
- Full Plugin Analysis: say "Give me a full analysis of this plugin, including benchmark setup." -> plugin-eval analyze ~/Desktop/application-hub/application-hub-mcp-server --format markdown
- Evaluate Plugin: say "Evaluate this plugin." -> plugin-eval analyze ~/Desktop/application-hub/application-hub-mcp-server --format markdown
- Explain Token Budget: say "Explain the token budget for this plugin." -> plugin-eval explain-budget ~/Desktop/application-hub/application-hub-mcp-server --format markdown
- Measure Real Token Usage: say "Measure the real token usage of this plugin." -> plugin-eval benchmark ~/Desktop/application-hub/application-hub-mcp-server --config ~/Desktop/application-hub/application-hub-mcp-server/.plugin-eval/benchmark.json
- Benchmark With Starter Scenarios: say "Help me benchmark this plugin." -> plugin-eval benchmark ~/Desktop/application-hub/application-hub-mcp-server --config ~/Desktop/application-hub/application-hub-mcp-server/.plugin-eval/benchmark.json
- Start Here: say "What should I run next?" -> plugin-eval benchmark ~/Desktop/application-hub/application-hub-mcp-server --config ~/Desktop/application-hub/application-hub-mcp-server/.plugin-eval/benchmark.json
</details>
<details>
<summary>Checks</summary>

- [WARN] plugin-skills-missing: The plugin did not expose any discoverable skills. Evidence: ./skills/ Remediation: Add at least one skill under the configured skills path.
- [FAIL] deferred_cost_tokens-budget-high: deferred_cost_tokens is excessive relative to the current Codex baseline. Evidence: Value: 69898 tokens Baseline samples: skills=24, plugins=116 Remediation: Reduce repeated instruction text and move detail into deferred supporting files.
- [FAIL] observed-usage-estimate-drift: Static budget estimates differ meaningfully from observed input token usage. Evidence: Estimated active tokens: 607 Observed average input tokens: 952856 Delta ratio: 156878% Remediation: Trim repeated instructions or supporting text if the observed value is higher than expected. If the static estimate is intentionally conservative, record that assumption in the skill or plugin references.
- [WARN] ts-complexity-high: At least one TypeScript function has high cyclomatic complexity. Evidence: Max complexity: 75 Remediation: Split complex functions into smaller branches with clearer responsibilities.
- [WARN] ts-function-length-high: At least one TypeScript function is long enough to hurt readability. Evidence: Max function length: 104 lines Remediation: Break large functions into smaller helpers with single-purpose logic.
- [WARN] ts-long-lines: Some TypeScript lines exceed 120 characters. Evidence: Long lines: 22 Remediation: Wrap long expressions and object literals to keep scanability high.
- [INFO] coverage-artifacts-unavailable: No coverage artifacts were found for this target. Evidence: ../application-hub/application-hub-mcp-server Remediation: Generate `lcov.info`, `coverage.xml`, or an Istanbul coverage JSON file if you want coverage scoring.
</details>
<details>
<summary>Metrics</summary>

- plugin_skill_count: 0 skills (moderate)
- plugin_keyword_count: 10 keywords (good)
- plugin_default_prompt_count: 3 prompts (good)
- trigger_cost_tokens: 93 tokens (moderate)
- invoke_cost_tokens: 514 tokens (moderate)
- deferred_cost_tokens: 69898 tokens (excessive)
- observed_usage_sample_count: 3 samples (moderate)
- observed_input_tokens_avg: 952856 tokens (info)
- observed_output_tokens_avg: 6909 tokens (info)
- observed_total_tokens_avg: 959765 tokens (info)
- estimate_vs_observed_input_delta: 952249 tokens (heavy)
- estimate_vs_observed_input_ratio: 1568.78 ratio (heavy)
- ts_file_count: 38 files (good)
- ts_function_count: 43 functions (good)
- ts_max_cyclomatic_complexity: 75 score (heavy)
- ts_average_function_length: 47.77 lines (moderate)
- ts_max_nesting_depth: 7 levels (heavy)
- ts_comment_ratio: 0.026 ratio (moderate)
- ts_test_file_count: 3 files (good)
- coverage_artifact_count: 0 files (info)
</details>
<details>
<summary>Score details</summary>

- Starting score: 100
- Total deductions: -46.25
- Final score: 54
- Risk: Contains 2 failing error checks (deferred_cost_tokens-budget-high, observed-usage-estimate-drift).
- Risk: Overall score is below 70, which the evaluator treats as high risk.

- -14 points: deferred_cost_tokens-budget-high [fail/error] deferred_cost_tokens is excessive relative to the current Codex baseline.
- -14 points: observed-usage-estimate-drift [fail/error] Static budget estimates differ meaningfully from observed input token usage.
- -4.5 points: plugin-skills-missing [warn/warning] The plugin did not expose any discoverable skills.
- -4.5 points: ts-complexity-high [warn/warning] At least one TypeScript function has high cyclomatic complexity.
- -4.5 points: ts-function-length-high [warn/warning] At least one TypeScript function is long enough to hurt readability.
- -4.5 points: ts-long-lines [warn/warning] Some TypeScript lines exceed 120 characters.
- -0.25 points: coverage-artifacts-unavailable [info/info] No coverage artifacts were found for this target.

- budget: -28 points across 2 checks
- readability: -9 points across 2 checks
- complexity: -4.5 points across 1 check
- manifest: -4.5 points across 1 check
- coverage: -0.25 points across 1 check
</details>
