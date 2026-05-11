# Session state — 2026-05-11 evening

> Snapshot of what's running, where it's pointing, and what's coordinated across the parallel sessions.
> Companion to `~/Desktop/MULTI_CLAUDE.md` (cross-workspace) and `SCRATCH.md` (active claims).

---

## Long-running processes on Deric's laptop

| Process | PID | Purpose | Cleanup on reboot |
|---|---|---|---|
| `ollama serve` | 71468 | Local LLM endpoint, started with `OLLAMA_HOST=0.0.0.0:11434 OLLAMA_ORIGINS="*"` so Cloudflare tunnel host headers are accepted | Restart with: `OLLAMA_HOST=0.0.0.0:11434 OLLAMA_ORIGINS="*" ollama serve &` |
| `cloudflared tunnel` | 66124 | Public tunnel → `titled-promotions-related-wing.trycloudflare.com` → Ollama | Restart with: `cloudflared tunnel --url http://localhost:11434 &`. Quick tunnels give a NEW URL every restart — update `user_integrations.base_url` accordingly. |
| `next dev` | 24268 | localhost:3000 dev server | `cd app && nohup npm run dev > /tmp/next-dev.log 2>&1 < /dev/null & disown` |

**Models pulled locally:** `llama3.1:8b` (4.7GB), `qwen2.5:3b` (1.8GB). `llama3.2` not pulled — see `model_preference` notes.

---

## Active sessions (per `~/Desktop/MULTI_CLAUDE.md`)

| Session | Focus | Status this evening |
|---|---|---|
| Cowork (Claude Code Desktop) | Funders index, Today dashboard, DNA radar | Active |
| **VS Code Claude (this session)** | Stripe + Llama e2e verification + repo cleanup review | ✅ **Wrapped Llama + Stripe**, posted review on issue #1 |
| Codex (Desktop) | MCP server hardening, stress-test persistence | Idle/wrapping — has uncommitted MCP server files in flight |
| mcp_eval (Claude VS Code in `~/Desktop/mcp_eval/`) | Plugin eval of the MCP server | Complete — 68/100 D grade, findings in `plugin-eval-findings.md` |

**Don't touch (active in another session):**
- `application-hub-mcp-server/` — Codex iterating
- `app/app/api/stripe/` — was my lane, now wrapped (safe to touch)
- `app/app/api/draft/route.ts` — was my lane, now wrapped (safe to touch)

---

## Today's verified-working surfaces

| Surface | URL | Status |
|---|---|---|
| Marketing landing | https://mos2es.xyz | ✅ 100/100 Lighthouse |
| Dev server | http://localhost:3000 | ✅ Tailwind serves cleanly after `.next/` clean |
| Hub directory | /hub | ✅ 842 programs |
| Workspace | /workspace/[program_id] | ✅ Draft with AI generates real output |
| Integrations | /profile/integrations | ✅ Base URL + Model fields now present (commit be71026) |
| Paste import | /profile/import | ✅ Route + UI shipped |
| URL submit | /hub/submit | ✅ Route + UI shipped |
| Stripe Checkout | /api/stripe/checkout | ✅ Code ready, ⏳ env keys pending |

---

## Repo cleanup review gate (issue #1)

**Spec:** `docs/17_repo_cleanup_review_gate.md`

**Comments so far:**
1. Cowork (16:38 UTC) — confirmed canonical files, stale references, README framing, recommended waiting for VS Code Claude to wrap Stripe + Llama
2. **VS Code Claude (this session, evening)** — confirmed Llama + Stripe wrapped, flagged 4 additional cleanup items (cross-theme positioning, 3 new operational docs to add to canonical list, `30 programs` → `842 programs` staleness, README architecture diagram scope)

**Still waiting on:** Devin to weigh in before implementation begins.

**Implementation sequence (Cowork's proposal, agreed):**
1. `coordination-sync` — memory docs + counts + source-of-truth alignment
2. `docs-structure` — archive README + doc renames/consolidation
3. `readme-redesign` — badges + new product-forward structure
4. `final-memory-pass` — CLAUDE.md, AGENTS.md, SCRATCH.md, MULTI_CLAUDE.md

---

## Things Deric needs to do (not auto)

| Task | Where | Why blocked |
|---|---|---|
| Add Stripe price IDs + secret/publishable/webhook keys to Vercel | `vercel env add ...` (see `docs/STRIPE_SETUP.md` Part 3) | Account-level keys, can't be auto-generated |
| Comment from Devin on issue #1 | GitHub | Required for cleanup gate to release |
| Decide whether to pull `llama3.2` (optional) | `ollama pull llama3.2` | Current setup uses `llama3.1:8b` — bigger / more capable anyway |
| Restart `ollama` + `cloudflared` after reboot | Terminal | Both processes don't persist across reboots; quick tunnels give a new URL |

---

## Key commits today (latest first)

```
a2c15d6  docs: milestone 2026-05-11 — end-to-end AI drafting verified live
eaf439f  feat: expand reviewer family and polish landing page    (Cowork)
be71026  fix(byok): expose Base URL + Model fields for Ollama in form
34d088b  feat: /about/scoring page + inline score tooltips        (Cowork)
f007c27  docs: BYOK Ollama setup
e058207  fix(draft): respect user's model_preference
d649251  fix(stripe): event dedup + dunning handlers + setup guide
a111dc9  feat: cross-theme expansion + community flywheel + Fundingcake archive
05b93f9  feat: cross-theme expansion — opportunity taxonomy
```

---

## Tomorrow morning's first 5 steps

1. Open terminal: `OLLAMA_HOST=0.0.0.0:11434 OLLAMA_ORIGINS="*" ollama serve &`
2. Same terminal: `cloudflared tunnel --url http://localhost:11434 &`
3. Grab the new tunnel URL: `grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-tunnel.log | head -1`
4. Update `user_integrations.base_url` to the new tunnel URL (via UI at `/profile/integrations` or SQL)
5. Test "Draft with AI" on `mos2es.xyz` — confirm 200 response

If you only test locally, you can skip steps 2–4 and use `base_url = http://localhost:11434` directly.
