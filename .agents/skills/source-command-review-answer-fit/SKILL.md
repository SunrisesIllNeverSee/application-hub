---
name: "source-command-review-answer-fit"
description: "Review one saved answer against a specific program and persist the result."
---

# source-command-review-answer-fit

Use this skill when the user asks to run the migrated source command `review-answer-fit`.

## Command Template

# /review-answer-fit -- Program-Scoped Answer Review

Use the `program-fit-reviewer` agent to review one saved answer against one specific program.

## Invocation

```text
/review-answer-fit <answer_id> <program_id>
```

## Workflow

1. Use `program-fit-reviewer`.
2. Read answer context through `hub_get_answer_review_context`.
3. Optionally stress-test with `hub_stress_test_answer` and `persist_result=true`.
4. Persist the result with `hub_save_answer_review`.
5. Return the saved review id and the most important fit mismatch, if any.
