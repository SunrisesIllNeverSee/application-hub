# Application Hub MCP Server

MCP server for the Application Hub — a platform that helps founders track, compare, and apply to accelerators, grants, and fellowships.

Exposes 21 tools, 7 resources, and 3 prompts over stdio (local) or HTTP (remote).

---

## Requirements

- Node.js >= 18
- A Supabase project with the Application Hub v3 schema applied
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (required)
- `SUPABASE_ANON_KEY` (required for authenticated user tools)

```bash
cp .env.example .env
# fill in your values
```

---

## Running Locally

```bash
npm install
npm run dev        # tsx watch — auto-reloads on save
# or
npm run build && npm start
```

### Local Codex / Cowork path

For this machine, Codex/Cowork can connect to the compiled MCP server at:

```text
/Users/dericmchenry/Desktop/application-hub/application-hub-mcp-server/dist/index.js
```

`dist/` is local build output and is intentionally ignored by git. The public GitHub repo will not include it. If a local client cannot connect because `dist/index.js` is missing, rebuild it:

```bash
cd /Users/dericmchenry/Desktop/application-hub/application-hub-mcp-server
npm install
npm run build
```

---

## Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "application-hub": {
      "command": "node",
      "args": ["/absolute/path/to/application-hub-mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
        "SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

Restart Claude Desktop. The server runs in stdio mode by default.

---

## Connect to Cursor

In `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "application-hub": {
      "command": "node",
      "args": ["/absolute/path/to/application-hub-mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
        "SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

---

## Connect to Windsurf

In `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "application-hub": {
      "command": "node",
      "args": ["/absolute/path/to/application-hub-mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
        "SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

---

## HTTP Mode (Remote / Cloudflare / Railway)

```bash
TRANSPORT=http PORT=3000 node dist/index.js
```

POST to `/mcp` with MCP JSON-RPC payloads. GET `/health` returns server status.

For remote Claude connections, point the MCP config at your deployed URL:

```json
{
  "mcpServers": {
    "application-hub": {
      "url": "https://your-server.example.com/mcp"
    }
  }
}
```

---

## Tools

### Public (no auth required)

| Tool | Description |
|---|---|
| `hub_search_programs` | Search/filter programs by type, equity cap, deadline, cash, etc. |
| `hub_get_program_detail` | Full detail for one program (by UUID or slug) |
| `hub_get_program_by_slug` | Server-friendly program detail lookup by slug, including stats and DNA rows |
| `hub_get_program_rankings` | Programs ranked by value score (ROI) |
| `hub_get_heat_scores` | Trending programs by applicant interest |
| `hub_get_program_questions` | All questions for a specific program with significance scores |
| `hub_find_similar_questions` | Find archive questions similar to a given text (pgvector + fallback) |
| `hub_get_universal_questions` | Questions asked by 80%+ of programs — answer these first |
| `hub_get_program_dna` | What a program actually cares about (traction vs team vs mission %) |
| `hub_get_question_significance` | How much a question matters across the platform |
| `hub_get_acceptance_stats` | Acceptance rate data by cohort label |

### Authenticated (requires `user_token`)

| Tool | Description |
|---|---|
| `hub_get_profile_answers` | User's answer library, ranked by coverage |
| `hub_get_application_readiness` | % complete for a specific program + missing questions |
| `hub_get_fit_score` | Pre-computed fit score vs a program (4-component breakdown) |
| `hub_find_best_programs` | Top programs ranked by composite score for this user |
| `hub_rank_my_answers` | Which answers unlock the most programs |
| `hub_log_draft_run` | Track AI draft usage (rate-limited by tier) |
| `hub_save_answer` | Validate and upsert one reusable profile answer |
| `hub_get_answer_review_context` | Gather saved-answer context for agent-side RNS/CIVITAE/MO§ES review |
| `hub_save_answer_review` | Persist structured agent-side review output for one saved answer |
| `hub_stress_test_answer` | Return deterministic follow-up prompts/checklist and optionally persist the run |

---

## Resources

| URI | Description |
|---|---|
| `hub://programs` | All open programs, sorted by heat score (cached 60s) |
| `hub://programs/{slug}` | Single program detail by slug (cached 5min) |
| `hub://questions/universal` | Universal questions, sorted by significance (cached 1hr) |
| `hub://questions/themes` | Question counts by theme |
| `hub://rankings/value` | Top 25 open programs by value score (cached 1hr) |
| `hub://rankings/heat` | Top 25 trending programs (cached 1hr) |
| `hub://stats/platform` | Live counts: total programs, questions |

---

## Prompts

| Prompt | Description |
|---|---|
| `opportunity_scout` | Multi-step: find best programs → show readiness gaps for each |
| `draft_answer` | Multi-step: get question significance → DNA → profile → draft answer |
| `program_comparison` | Side-by-side table comparison of two programs with DNA + verdict |

---

## Development

```bash
npm run dev          # tsx watch mode
npm run build        # compile to dist/
npm run inspector    # launch MCP Inspector UI for interactive testing
npm run clean        # remove dist/
```

Test individual tools with the MCP Inspector:

```bash
npm run inspector
# Opens at http://localhost:5173
# Select "stdio" transport, point at dist/index.js
```
