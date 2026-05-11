# Preview Test Preconditions

This document exists to stop the team from burning time and usage on preview tests that are structurally blocked before they start.

Use it before asking any agent to test a Vercel preview, especially when the feature depends on new migrations, auth, or live Supabase state.

## Why This Exists

Recent preview testing for applicant-mode work stalled for predictable reasons:

- the preview code was deployed
- the database migration was not yet applied
- authenticated surfaces depended on new columns and views
- the tester still had to spend cycles discovering which pages were safe to test anonymously and which were guaranteed to fail

That is a coordination problem, not a testing failure.

## Test Classes

Every preview test request should be labeled as one of these before work starts.

### 1. Static / anon-safe

These can be tested without login and without new database state.

Examples:

- landing page copy
- badges and marketing surfaces
- FAQ entries
- layout and responsiveness
- non-authenticated navigation

### 2. Auth-required

These require a valid test user in the preview's Supabase project.

Examples:

- `/hub` for signed-in users
- `/profile/about`
- `/profile/integrations`
- draft flows
- saved answer flows

### 3. Migration-blocked

These depend on schema objects that do not exist until a named migration is applied.

Examples:

- new columns on existing tables
- new enum values
- new views
- new API routes that read/write newly added fields
- new triggers or reward ledgers

If a test is migration-blocked, do not start end-to-end testing until the migration status is confirmed.

## Required Preflight Checklist

Before any agent starts preview testing, answer these questions explicitly.

### Deployment

- What exact preview URL should be tested?
- Is the preview publicly reachable, or protected by Vercel auth?

### Migration state

- Which migration(s) must already be applied for this feature?
- Have they actually been applied to the Supabase project backing the preview?

Required format:

```text
Migration required: 027_applicant_modes_and_contributions.sql
Migration applied to preview DB: yes | no | unknown
```

### Auth state

- Does the feature require a signed-in user?
- If yes, is there a test account available?
- What auth path should be used?
  - magic link
  - OTP
  - password escape hatch

Required format:

```text
Auth required: yes | no
Test account available: yes | no | unknown
Preferred login path: magic link | OTP | password
```

### Expected failure policy

If preconditions are not met, the tester should not keep digging blindly.

Instead, the tester should stop and report:

- what was testable
- what was blocked
- the exact missing prerequisite

## Applicant-Mode Example

For PR #2 (`Cross-theme positioning: applicant modes + identity toggle + contribution rewards`), the testing split is:

### Safe before migration 027

- landing page mode badges
- landing page demo caption
- "Coming next" lane
- FAQ copy
- general responsive/layout checks on anon surfaces

### Blocked until migration 027 is applied

- `PATCH /api/profile/identity`
- `/hub` mode persistence for signed-in users
- `/profile/about` identities multi-select save
- `user_profiles.identities`
- `user_profiles.active_identity`
- contribution credit summary
- `user_contributions`-backed UI

### Also blocked on auth

- any signed-in Hub mode switching
- profile save flows
- contribution summary verification

## Recommended Test Request Template

Use this when handing preview work to an agent:

```text
Preview URL:
Preview access:
Feature under test:
Migration required:
Migration applied:
Auth required:
Test account available:
What should be tested now:
What is expected to remain blocked:
```

## Team Rule

Do not ask for "end-to-end preview testing" as a single undifferentiated task when the feature depends on fresh schema.

Ask for one of:

- static/anon verification
- authenticated verification
- post-migration end-to-end verification

That keeps testing honest, cheaper, and much easier to hand off.
