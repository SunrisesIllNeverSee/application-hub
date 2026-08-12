# 31 — The Pound-Out Loop

> How to grab an application, fill it from your answer bank, review, and submit — manually — over and over.
>
> Two surfaces: the **browser workspace** (visual review) and **VS Code / Cursor / Claude via MCP** (one-call intake + fill from the editor).

---

## What this loop does

1. **Intake** — paste a raw application form. The system archives the source, finds-or-creates the program, extracts every question (preserving exact wording as `asked_as`), embeds each new question in the 768d vector space, and opens a `user_applications` row.
2. **Fill** — for each question, in order:
   - **DIRECT** — you already have a `profile_answer` for this exact archived question → it's already in your workspace.
   - **BORROW** — vector-match the question's exact wording against the archive; if a near-identical question (≥ similarity threshold) has one of your answers, copy it in as a **new draft version** on this question. Never overwrites.
   - **GAP** — nothing in the bank → left empty, reported for work-through.
3. **Review** — open `/workspace/[program_id]` in the browser, edit drafts, lock the ones you trust.
4. **Submit manually** — AQUA never auto-submits. You copy the final answers into the real application form and submit yourself.

---

## Prerequisites (one-time)

### 1. Ollama + embedding model

The archive is embedded at **768 dimensions** with `nomic-embed-text`. Local Ollama is the only default embedding provider — production Vercel cannot reach localhost, so remote operation needs an OpenAI fallback configured separately.

```bash
ollama pull nomic-embed-text
ollama serve   # keep running in another terminal / as a service
```

Verify:

```bash
curl -s http://localhost:11434/api/embeddings \
  -d '{"model":"nomic-embed-text","prompt":"test"}' | jq '.embedding | length'
# → 768
```

### 2. Supabase env

`app/.env.local` (already set):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `INTEGRATION_ENCRYPTION_KEY`
- beta flags

**Never** put `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or any frontend file. Pass it inline when a script needs it.

### 3. Load your answer bank

Your real canonical/submitted answers live in `qaapplication/`. The loader is dry-run-verified against 41 files / 128 Q&A sections.

```bash
cd app
SUPABASE_SERVICE_ROLE_KEY="<paste>" npx tsx ../scripts/import-qaapplication-corpus.ts --write
```

Confidence mapping:
- canonical answers → `solid`
- submitted answers → `locked`
- drafts → `draft`

Re-run any time; it's idempotent on `(user, archived_question_id, version)`.

### 4. (Optional) AI key for extraction

Without it, intake falls back to a deterministic `Q:` / `A:` / markdown-header parser. With it, blank-form extraction is much stronger.

Set `ANTHROPIC_API_KEY` **or** `GROQ_API_KEY` in the **MCP server's** environment (not the browser app's) to enable AI extraction from `hub_intake_application`. Anthropic is tried first; Groq (Llama, OpenAI-compatible API) is the fallback. Optional: `GROQ_MODEL` to override the default `llama-3.3-70b-versatile`.

> **Embeddings** default to local Ollama (`nomic-embed-text`, 768d — matches the archive). OpenAI fallback is gated behind `ALLOW_OPENAI_EMBED_FALLBACK=1` because `text-embedding-3-small` is a different vector space; only enable it if you know you haven't seeded the archive with Ollama embeddings.

---

## Path A — Browser workspace

### Start the app

```bash
cd app
SUPABASE_SERVICE_ROLE_KEY="<paste>" npm run dev
```

The service-role key is needed server-side for the intake/fill routes (they write to `archived_questions`, `program_questions`, `user_applications`).

### Run the loop

1. Sign in at `/auth`.
2. Open `/workspace`.
3. Click **+ New application**.
4. Paste the raw application form (questions + any surrounding context).
5. Submit — the intake route archives, indexes, embeds, and opens the application.
6. The workspace shows the application with questions and any direct/borrowed fills.
7. Edit drafts inline. Lock the ones you trust.
8. Copy final answers into the real application form. Submit yourself.

### Backfill historical question embeddings

If you have archive questions that pre-date the embed-on-create change:

```bash
cd app
SUPABASE_SERVICE_ROLE_KEY="<paste>" npx tsx scripts/seed-question-embeddings.ts
```

---

## Path B — VS Code / Cursor / Claude via MCP

The MCP server exposes the same loop as three authenticated tools. Best for batch intake or when you're already in the editor.

### Build the server

```bash
cd application-hub-mcp-server
npm run check   # typecheck + build
```

Output: `dist/index.js`.

### Configure your editor

Add to your editor's MCP config (Claude Code, Cursor, Windsurf all support stdio MCP):

```json
{
  "mcpServers": {
    "application-hub": {
      "command": "node",
      "args": ["/Users/dericmchenry/Developer/built/application-hub/application-hub-mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "<your project URL>",
        "SUPABASE_SERVICE_ROLE_KEY": "<service-role key>",
        "SUPABASE_ANON_KEY": "<anon key>",
        "OLLAMA_URL": "http://localhost:11434",
        "OLLAMA_EMBED_MODEL": "nomic-embed-text",
        "GROQ_API_KEY": "<optional, for AI extraction>",
        "ANTHROPIC_API_KEY": "<optional, for AI extraction (tried first)>"
      }
    }
  }
}
```

**Security**: the service-role key lives in the editor's MCP config, not in the repo, not in `app/.env.local`, not in client code. The MCP server uses it for public-read queries (programs, questions archive) and for the intake writes that need to bypass RLS on shared archive tables. All user-scoped writes go through `userClient(token)` with RLS.

### Authenticate

Every pound-out tool takes a `user_token` — your Supabase JWT. Get it from the browser app's auth session (the `/api/auth/token` route, or the ExtensionTokenCard). The token scopes all reads/writes to your user via RLS.

### The three tools

#### `hub_intake_application`

One call. Archives the source, finds-or-creates the program, extracts questions (AI if `ANTHROPIC_API_KEY` is set, otherwise deterministic parser), embeds new questions, opens the application.

Inputs: `user_token`, `program_name`, `program_url?`, `application_text`, `source_kind` (accelerator | job | school | grant | vc | other).

Returns: `application_id`, `program_id`, question counts, extraction mode, failures, and the next-step pointer (`hub_fill_application`).

#### `hub_fill_application`

Fills the application from your bank. Direct hits first, then vector-borrowed drafts for near-identical questions, then gaps reported.

Inputs: `user_token`, `application_id`, `borrow_threshold?` (default 0.8), `dry_run?`.

Returns: coverage %, direct count, borrowed list (with source question + similarity), gaps, workspace URL.

Borrowed answers are written as **`draft` confidence, new version** — never overwriting existing answers, never auto-promoted to `solid` or `locked`.

#### `hub_search_answer_bank`

Search your own answer bank by natural-language query. Vector search first (Ollama → `match_archived_questions` RPC joined to your `profile_answers`); falls back to full-text search on question text when embeddings are unavailable.

Inputs: `user_token`, `query`, `limit?` (default 8), `threshold?` (default 0.6).

Returns: hits with question text, theme, your latest answer, version, confidence, similarity, match mode. Never returns another user's answers.

### Example session (in Claude Code / Cursor)

```
> Use the application-hub MCP server. My token is <paste>.

