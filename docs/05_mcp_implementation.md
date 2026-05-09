# MCP Server — Full Implementation Map
> application-hub-mcp-server
> TypeScript · @modelcontextprotocol/sdk · Streamable HTTP

---

## Project Structure

```
application-hub-mcp-server/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── src/
│   ├── index.ts                    ← server entry, transport setup
│   ├── constants.ts                ← API_BASE_URL, CHARACTER_LIMIT, defaults
│   ├── types.ts                    ← all TypeScript interfaces
│   ├── services/
│   │   ├── supabase.ts             ← service role client (bypasses RLS)
│   │   ├── auth.ts                 ← JWT validation for authenticated tools
│   │   └── cache.ts                ← in-memory cache with TTL
│   ├── schemas/
│   │   ├── common.ts               ← shared Zod schemas (pagination, format)
│   │   ├── programs.ts             ← program filter schemas
│   │   ├── questions.ts            ← question search schemas
│   │   └── user.ts                 ← authenticated tool schemas
│   ├── tools/
│   │   ├── programs/
│   │   │   ├── hub_search_programs.ts
│   │   │   ├── hub_get_program_detail.ts
│   │   │   ├── hub_get_program_rankings.ts
│   │   │   └── hub_get_heat_scores.ts
│   │   ├── questions/
│   │   │   ├── hub_get_program_questions.ts
│   │   │   ├── hub_find_similar_questions.ts
│   │   │   ├── hub_get_universal_questions.ts
│   │   │   └── hub_get_program_dna.ts
│   │   ├── intelligence/
│   │   │   ├── hub_get_question_significance.ts
│   │   │   └── hub_get_acceptance_stats.ts
│   │   └── user/                   ← all require JWT
│   │       ├── hub_get_profile_answers.ts
│   │       ├── hub_get_application_readiness.ts
│   │       ├── hub_get_fit_score.ts
│   │       ├── hub_find_best_programs.ts
│   │       ├── hub_rank_my_answers.ts
│   │       └── hub_log_draft_run.ts
│   ├── resources/
│   │   ├── programs.ts             ← hub://programs, hub://programs/{slug}
│   │   ├── questions.ts            ← hub://questions/universal, hub://questions/themes
│   │   └── rankings.ts             ← hub://rankings/value, hub://rankings/heat
│   └── prompts/
│       ├── opportunity_scout.ts    ← profile → best programs
│       ├── draft_answer.ts         ← profile answers → draft for question
│       └── program_comparison.ts   ← side-by-side two programs
└── dist/
```

---

## package.json

