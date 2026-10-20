-- ============================================================
-- P0 team invite acceptance role tests (055; EI-06 / EI-07)
-- ============================================================
-- LOCAL THROWAWAY POSTGRES ONLY. Requires 00-03 loaded and p0.phase set.
-- 'pre'  = before 055: reproduces EI-06 (invitee cannot read the invite or
--          join under RLS; RPC does not exist).
-- 'post' = after 055: contract of accept_team_invite(p_token) + RLS unchanged.
-- Observed strings: <status|error> member=<bool> accepted=<bool> role=<role>
-- ============================================================
\set a1 '00000000-0000-0000-0000-0000000000a1'
\set a3 '00000000-0000-0000-0000-0000000000a3'
\set a4 '00000000-0000-0000-0000-0000000000a4'
\set a5 '00000000-0000-0000-0000-0000000000a5'
\set a6 '00000000-0000-0000-0000-0000000000a6'
\set a7 '00000000-0000-0000-0000-0000000000a7'

-- ---------- EI-06: RLS reproduction (same in both phases: RLS is NOT widened) ----------
-- FINDING (reproduced locally AND live, read-only): the live team policies are
-- self-referential (tm_member_select selects from team_members), so ANY
-- authenticated read/write of team_members / team_invites / teams fails with
-- 42P17 "infinite recursion detected in policy". The invitee failure is
-- therefore worse than the diagnosed 0-rows/403. 055 sidesteps it via
-- SECURITY DEFINER; it does NOT fix the recursion (see report, open item).
SELECT p0.test('EI-06a','invitee reads own invite by token under RLS (policy recursion 42P17; also ti_team_select needs membership)',
 'error:42P17','error:42P17','authenticated',:'a3',
 $q$SELECT count(*)::text FROM team_invites WHERE token='tok-valid'$q$,
 $q$SELECT current_setting('p0.last')$q$,
 'scalar', 'invitee@example.test');

SELECT p0.test('EI-06b','invitee inserts own team_members row under RLS (policy recursion 42P17; tm_owner_manage is owner-only)',
 'error:42P17','error:42P17','authenticated',:'a3',
 $q$INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a3','member',now())$q$,
 $q$SELECT current_setting('p0.last')$q$,
 'dml', 'invitee@example.test');

SELECT p0.test('EI-06c','invitee marks invite accepted under RLS',
 'error:42P17','error:42P17','authenticated',:'a3',
 $q$UPDATE team_invites SET accepted_at=now() WHERE token='tok-valid'$q$,
 $q$SELECT current_setting('p0.last')$q$,
 'dml', 'invitee@example.test');

SELECT p0.test('EI-06d','pre-055: accept_team_invite does not exist',
 'error:42883','n/a','authenticated',:'a3',
 $q$SELECT public.accept_team_invite('tok-valid')::text$q$,
 $q$SELECT current_setting('p0.last')$q$,
 'scalar', 'invitee@example.test');

SELECT p0.test('EI-06e','authenticated cannot read auth.users directly (RPC reads it as definer)',
 'error:42501','error:42501','authenticated',:'a3',
 $q$SELECT count(*)::text FROM auth.users$q$,
 $q$SELECT current_setting('p0.last')$q$,
 'scalar', 'invitee@example.test');

-- ---------- 055 contract (post phase only) ----------
-- shared verify: status|error + membership + accepted flag + member role

SELECT p0.test('INV-1','matching email (case/whitespace-insensitive) joins as member, invite marked accepted',
 'n/a','joined member=true accepted=true role=member','authenticated',:'a3',
 $q$SELECT public.accept_team_invite('tok-valid')::text$q$,
 $q$SELECT coalesce((current_setting('p0.last')::jsonb)->>'status',(current_setting('p0.last')::jsonb)->>'error')
         || ' member=' || EXISTS(SELECT 1 FROM team_members WHERE team_id='aaaaaaaa-0000-0000-0000-000000000001' AND user_id='00000000-0000-0000-0000-0000000000a3')::text
         || ' accepted=' || (SELECT accepted_at IS NOT NULL FROM team_invites WHERE token='tok-valid')::text
         || ' role=' || coalesce((SELECT role FROM team_members WHERE team_id='aaaaaaaa-0000-0000-0000-000000000001' AND user_id='00000000-0000-0000-0000-0000000000a3'),'-')$q$,
 'scalar', 'INVITEE@example.test');

