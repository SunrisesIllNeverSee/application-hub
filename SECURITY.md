# Security Policy

_Last updated: 2026-05-09_

## Scope

This repository contains:

- Supabase schema migrations
- MCP server runtime code
- infrastructure and environment configuration examples
- application intelligence and scoring logic

It may eventually include frontend application code and deployment configuration.

---

## Sensitive systems

The following systems should always be treated as sensitive:

- Supabase service-role access
- user profile answers
- subscription and billing data
- AI draft usage logs
- future authentication/session infrastructure

---

## Environment variables

Never commit real credentials.

Required secrets include:

```text
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
STRIPE_SECRET_KEY
RESEND_API_KEY
```

Rules:

- Service-role keys are server-side only.
- Frontend code must never expose the service-role key.
- `.env` files remain gitignored.
- Use `.env.example` for templates only.

---

## Repository hygiene

The repository currently ignores:

- `node_modules/`
- `dist/`
- `.next/`
- `.env*`
- editor artifacts

Before pushing local work:

```bash
git status
```

Verify:

- no local secrets
- no generated build output
- no database dumps
- no personal credential files

---

## Recommended future additions

### CI

Add GitHub Actions validation for:

- TypeScript build
- typecheck
- linting
- dependency audit

### Secret scanning

Recommended:

- GitHub secret scanning
- Dependabot alerts
- Gitleaks or TruffleHog

### Production hardening

Before public launch:

- enable Supabase RLS everywhere appropriate
- audit all RPC permissions
- add rate limiting to public HTTP MCP endpoints
- validate authentication boundaries for all user-scoped tools
- verify Stripe webhook signatures
- add structured server logging
- add monitoring/alerting

---

## Responsible disclosure

If a security issue is discovered:

1. Do not publish credentials or exploit details publicly.
2. Document:
   - affected file(s)
   - reproduction steps
   - severity
   - possible impact
3. Rotate exposed credentials immediately if exposure is confirmed.
4. Patch the issue before broad disclosure.

---

## Current known security posture

### Positive

- Service-role usage is documented as server-side only.
- MCP runtime is separated from planned frontend deployment.
- `.env` files are ignored.
- Strict TypeScript mode is enabled.
- Database-side scoring reduces client-side trust assumptions.

### Missing / incomplete

- No GitHub Actions CI yet.
- No automated secret scanning configured.
- No dependency audit workflow configured.
- Frontend auth boundaries are not yet verified in the remote repository state.
