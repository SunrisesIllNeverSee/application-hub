# Stress-Test Persistence

`hub_stress_test_answer` already provides deterministic answer review context. Migration `010_launch_hardening.sql` adds the persistence table for saving those runs.

## Table

`answer_stress_tests`

Important columns:

- `user_id`
- `profile_answer_id`
- `program_id`
- `archived_question_id`
- `depth`: `light | medium | deep`
- `mode`: starts as `stub_no_llm`
- `provider`
- `model_used`
- `detected_signals`
- `follow_up_prompts`
- `checklist`
- `risk_flags`
- `score_payload`
- `fidelity_certificate`

## Launch Use

Milestone 3 can ship without the UI for this table. The important part is that the backend contract is no longer vague.

Next implementation step:

1. UI calls `hub_stress_test_answer` or app-side equivalent.
2. User reviews suggested follow-up prompts.
3. App persists the run to `answer_stress_tests`.
4. Later RNS/CIVITAE/MO§ES workflows write richer scores and fidelity certificates into the JSONB fields.

## RNS Upgrade Path

The table is intentionally JSONB-friendly because the scoring shape is going to evolve.

Planned fields inside `score_payload`:

- signal purity
- specificity
- claim support
- commitment stability
- program alignment
- contradiction risk

Planned fields inside `fidelity_certificate`:

- source claims checked
- answer version/hash
- generated challenges
- reviewer/posture metadata
- confidence bounds

## Product Boundary

Drafting creates first-pass text.

Stress testing evaluates saved answers and generates pressure questions, gaps, and evidence checks. It is allowed to be deeper and more RNS-flavored than `/api/draft`.