SELECT p0.test('INV-1b','response shape: ok=true, team_id uuid string, status joined',
 'n/a','true|aaaaaaaa-0000-0000-0000-000000000001|joined','authenticated',:'a3',
 $q$SELECT public.accept_team_invite('tok-valid')::text$q$,
 $q$SELECT (current_setting('p0.last')::jsonb->>'ok') || '|' || (current_setting('p0.last')::jsonb->>'team_id') || '|' || (current_setting('p0.last')::jsonb->>'status')$q$,
 'scalar', 'invitee@example.test');

SELECT p0.test('INV-2','reuse: second accept of the same token -> invalid_or_used',
 'n/a','joined/invalid_or_used','authenticated',:'a3',
 $q$SELECT (public.accept_team_invite('tok-valid')->>'status') || '/' || (public.accept_team_invite('tok-valid')->>'error')$q$,
 $q$SELECT current_setting('p0.last')$q$,
 'scalar', 'invitee@example.test');

SELECT p0.test('INV-2b','reuse: token already accepted in the table -> invalid_or_used',
 'n/a','invalid_or_used','authenticated',:'a3',
 $q$SELECT public.accept_team_invite('tok-used')::text$q$,
 $q$SELECT current_setting('p0.last')::jsonb->>'error'$q$,
 'scalar', 'invitee@example.test');

SELECT p0.test('INV-3','wrong email -> email_mismatch; no membership, invite stays open',
 'n/a','email_mismatch member=false accepted=false role=-','authenticated',:'a4',
 $q$SELECT public.accept_team_invite('tok-valid')::text$q$,
 $q$SELECT coalesce((current_setting('p0.last')::jsonb)->>'status',(current_setting('p0.last')::jsonb)->>'error')
         || ' member=' || EXISTS(SELECT 1 FROM team_members WHERE team_id='aaaaaaaa-0000-0000-0000-000000000001' AND user_id='00000000-0000-0000-0000-0000000000a4')::text
         || ' accepted=' || (SELECT accepted_at IS NOT NULL FROM team_invites WHERE token='tok-valid')::text
         || ' role=' || coalesce((SELECT role FROM team_members WHERE team_id='aaaaaaaa-0000-0000-0000-000000000001' AND user_id='00000000-0000-0000-0000-0000000000a4'),'-')$q$,
 'scalar', 'stranger@example.test');

SELECT p0.test('INV-3b','spoofed JWT email claim does not help: email is read from auth.users',
 'n/a','email_mismatch','authenticated',:'a4',
 $q$SELECT public.accept_team_invite('tok-valid')::text$q$,
 $q$SELECT current_setting('p0.last')::jsonb->>'error'$q$,
 'scalar', 'invitee@example.test');

SELECT p0.test('INV-4','expired invite (matching email) -> expired; not joined, not accepted',
 'n/a','expired member=false accepted=false','authenticated',:'a3',
 $q$SELECT public.accept_team_invite('tok-expired')::text$q$,
 $q$SELECT coalesce((current_setting('p0.last')::jsonb)->>'status',(current_setting('p0.last')::jsonb)->>'error')
         || ' member=' || EXISTS(SELECT 1 FROM team_members WHERE team_id='aaaaaaaa-0000-0000-0000-000000000001' AND user_id='00000000-0000-0000-0000-0000000000a3')::text
         || ' accepted=' || (SELECT accepted_at IS NOT NULL FROM team_invites WHERE token='tok-expired')::text$q$,
 'scalar', 'invitee-expired@example.test',
 $q$UPDATE auth.users SET email='invitee-expired@example.test' WHERE id='00000000-0000-0000-0000-0000000000a3'$q$);