```json
{
  "name": "application-hub-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for the Application Hub — programs, questions, rankings, and applicant intelligence",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "engines": { "node": ">=18" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.6.1",
    "@supabase/supabase-js": "^2.0.0",
    "axios": "^1.7.9",
    "express": "^4.18.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

---

## src/index.ts

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";

// Tool registrations
import { registerSearchPrograms } from "./tools/programs/hub_search_programs.js";
import { registerGetProgramDetail } from "./tools/programs/hub_get_program_detail.js";
import { registerGetProgramRankings } from "./tools/programs/hub_get_program_rankings.js";
import { registerGetHeatScores } from "./tools/programs/hub_get_heat_scores.js";
import { registerGetProgramQuestions } from "./tools/questions/hub_get_program_questions.js";
import { registerFindSimilarQuestions } from "./tools/questions/hub_find_similar_questions.js";
import { registerGetUniversalQuestions } from "./tools/questions/hub_get_universal_questions.js";
import { registerGetProgramDna } from "./tools/questions/hub_get_program_dna.js";
import { registerGetQuestionSignificance } from "./tools/intelligence/hub_get_question_significance.js";
import { registerGetAcceptanceStats } from "./tools/intelligence/hub_get_acceptance_stats.js";
// Authenticated tools
import { registerGetProfileAnswers } from "./tools/user/hub_get_profile_answers.js";
import { registerGetApplicationReadiness } from "./tools/user/hub_get_application_readiness.js";
import { registerGetFitScore } from "./tools/user/hub_get_fit_score.js";
import { registerFindBestPrograms } from "./tools/user/hub_find_best_programs.js";
import { registerRankMyAnswers } from "./tools/user/hub_rank_my_answers.js";
import { registerLogDraftRun } from "./tools/user/hub_log_draft_run.js";
// Resources
import { registerProgramResources } from "./resources/programs.js";
import { registerQuestionResources } from "./resources/questions.js";
import { registerRankingResources } from "./resources/rankings.js";
// Prompts
import { registerOpportunityScout } from "./prompts/opportunity_scout.js";
import { registerDraftAnswer } from "./prompts/draft_answer.js";
import { registerProgramComparison } from "./prompts/program_comparison.js";

const server = new McpServer({
  name: "application-hub-mcp-server",
  version: "1.0.0"
});

// Register all tools
registerSearchPrograms(server);
registerGetProgramDetail(server);
registerGetProgramRankings(server);
registerGetHeatScores(server);
registerGetProgramQuestions(server);
registerFindSimilarQuestions(server);
registerGetUniversalQuestions(server);
registerGetProgramDna(server);
registerGetQuestionSignificance(server);
registerGetAcceptanceStats(server);
registerGetProfileAnswers(server);
registerGetApplicationReadiness(server);
registerGetFitScore(server);
registerFindBestPrograms(server);
registerRankMyAnswers(server);
registerLogDraftRun(server);

// Register resources
registerProgramResources(server);
registerQuestionResources(server);
registerRankingResources(server);

// Register prompts
registerOpportunityScout(server);
registerDraftAnswer(server);
registerProgramComparison(server);

// Transport
const transport = process.env.TRANSPORT ?? "stdio";

if (transport === "http") {
  const app = express();
  app.use(express.json());
  app.post("/mcp", async (req, res) => {
    const t = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    res.on("close", () => t.close());
    await server.connect(t);
    await t.handleRequest(req, res, req.body);
  });
  const port = parseInt(process.env.PORT ?? "3000");
  app.listen(port, () => console.error(`Hub MCP running on :${port}/mcp`));
} else {
  const t = new StdioServerTransport();
  await server.connect(t);
}
```

---

## src/services/supabase.ts

```typescript
import { createClient } from "@supabase/supabase-js";

// Service role — bypasses RLS, used for all public tool queries
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// User-scoped client — for authenticated tools, uses user JWT
export function userClient(token: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}
```

---

## src/services/auth.ts

```typescript
import { supabase } from "./supabase.js";

export async function validateUserToken(token: string): Promise<string> {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Invalid or expired user token. Please re-authenticate.");
  }
  return data.user.id;
}
```

---

## src/constants.ts

```typescript
export const CHARACTER_LIMIT = 25_000;

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

export enum ProgramType {
  GRANT = "grant",
  ACCEL = "accel",
  VC = "vc",
  CORP = "corp",
  UNI = "uni",
  JOB = "job",
  FELLOWSHIP = "fellowship",
  OTHER = "other"
}

export enum ProgramStatus {
  UPCOMING = "upcoming",
  OPEN = "open",
  CLOSED = "closed",
  RESULTS = "results"
}

export enum AnswerConfidence {
  DRAFT = "draft",
  SOLID = "solid",
  LOCKED = "locked"
}
```

---

## Tool Implementations

### hub_search_programs

