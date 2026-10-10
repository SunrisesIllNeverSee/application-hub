# LF-Provider-Egress-Policy

Scope: `app/lib/aqua-local/` — the local-first vault. LF-19.

## The rule

The aqua-local vault mints **zero** server rewards, credits, tokens, or
billing events. Local drafts and approvals are private user data; nothing
about producing or approving them may reach an application server.

## Enforcement layers

1. **Code boundary.** Every file except `providers.ts` is marked
   `NETWORK-BOUNDARY` and contains no network primitive. `providers.ts` is
   marked `EGRESS-BOUNDARY`: the single permitted egress site is the
   `ctx.fetchImpl(...)` call inside `createHttpJsonProvider`, reachable
   only after a per-generation `ProviderConsentRecord` is written
   (`granted_by: 'user'`).
2. **Runtime test.** `run-approval-tests.mjs` stubs `globalThis.fetch`
   and runs the full approve → freeze → sign → export flow: **0 fetches**.
   A second test greps all lib sources and fails on any network primitive
   outside the declared egress site.
3. **No ledger to mint into.** No vault store names a reward, credit,
   billing, or balance concept (`STORE_NAMES` asserted by test). There is
   no API client, no reward endpoint, and no submission transport —
   `submitted_external_observed` is a declared-but-unreachable packet
   state.

## Provider modes

| mode | egress | key material | platform cost |
|------|--------|--------------|---------------|
| `manual` | none | none | none |
| `byok` | provider-direct only | user's own key, encrypted in the local vault (`provider_keys`), never sent to the app server | none — the user pays their own provider directly |
| `app_provider` | provider endpoint only, behind stored consent | app-provisioned token (if any) | none recorded locally |

## BYOK cost accounting

BYOK calls use the user's own API key, sent as a bearer token **directly
to the provider** (`authorization: Bearer <user key>` — asserted by test).
The key is stored encrypted under the vault secret in `provider_keys` and
is loaded only inside the consent-gated generation path. The application
server never sees the key, never proxies the call, and records no cost,
usage, or reward entry for it. The only local artifacts are the consent
receipt (`provider_consents`), the provenance record, and the version
itself — all vault-local, none egressed.
