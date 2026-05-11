---
description: Run a certification-oriented review for one saved answer and persist the result.
argument-hint: "<answer_id> [program_id]"
---

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
