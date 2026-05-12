-- Migration 040 — Onboarding gate
--
-- Adds onboarding_completed_at to user_profiles. The /onboarding page
-- gates the app for new users until they either fill the 5-10 question
-- starter application or paste/upload an in-progress one.
--
-- Grandfathering: anyone with at least one profile_answer row is
-- considered already onboarded (their behavior is the signal).

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Backfill: mark existing active users as already onboarded.
UPDATE public.user_profiles up
SET    onboarding_completed_at = NOW()
WHERE  onboarding_completed_at IS NULL
  AND  EXISTS (
        SELECT 1 FROM public.profile_answers pa
        WHERE  pa.user_id = up.user_id
       );

COMMENT ON COLUMN public.user_profiles.onboarding_completed_at IS
  'When the user finished /onboarding (starter app or upload). NULL = gate still active. Backfilled for legacy users with existing profile_answers.';