```typescript
// src/tools/programs/hub_search_programs.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../../services/supabase.js";
import { ResponseFormat, CHARACTER_LIMIT } from "../../constants.js";

const Schema = z.object({
  query: z.string().optional().describe("Full-text search on program name/description"),
  type: z.array(z.enum(["grant","accel","vc","corp","uni","job","fellowship","other"])).optional(),
  status: z.array(z.enum(["upcoming","open","closed","results"])).optional().default(["open"]),
  equity_max_pct: z.number().min(0).max(100).optional().describe("Exclude programs taking more than this % equity"),
  min_cash_usd: z.number().optional(),
  rolling_only: z.boolean().optional(),
  deadline_within_days: z.number().int().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sort_by: z.enum(["heat_score","program_value_score","deadline","acceptance_rate"]).default("heat_score"),
  response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
}).strict();

export function registerSearchPrograms(server: McpServer) {
  server.registerTool("hub_search_programs", {
    title: "Search Programs",
    description: `Search the Application Hub for startup programs (accelerators, grants, fellowships, VC programs, corporate programs, university programs).

Supports filtering by type, status, equity, cash value, deadline, and rolling/cohort. Sorted by heat score, value score, deadline, or acceptance rate.

Returns: id, name, slug, type, status, deadline, equity_pct, cash_value_usd, heat_score, program_value_score, acceptance_rate, question_count, is_rolling.`,
    inputSchema: Schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (params) => {
    let q = supabase
      .from("programs")
      .select(`id, name, slug, type, status, deadline_at, equity_pct, cash_value_usd, credit_value_usd,
               heat_score, program_value_score, is_rolling, network_score, brand_score,
               program_stats(acceptance_rate_pct, total_applications)`)
      .order(params.sort_by, { ascending: params.sort_by === "deadline" })
      .range(params.offset, params.offset + params.limit - 1);

    if (params.status) q = q.in("status", params.status);
    if (params.type) q = q.in("type", params.type);
    if (params.equity_max_pct !== undefined) q = q.or(`equity_pct.is.null,equity_pct.lte.${params.equity_max_pct}`);
    if (params.min_cash_usd) q = q.gte("cash_value_usd", params.min_cash_usd);
    if (params.rolling_only) q = q.eq("is_rolling", true);
    if (params.query) q = q.textSearch("name", params.query);
    if (params.deadline_within_days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + params.deadline_within_days);
      q = q.lte("deadline_at", cutoff.toISOString());
    }

    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    const output = {
      total: count ?? data?.length ?? 0,
      count: data?.length ?? 0,
      offset: params.offset,
      has_more: (count ?? 0) > params.offset + (data?.length ?? 0),
      programs: data ?? []
    };

    if (params.response_format === ResponseFormat.JSON) {
      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
    }

    const lines = [`# Programs (${output.total} found)`, ""];
    for (const p of output.programs) {
      lines.push(`## ${p.name}`);
      lines.push(`- **Type**: ${p.type} | **Status**: ${p.status}`);
      lines.push(`- **Equity**: ${p.equity_pct ?? "n/a"}% | **Cash**: $${p.cash_value_usd?.toLocaleString() ?? "n/a"}`);
      lines.push(`- **Heat**: ${p.heat_score?.toFixed(1)} | **Value Score**: ${p.program_value_score?.toFixed(1)}`);
      lines.push(`- **Rolling**: ${p.is_rolling ? "Yes" : "No"} | **Deadline**: ${p.deadline_at ?? "n/a"}`);
      lines.push("");
    }

    const text = lines.join("\n").slice(0, CHARACTER_LIMIT);
    return { content: [{ type: "text", text }], structuredContent: output };
  });
}
```

---

### hub_get_program_dna

```typescript
// src/tools/questions/hub_get_program_dna.ts
// Returns theme weight breakdown for a program — what it actually cares about

