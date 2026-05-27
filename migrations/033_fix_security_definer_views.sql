-- Migration 033: Fix SECURITY DEFINER views
--
-- Supabase linter flagged these three views as SECURITY DEFINER, meaning they
-- execute with the view creator's privileges rather than the querying user's.
-- This bypasses RLS on the underlying tables.
--
-- Fix: recreate each view with security_invoker = true so RLS applies normally.

-- ── opportunities ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.opportunities;
CREATE VIEW public.opportunities
  WITH (security_invoker = true)
AS
  SELECT * FROM programs;

-- Grant same access as before
GRANT SELECT ON public.opportunities TO authenticated, anon;

-- ── user_credit_balance ───────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.user_credit_balance;
CREATE VIEW public.user_credit_balance
  WITH (security_invoker = true)
AS
SELECT
  user_id,
  COALESCE(SUM(amount), 0)::INT AS balance,
  COUNT(*)::INT                 AS event_count,
  MAX(created_at)               AS last_earned_at
FROM credit_events
GROUP BY user_id;

GRANT SELECT ON public.user_credit_balance TO authenticated;

-- ── user_contribution_summary ─────────────────────────────────────────────────
DROP VIEW IF EXISTS public.user_contribution_summary;
CREATE VIEW public.user_contribution_summary
  WITH (security_invoker = true)
AS
SELECT
  user_id,
  COUNT(*)::INT                        AS contribution_count,
  COALESCE(SUM(credit_amount), 0)::INT AS total_credits_earned,
  MAX(awarded_at)                      AS last_awarded_at
FROM user_contributions
GROUP BY user_id;

GRANT SELECT ON public.user_contribution_summary TO authenticated;
