---
name: application-hub-discovery
description: Discover funding programs and assess applicant readiness via the Application Hub MCP server. Use when the user wants to find grants, accelerators, or fellowships, explore program questions and DNA themes, score applicant fit, or review and stress-test answers.
license: UNLICENSED
---

# Application Hub Discovery

Use this skill whenever the user asks about funding programs, grant or accelerator applications, fit scoring, or application answer quality.

## When to invoke

- "Find me open accelerators / grants / fellowships matching X"
- "What questions does program Y ask?"
- "How well do I fit program Z?"
- "Review / rank / stress-test my answers."
- "Is my application ready?"

## Tool routing

- Discovery: `hub_search_programs`, `hub_get_program_detail`, `hub_get_program_by_slug`, `hub_get_program_rankings`, `hub_get_heat_scores`.
- Questions: `hub_get_program_questions`, `hub_find_similar_questions`, `hub_get_universal_questions`, `hub_get_program_dna`.
- Applicant (auth): `hub_get_fit_score`, `hub_find_best_programs`, `hub_get_application_readiness`, `hub_rank_my_answers`, `hub_get_answer_review_context`, `hub_save_answer_review`, `hub_stress_test_answer`, `hub_save_answer`, `hub_log_draft_run`.
- Intelligence: `hub_get_question_significance`, `hub_get_acceptance_stats`.

## Operating guidance

1. Pull live data via MCP — never fabricate program names, deadlines, or weights.
2. Prefer `hub_search_programs` before `hub_get_program_detail` when the program is unknown.
3. Combine `hub_get_application_readiness` with `hub_rank_my_answers` to focus on highest-leverage gaps.
4. For fit, return the score plus top contributing DNA themes from `hub_get_program_dna`.
5. Surface auth errors clearly — applicant tools require a signed-in profile.
