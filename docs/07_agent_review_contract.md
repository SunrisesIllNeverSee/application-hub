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

This output does not have to be persisted in Phase 2. The first goal is to make review context easy to retrieve and reason over. Persistence can come later through a dedicated `answer_reviews` table or JSON metadata column once the review shape stabilizes.

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

---

## Launch Rule

Do not put the full RNS review system inside `POST /api/draft`. Keep first-pass drafting fast. Let the agent-side review path mature through MCP before promoting it into first-class app UI.
