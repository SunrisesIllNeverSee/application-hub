-- ============================================================
-- 055 — Team invite acceptance RPC (M08 / P0 auth)
-- ============================================================
-- STATUS: PREPARED — DO NOT APPLY without separate owner
-- prod-exec-auth. Independent of 054. Forward-only, idempotent
-- (CREATE OR REPLACE + explicit grants). Touches no data rows and
-- changes NO RLS policy.
--
-- Problem (diagnosis-email-invites.md EI-06/EI-07): under the live RLS
-- (025) an invitee is by definition not a team member, so with the
-- user-scoped client they can neither read their team_invites row
-- (ti_team_select needs membership) nor join (tm_owner_manage is owner
-- only). The accept flow therefore could never work. No RLS widening is
-- needed or done: acceptance goes through a narrow SECURITY DEFINER RPC.
--
-- Contract (shared with the auth app):
--   public.accept_team_invite(p_token text) RETURNS jsonb
--   success: {"ok": true,  "team_id": "<uuid>", "status": "joined"|"already_member"}
--   failure: {"ok": false, "error": "not_authenticated"|"invalid_or_used"|"expired"|"email_mismatch"}
--   App call: supabase.rpc('accept_team_invite', { p_token: token })
--   with the user-scoped server client. EXECUTE: authenticated only.
--
-- Rules enforced inside the function (one transaction, row-locked):
--   * caller must be authenticated (auth.uid());
--   * token must exist and be unused (accepted_at IS NULL)  -> else invalid_or_used;
--     single-use: a reused token is invalid_or_used for everyone;
--   * invite email must equal the caller's AUTH email, case-insensitive and
--     whitespace-trimmed; the email is read from auth.users (authoritative,
--     not from the JWT) and must be confirmed (email_confirmed_at set)
--     -> else email_mismatch;
--   * invite must not be expired (expires_at > now())      -> else expired;
--     (checked after the email match so a non-invitee learns nothing
--      beyond the generic outcome);
--   * membership insert is idempotent (UNIQUE team_id,user_id; an existing
--     member keeps their role: status 'already_member');
--   * the invite row's role is honored only for 'admin' or 'member'; any
--     other value (including 'owner') is granted as 'member' — an invite
--     can never mint an owner;
--   * invite is marked accepted (accepted_at = now()) in the same
--     transaction.
--
-- ROLLBACK (owner-run):
--   DROP FUNCTION IF EXISTS public.accept_team_invite(text);
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.accept_team_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_email    text;
  v_confirmed timestamptz;
  v_invite   public.team_invites%ROWTYPE;
  v_role     text;
  v_inserted int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_used');
  END IF;

  -- Row lock: serializes concurrent accepts of the same token (single use).
  SELECT * INTO v_invite
    FROM public.team_invites
   WHERE token = p_token
   FOR UPDATE;

  IF NOT FOUND OR v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_used');
  END IF;

  SELECT u.email, u.email_confirmed_at
    INTO v_email, v_confirmed
    FROM auth.users u
   WHERE u.id = v_uid;

  IF v_email IS NULL
     OR v_confirmed IS NULL
     OR lower(btrim(v_email)) <> lower(btrim(v_invite.email))
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_mismatch');
  END IF;

  IF v_invite.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  v_role := CASE WHEN v_invite.role IN ('admin', 'member') THEN v_invite.role ELSE 'member' END;

  INSERT INTO public.team_members (team_id, user_id, role, invited_by, joined_at)
  VALUES (v_invite.team_id, v_uid, v_role, v_invite.invited_by, now())
  ON CONFLICT (team_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  UPDATE public.team_invites
     SET accepted_at = now()
   WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'ok', true,
    'team_id', v_invite.team_id,
    'status', CASE WHEN v_inserted = 1 THEN 'joined' ELSE 'already_member' END
  );
END;
$$;

-- EXECUTE: authenticated only. (Supabase default privileges grant EXECUTE on
-- new public functions to anon/authenticated/service_role; revoke explicitly.)
REVOKE ALL ON FUNCTION public.accept_team_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_team_invite(text) FROM anon;
REVOKE ALL ON FUNCTION public.accept_team_invite(text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(text) TO authenticated;

COMMENT ON FUNCTION public.accept_team_invite(text) IS
  'P0 auth: accept a team invite by token. SECURITY DEFINER; binds acceptance to the caller''s confirmed auth email; single use; idempotent membership.';

COMMIT;

-- ============================================================
-- Post-apply read-only verification (owner-run):
--   SELECT prosecdef, proconfig FROM pg_proc WHERE proname='accept_team_invite';
--     -- expect t, {search_path=public, pg_temp}
--   SELECT has_function_privilege('anon','public.accept_team_invite(text)','EXECUTE'),
--          has_function_privilege('authenticated','public.accept_team_invite(text)','EXECUTE');
--     -- expect f, t
-- ============================================================
