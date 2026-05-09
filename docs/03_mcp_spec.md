# MCP Server Spec — Application Hub
> Ello Cello LLC

This is the platform's external surface area. Every AI assistant (Claude, GPT, Cursor, Windsurf, custom agents) can connect to this and query live program data, user answers, heat scores, and rankings. Publishing here turns the platform into infrastructure, not just an app.

---

## What We're Building vs What Exists

| | grants-mcp (Tar-ive) | agentdeals | **Application Hub MCP** |
|---|---|---|---|
| Federal grants | ✓ | – | ✓ (via sync) |
| Private accelerators | – | – | ✓ |
| Fellowships | – | – | ✓ |
| Corporate programs | – | ✓ (credits only) | ✓ |
| Question archive | – | – | ✓ |
| Semantic question search | – | – | ✓ |
| User profile answers | – | – | ✓ (authenticated) |
| Program ranking/ROI | – | – | ✓ |
| Application workflow | – | – | ✓ |

We consume grants-mcp as a data source. We are not competing with it.

---

## MCP Architecture

```
[Client: Claude / GPT / Cursor / custom agent]
                    ↓
         MCP Transport (stdio or HTTP/SSE)
                    ↓
         Application Hub MCP Server
         (TypeScript, @modelcontextprotocol/sdk)
                    ↓
         Supabase REST API (service role key)
                    ↓
         Postgres (RLS bypassed at service role — MCP enforces its own auth)
```

### Deployment options
- **Option A**: Supabase Edge Function (low ops, already on platform)
- **Option B**: Vercel Function (better cold start, simpler routing)
- **Option C**: Standalone Node service (max control)

Start with Option A (Edge Function). Migrate to B if latency is an issue.

---

## Authentication

Two modes:

### 1. Public tools (no auth required)
Search programs, get questions, get heat scores, get rankings. Read-only, no user data.

### 2. Authenticated tools (require user token)
Get profile answers, log draft runs, get personalized readiness scores.

Auth flow: client passes Supabase JWT in tool call → MCP server validates via `supabase.auth.getUser(token)` → scopes response to that user.

---

## Tools

### `search_programs`
Search the program hub with filters.

**Inputs:**
```typescript
{
  query?: string,            // full-text search on name/description
  type?: program_type[],     // grant | accel | vc | corp | uni | job | fellowship
  status?: program_status[], // upcoming | open | closed
  equity_max_pct?: number,   // filter out programs taking more than X% equity
  min_cash_usd?: number,
  rolling_only?: boolean,
  deadline_within_days?: number,
  limit?: number,            // default 20, max 100
  sort_by?: 'heat_score' | 'program_value_score' | 'deadline' | 'acceptance_rate'
}
```

**Returns:** Array of programs with: id, name, slug, type, status, deadline, equity_pct, cash_value_usd, heat_score, program_value_score, acceptance_rate, question_count.

---

### `get_program_detail`
Full detail on one program.

**Inputs:** `{ program_id: string }` or `{ slug: string }`

**Returns:** All program fields + program_stats row + listing tier (standard/verified/featured).

---

### `get_program_questions`
All questions for a program, ordered by display order.

**Inputs:** `{ program_id: string }`

**Returns:** Array of: question_id, archived_question_id, exact_phrasing, theme, word_limit, char_limit, is_required, order_index, is_universal, asked_by_count.

---

### `find_similar_questions`
Semantic search across the question archive. Useful for: "what programs ask about traction?" or "find questions similar to this one."

**Inputs:**
```typescript
{
  text: string,      // question text or concept
  threshold?: number, // cosine similarity floor, default 0.7
  limit?: number      // default 10
}
```

**Returns:** Array of: question_id, text, theme, asked_by_count, is_universal, similar_programs (list of program names that ask it).

---

### `get_heat_scores`
Trending programs right now.

**Inputs:**
```typescript
{
  type?: program_type,
  limit?: number,        // default 10
  status?: 'open'        // usually only want open programs
}
```

**Returns:** Programs ranked by heat_score descending, with score breakdown (views, saves, starts, submits, deadline_pressure_multiplier).

---

### `get_program_rankings`
Programs ranked by value score (ROI).

**Inputs:**
```typescript
{
  type?: program_type[],
  equity_max_pct?: number,
  status?: 'open',
  limit?: number
}
```

**Returns:** Programs sorted by program_value_score descending, with: cash, credits, equity, follow_on_rate, network_score, brand_score, application_difficulty.

---

### `get_profile_answers` *(authenticated)*
User's stored profile answers — the reusable answer bank.

**Inputs:**
```typescript
{
  user_token: string,
  theme?: string,           // filter by question theme
  confidence?: answer_confidence  // draft | solid | locked
}
```

**Returns:** Array of: question_text, theme, answer_content, confidence, word_count, last_updated.

---

### `get_application_readiness` *(authenticated)*
How ready is a user for a specific program?

**Inputs:**
```typescript
{
  user_token: string,
  program_id: string
}
```

**Returns:**
```typescript
{
  program_name: string,
  completion_pct: number,         // answered required questions / total required
  answered_questions: number,
  total_required_questions: number,
  missing_questions: [{           // questions not yet answered
    question_text: string,
    theme: string,
    word_limit: number
  }],
  deadline: string,
  days_remaining: number
}
```