> hub_intake_application
  program_name: "Hannah Grey Capital"
  program_url: "https://hannahgrey.com/apply"
  application_text: <paste the form>
  source_kind: "accelerator"

→ application_id: <uuid>, 12 questions indexed, 4 new to archive

> hub_fill_application
  application_id: <uuid>
  borrow_threshold: 0.8

→ 67% coverage — 5 direct, 3 borrowed, 4 gaps

> hub_search_answer_bank
  query: "tell us about a time you failed"

→ 2 hits, both solid, 0.91 and 0.84 similarity

> Open /workspace/<program_id> in the browser to review and edit.
```

---

## Safety rules (non-negotiable)

1. **No auto-submit.** AQUA prepares and reviews. You submit.
2. **No service-role key in client code or `app/.env.local`.** Pass inline for scripts; put in editor MCP env for the server.
3. **Borrowed answers are always `draft`.** They never auto-promote to `solid` or `locked`. Promotion is a manual review action.
4. **Borrow never overwrites.** A new version is inserted; the old one is preserved.
5. **User review is required.** The fill is a head start, not a finished application.
6. **Vector similarity is matching evidence, not identity.** A 0.85 match means "probably the same question asked differently," not "definitely the same."
7. **Local Ollama vs production:** local = full embedding + borrow. Production (Vercel) = needs OpenAI fallback configured, otherwise borrow is skipped and only direct hits work.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `embedding unavailable` in fill/search | Ollama not running | `ollama serve` |
| `no extractable questions` in intake | No AI key + text not in Q:/A: or markdown format | Add `ANTHROPIC_API_KEY` to MCP env, or format text as `## Question` sections |
| `Application not found` in fill | Wrong `application_id` or not yours | Re-run intake, check the returned `application_id` |
| Borrow threshold too loose / tight | Default 0.8 is conservative | Lower to 0.7 for more borrows (more false positives), raise to 0.9 for fewer |
| Direct hits missing | Answer bank not loaded | Run the corpus loader (see Prerequisites §3) |
| `match_archived_questions` RPC error | Schema drift or RPC not deployed | Check `STATUS.md` migration chain; the RPC ships with the embedding migration |

---

## Related

- `app/lib/embed.ts` — shared embedding helper (browser side)
- `app/lib/intake-extract.ts` — shared extraction helpers (browser side)
- `app/app/api/applications/intake/route.ts` — browser intake endpoint
- `app/app/api/applications/[id]/fill/route.ts` — browser fill endpoint
- `application-hub-mcp-server/src/services/embed.ts` — MCP-side embedding helper
- `application-hub-mcp-server/src/tools/user/hub_intake_application.ts`
- `application-hub-mcp-server/src/tools/user/hub_fill_application.ts`
- `application-hub-mcp-server/src/tools/user/hub_search_answer_bank.ts`
- `scripts/import-qaapplication-corpus.ts` — answer bank loader
- `docs/BYOK_OLLAMA.md` — Ollama setup details
- `docs/BROWSER_EXTENSION.md` — browser extension spec
