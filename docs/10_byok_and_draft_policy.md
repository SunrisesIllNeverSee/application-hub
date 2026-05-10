# BYOK and Draft Policy

Application Hub should not subsidize unbounded AI drafts. The launch-safe model is:

1. Users bring their own provider key whenever possible.
2. Hosted/platform drafting is explicitly enabled, metered, and gated.
3. Review, stress testing, and RNS judgment can run through MCP/RNS paths separately from first-pass drafting.

## Current State

- `POST /api/draft` can generate hosted Anthropic drafts.
- Successful hosted drafts insert into `ai_draft_runs`.
- The database trigger increments `ai_usage`.
- The route now fails closed unless `PLATFORM_AI_DRAFTS_ENABLED=true`.
- If enabled, the route requires `ANTHROPIC_API_KEY`.

## Environment Flags

| Variable | Meaning |
|---|---|
| `PLATFORM_AI_DRAFTS_ENABLED=true` | Allows platform-paid hosted Anthropic drafting. Omit or set false to disable. |
| `ANTHROPIC_API_KEY` | Platform Anthropic key used only when hosted drafting is enabled. |

Launch recommendation:

- Soft launch: leave hosted drafts disabled unless testing with trusted users.
- MVP: enable BYOK first, then decide whether Pro gets platform fallback.
- Public launch: show provider status and remaining draft count in the UI.

## Migration 010 Contract

`migrations/012_launch_hardening.sql` adds:

- `user_integrations`: provider metadata for BYOK.
- `answer_stress_tests`: persisted stress-test/review outputs.
- `ai_provider_type`, `integration_status`, and `answer_stress_depth` enums.

Important: `user_integrations` does **not** store raw API keys. `key_storage_ref` points to a server-side secret store. The raw key must never be readable from client-side Supabase queries.

## BYOK Storage Flow

Target flow:

1. User opens `/profile/integrations`.
2. User enters provider key.
3. Server route receives the key over HTTPS.
4. Server verifies the key with the provider.
5. Server stores the key in Supabase Vault/KMS or equivalent.
6. Server writes metadata to `user_integrations`:
   - provider
   - status
   - model preference
   - key fingerprint
   - secret reference
7. Client sees only metadata/status, never the key.

## Draft Routing Order

Target `/api/draft` routing:

1. If user has an active default BYOK integration, use that provider.
2. Else if platform drafting is enabled and user is allowed by policy, use the platform key.
3. Else return a provider-required error and tell the UI to send user to `/profile/integrations`.

## Product Policy To Decide

Open launch decisions:

- Free users: BYOK only, or tiny hosted trial?
- Pro users: BYOK preferred, platform fallback allowed?
- Team users: shared provider key or per-seat keys?
- Local providers: allow Ollama/custom base URLs in hosted deployment, or local-only?

Recommended Milestone 3 posture:

- Free: BYOK only.
- Pro: BYOK preferred; platform fallback later after billing is live.
- Admin/trusted testing: hosted drafts enabled manually.

## UI Requirements

Draft UI should display:

- Provider source: user key vs. platform key.
- Drafts remaining when platform key is used.
- Clear CTA to connect provider when no provider is available.
- Safe failure message for disabled hosted drafting.

Relevant route errors:

- `hosted_ai_disabled`
- `hosted_ai_unconfigured`
- `draft_limit_reached`