SELECT p0.test('INV-4b','expired invite with a non-matching email -> email_mismatch (no expiry oracle)',
 'n/a','email_mismatch','authenticated',:'a4',
 $q$SELECT public.accept_team_invite('tok-expired')::text$q$,
 $q$SELECT current_setting('p0.last')::jsonb->>'error'$q$,
 'scalar', 'stranger@example.test');

SELECT p0.test('INV-5a','anon cannot execute (EXECUTE revoked)',
 'n/a','error:42501','anon',NULL,
 $q$SELECT public.accept_team_invite('tok-valid')::text$q$,
 $q$SELECT current_setting('p0.last')$q$,
 'scalar');

SELECT p0.test('INV-5b','service_role cannot execute (contract: authenticated only)',
 'n/a','error:42501','service_role',NULL,
 $q$SELECT public.accept_team_invite('tok-valid')::text$q$,
 $q$SELECT current_setting('p0.last')$q$,
 'scalar');

SELECT p0.test('INV-6','authenticated role without a sub claim -> not_authenticated',
 'n/a','not_authenticated','authenticated',NULL,
 $q$SELECT public.accept_team_invite('tok-valid')::text$q$,
 $q$SELECT current_setting('p0.last')::jsonb->>'error'$q$,
 'scalar');

SELECT p0.test('INV-7a','unknown token -> invalid_or_used',
 'n/a','invalid_or_used','authenticated',:'a3',
 $q$SELECT public.accept_team_invite('no-such-token')::text$q$,
 $q$SELECT current_setting('p0.last')::jsonb->>'error'$q$,
 'scalar', 'invitee@example.test');

SELECT p0.test('INV-7b','NULL token -> invalid_or_used',
 'n/a','invalid_or_used','authenticated',:'a3',
 $q$SELECT public.accept_team_invite(NULL)::text$q$,
 $q$SELECT current_setting('p0.last')::jsonb->>'error'$q$,
 'scalar', 'invitee@example.test');

SELECT p0.test('INV-8','already a member: status already_member, existing role kept, invite consumed',
 'n/a','already_member member=true accepted=true role=admin','authenticated',:'a6',
 $q$SELECT public.accept_team_invite('tok-already')::text$q$,
 $q$SELECT coalesce((current_setting('p0.last')::jsonb)->>'status',(current_setting('p0.last')::jsonb)->>'error')
         || ' member=' || EXISTS(SELECT 1 FROM team_members WHERE team_id='aaaaaaaa-0000-0000-0000-000000000001' AND user_id='00000000-0000-0000-0000-0000000000a6')::text
         || ' accepted=' || (SELECT accepted_at IS NOT NULL FROM team_invites WHERE token='tok-already')::text
         || ' role=' || coalesce((SELECT role FROM team_members WHERE team_id='aaaaaaaa-0000-0000-0000-000000000001' AND user_id='00000000-0000-0000-0000-0000000000a6'),'-')$q$,
 'scalar', 'admin@example.test');

SELECT p0.test('INV-9','invite row with role=owner is granted as member (no owner minting)',
 'n/a','joined member=true accepted=true role=member','authenticated',:'a7',
 $q$SELECT public.accept_team_invite('tok-owner-role')::text$q$,
 $q$SELECT coalesce((current_setting('p0.last')::jsonb)->>'status',(current_setting('p0.last')::jsonb)->>'error')
         || ' member=' || EXISTS(SELECT 1 FROM team_members WHERE team_id='aaaaaaaa-0000-0000-0000-000000000001' AND user_id='00000000-0000-0000-0000-0000000000a7')::text
         || ' accepted=' || (SELECT accepted_at IS NOT NULL FROM team_invites WHERE token='tok-owner-role')::text
         || ' role=' || coalesce((SELECT role FROM team_members WHERE team_id='aaaaaaaa-0000-0000-0000-000000000001' AND user_id='00000000-0000-0000-0000-0000000000a7'),'-')$q$,
 'scalar', 'esc@example.test');

