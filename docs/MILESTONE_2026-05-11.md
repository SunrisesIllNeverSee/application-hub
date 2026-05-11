# Milestone: 2026-05-11 — End-to-end BYOK + AI drafting live

> The day Application Hub became a real AI-native SaaS that anyone can sign up to and use.

## What shipped

| Layer | State | Verified |
|---|---|---|
| Marketing landing (`mos2es.xyz`) | ✅ 100/100 Lighthouse | screenshots in `.claude/` |
| Auth (magic link + password) | ✅ both flows work | tested 2026-05-11 |
| Cross-theme schema (jobs / school / grants) | ✅ migration 018 applied | enum `opportunity_kind` populated |
| Programs archive | ✅ **30 → 842** | migrations 019 applied, 812 Fundingcake imports |
| Question archive | ✅ 225 questions seeded | significance-scored |
| Answer Bank + Drip mechanic | ✅ table + RPCs | migration 014 applied |
| Workspace + Profile + Hub UIs | ✅ all routes render | tested on localhost + mos2es.xyz |
| **BYOK Ollama** (local + tunnel) | ✅ **just shipped** | drafted 93 words via `llama3.1:8b` |
| AI Draft (kind-aware coach) | ✅ working | 11 coach personas wired |
| Paste import (`/profile/import`) | ✅ route + UI | migration 020 applied |
| URL submit (`/hub/submit`) | ✅ route + UI | migration 021 applied |
| Stripe Checkout / Portal / Webhook | ✅ code | ⏳ env keys still TODO |
| Stripe event dedup | ✅ migration 022 applied | best-practices skill audited |
| Integration form (Base URL + Model fields) | ✅ **just shipped** | bug from earlier today fixed |

## Today's bug count and resolution

1. **`.next/` duplicate folders** (`chunks 2/`, `css 2/`, etc) — Tailwind not loading on dev. Cure: `rm -rf .next node_modules/.cache` before restart.
2. **`INTEGRATION_ENCRYPTION_KEY` was empty string** on both surfaces — caused 503 "Key storage not configured". Generated proper 32-byte hex, wired into `.env.local` + Vercel prod + preview.
3. **Integration form didn't expose `base_url` / `model_preference`** for Ollama — saves landed with NULL fields, draft route fell back to hardcoded `llama3.2` (which most users don't have pulled). Fix: branched the form on `provider === 'ollama'` to show Base URL + Model inputs with sensible defaults.
4. **Login buttons looked disabled** — they're correctly disabled until you type. Not a bug, but added to the followup polish list (subtle visual cue when form becomes submittable).

## The verified-working draft path

```
User clicks "Draft with AI" on /workspace/[program_id]
  ↓
POST /api/draft (server-side route on Vercel or localhost:3000)
  ↓
Read user_integrations row for current user, sorted by PROVIDER_PRIORITY
  ↓
Decrypt key_encrypted via INTEGRATION_ENCRYPTION_KEY (AES-256-GCM)
  ↓
Build prompt with kind-aware coach profile (KIND_COACH_PROFILE)
  ↓
fetch(base_url + '/v1/chat/completions', { model: model_preference })
  ↓
Tunnel: titled-promotions-related-wing.trycloudflare.com → laptop Ollama
  OR direct: localhost:11434 → laptop Ollama (when on dev server)
  ↓
llama3.1:8b runs on local CPU — 5-15s for a 100-300 word draft
  ↓
ai_draft_runs row inserted, response returned to UI, editor renders
```

## What's NOT done (next session's punch list)

| Item | Why it matters |
|---|---|
| **Stripe env keys** in Vercel | Until set, upgrade buttons fail. Walkthrough in `docs/STRIPE_SETUP.md`. |
| `database.types.ts` regenerate | Some new tables (`stripe_events`, `app_import_sessions`, migration 018 columns) currently typed as `unknown` casts in new routes |
| **Persistent tunnel** | Quick tunnels die on reboot — URL changes, integration row needs re-pointing. Named tunnel via Cloudflare account would fix |
| Public Ollama VPS (when real users arrive) | Laptop tunnels don't scale past 1-2 concurrent users |
| Pull `llama3.2` if you actually want it | Currently using llama3.1:8b which is bigger / more capable anyway |

## Key files touched in this session

- `migrations/018_opportunity_taxonomy.sql` — cross-theme schema
- `migrations/019_fundingcake_seed.sql` — 821 programs imported
- `migrations/020_app_import_sessions.sql` — paste import tracking
- `migrations/021_import_queue_extensions.sql` — URL submit
- `migrations/022_stripe_events.sql` — webhook dedup
- `app/app/api/draft/route.ts` — kind-aware coaching + model_preference fix
- `app/app/api/stripe/{checkout,portal,webhook}/route.ts` — Stripe routes + best-practice hardening
- `app/app/(app)/profile/import/page.tsx` — paste import UI
- `app/app/(app)/hub/submit/page.tsx` — URL submit UI
- `app/components/IntegrationsForm.tsx` — Base URL + Model fields for Ollama
- `app/lib/{stripe,subscription,encryption}.ts` — Stripe + BYOK plumbing
- `docs/STRIPE_SETUP.md` — 5-part setup walkthrough
- `docs/BYOK_OLLAMA.md` — verified-working setup with architecture diagram
- `scripts/{parse_fundingcake.py,build_active_applications.py,json_to_csv.py}` — Fundingcake harvest

## Commits today (latest first)

```
be71026 fix(byok): expose Base URL + Model fields for Ollama in integrations form
34d088b feat: /about/scoring page + inline score tooltips
f007c27 docs: BYOK Ollama setup — local laptop model serving production
e0d5c70 update
6edcc6e chore(stripe): archive webhook diagnostic and remove debug log
c3e8b60 update
e058207 fix(draft): respect user's model_preference instead of hardcoding llama3.2
d649251 fix(stripe): event dedup + dunning handlers + setup guide
a111dc9 feat: cross-theme expansion + community flywheel + Fundingcake archive
05b93f9 feat: cross-theme expansion — opportunity taxonomy (jobs/school/grants)
```

## The "WORKING" screenshot — verified state

User question on workspace: *"What are you building? Describe your product or service in plain language."*
Draft generated: **93 words** of real model output, in ~6-7 seconds, via local Ollama llama3.1:8b through Cloudflare tunnel.

That's the entire SaaS loop closed.
