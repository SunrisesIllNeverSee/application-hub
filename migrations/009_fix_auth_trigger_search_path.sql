-- ============================================================
-- 009 — Fix auth-trigger search_path (Supabase signup)
-- ============================================================
--
-- WHY: When Supabase GoTrue inserts a new row into auth.users, the trigger
-- chain can run under a role whose search_path does not include public. Even
-- though the functions are SECURITY DEFINER, unqualified table references can
-- fail unless the function search_path is pinned.
--
-- Symptom during live smoke testing:
--   "Database error saving new user"
-- with auth logs similar to:
--   ERROR: relation "user_subscriptions" does not exist (SQLSTATE 42P01)
--
-- This pins search_path on every function that participates in the new-user
-- signup trigger chain so public.* tables resolve correctly.
-- ============================================================

ALTER FUNCTION public.create_free_subscription_on_signup()
  SET search_path = public, extensions;

ALTER FUNCTION public.set_draft_limit_on_insert()
  SET search_path = public, extensions;

ALTER FUNCTION public.sync_draft_limit_on_tier_change()
  SET search_path = public, extensions;
