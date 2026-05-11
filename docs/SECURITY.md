# Application Hub — Security Policy

_Last updated: 2026-05-11_

## Scope

This repository contains:
- Supabase migrations
- MCP server runtime code
- Next.js app code
- billing and integration routes
- operational documentation for BYOK, SMTP, and Stripe

## Sensitive systems

Treat these as sensitive at all times:
- `SUPABASE_SERVICE_ROLE_KEY`
- user answers and answer history
- encrypted BYOK provider credentials
- Stripe secrets and webhook signing secrets
- auth/session flows

## Secrets rules

Never commit real credentials.

Common sensitive env vars include:

```text
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
INTEGRATION_ENCRYPTION_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
RESEND_API_KEY
CRON_SECRET
```

Rules:
- service-role keys stay server-side only
- `INTEGRATION_ENCRYPTION_KEY` is required for BYOK key storage
- frontend code must never expose service-role or webhook secrets
- `.env*`, `.next/`, and build output remain ignored

## Current posture

### Positive
- CI exists for the app + MCP server
- strict TypeScript is in use
- BYOK keys are encrypted server-side
- Stripe webhook dedup exists
- review/stress-test persistence is append-oriented
- Supabase remains the system of record

### Still worth hardening
- benchmark and trim MCP token budget
- tighten secret scanning / dependency scanning
- keep public-route rate limits explicit where needed
- keep review / draft provider selection clear in docs and runtime messaging

## Before pushing

Run:

```bash
git status
git diff --check
```

Check for:
- generated build artifacts
- copied secrets
- local dumps
- tunnel URLs or personal endpoints accidentally pasted into tracked docs

## Disclosure rule

If a security issue is found:
1. avoid public credential disclosure
2. document impact and affected files
3. rotate secrets if exposure is plausible
4. patch before broad discussion
