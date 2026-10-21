-- 057: Complete the deferred Teams client-write lockdown.
-- Applied to production AppFeeder on 2026-10-21.
-- Migration ledger version: 20261021214559.
-- Migration 056 revoked INSERT/UPDATE/DELETE; the original security
-- specification also requires TRUNCATE to be denied for API client roles.
-- Preserve SELECT, all service_role grants and SECURITY DEFINER RPC access.
REVOKE TRUNCATE
ON TABLE public.teams,
         public.team_members,
         public.team_invites,
         public.team_answers
FROM anon, authenticated;