SELECT p0.test('INV-10','unconfirmed auth email matching the invite -> email_mismatch',
 'n/a','email_mismatch member=false accepted=false','authenticated',:'a5',
 $q$SELECT public.accept_team_invite('tok-unverified')::text$q$,
 $q$SELECT coalesce((current_setting('p0.last')::jsonb)->>'status',(current_setting('p0.last')::jsonb)->>'error')
         || ' member=' || EXISTS(SELECT 1 FROM team_members WHERE team_id='aaaaaaaa-0000-0000-0000-000000000001' AND user_id='00000000-0000-0000-0000-0000000000a5')::text
         || ' accepted=' || (SELECT accepted_at IS NOT NULL FROM team_invites WHERE token='tok-unverified')::text$q$,
 'scalar', 'unverified@example.test');

SELECT p0.test('INV-11','admin-role invite joins as admin',
 'n/a','joined member=true accepted=true role=admin','authenticated',:'a4',
 $q$SELECT public.accept_team_invite('tok-race')::text$q$,
 $q$SELECT coalesce((current_setting('p0.last')::jsonb)->>'status',(current_setting('p0.last')::jsonb)->>'error')
         || ' member=' || EXISTS(SELECT 1 FROM team_members WHERE team_id='aaaaaaaa-0000-0000-0000-000000000001' AND user_id='00000000-0000-0000-0000-0000000000a4')::text
         || ' accepted=' || (SELECT accepted_at IS NOT NULL FROM team_invites WHERE token='tok-race')::text
         || ' role=' || coalesce((SELECT role FROM team_members WHERE team_id='aaaaaaaa-0000-0000-0000-000000000001' AND user_id='00000000-0000-0000-0000-0000000000a4'),'-')$q$,
 'scalar', 'stranger@example.test');

SELECT p0.test('INV-12','search_path hardening: caller-created temp table team_invites does not shadow the real one',
 'n/a','EFFECT','authenticated',:'a4',
 $q$DO $x$ BEGIN
      CREATE TEMP TABLE team_invites (id uuid, team_id uuid, email text, token text, role text, invited_by uuid, accepted_at timestamptz, expires_at timestamptz, created_at timestamptz);
      INSERT INTO pg_temp.team_invites (token, email, team_id, expires_at, role)
        VALUES ('tok-race','stranger@example.test','aaaaaaaa-0000-0000-0000-000000000009', now()+interval '1 day','owner');
      PERFORM public.accept_team_invite('tok-race');
    END $x$$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM team_members WHERE team_id='aaaaaaaa-0000-0000-0000-000000000001' AND user_id='00000000-0000-0000-0000-0000000000a4' AND role='admin'))$q$,
 'dml', 'stranger@example.test');

SELECT p0.test('INV-13','function catalog: SECURITY DEFINER, pinned search_path, EXECUTE only for authenticated',
 'n/a','true/{"search_path=public, pg_temp"}/anon=false/auth=true/svc=false/public=false','postgres',NULL,
 $q$SELECT 'x'$q$,
 $q$SELECT prosecdef::text||'/'||proconfig::text||'/anon='||has_function_privilege('anon','public.accept_team_invite(text)','EXECUTE')::text||'/auth='||has_function_privilege('authenticated','public.accept_team_invite(text)','EXECUTE')::text||'/svc='||has_function_privilege('service_role','public.accept_team_invite(text)','EXECUTE')::text||'/public='||has_function_privilege('public','public.accept_team_invite(text)','EXECUTE')::text FROM pg_proc WHERE proname='accept_team_invite'$q$,
 'scalar');

SELECT p0.test('INV-14','RLS unchanged after 055: policy set on team tables identical (count of policies)',
 'n/a','team_invites=2 team_members=2 teams=2','postgres',NULL,
 $q$SELECT 'x'$q$,
 $q$SELECT 'team_invites='||(SELECT count(*) FROM pg_policies WHERE tablename='team_invites')||' team_members='||(SELECT count(*) FROM pg_policies WHERE tablename='team_members')||' teams='||(SELECT count(*) FROM pg_policies WHERE tablename='teams')$q$,
 'scalar');

SELECT p0.report();