server.registerTool("hub_get_program_dna", {
  title: "Get Program DNA",
  description: `Returns the theme weight breakdown for a program — what the program actually cares about, inferred from its questions.

Each theme (traction, team, product, market, mission, impact, etc.) is weighted by question count × word limits × order.

Example output:
  YC: traction 35%, team 25%, product 20%, market 10%, ask 10%
  Echoing Green: impact 40%, mission 30%, team 20%, financials 10%

Use this to understand what to emphasize in an application.`,
  inputSchema: z.object({
    program_id: z.string().uuid().optional(),
    slug: z.string().optional(),
    response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
  }).strict(),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async ({ program_id, slug, response_format }) => {
  // Resolve slug → id if needed
  let id = program_id;
  if (!id && slug) {
    const { data } = await supabase.from("programs").select("id").eq("slug", slug).single();
    id = data?.id;
  }
  if (!id) return { content: [{ type: "text", text: "Error: provide program_id or slug." }] };

  const { data, error } = await supabase
    .from("program_dna")
    .select("theme, question_count, word_limit_sum, weight_pct")
    .eq("program_id", id)
    .order("weight_pct", { ascending: false });

  if (error || !data?.length) return { content: [{ type: "text", text: "DNA not yet computed for this program." }] };

  const output = { program_id: id, themes: data };

  if (response_format === ResponseFormat.JSON) {
    return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: output };
  }

  const bar = (pct: number) => "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
  const lines = ["# Program DNA", ""];
  for (const t of data) {
    lines.push(`${bar(t.weight_pct)} ${t.theme.padEnd(14)} ${t.weight_pct?.toFixed(0)}%  (${t.question_count} questions)`);
  }
  return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: output };
});
```

---

### hub_get_fit_score (authenticated)

```typescript
// src/tools/user/hub_get_fit_score.ts

