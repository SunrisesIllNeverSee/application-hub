---
description: Generate and persist a saved-answer stress test, then summarize the highest-risk prompts.
argument-hint: "<answer_id> [program_id] [light|medium|deep]"
---

# /stress-test-answer -- Persisted Answer Stress Test

Use the `stress-test-conductor` agent to generate and persist a deterministic stress-test run.

## Invocation

```text
/stress-test-answer <answer_id> [program_id] [light|medium|deep]
```

## Workflow

1. Use `stress-test-conductor`.
2. Call `hub_stress_test_answer` with `persist_result=true`.
3. Return:
   - the saved `stress_test_id`
   - the key follow-up prompts
   - the biggest evidence gap exposed by the run
