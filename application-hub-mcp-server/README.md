# aqua-mcp-server 2.0

The AQUA MCP server. It gives an AI agent (Claude Code, Claude Desktop, Cursor and others) two things:

- **Your local AQUA workspace**, with tiered tools: read, stage drafts, prepare an export. Nothing is ever approved or submitted for you.
- **The public AQUA catalog**: approved programs with their exact application questions, limits, cycles and deadlines.

It holds no account token and no privileged database key. Its only credential is the public publishable key that the AQUA website ships to every browser, and it refuses to start with any other key.

Tool counts below come from [`TOOLS.json`](TOOLS.json), which is generated from the code (`npm run manifest`) and checked in CI.

## Three modes

| Mode | How | Tools | What it can do |
|---|---|---|---|
| **stdio, with a workspace** | `npx -y aqua-mcp-server --workspace <dir>` | 37 (23 read, 8 private_write, 1 human_consent, 5 human_only) | The full product: the [aqua-companion](../aqua-companion) tool set on one local encrypted workspace, plus the public catalog tools |
| **stdio, no workspace yet** | `npx -y aqua-mcp-server` | 14 (13 read, 1 human_consent) | Public catalog tools and resources, plus the companion's setup tools: `locate_workspace`, `init_workspace`, `doctor` |
| **hosted, read-only** | `https://aquaidp.xyz/mcp` | 11 (read) | Public catalog tools, resources and prompts only. No auth, rate-limited, nothing private |

All three modes serve resources and prompts. Only workspace mode has `aqua://workspace/status`.

The local modes run on the companion's own tool registry (`createAquaToolRegistry`). The companion owns the tool set, the workspace session and tier enforcement, and this server adds the public catalog tools, resources and prompts. When `init_workspace` opens a workspace mid-session, the server switches to workspace mode and sends `notifications/tools/list_changed`.

### Tiers

Every tool declares its tier in code, and the server enforces it rather than relying on the tool description.

- **read** tools only read.
- **private_write** tools stage records in your local workspace: drafts, imported applications, history, evidence, observations. They are refused under `--read-only`, and nothing they write counts as approved.
- **human_consent** tools (`init_workspace`) act only after you confirm in your MCP client, through MCP elicitation. Without client support they return the command for you to run. They are refused under `--read-only`.
- **human_only** tools never act. They return the steps you take in the AQUA browser app: `approve_answer`, `sign_packet`, `export_packet`, `attest_submission`, `submit_catalog_candidate`.
- **privileged** operations don't exist here at all: catalog publication, migrations, administration, security configuration, reading hosted answers.

Approvals, signatures, packet freeze and export, and submission happen in the AQUA browser app, by you.

### Untrusted content

Results put server structure first: ids, slugs, enums, numbers, dates, counts. Any text that came from your files, the workspace or the catalog (names, descriptions, question wording) appears only under `untrusted_content`, with a fixed notice. Agents treat it as data, never as instructions.

## Install

Node.js 22 or newer.

```bash
npx -y aqua-mcp-server --help
```

> Until 2.0.0 is published to npm, use the tarball from the AQUA team: `npx -y ./aqua-mcp-server-2.0.0.tgz`. Or run it from a checkout: `node application-hub-mcp-server/bin/aqua-mcp-server.mjs` after `npm install` in that folder.

### Claude Code

```bash
# catalog only
claude mcp add aqua -- npx -y aqua-mcp-server
# with your workspace (the passphrase comes from the environment or the macOS Keychain, never from chat)
claude mcp add aqua --env AQUA_PASSPHRASE=… -- npx -y aqua-mcp-server --workspace ~/AQUA
claude mcp add aqua -- npx -y aqua-mcp-server --workspace ~/AQUA --keychain
# hosted, read-only
claude mcp add --transport http aqua-public https://aquaidp.xyz/mcp
```

### Claude Desktop / `.mcp.json`