server.registerTool("hub_get_fit_score", {
  title: "Get Fit Score",
  description: `Returns how well this user matches a specific program, broken into four components:
- coverage_pct: % of required questions the user has profile answers for
- theme_alignment: do the user's strongest answers match the program's highest-weighted themes?
- criteria_match: does the user match stage/sector/geography requirements?
- quality_signal: answer quality (word count vs limit, confidence level)

Overall fit_score: 0–100.

Use to prioritize which programs to apply to first.`,
  inputSchema: z.object({
    user_token: z.string().describe("Supabase JWT from client auth"),
    program_id: z.string().uuid()
  }).strict(),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async ({ user_token, program_id }) => {
  const user_id = await validateUserToken(user_token);

  const { data } = await supabase
    .from("user_program_fit")
    .select("fit_score, coverage_pct, theme_alignment, criteria_match, quality_signal, computed_at")
    .eq("user_id", user_id)
    .eq("program_id", program_id)
    .single();

  if (!data) return { content: [{ type: "text", text: "Fit score not yet computed. Check back after your profile answers are saved." }] };

  const text = [
    `# Fit Score`,
    `**Overall: ${data.fit_score?.toFixed(0)}/100**`,
    "",
    `- Coverage:       ${data.coverage_pct?.toFixed(0)}%  (answered required questions)`,
    `- Theme Alignment: ${data.theme_alignment?.toFixed(0)}%  (your strong answers match program priorities)`,
    `- Criteria Match: ${data.criteria_match?.toFixed(0)}%  (stage/sector/geo)`,
    `- Quality Signal: ${data.quality_signal?.toFixed(0)}%  (answer quality vs limits)`,
    "",
    `Computed: ${data.computed_at}`
  ].join("\n");

  return { content: [{ type: "text", text }], structuredContent: data };
});
```

---

### hub_find_best_programs (the Opportunity Scout as a tool)

```typescript
server.registerTool("hub_find_best_programs", {
  title: "Find Best Programs For User",
  description: `Ranks all currently open programs by (fit_score × program_value_score) for this user.
This is the Opportunity Scout in tool form — proactively finds the best match between what the user has written and what programs want.

Returns top N programs with fit score, value score, composite rank, days to deadline, and what's missing.`,
  inputSchema: z.object({
    user_token: z.string(),
    limit: z.number().int().min(1).max(20).default(5),
    equity_max_pct: z.number().optional(),
    type: z.array(z.enum(["grant","accel","vc","corp","uni","fellowship","other"])).optional(),
    response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN)
  }).strict(),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async ({ user_token, limit, equity_max_pct, type, response_format }) => {
  const user_id = await validateUserToken(user_token);

  let q = supabase
    .from("user_program_fit")
    .select(`fit_score, program_id,
             programs(name, slug, type, status, deadline_at, equity_pct, cash_value_usd, program_value_score, is_rolling)`)
    .eq("user_id", user_id)
    .eq("programs.status", "open")
    .order("fit_score", { ascending: false })
    .limit(limit * 3); // fetch more, filter, re-rank

  const { data, error } = await q;
  if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

  // Re-rank by composite: fit × value
  let programs = (data ?? [])
    .filter(r => r.programs)
    .map(r => ({
      ...r.programs,
      fit_score: r.fit_score,
      composite: (r.fit_score ?? 0) * (r.programs.program_value_score ?? 50) / 100
    }))
    .filter(p => !equity_max_pct || !p.equity_pct || p.equity_pct <= equity_max_pct)
    .filter(p => !type || type.includes(p.type))
    .sort((a, b) => b.composite - a.composite)
    .slice(0, limit);

  if (response_format === ResponseFormat.JSON) {
    return { content: [{ type: "text", text: JSON.stringify(programs, null, 2) }], structuredContent: { programs } };
  }

  const lines = [`# Your Best Programs Right Now`, ""];
  for (const p of programs) {
    const deadline = p.deadline_at ? new Date(p.deadline_at) : null;
    const days = deadline ? Math.ceil((deadline.getTime() - Date.now()) / 86400000) : null;
    lines.push(`## ${p.name}`);
    lines.push(`Fit: **${p.fit_score?.toFixed(0)}%**  |  Value: **${p.program_value_score?.toFixed(0)}**  |  Composite: **${p.composite?.toFixed(0)}**`);
    lines.push(`${p.equity_pct ? `${p.equity_pct}% equity` : "No equity"} · $${p.cash_value_usd?.toLocaleString() ?? "n/a"} · ${p.is_rolling ? "Rolling" : "Cohort"}`);
    if (days !== null) lines.push(`⏱ ${days} days left`);
    lines.push("");
  }

  return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: { programs } };
});
```

---

## Resources

```typescript
// src/resources/programs.ts
server.registerResource(
  { uri: "hub://programs", name: "All Programs", description: "Paginated list of all programs", mimeType: "application/json" },
  async () => {
    const { data } = await supabase.from("programs").select("id, name, slug, type, status, deadline_at, heat_score").limit(50);
    return { contents: [{ uri: "hub://programs", mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerResource(
  { uri: "hub://programs/{slug}", name: "Program by Slug", mimeType: "application/json" },
  async (uri) => {
    const slug = uri.split("/").pop();
    const { data } = await supabase.from("programs").select("*").eq("slug", slug).single();
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
  }
);

// src/resources/questions.ts
server.registerResource(
  { uri: "hub://questions/universal", name: "Universal Questions", description: "Questions asked by 80%+ of programs — the ones to answer first", mimeType: "application/json" },
  async () => {
    const { data } = await supabase.from("archived_questions").select("id, text, theme, significance_score, asked_by_count").eq("is_universal", true).order("significance_score", { ascending: false });
    return { contents: [{ uri: "hub://questions/universal", mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
  }
);
```

---

## Prompts

```typescript
// src/prompts/opportunity_scout.ts
server.registerPrompt("opportunity_scout", {
  title: "Opportunity Scout",
  description: "Given a user's profile answers, find and rank the best matching open programs",
  arguments: [
    { name: "user_token", description: "Supabase JWT", required: true },
    { name: "top_n", description: "Number of programs to return", required: false }
  ]
}, async ({ user_token, top_n }) => {
  return {
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Use hub_get_profile_answers to get this user's answers (token: ${user_token}), then use hub_find_best_programs to find the top ${top_n ?? 5} programs. Present results clearly showing fit score, value score, what's missing per program, and days to deadline.`
      }
    }]
  };
});

// src/prompts/draft_answer.ts
server.registerPrompt("draft_answer", {
  title: "Draft Answer",
  description: "Draft an answer to a program question using the user's profile answers as context",
  arguments: [
    { name: "user_token", required: true },
    { name: "program_id", required: true },
    { name: "question_id", required: true }
  ]
}, async ({ user_token, program_id, question_id }) => {
  return {
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Use hub_get_program_questions to get the question detail for question ${question_id} in program ${program_id}. Use hub_get_profile_answers (token: ${user_token}) to get the user's stored answers for the same theme. Then draft a response to the question using the profile answer as context, staying within word limits, and matching the program's DNA (call hub_get_program_dna for emphasis guidance). Do not simply copy the profile answer — adapt it.`
      }
    }]
  };
});
```

---

## MO§ES Integration Points

The MO§ES governance system (already built) wires into the MCP server at these points:

| MO§ES Skill | Where It Applies in MCP |
|---|---|
| `context-assembly` | Becomes the authenticated request context builder — assembles user tier, integration config, vault |
| `audit-trail` | Wraps every call to `hub_log_draft_run` and all authenticated write tools — SHA-256 hash chain |
| `posture-control` | SCOUT mode enforced on all public read tools (no state mutations allowed). OFFENSE required for `hub_log_draft_run`. |
| `role-hierarchy` | Opportunity Scout (Primary) → Answer Coach (Sub). Scout can call Coach, not the reverse. |
| `vault` | User's integration config (Claude API key, OpenAI key, custom agent endpoint) injected per session |

Implementation: wrap authenticated tool handlers in a `withGovernance(userId, posture, fn)` HOF that:
1. Validates posture allows the operation
2. Calls the function
3. Appends to audit trail with hash

---

## Environment Variables

```bash
# .env.example
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=          # server-side only — never expose to client
SUPABASE_ANON_KEY=                  # for user-scoped auth validation
TRANSPORT=http                      # "http" for remote, "stdio" for local
PORT=3000
```

---

## Rate Limiting by Subscription Tier

```typescript
// src/services/rate_limit.ts
const LIMITS: Record<string, number> = {
  free: 100,    // calls/day
  pro: -1,      // unlimited
  team: -1      // unlimited
};

export async function checkRateLimit(user_id: string): Promise<void> {
  const { data } = await supabase
    .from("user_subscriptions")
    .select("tier")
    .eq("user_id", user_id)
    .single();

  const tier = data?.tier ?? "free";
  const limit = LIMITS[tier];
  if (limit === -1) return; // unlimited

  // Check daily usage in ai_usage table (reuse existing infrastructure)
  const month = new Date().toISOString().slice(0, 7);
  const { data: usage } = await supabase
    .from("ai_usage")
    .select("draft_count")
    .eq("user_id", user_id)
    .eq("month_year", month)
    .single();

  if ((usage?.draft_count ?? 0) >= limit) {
    throw new Error(`Daily MCP call limit (${limit}) reached. Upgrade to Pro for unlimited access.`);
  }
}
```

---

## v1 Ship Checklist

- [ ] All public tools implemented and tested (no auth required)
- [ ] `npm run build` passes clean
- [ ] Resources registered: hub://programs, hub://questions/universal, hub://rankings/value
- [ ] Deploy as Supabase Edge Function (or Vercel)
- [ ] Submit to registry.modelcontextprotocol.io
- [ ] Submit to Smithery + Glama
- [ ] README with connection examples for Claude, Cursor, Windsurf

## v2 Checklist

- [ ] Authenticated tools wired (hub_get_profile_answers, hub_get_fit_score, hub_find_best_programs, hub_log_draft_run)
- [ ] Rate limiting by subscription tier
- [ ] MO§ES governance wrapper on authenticated tools
- [ ] Prompts: opportunity_scout, draft_answer, program_comparison
- [ ] Audit trail on all write operations
