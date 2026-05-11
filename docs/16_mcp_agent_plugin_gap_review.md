# MCP, Agent, and Plugin Gap Review

_Reviewed 2026-05-11_

This document captures the current state of the Application Hub MCP server, the documented agent-review boundary, the local plugin/tooling surfaces, and what is still missing before the RNS/CIVITAE/MO§ES layer can act as a full two-way agent system.

---

## Executive summary

The repo is further along than the earlier gap summary implied.

What is already real:

- MCP server is implemented and registered
- `hub_get_answer_review_context` exists
- `hub_stress_test_answer` exists
- `answer_stress_tests` table exists
- review/stress-test boundary is documented

What is still actually missing:

- a write-back path for agent review results
- concrete checked-in RNS/CIVITAE/MO§ES agent implementations
- reconciliation between the documented future stress-test persistence contract and the schema that now exists
- local measurement/evaluation workflow for the MCP bundle

---

## Confirmed current state

### MCP server

Confirmed in `application-hub-mcp-server/src/index.ts`:

- `hub_get_answer_review_context`
- `hub_stress_test_answer`
- 20 registered tools total

This means the “stress test MCP tool is still missing” note is stale. The missing layer is no longer MCP exposure; it is persistence, scoring, UI, and agent implementation.

### Review bridge

Confirmed in `application-hub-mcp-server/src/tools/user/hub_get_answer_review_context.ts`:

- authenticated read access to a saved answer
- archived question context
- program usage
- program DNA
- answer history
- review contract slots

This is a valid read bridge for external agent review.

### Stress-test groundwork

Confirmed in `application-hub-mcp-server/src/tools/user/hub_stress_test_answer.ts`:

- deterministic prompt generation
- theme-aware follow-up prompts
- no LLM dependency
- no persistence yet from the tool itself

Confirmed in `migrations/012_launch_hardening.sql`:

- `answer_stress_tests` table exists
- append-oriented storage contract exists
- RLS is in place

So the tool is implemented, but the tool and persistence contract have not yet been joined.

---

## Real gaps

### 1. No review-output write-back path

Agents can read answer review context, but they cannot save:

- comments
- scores
- certification payload
- reviewer identity / run metadata

Without that, agent review is observational only.

The repo needs either:

- an `answer_reviews` table plus MCP/app save path, or
- a constrained JSON review column strategy

The first option is cleaner.

### 2. No checked-in agent implementations

The repo documents RNS/CIVITAE/MO§ES review behavior, but does not contain first-class agent implementations for it.

Current state:

- contract exists
- bridge exists
- persistence for stress-test runs exists
- actual reviewer agents do not appear to be checked into the repo

That means the architecture is ready for agent interaction, but the agent layer itself is not yet productized.

### 3. Review/stress-test contract drift

`docs/07_agent_review_contract.md` still describes a future persistence contract that does not match the schema now present in `answer_stress_tests`.

Doc says future fields like:

- `answer_id`
- `follow_up_questions`
- `responses`
- `confidence_score`
- `run_at`

Schema actually has:

- `profile_answer_id`
- `follow_up_prompts`
- `checklist`
- `score_payload`
- `created_at`

This should be reconciled before downstream agent work begins.

### 4. No local plugin-eval benchmarking baseline for the MCP bundle

`plugin-eval` is now installed locally, but observed-usage benchmarking has not yet been set up for:

- `application-hub-mcp-server`
- any future local agent/plugin bundle

That means current plugin-eval output is static-analysis-heavy and not yet grounded in observed usage.

---

## Plugin-eval findings

Local CLI is installed and working as:

```bash
plugin-eval
```

Installation source:

- local plugin bundle cache via `npm link`

Static evaluation on `application-hub-mcp-server` reported:

- score: `68/100`
- main issues:
  - deferred instruction/token budget too high
  - no test coverage around TS tool logic
  - high-complexity/high-length functions
  - long lines

Important nuance:

- this evaluation treated the MCP server as a generic code target, not a true plugin root
- it is still useful for code-health direction, but not a full plugin-structure verdict

---

## Tools and plugins that actually help next

### Already useful

- `plugin-eval`
  - static quality review
  - benchmark scaffolding
  - token-budget measurement path

- `openai-developers` / `agents-sdk`
  - best fit for building a real checked-in agent runner layer once the review write-back contract exists

- `supabase`
  - best fit for schema work, review persistence, and querying live review/stress-test data

- `context7`
  - current docs for Agents SDK, MCP patterns, and any supporting library changes

### Useful but secondary

- `github`
  - only if we want issues/backlog or PR-based rollout around agent work

- `vercel`
  - only when agent/UI surfaces become deployed app behavior

### Not the bottleneck

- more MCP exposure
- more prompt-only docs
- deeper hosted draft complexity

The bottleneck is now persistence + concrete agents, not another surface description.

---

## Recommended implementation plan

### Phase 1 — Reconcile the contract

- Update `docs/07_agent_review_contract.md` so the stress-test persistence contract matches `answer_stress_tests`
- Document clearly that `hub_stress_test_answer` exists and is the current groundwork tool
- Remove stale roadmap/task language that implies the tool is unbuilt

### Phase 2 — Add review persistence

- Create `answer_reviews` table
- Store:
  - `profile_answer_id`
  - `user_id`
  - optional `program_id`
  - reviewer type / provider / model
  - summary
  - comments JSON
  - scores JSON
  - certification JSON
  - created timestamp
- Add RLS mirroring `answer_stress_tests`

### Phase 3 — Add a write path

- MCP tool for saving review output, likely:
  - `hub_save_answer_review`
- keep strict validation
- keep hosted drafting separate
- allow external agents to write back structured review results

### Phase 4 — Build the first real agent

Start with one concrete reviewed path, not a full ecosystem:

- one RNS/CIVITAE-style reviewer agent
- input: `hub_get_answer_review_context`
- output: contract-compliant review object
- persistence: `hub_save_answer_review`

Do not start with MO§ES governance breadth first.
Start with one full loop.

### Phase 5 — Measure it

- initialize `plugin-eval` benchmark config for the MCP bundle
- collect observed usage
- rerun plugin-eval with usage evidence
- use that to trim prompt/deferred budget before expanding agent breadth

---

## Short verdict

Application Hub already has the read side of agent interaction and the beginnings of stress-test infrastructure.

It does **not** yet have:

- review-result persistence
- review-result write-back tools
- checked-in reviewer agents

That is the real line between “agent-ready architecture” and “full agent interaction.”