```json
{
  "mcpServers": {
    "aqua": {
      "command": "npx",
      "args": ["-y", "aqua-mcp-server", "--workspace", "/Users/you/AQUA", "--keychain"]
    },
    "aqua-public": {
      "type": "http",
      "url": "https://aquaidp.xyz/mcp"
    }
  }
}
```

Add `--read-only` to allow reading only.

### Setting up a workspace

The bin bundles the companion CLI (`aqua-mcp-server companion <command>`).

1. Either let the agent call `init_workspace` (you confirm the folder in your MCP client; the passphrase comes from the server environment, never the chat), or run `npx -y aqua-mcp-server companion init --path ~/`, which creates `~/AQUA`. It asks for a passphrase and shows a plan first.
2. In the AQUA browser app, open AQUA Local and export an encrypted backup. Then run `npx -y aqua-mcp-server companion import-backup <file> --workspace ~/AQUA`. Nothing is uploaded.
3. Start the server with `--workspace ~/AQUA`.

Files you want the agent to read go in the workspace `inbox/` folder. The server reads nothing else from disk.

## Options and environment

```
--workspace DIR          workspace folder (or AQUA_WORKSPACE)
--read-only              refuse every private write
--keychain               workspace passphrase from the macOS Keychain
--catalog-config F|URL   public catalog config (file or https URL)
--offline                don't fetch the catalog config

AQUA_PASSPHRASE          workspace passphrase (or --keychain)
AQUA_CATALOG_CONFIG_URL  catalog config URL (default https://aquaidp.xyz/.well-known/aqua-catalog.json)
AQUA_CATALOG_CONFIG      catalog config file (same format as aqua-companion/config/public-catalog.json)
AQUA_SUPABASE_URL + AQUA_PUBLISHABLE_KEY   the catalog endpoint directly
```

The catalog config is `{ "supabase_url": "https://<ref>.supabase.co", "publishable_key": "<public key>", "tables": { … } }`.

The key is decoded at startup:

- `sb_publishable_…` and JWTs with role `anon` are accepted.
- `sb_secret_…` keys, `service_role` keys, any other role, and unrecognized formats stop the server before it sends a single request.

If no config can be loaded, the server still starts, and catalog tools answer `catalog_not_configured` with the fix.

## Public catalog tools

All are tier read, available in all three modes, and reached by read-only PostgREST GETs with the public key. They read **approved programs only**, by the same rule as the website: registry slug, or `source = canonical`. Every dependent read (cycles, questions, DNA, stats, reports) is scoped to those programs, even where the database would allow more.

| Tool | Returns |
|---|---|
| `hub_search_programs` | approved programs by words, type, status, equity, cash, rolling, deadline window; sorting and paging |
| `hub_get_program_detail` | one program: deadlines, cycles, value and acceptance figures where public |
| `hub_get_program_by_slug` | one program with stats and theme weights |
| `hub_get_program_questions` | exact question wording, limits, required flags, theme, reuse counts |
| `hub_find_similar_questions` | canonical questions matching a text (lexical; no embeddings) |
| `hub_get_universal_questions` | canonical questions most approved programs ask |
| `hub_get_program_dna` | a program's theme weights |
| `hub_get_question_significance` | how much one canonical question matters across approved programs |
| `hub_get_program_rankings` | ranked by program value score |
| `hub_get_heat_scores` | ranked by heat score |
| `hub_get_acceptance_stats` | acceptance figures and verified outcome counts per cohort (counts only) |

When the public key can't read a table, the tool answers `status: "not_public"` with the HTTP status and PostgREST code. Nothing is escalated. Optional sections degrade on their own (`sections.stats.status = "not_public"`).

## Resources and prompts

- `aqua://programs`: approved programs.
- `aqua://programs/{slug}`: a program template with exact wording, limits, required flags, cycles and deadline.
- `aqua://questions/{id}`: one canonical question.
- `aqua://workspace/status` (workspace mode only): review status of every application.

Prompts:

- `start-application` takes a slug or URL.
- `reuse-my-answers` and `get-ready-to-export` each take an optional `application_id`.

Each one walks the agent through the tiers and states that approvals happen in the browser.

## Privacy model

