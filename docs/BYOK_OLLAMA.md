# BYOK Ollama setup — local model on production

> Verified working on 2026-05-11. End-to-end: `mos2es.xyz` → Cloudflare tunnel → laptop Ollama → llama3.1:8b → draft text streamed back into the workspace UI.

This is the setup that lets your **deployed Vercel app** call **the Ollama server running on your laptop** — without exposing your home IP, paying for an OpenAI key, or maintaining a server.

---

## What's in scope

- **Provider**: Ollama running locally (your laptop)
- **Models pulled**: `llama3.1:8b` (4.7GB), `qwen2.5:3b` (1.8GB)
- **Reachable from**: both `localhost:3000` dev server AND `mos2es.xyz` production
- **Cost**: $0 — no API charges, just your laptop's CPU/GPU and electricity

---

## Architecture

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Vercel server   │      │ Cloudflare quick │      │  Your laptop     │
│  (Washington     │      │ tunnel           │      │                  │
│   D.C. region)   │      │                  │      │  ┌────────────┐  │
│                  │      │  *.trycloudflare │      │  │ ollama     │  │
│  /api/draft      │─────▶│  .com            │─────▶│  │ serve      │  │
│  route.ts        │      │                  │      │  │ :11434     │  │
│                  │      │                  │      │  └────────────┘  │
└──────────────────┘      └──────────────────┘      └──────────────────┘
       │                                                      │
       └──── HTTPS, no inbound port ◀──── outbound only ──────┘
```

The tunnel is **outbound-initiated** from your laptop. No router config, no port forwarding, no firewall holes. Cloudflare's edge proxies HTTPS requests from public clients back through the tunnel.

---

## One-time per-session setup (after every reboot)

```bash
# 1. Start Ollama with permissive CORS so the tunnel host header is accepted
pkill -f "ollama serve" 2>/dev/null
OLLAMA_HOST=0.0.0.0:11434 OLLAMA_ORIGINS="*" ollama serve > /tmp/ollama.log 2>&1 &

# 2. Start the Cloudflare quick tunnel
cloudflared tunnel --url http://localhost:11434 > /tmp/cf-tunnel.log 2>&1 &

# 3. Grab the public URL (changes every restart)
sleep 5
grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-tunnel.log | head -1
```

The tunnel URL looks like `https://titled-promotions-related-wing.trycloudflare.com`. **Changes every time** you restart cloudflared — quick tunnels are ephemeral.

> **Why `OLLAMA_ORIGINS="*"`**: Ollama by default rejects Host headers that aren't `localhost` or `127.0.0.1` as a CSRF defense. Cloudflare proxies preserve the tunnel hostname in `Host`, so without this env var you get 403s.

---

## Saving the BYOK integration

Visit **mos2es.xyz/profile/integrations** → sign in → save:

| Field | Value |
|---|---|
| Provider | `ollama` |
| API key | `ollama` (literal — Ollama ignores it but the column is NOT NULL) |
| Base URL | The current tunnel URL (e.g. `https://titled-promotions-related-wing.trycloudflare.com`) |
| Model preference | `llama3.1:8b` |
| Label | `Local Ollama (via tunnel)` |

The integration row lives in `public.user_integrations`. The `base_url` and `model_preference` fields are both honored by the draft route — see `app/app/api/draft/route.ts` ~line 360.

---

## How a draft request flows

1. User clicks **"Draft with AI"** on a workspace question (mos2es.xyz/workspace/[program_id])
2. Browser POSTs to `/api/draft` with `archived_question_id` and the program metadata
3. Server reads `user_integrations` filtered by `user_id`, sorted by `PROVIDER_PRIORITY` (anthropic → openai → ollama → google)
4. Picks the highest-priority active integration (your Ollama row)
5. Decrypts the saved API key (AES-256-GCM via `INTEGRATION_ENCRYPTION_KEY`)
6. Builds the prompt — system prompt is `KIND_COACH_PROFILE[opportunity.kind]` (accelerator coach for YC, MBA admissions for grad schools, etc.)
7. Hits `${base_url}/v1/chat/completions` with model = `model_preference` or default
8. Ollama runs `llama3.1:8b` on your laptop, streams response back through tunnel
9. Server saves the draft to `ai_draft_runs` and returns it as JSON
10. Workspace UI renders the draft in the editor

