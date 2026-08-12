---
name: "source-command-certify-answer"
description: "Run a certification-oriented review for one saved answer and persist the result."
---

# source-command-certify-answer

Use this skill when the user asks to run the migrated source command `certify-answer`.

## Command Template

# /certify-answer -- Fidelity and Certification Review

Use the `fidelity-certifier` agent to decide whether a saved answer is ready for broad reuse.

## Invocation

```text
/certify-answer <answer_id> [program_id]
```

## Workflow

1. Use `fidelity-certifier`.
2. Read answer context through `hub_get_answer_review_context`.
3. Stress-test with `hub_stress_test_answer` when needed, preferably with `persist_result=true`.
4. Persist the review with `hub_save_answer_review`.
5. Return the saved review id plus the certification verdict.
