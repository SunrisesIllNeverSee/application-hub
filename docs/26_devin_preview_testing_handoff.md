# Devin Preview Testing Handoff

This is the compact handoff for the applicant-mode preview testing lane so another session can pick it up without re-spending context.

## Current State

Feature branch / PR:

- PR: [#2](https://github.com/SunrisesIllNeverSee/application-hub/pull/2)
- Preview: [application-hub-git-devin-f13798-sunrisesillneversees-projects.vercel.app](https://application-hub-git-devin-f13798-sunrisesillneversees-projects.vercel.app)

What shipped in that PR:

- applicant-mode toggle
- multi-identity profile fields
- contribution rewards primitive
- migration `027_applicant_modes_and_contributions.sql`

## What Has Already Been Verified

Using Vercel protected fetch access, the preview is reachable and these anon/static surfaces are present:

- landing page loads
- 4-up mode badges render
  - Founder = `Live`
  - Job-seeker / Student / Researcher = `Soon`
- demo panel caption includes `Founder mode`
- `Coming next` lane renders under `Indexed across`
- new FAQ entry about non-founder modes is present
- `/login` loads and shows:
  - magic-link email flow
  - dev-only password fallback copy

## What Has Changed Since This Doc Was Written

- Migration `027_applicant_modes_and_contributions.sql` has been **applied** (renumbered to 030)
- Migration `031_fix_contribution_credit_amount.sql` applied — Bug #3 fixed in DB
- Bug #2 (logged-out 401 on mode selector) fixed in `HubPage` — ModeSelector now only renders when `user` is authenticated
- PR #2 finding #1 (migration collision) resolved

## What Is Still Blocked

### 1. Migration-gated

Meaningful testing of the new signed-in surfaces requires:

- [migrations/027_applicant_modes_and_contributions.sql](/Users/dericmchenry/Desktop/application-hub/migrations/027_applicant_modes_and_contributions.sql)

Until that migration is applied to the Supabase project backing the preview:

- `user_profiles.identities` does not exist
- `user_profiles.active_identity` does not exist
- `user_contributions` does not exist
- `user_contribution_summary` does not exist
- `PATCH /api/profile/identity` is expected to fail
- `/profile/about` identity save path is expected to fail

### 2. Auth-gated

To finish end-to-end testing, the tester needs an authenticated preview session.

Preferred path:

- magic link

Alternative:

- dev-only password path, if a test account is available and intentionally allowed

## Remaining Test Cases

Once migration `027` is applied and a login session exists, test these in order:

1. `/hub`
   - mode selector renders for signed-in user
   - switching mode persists or refreshes correctly
   - sparse modes show the intended empty-state messaging

2. Sparse-mode empty state
   - CTA deep-links to `/hub/submit?kind=<defaultKind>`
   - copy promises `5 drip unlocks`

3. `/profile/about`
   - `I am a…` multi-select renders
   - active identity dropdown renders
   - save succeeds

4. Contribution summary
   - if test data exists, credit card renders without errors

5. `/hub/submit`
   - `kind` query param preselect works for mode-driven CTA

## Known Review Findings On PR #2

These are already posted on the PR and should remain in view during testing:

1. ~~migration number collision with existing `027_recruiter_alerts.sql`~~ — **Fixed** (Codex file renumbered to 030)
2. ~~logged-out users can click the mode selector but hit `401` on switch~~ — **Fixed** (ModeSelector guarded behind `{user && ...}`)
3. ~~contribution ledger records `5` credits even when fewer than 5 new unlocks may actually be inserted~~ — **Fixed** (migration 031)

## Testing Rules Going Forward

Use [docs/25_preview_test_preconditions.md](/Users/dericmchenry/Desktop/application-hub/docs/25_preview_test_preconditions.md) before assigning preview work.

Classify the lane as:

- static / anon-safe
- auth-required
- migration-blocked

Do not assign it as one undifferentiated "E2E test" task.