**Typical latency**: 5–15 seconds for a 100–300 word draft on llama3.1:8b. First request after Ollama starts is slower (model load).

---

## Updating the tunnel URL after a restart

When the tunnel restarts and gives you a new URL:

```bash
# Get the new URL
NEW=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-tunnel.log | head -1)
echo "New tunnel: $NEW"

# Update the integration row in Supabase
# (use the Supabase SQL editor or the MCP execute_sql tool)
```

```sql
UPDATE user_integrations
SET base_url = 'https://NEW_TUNNEL_URL.trycloudflare.com',
    updated_at = now()
WHERE provider = 'ollama';
```

Or just visit `mos2es.xyz/profile/integrations` and update the Base URL via the UI.

---

## Production smoke test

```bash
# Test the tunnel directly — what `/api/draft` does
curl --max-time 60 -X POST \
  https://YOUR-TUNNEL.trycloudflare.com/v1/chat/completions \
  -H "Authorization: Bearer ollama" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.1:8b","messages":[{"role":"user","content":"In one sentence: hello"}]}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])"
```

Expected: a short response in 5–10 seconds. If it 403s, Ollama wasn't restarted with `OLLAMA_ORIGINS="*"`. If it 502/timeout, the tunnel is down — restart cloudflared.

---

## Known limitations & follow-ups

| Issue | Workaround | Fix |
|---|---|---|
| Tunnel URL changes every restart | Update `base_url` in `user_integrations` | Use named tunnel: `cloudflared tunnel create app-hub-ollama` (requires CF account) |
| Laptop must be on + Ollama running | Realistic for personal use | For "always-on" deployment: rent a $5/mo VPS with Ollama OR switch to OpenAI/Anthropic BYOK |
| `OLLAMA_ORIGINS="*"` means anyone with the URL can call Ollama | URL is unguessable; treat semi-secret | Use `OLLAMA_ORIGINS="https://YOUR-TUNNEL.trycloudflare.com"` for tighter scoping |
| `llama3.2` was the default in code, but only 3.1:8b/qwen2.5:3b pulled locally | Set `model_preference` on the integration row | The draft route already falls back to whatever model is saved; default is only a fallback |
| First inference is ~10s slower (model load) | Hit it once to warm Ollama keeps the model in memory | n/a — Ollama unloads after ~5 min idle by default |

---

## When this stops being the right answer

This setup is great for **you developing + dogfooding**. It does NOT scale to real users because:

1. Your laptop has to be online for any user to get a draft
2. One Ollama instance can't serve concurrent users — requests queue
3. You'd be paying electricity to run inference for strangers

**When you have paying Pro users**, the right migration is:
- Either: BYOK with each user supplying their own OpenAI/Anthropic key (zero infrastructure for you)
- Or: a small GPU VPS running Ollama with a stable URL (e.g. Hetzner with an A4500, ~$70/mo)
- Or: Switch to managed inference (Together, Groq, Fireworks) — pennies per draft

For now (you + 5 power users testing), the laptop + tunnel setup is perfect.

---

## Files involved

- `app/app/api/draft/route.ts` — the route that reads `user_integrations` and calls the chosen provider
- `app/lib/byok-crypto.ts` — AES-GCM encryption for stored API keys (Ollama saves `"ollama"` as the key — it's not sensitive but goes through the same path)
- `app/app/(app)/profile/integrations/page.tsx` — the UI for saving/editing BYOK rows
- `migrations/012_launch_hardening.sql` — `user_integrations` table schema
- `migrations/015_byok_key_storage.sql` — adds `key_encrypted` column

---

## What worked first time on 2026-05-11

The full chain — `mos2es.xyz` workspace UI → POST `/api/draft` → Vercel cloud function → `https://titled-promotions-related-wing.trycloudflare.com` → my MacBook's Ollama → `llama3.1:8b` running on local CPU → response streamed back → rendered in the editor — returned a 127-word draft for the question *"Why is now the right time to build this?"* in ~7 seconds. Free, private, no API key, no rate limits.

That's the entire AI feature working on production infrastructure with $0 of cloud GPU spend.
