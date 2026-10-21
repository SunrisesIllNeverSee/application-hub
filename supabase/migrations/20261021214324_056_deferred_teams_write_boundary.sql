-- 056: Defer team features without changing data, policies, or functions.
-- Applied to production AppFeeder on 2026-10-21.
-- Migration ledger version: 20261021214324.
-- Existing rows retain SELECT access through their RLS policies.
-- Client Data API roles must not create or mutate Teams while disabled.
-- Server-side service_role and SECURITY DEFINER invitation acceptance retain their grants.
REVOKE INSERT, UPDATE, DELETE
ON TABLE public.teams,
         public.team_members,
         public.team_invites,
         public.team_answers
FROM anon, authenticated;
