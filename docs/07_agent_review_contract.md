# Agent-Side Answer Review Contract

Application Hub separates hosted drafting from deeper review. The app can create a first-pass draft through `POST /api/draft`, save it to the answer bank, and keep the product loop fast. Review comments, RNS signal analysis, answer fidelity, commitment conservation, and certification can run from Deric's side through MCP/agent workflows over saved answers.

This document defines the first contract for that agent-side review path.

---

## Boundary

Hosted drafting:

- Runs inside the Next.js app.
- Uses `POST /api/draft`.
- Produces first-pass text.
- Saves through the existing answer editor flow.

Agent-side review:

- Runs outside the hosted draft route.
- Reads saved answer context through MCP.
- Produces comments, scores, warnings, and optional certification metadata.
- Does not need to block launch or sit in the synchronous app request path.

---

## Review Context Input

The first MCP surface is:

```text
hub_get_answer_review_context(answer_id)
```

`answer_id` is a `profile_answers.id` UUID. The authenticated user's Supabase JWT scopes access to their own saved answer.

The tool should return:

- `answer`: saved profile answer content, confidence, word count, version, and timestamps.
- `archived_question`: canonical question text, theme, significance, asked-by count, universal flag, and typical word limit.
- `program_usage`: programs that ask this question, with exact phrasing, section, order, and word/character limits.
- `program_dna`: theme weights for the programs that ask the question.
- `answer_history`: recent saved versions for answer evolution review.
- `review_contract`: named slots expected from an RNS/CIVITAE/MO§ES reviewer.

The first stress-testing surface is:

```text
hub_stress_test_answer(user_token, answer_id, program_id?, stress_depth?)
```

This tool uses the same saved-answer context pattern as `hub_get_answer_review_context`: validate the user's Supabase JWT, load the saved answer by `profile_answers.id`, load the canonical archived question, load matching program usage, and load program DNA rows for the programs asking that question. It is deterministic in this phase. It does not call an LLM or score confidence. When `persist_result=true`, it saves the generated plan to `answer_stress_tests`.

`stress_depth` controls the number of follow-ups returned:

- `light`: 3 prompts
- `medium`: 4 prompts
- `deep`: 5 prompts

The optional `program_id` narrows program usage and DNA to one program, which lets the prompts stress the answer against a specific application instead of all programs that ask the same archived question.

---

## Review Output Shape

Reviewers should produce a structured object with these fields:

```json
{
  "answer_id": "uuid",
  "overall_status": "draft | usable | strong | certify",
  "summary": "Short human-readable assessment",
  "comments": [
    {
      "type": "signal | fidelity | commitment | specificity | fit | risk",
      "severity": "info | warning | blocker",
      "message": "Concrete reviewer note",
      "suggested_revision": "Optional replacement or edit guidance"
    }
  ],
  "scores": {
    "signal_purity": 0.0,
    "answer_fidelity": 0.0,
    "commitment_stability": 0.0,
    "program_fit_alignment": 0.0,
    "specificity": 0.0
  },
  "certification": {
    "eligible": false,
    "label": null,
    "rationale": "Why this answer is or is not ready to certify"
  }
}
```

This output is now persisted through:

```text
hub_save_answer_review(user_token, answer_id, ...)
```

The write path stores append-only rows in `answer_reviews`, scoped by the authenticated user's Supabase JWT. That keeps first-pass drafting fast while giving external RNS/CIVITAE/MO§ES workflows a durable place to save:

- comments
- scores
- certification payload
- reviewer identity and model metadata

Hosted drafting still does not need to own that review lifecycle.

---

## Stress-Test Output Shape

`hub_stress_test_answer` should return a structured object with these fields:

```json
{
  "answer_id": "uuid",
  "stress_test_id": "uuid or null",
  "mode": "stub_no_llm",
  "stress_depth": "light | medium | deep",
  "persisted": false,
  "scoring_performed": false,
  "answer": {
    "id": "uuid",
    "archived_question_id": "uuid",
    "question_text": "Question text",
    "theme": "traction",
    "answer_content": "Saved answer text",
    "confidence": "draft | solid | locked",
    "word_count": 120,
    "version": 3,
    "updated_at": "timestamp"
  },
  "archived_question": {},
  "program_scope": {
    "requested_program_id": "uuid or null",
    "matched_program_count": 3,
    "program_usage": [],
    "program_dna": []
  },
  "detected_signals": {
    "word_count_estimate": 120,
    "numeric_claims": ["$50k", "30%"],
    "likely_urls": []
  },
  "follow_up_prompts": [
    {
      "id": "stress_follow_up_1",
      "focus": "metric provenance",
      "prompt": "Where did the traction number in this answer come from, and what source would verify it?",
      "expected_evidence": ["analytics export", "Stripe or bank record", "CRM or customer list"],
      "risk_if_unanswered": "The answer may read as polished but unverifiable.",
      "response_type": "free_text",
      "founder_response": null
    }
  ],
  "checklist": [
    {
      "id": "claim_specificity",
      "label": "Every major claim names a number, customer, date, artifact, or observable outcome.",
      "status": "not_checked"
    }
  ],
  "persistence": {
    "requested": false,
    "saved": false,
    "table": "answer_stress_tests",
    "persisted_at": null
  }
}
```

The prompt set is intentionally conservative groundwork. It should help an external agent or UI ask useful follow-ups today, while leaving deeper claim extraction, confidence scoring, and persistence for a later schema-backed phase.

---

## RNS Mapping

Use the current app fields as launch scaffolding:

- `confidence = draft | solid | locked` remains the user-facing readiness state.
- `significance_score` remains the display alias for question leverage.
- `program_dna.weight_pct` remains the display alias for program theme weight.

RNS adds deeper judgment without replacing those fields immediately:

- Signal purity: does the answer preserve the question's actual intent?
- Word Vault classification: which concept family and theme does the answer express?
- Commitment conservation: does the answer make stable claims across versions and contexts?
- SigToken scoring: is the answer specific, grounded, and reusable?
- Fidelity certificate: is the answer strong enough to reuse across high-value applications?
- Stress-test survival: can the answer withstand follow-up prompts without exposing unverifiable, overstated, or generic claims?

---

## Launch Rule

Do not put the full RNS review system inside `POST /api/draft`. Keep first-pass drafting fast. Let the agent-side review path mature through MCP before promoting it into first-class app UI.

Likewise, keep stress testing out of hosted drafting for now. The MCP tool can generate and optionally persist the follow-up contract without subsidizing model calls or blocking the answer editor. LLM follow-up generation, monthly quota checks, and confidence scoring can land after BYOK and the current stub path are in place.