- **Workspace mode:** the workspace is encrypted at rest and decrypted in memory only. The passphrase comes from your environment or the macOS Keychain. Every tool call is recorded in the workspace's own audit log (`audit/agent.jsonl`, with an argument MAC rather than the arguments).
- **Catalog requests:** they carry only table names, column lists and public catalog ids. Nothing from your workspace is ever sent.
- **Hosted endpoint:**
  - It has no auth, sessions or cookies.
  - It uses a server-side client holding the public key only.
  - It is rate-limited per client IP: 60 requests a minute, using a hashed key.
  - It validates `Origin` and logs nothing that came from a request.

## Intentionally absent

These are not available in any mode:

- catalog publication;
- migrations;
- platform administration;
- security configuration;
- reading hosted answers.

There is also no self-hosted HTTP transport. `TRANSPORT=http` is refused; use stdio locally or the hosted read-only endpoint.

## Migrating from 1.x

2.0 is a breaking release. 1.x needed a privileged database key, took per-tool `user_token` arguments, had an operator bypass, served unauthenticated write-capable HTTP, and wrote private answers to the hosted store, which local-first deployments refuse. All of that is gone:

| 1.x | 2.0 |
|---|---|
| privileged Supabase client | the public publishable key only; any other key is refused |
| `user_token` arguments, operator bypass | none: private data lives in your local workspace |
| `TRANSPORT=http` (Express, unauthenticated) | stdio, or the read-only `https://aquaidp.xyz/mcp` |
| 11 public `hub_*` tools | the same 11 names, approved programs only; JSON results instead of `response_format: markdown` |
| `hub_find_similar_questions` via the pgvector RPC | lexical similarity over approved canonical questions (`method: "lexical"`) |
| `hub_get_program_rankings` via the RPC | plain reads, ranked in the server |
| `hub_save_answer` | `create_draft_version` (staged; you approve in the browser) |
| `hub_get_profile_answers`, `hub_search_answer_bank` | `search_answer_bank` |
| `hub_intake_application` | `import_local_application` (files from `inbox/`) |
| `hub_fill_application` | `match_canonical_questions` + `search_answer_bank` + `create_draft_version` |
| `hub_get_answer_review_context`, `hub_rank_my_answers` | `read_review_status` (per-question Direct / Adapt / Gap) |
| `hub_save_answer_review` | `present_review_decisions`; approval is `approve_answer` (human_only) |
| `hub_set_borrow_threshold` | none: reuse is a per-question recommendation |
| `hub_get_application_readiness` | `prepare_packet` |
| `hub_stress_test_answer`, `hub_get_fit_score`, `hub_log_draft_run` | none in 2.0. Every call is audited by the companion |
| `hub_find_best_programs` | `hub_search_programs` + `hub_get_program_rankings` |
| `aqua.*` canonical hub tools | none for agents: `prepare_catalog_candidate` + `submit_catalog_candidate` (human_only); `prepare_packet` / `export_packet` |
| prompts `opportunity_scout`, `draft_answer`, `program_comparison` | `start-application`, `reuse-my-answers`, `get-ready-to-export` |
| the old answer-matcher copy | the companion's tiered matcher (`match_canonical_questions`) |

The full list, with reasons, is under `removed_in_2` and `intentionally_absent` in `TOOLS.json`.

## Development

```bash
npm install                 # links ../aqua-companion
npm test                    # node:test suite (fake PostgREST, synthetic workspaces)
npm run manifest            # regenerate TOOLS.json (CI: manifest:check)
npm run vendor:hosted       # copy src/catalog into app/app/api/mcp/_vendor (CI: vendor:hosted:check)
npm run live-check          # read-only counts from the configured catalog (public key only; no row content)
```

- `src/catalog/` is web-API-only ESM, shared verbatim with the hosted route.
- `src/node/` is the stdio server, the workspace bridge to the companion, and the registry.
- The hosted route is `app/app/api/mcp/route.ts`. The middleware rewrites MCP transport requests on `/mcp` to it; browser GETs of `/mcp` get the docs page.