---

### `log_draft_run` *(authenticated)*
Record that an AI assistant generated a draft. Enforces usage limits.

**Inputs:**
```typescript
{
  user_token: string,
  program_id: string,
  archived_question_id: string,
  integration_type: 'claude' | 'openai' | 'custom_agent' | 'mcp',
  model_used?: string,
  prompt_tokens?: number,
  completion_tokens?: number
}
```

**Returns:** `{ success: boolean, drafts_remaining: number | 'unlimited' }`

Raises error if monthly limit exceeded (enforced by trigger in migration 007).

---

### `get_acceptance_stats`
Crowdsourced acceptance data for a program.

**Inputs:** `{ program_id: string }`

**Returns:** `{ acceptance_rate_pct, total_reports, verified_reports, cohort_breakdown: [{cohort_label, accepted, rejected, waitlisted}] }`

---

## Resources (MCP Resources, not just tools)

MCP supports Resources — structured data the client can read like a filesystem.

```
hub://programs                    → list of all programs (paginated)
hub://programs/{slug}             → full program detail
hub://questions/universal         → all is_universal=true questions
hub://questions/themes            → question counts by theme
hub://rankings/value              → top programs by ROI score
hub://rankings/heat               → trending programs
hub://stats/platform              → total programs, questions, users (public)
```

Resources are cached (Supabase reads) and invalidated on data change.

---

## Prompts (MCP Prompts)

Pre-built prompt templates the client can invoke:

### `opportunity_scout`
"Given this user's profile, find the best matching open programs."
Inputs: user_token, top_n (default 5)
Internally calls: `get_profile_answers` + `search_programs` + `get_application_readiness`

### `draft_answer`
"Draft an answer to this question using the user's profile as context."
Inputs: user_token, program_id, question_id
Internally calls: `get_profile_answers` (for relevant theme) + question detail

### `program_comparison`
"Compare these two programs side by side."
Inputs: program_id_a, program_id_b
Internally calls: `get_program_detail` × 2 + `get_acceptance_stats` × 2

---

## Connection to MO§ES Work

The MO§ES governance system (already built) gives us:
- **Audit trail** for every MCP tool call (who called what, when)
- **Posture control** — SCOUT mode (read-only) for public tools, OFFENSE for authenticated writes
- **Role hierarchy** — Opportunity Scout Agent = Primary, Answer Coach = Sub
- **Vault** — user's integration config (Claude API key, OpenAI key) injected per session

What we carry over from MO§ES directly:
- The `context-assembly` skill → becomes the MCP server's request handler context builder
- The `audit-trail` skill → wraps every authenticated tool call
- The `posture-control` skill → enforces SCOUT mode on public read tools (no state changes)
- The `role-hierarchy` skill → governs agent-to-agent calls (Opportunity Scout calling Answer Coach)

What we build new on top:
- The actual tool implementations (Supabase queries)
- Auth middleware (Supabase JWT validation)
- Rate limiting per user tier (free = 100 calls/day, pro = unlimited)
- The Resources layer (hub:// URIs)

---

## Publishing

| Registry | URL | Status |
|---|---|---|
| Official MCP Registry | registry.modelcontextprotocol.io | Submit after stable v1 |
| Smithery | smithery.ai | Submit + verify |
| Glama | glama.ai/mcp/servers | Submit |
| Claude plugins | claude.ai/plugins (when available) | Submit |
| Cursor | cursor.com/mcp | Submit |

---

## Implementation Stack

```
/mcp-server
  index.ts              ← MCP server entrypoint
  tools/
    search_programs.ts
    get_program_detail.ts
    get_program_questions.ts
    find_similar_questions.ts
    get_heat_scores.ts
    get_program_rankings.ts
    get_profile_answers.ts         ← authenticated
    get_application_readiness.ts   ← authenticated
    log_draft_run.ts               ← authenticated + write
    get_acceptance_stats.ts
  resources/
    programs.ts
    questions.ts
    rankings.ts
  prompts/
    opportunity_scout.ts
    draft_answer.ts
    program_comparison.ts
  auth/
    validate_token.ts   ← Supabase JWT validation
    rate_limit.ts       ← per user tier
  lib/
    supabase.ts         ← service role client
    cache.ts            ← in-memory + Redis (optional)
```

Dependencies:
```json
{
  "@modelcontextprotocol/sdk": "latest",
  "@supabase/supabase-js": "latest",
  "zod": "latest"
}
```

---

## v1 Scope (Ship This)

- Tools: search_programs, get_program_questions, find_similar_questions, get_heat_scores, get_program_rankings, get_acceptance_stats (all public, no auth required)
- Resources: hub://programs, hub://questions/universal, hub://rankings/value
- No authenticated tools in v1 (simplifies launch)
- Deploy as Supabase Edge Function
- List on Official MCP Registry + Smithery + Glama

## v2 (After Launch)

- Authenticated tools: get_profile_answers, get_application_readiness, log_draft_run
- Prompts: opportunity_scout, draft_answer, program_comparison
- Rate limiting by subscription tier
- MO§ES audit trail integration
