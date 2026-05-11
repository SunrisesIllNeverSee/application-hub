# MCP, Agent, and Plugin Gap Review

_Reviewed 2026-05-11_

This document captures the current state of the Application Hub MCP server, the documented agent-review boundary, the local plugin/tooling surfaces, and what is still missing before the RNS/CIVITAE/MO§ES layer can act as a full two-way agent system.

---

## Executive summary

The repo is further along than the earlier gap summary implied.

What is already real:

- MCP server is implemented and registered
- `hub_get_answer_review_context` exists
- `hub_save_answer_review` exists
- `hub_stress_test_answer` exists
- `answer_reviews` table exists
- `answer_stress_tests` table exists
- review/stress-test boundary is documented
- reviewer agent family exists

What is still actually missing:

- local measurement/evaluation workflow for the MCP bundle
- broader governed reviewer families beyond the first concrete agent
- measurement and governance conventions across the growing reviewer family

---

## Confirmed current state

### MCP server

Confirmed in `application-hub-mcp-server/src/index.ts`:

- `hub_get_answer_review_context`
- `hub_save_answer_review`
- `hub_stress_test_answer`
- 21 registered tools total

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
- optional persistence via `persist_result=true`

Confirmed in `migrations/012_launch_hardening.sql`:

- `answer_stress_tests` table exists
- append-oriented storage contract exists
- RLS is in place

So the tool is implemented and now joined to persistence, but it is still a deterministic stub rather than a scored LLM-backed challenge path.

---

## Real gaps

### 1. Stress-test persistence is wired, but app UX is still missing

`hub_stress_test_answer` can now persist runs, but the product still lacks a first-class app surface and quota policy around those saved stress tests.

### 2. Only the first reviewer agent is checked in

The original gap is now partially closed.

Current state:

- contract exists
- bridge exists
- persisted review write-back exists
- persistence for stress-test runs exists and can be triggered from the MCP tool
- `.claude/agents/rns-answer-reviewer.md` is now checked in
- broader RNS/CIVITAE/MO§ES family still does not exist yet

That means the architecture now has a usable starter family of reviewers, but not yet the full governed RNS/CIVITAE/MO§ES system.

### 3. Review/stress-test contract drift

This gap has been closed in `docs/07_agent_review_contract.md`.

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

Status: done

- Update `docs/07_agent_review_contract.md` so the stress-test persistence contract matches `answer_stress_tests`
- Document clearly that `hub_stress_test_answer` exists and is the current groundwork tool
- Remove stale roadmap/task language that implies the tool is unbuilt

### Phase 2 — Add review persistence

Status: done

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

Status: done

- MCP tool for saving review output, likely:
  - `hub_save_answer_review`
- keep strict validation
- keep hosted drafting separate
- allow external agents to write back structured review results

### Phase 4 — Build the first real agent

Status: done

Start with one concrete reviewed path, not a full ecosystem:

- one general RNS/CIVITAE-style reviewer agent
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

It now has:

- review-result persistence
- review-result write-back tools
- a checked-in starter reviewer family

The remaining line between “first real agent loop” and “full agent interaction” is:

- broader governed reviewer families
- observed-usage benchmarking
- app/product surfaces for invoking the saved review and stress-test paths
