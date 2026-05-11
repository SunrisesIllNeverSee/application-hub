---
description: Run the saved-answer reviewer loop for one answer and persist the result.
argument-hint: "<answer_id> [program_id]"
---

# /review-answer -- Persisted Saved-Answer Review

Run the first real Application Hub reviewer loop against an existing `profile_answers` row.

## Invocation

```text
/review-answer <answer_id> [program_id]
```

- `answer_id` is required and must be a `profile_answers.id` UUID.
- `program_id` is optional and narrows the review to one program context.

## Workflow

1. Use the `rns-answer-reviewer` agent.
2. Read answer context through `hub_get_answer_review_context`.
3. If the answer needs harder probing, call `hub_stress_test_answer` with:
   - the same `answer_id`
   - the optional `program_id`
   - `persist_result=true`
4. Produce a structured review that matches `docs/07_agent_review_contract.md`.
5. Persist the review with `hub_save_answer_review`.
6. Return a short human-readable summary plus the saved review id.

## Guardrails

- Do not generate a first-pass draft here.
- Do not mutate `profile_answers` directly.
- Do not fabricate evidence the founder has not provided.
- Keep the output useful and compact.
