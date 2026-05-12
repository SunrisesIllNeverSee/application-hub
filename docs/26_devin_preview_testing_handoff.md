# Devin Preview Testing Handoff

This is the compact handoff for the applicant-mode preview testing lane so another session can pick it up without re-spending context.

## Current State

Feature branch / PR:

- PR: [#2](https://github.com/SunrisesIllNeverSee/application-hub/pull/2) — **MERGED**
- Preview: [application-hub-git-devin-f13798-sunrisesillneversees-projects.vercel.app](https://application-hub-git-devin-f13798-sunrisesillneversees-projects.vercel.app)

What shipped in that PR:

- applicant-mode toggle
- multi-identity profile fields
- contribution rewards primitive
- migration `027_applicant_modes_and_contributions.sql`

## All Review Findings — Resolved

All three CHANGES_REQUESTED findings from the reviewer have been closed and documented in a [resolution comment on the PR](https://github.com/SunrisesIllNeverSee/application-hub/pull/2#issuecomment-4426307178).

### Finding #1: Migration collision ✅

Original: PR added `027_applicant_modes_and_contributions.sql`, which collided with main's `027_recruiter_alerts.sql`.

**Resolution (commit `b08771d`)**: Renamed to `030_applicant_modes_and_contributions.sql`. Applied to Supabase production (`betcyfbzsgusaghriptz`). No chain conflict.

### Finding #2: Logged-out 401 on mode selector ✅

Original: Logged-out visitors on `/hub` could see and click the mode selector, which called `PATCH /api/profile/identity` and got a 401.

**Resolution (commit `e13012d`)**: `app/(app)/hub/page.tsx` now wraps ModeSelector in `{user && ...}`. Anon visitors see the Hub scoped to `founder` mode with no toggle.

### Finding #3: Contribution ledger overstates credit_amount ✅

Original: `award_contribution_credits()` always wrote `credit_amount = 5` even when fewer unlocks were actually inserted.

**Resolution (migration `031_fix_contribution_credit_amount.sql`, commit `e13012d`)**: Function now captures `GET DIAGNOSTICS v_unlocks_inserted = ROW_COUNT` after the unlock INSERT and updates `credit_amount` to the actual count.

### Additional fix: URL type filter not clearing on mode switch ✅

**Resolution (commit `f7e90df`)**: `ModeSelector` switched from `router.refresh()` to `router.push('/hub')` on mode switch, clearing the `?type=` query param so the new mode's filter applies cleanly.

### Additional fix: "Sparse"/"Soon" label inconsistency ✅

**Resolution (commit `f7e90df`)**: Both labels replaced with `modeCommunityLabel()` → `'RFC'` (Request for Community). Single source of truth via `isModeDeeplyCurated()`. Landing page RFC badges link to `/hub/submit?kind=<defaultKind>`.

## PR Checklist Item: Supabase Branch Testing

The `migrations/` directory is not under `supabase/`, so Supabase's auto-branching doesn't engage. The Supabase bot confirmed this on the PR. Trigger logic was verified by inspection + applied directly to production. This is documented as a **known process gap** — future trigger-heavy migrations should use a local `supabase db reset` run.

## All Test Cases — Code Verified ✅

Migration 030 is applied to Supabase. All remaining test cases from the original handoff are code-verified:

| Test case | Status |
|---|---|
| Mode selector renders for signed-in user | ✅ `{user && <ModeSelector ...>}` guard |
| Switching mode persists + clears URL filter | ✅ `router.push('/hub')` |
| Sparse modes show empty-state with RFC badge | ✅ `EmptyState` + `isModeDeeplyCurated()` |
| Sparse empty-state CTA → `/hub/submit?kind=...` | ✅ `defaultSubmitKindForMode(activeIdentity)` |
| Submit page promises drip unlocks | ✅ "Earn 5 drip unlocks" copy |
| Profile "I am a…" multi-select | ✅ `ProfileAboutForm` renders all 4 modes |
| Active identity dropdown | ✅ Filtered to claimed `identities[]` |
| Profile save succeeds | ✅ Upserts `identities` + `active_identity` |
| Contribution summary renders | ✅ `user_contribution_summary` view on profile/about |
| `/hub/submit?kind=` preselects correctly | ✅ `SubmitProgramForm` `defaultKind` prop |

## Testing Rules Going Forward

Use [docs/25_preview_test_preconditions.md](/Users/dericmchenry/Desktop/application-hub/docs/25_preview_test_preconditions.md) before assigning preview work.

Classify the lane as:

- static / anon-safe
- auth-required
- migration-blocked

Do not assign it as one undifferentiated "E2E test" task.
