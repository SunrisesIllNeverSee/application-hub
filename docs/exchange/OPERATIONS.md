# Exchange Gateway — Operator Runbook

## Company state

`pending` → DNS verification → `verified`. Only verified domains receive transactions. Suspended/rejected companies cannot be targeted.

## Exchange state

`proposed → engaged → negotiating → committed → authorized → delivering → delivered → verified → settled → closed`

Company-only transitions: engage, authorize, verify, decline.  
Proposer-only transitions: delivering, delivered, revoke.  
Settlement system only: settled.  
Both parties may negotiate, commit, dispute or close where the state machine permits.

## Credentials

- Company admin key: generated once; SHA-256 stored.
- Guest proposer key: generated once per exchange; SHA-256 stored.
- Registered agent key: generated once; SHA-256 stored.
- Reference-site admin key: environment variable, not database plaintext.

Keys are bearer credentials in v0.1. Future versions should support DID/VC or signed requests without removing the simpler path.

## Transaction fee

`EXCHANGE_PLATFORM_FEE_BPS` controls the fee applied to the cash component of a verified exchange. Default reference value: 500 bps (5%).

`EXCHANGE_REFERRAL_BPS` reserves a portion of gross consideration for referral accounting. Default: 0. It must never exceed the platform fee in the reference math.

## Financial settlement

Automatic Stripe settlement requires a registered contributor with `payout_provider=stripe_connect` and a connected-account ID. Otherwise the system creates a `manual_required` settlement record and does not falsely mark the exchange settled.

## Rights and revocation

Do not promise technical recall of copied information. Model separate controls for authorization, access, pre-vesting licenses, post-vesting licenses, and artifact/key custody.

## Abuse handling

Reject proposals that are generic sales spam, contain illegal content, demand payment for withholding harm, claim unauthorized penetration testing, or rely on stolen/private data. Do not reward activity that violated the domain's published scope.

## Audit

Every state transition writes `exchange_events`. The Contribution Commitment receives a deterministic SHA-256 terms hash. Settlement state is stored separately from negotiation state so payment retries cannot silently alter contractual terms.
