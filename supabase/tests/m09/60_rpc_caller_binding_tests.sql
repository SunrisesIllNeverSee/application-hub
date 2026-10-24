-- ============================================================
-- M09 061 suite: user-scoped RPCs are bound to the caller
-- ============================================================
-- LOCAL THROWAWAY POSTGRES ONLY. Needs p0/03_harness.sql (p0.results)
-- and the chain through 061. Run by full_chain.sh in both
-- GRANTS_MODE=default and =revoked.
--
-- Covers: the user-id functions (claim_starter_package, run_daily_drip,
-- compute_user_fit_scores, increment_draft_count, seed_signup_questions),
-- the recompute jobs, get_top_programs_by_value, the RLS / guard helpers,
-- the trigger functions (still fire after the EXECUTE revoke), and a drift
-- guard: no SECURITY DEFINER function in public is executable by anon
-- unless allowlisted (RB-ANON-DEFINER).
--
-- p0r.call() runs ONE statement the way the caller really arrives:
--   session 'authenticator'  PostgREST: SET SESSION AUTHORIZATION
--                            authenticator, then SET ROLE anon /
--                            authenticated / service_role + JWT claims
--   session 'postgres'       pg_cron, SQL editor, migrations (optionally
--                            impersonating an API role, as the SQL editor
--                            role switcher does)
-- after an optional setup statement (postgres), then a verify query
-- (postgres) that may read current_setting('p0.last'):
--   'ok:<scalar>' | 'error:<SQLSTATE>'
-- and, after an error, current_setting('p0r.msg') = the error message
-- (the 061 check raises 'forbidden'; an RLS refusal reads differently).
-- Everything is rolled back after each test, so tests are independent.
-- ============================================================
\set a1 '00000000-0000-0000-0000-0000000000a1'
\set a2 '00000000-0000-0000-0000-0000000000a2'
\set hidden '00000000-0000-0000-0000-00000000f061'

CREATE SCHEMA IF NOT EXISTS p0r;

CREATE OR REPLACE FUNCTION p0r.call(
  p_id text, p_desc text, p_expected text,
  p_session text, p_role text, p_claims jsonb,
  p_sql text, p_verify text DEFAULT NULL, p_setup text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE v_stmt text; v_obs text;
BEGIN
  BEGIN  -- sub-transaction, always rolled back via sentinel
    IF p_setup IS NOT NULL THEN EXECUTE p_setup; END IF;
    IF p_session <> 'postgres' THEN
      EXECUTE format('SET LOCAL SESSION AUTHORIZATION %I', p_session);
    END IF;
    PERFORM set_config('request.jwt.claims', coalesce(p_claims::text, ''), true);
    EXECUTE format('SET LOCAL ROLE %I', p_role);
    BEGIN
      EXECUTE p_sql INTO v_stmt;
      v_stmt := 'ok:' || coalesce(v_stmt, '<null>');
    EXCEPTION WHEN OTHERS THEN
      v_stmt := 'error:' || SQLSTATE;
      PERFORM set_config('p0r.msg', SQLERRM, true);
    END;
    RESET ROLE;
    RESET SESSION AUTHORIZATION;
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('p0.last', v_stmt, true);
    IF p_verify IS NULL THEN v_obs := v_stmt; ELSE EXECUTE p_verify INTO v_obs; END IF;
    RAISE EXCEPTION 'p0r rollback sentinel' USING ERRCODE = 'P0RBK';
  EXCEPTION WHEN SQLSTATE 'P0RBK' THEN
    NULL;
  END;
  INSERT INTO p0.results(test_id, descr, phase, role_used, expected, observed, stmt_outcome, pass)
  VALUES (p_id, p_desc, current_setting('p0.phase'), p_session || '/' || p_role, p_expected, v_obs, v_stmt,
          v_obs IS NOT DISTINCT FROM p_expected);
END
$fn$;

CREATE OR REPLACE FUNCTION p0r.check(p_id text, p_desc text, p_expected text, p_observed text)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO p0.results(test_id, descr, phase, role_used, expected, observed, stmt_outcome, pass)
  VALUES (p_id, p_desc, current_setting('p0.phase'), 'postgres', p_expected, p_observed, 'catalog',
          p_expected IS NOT DISTINCT FROM p_observed)
$$;

-- JWT claims as PostgREST sets them
CREATE OR REPLACE FUNCTION p0r.jwt(p_role text, p_sub uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql AS $$ SELECT jsonb_strip_nulls(jsonb_build_object('role', p_role, 'sub', p_sub, 'aud', p_role)) $$;

-- Setup statements (run as postgres inside the rolled-back sub-transaction)
-- starter pack with three canonical questions (the seeded pack is empty)
\set setup_pack 'UPDATE starter_packages SET question_ids = (SELECT array_agg(id ORDER BY id) FROM (SELECT aq.id FROM archived_questions aq WHERE EXISTS (SELECT 1 FROM program_questions pq JOIN programs p ON p.id = pq.program_id WHERE pq.archived_question_id = aq.id AND p.source = ''canonical'') ORDER BY aq.id LIMIT 3) s) WHERE name = ''Founder Starter Pack'''
-- a question linked to no program (outside the 052 read boundary for every
-- client) with the highest significance, so an unbounded drip picks it first
\set setup_hidden 'INSERT INTO archived_questions (id, text, theme, significance_score) VALUES (''00000000-0000-0000-0000-00000000f061'', ''p0r hidden question'', ''team'', 1000)'

-- ---------- 1. anon cannot execute any of the three ----------
SELECT p0r.call('RB-ANON-claim', 'anon (PostgREST) claim_starter_package(other user)', 'error:42501',
  'authenticator', 'anon', p0r.jwt('anon'), format($q$SELECT public.claim_starter_package(%L)::text$q$, :'a1'));
SELECT p0r.call('RB-ANON-drip', 'anon (PostgREST) run_daily_drip(other user)', 'error:42501',
  'authenticator', 'anon', p0r.jwt('anon'), format($q$SELECT count(*)::text FROM public.run_daily_drip(%L)$q$, :'a1'));
SELECT p0r.call('RB-ANON-fit', 'anon (PostgREST) compute_user_fit_scores(other user)', 'error:42501',
  'authenticator', 'anon', p0r.jwt('anon'), format($q$SELECT public.compute_user_fit_scores(%L)$q$, :'a1'));
SELECT p0r.call('RB-ANON-fit-null', 'anon (PostgREST) compute_user_fit_scores(NULL)', 'error:42501',
  'authenticator', 'anon', p0r.jwt('anon'), $q$SELECT public.compute_user_fit_scores(NULL)$q$);
SELECT p0r.check('RB-ANON-acl', 'anon / PUBLIC hold no EXECUTE on the three functions', 'none',
  coalesce((SELECT string_agg(p.proname || ':' || CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END, ',')
              FROM pg_proc p, aclexplode(p.proacl) a
             WHERE p.pronamespace = 'public'::regnamespace
               AND p.proname IN ('claim_starter_package', 'run_daily_drip', 'compute_user_fit_scores')
               AND (a.grantee = 0 OR a.grantee = 'anon'::regrole)), 'none'));

-- ---------- 2. authenticated acting for another user: 42501, no effect ----------
SELECT p0r.call('RB-OTHER-claim', 'a1 claim_starter_package(a2): forbidden, nothing written', 'error:42501 forbidden claims=0 unlocks=0',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$SELECT public.claim_starter_package(%L)::text$q$, :'a2'),
  format($q$SELECT current_setting('p0.last') || ' ' || current_setting('p0r.msg') || ' claims=' || (SELECT count(*) FROM user_starter_claims WHERE user_id = %1$L)
           || ' unlocks=' || (SELECT count(*) FROM user_question_unlocks WHERE user_id = %1$L AND source = 'starter')$q$, :'a2'),
  :'setup_pack');
SELECT p0r.call('RB-OTHER-drip', 'a1 run_daily_drip(a2): forbidden, nothing written', 'error:42501 forbidden drips=0',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$SELECT count(*)::text FROM public.run_daily_drip(%L)$q$, :'a2'),
  format($q$SELECT current_setting('p0.last') || ' ' || current_setting('p0r.msg') || ' drips=' || (SELECT count(*) FROM user_question_unlocks WHERE user_id = %L AND source = 'drip')$q$, :'a2'));
SELECT p0r.call('RB-OTHER-fit', 'a1 compute_user_fit_scores(a2): forbidden', 'error:42501',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$SELECT public.compute_user_fit_scores(%L)$q$, :'a2'));
SELECT p0r.call('RB-OTHER-fit-null', 'a1 compute_user_fit_scores(NULL = all users): forbidden', 'error:42501',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  $q$SELECT public.compute_user_fit_scores(NULL)$q$);
SELECT p0r.call('RB-OTHER-claim-null', 'a1 claim_starter_package(NULL): forbidden', 'error:42501',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  $q$SELECT public.claim_starter_package(NULL)::text$q$);
SELECT p0r.call('RB-OTHER-drip-nosub', 'authenticated without a sub claim run_daily_drip(a2): forbidden', 'error:42501',
  'authenticator', 'authenticated', p0r.jwt('authenticated'),
  format($q$SELECT count(*)::text FROM public.run_daily_drip(%L)$q$, :'a2'));
-- SQL editor role switcher: a postgres session acting as authenticated is bound too
SELECT p0r.call('RB-OTHER-impersonate', 'postgres session as authenticated a1: run_daily_drip(a2) forbidden', 'error:42501 forbidden',
  'postgres', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$SELECT count(*)::text FROM public.run_daily_drip(%L)$q$, :'a2'),
  $q$SELECT current_setting('p0.last') || ' ' || current_setting('p0r.msg')$q$);
SELECT p0r.call('RB-OTHER-impersonate-claim', 'postgres session as authenticated a1: claim_starter_package(a2) forbidden', 'error:42501',
  'postgres', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$SELECT public.claim_starter_package(%L)::text$q$, :'a2'), NULL, :'setup_pack');

-- ---------- 3. authenticated acting for itself ----------
SELECT p0r.call('RB-OWN-claim', 'a1 claim_starter_package(a1): 3 unlocked, 1 claim', 'ok:3 claims=1 unlocks=3',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$SELECT public.claim_starter_package(%L)::text$q$, :'a1'),
  format($q$SELECT current_setting('p0.last') || ' claims=' || (SELECT count(*) FROM user_starter_claims WHERE user_id = %1$L)
           || ' unlocks=' || (SELECT count(*) FROM user_question_unlocks WHERE user_id = %1$L AND source = 'starter')$q$, :'a1'),
  :'setup_pack');
SELECT p0r.call('RB-OWN-claim-again', 'a1 claim_starter_package(a1) twice: idempotent', 'ok:3 claims=1 unlocks=3',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$SELECT public.claim_starter_package(%L)::text$q$, :'a1'),
  format($q$SELECT current_setting('p0.last') || ' claims=' || (SELECT count(*) FROM user_starter_claims WHERE user_id = %1$L)
           || ' unlocks=' || (SELECT count(*) FROM user_question_unlocks WHERE user_id = %1$L AND source = 'starter')$q$, :'a1'),
  :'setup_pack' || format('; SELECT public.claim_starter_package(%L)', :'a1'));
SELECT p0r.call('RB-OWN-drip', 'a2 run_daily_drip(a2): 3 rows, no 42702, nothing outside the read boundary', 'ok:3 drips=3 hidden=0',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a2'),
  format($q$SELECT count(*)::text FROM public.run_daily_drip(%L)$q$, :'a2'),
  format($q$SELECT current_setting('p0.last') || ' drips=' || (SELECT count(*) FROM user_question_unlocks WHERE user_id = %1$L AND source = 'drip')
           || ' hidden=' || (SELECT count(*) FROM user_question_unlocks WHERE user_id = %1$L AND archived_question_id = %2$L)$q$, :'a2', :'hidden'),
  :'setup_hidden');
SELECT p0r.call('RB-OWN-drip-columns', 'a2 run_daily_drip(a2): every returned column is filled', 'ok:yyy',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a2'),
  format($q$SELECT string_agg(CASE WHEN question_id IS NOT NULL AND question_text IS NOT NULL AND theme IS NOT NULL
                                     AND significance IS NOT NULL THEN 'y' ELSE 'n' END, '') FROM public.run_daily_drip(%L)$q$, :'a2'));
SELECT p0r.call('RB-OWN-drip-matches', 'a2 run_daily_drip(a2): returned rows = the drip rows written, with catalog text/theme', 'ok:match',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a2'),
  format($q$WITH r AS (SELECT * FROM public.run_daily_drip(%1$L))
            SELECT CASE WHEN (SELECT count(*) FROM r) = 3
                         AND NOT EXISTS (SELECT 1 FROM r JOIN archived_questions aq ON aq.id = r.question_id
                                          WHERE r.question_text <> aq.text OR r.theme <> aq.theme OR r.significance <> aq.significance_score)
                         AND (SELECT count(*) FROM r JOIN archived_questions aq ON aq.id = r.question_id) = 3
                        THEN 'match' ELSE 'mismatch' END$q$, :'a2'));
SELECT p0r.call('RB-OWN-drip-daily', 'a2 run_daily_drip(a2) after a drip today: no new rows', 'ok:0 drips=3',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a2'),
  format($q$SELECT count(*)::text FROM public.run_daily_drip(%L)$q$, :'a2'),
  format($q$SELECT current_setting('p0.last') || ' drips=' || (SELECT count(*) FROM user_question_unlocks WHERE user_id = %L AND source = 'drip')$q$, :'a2'),
  format('SELECT count(*) FROM public.run_daily_drip(%L)', :'a2'));
SELECT p0r.call('RB-OWN-drip-pro', 'a2 (pro) run_daily_drip(a2): unlocks readable questions only', 'ok:0 pro_any=true hidden=0',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a2'),
  format($q$SELECT count(*)::text FROM public.run_daily_drip(%L)$q$, :'a2'),
  format($q$SELECT current_setting('p0.last') || ' pro_any=' || EXISTS (SELECT 1 FROM user_question_unlocks WHERE user_id = %1$L AND source = 'pro_unlock')
           || ' hidden=' || (SELECT count(*) FROM user_question_unlocks WHERE user_id = %1$L AND archived_question_id = %2$L)$q$, :'a2', :'hidden'),
  :'setup_hidden' || format($q$; UPDATE user_subscriptions SET tier = 'pro' WHERE user_id = %L$q$, :'a2'));
SELECT p0r.call('RB-OWN-fit', 'a1 compute_user_fit_scores(a1): no client caller, EXECUTE not granted', 'error:42501',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$SELECT public.compute_user_fit_scores(%L)$q$, :'a1'));

-- ---------- 4. service_role and postgres / pg_cron ----------
SELECT p0r.call('RB-SVC-claim', 'service_role claim_starter_package(a2)', 'ok:3 claims=1',
  'authenticator', 'service_role', p0r.jwt('service_role'),
  format($q$SELECT public.claim_starter_package(%L)::text$q$, :'a2'),
  format($q$SELECT current_setting('p0.last') || ' claims=' || (SELECT count(*) FROM user_starter_claims WHERE user_id = %L)$q$, :'a2'),
  :'setup_pack');
SELECT p0r.call('RB-SVC-drip', 'service_role run_daily_drip(a2) (bypasses RLS)', 'ok:3 hidden=1',
  'authenticator', 'service_role', p0r.jwt('service_role'),
  format($q$SELECT count(*)::text FROM public.run_daily_drip(%L)$q$, :'a2'),
  format($q$SELECT current_setting('p0.last') || ' hidden=' || (SELECT count(*) FROM user_question_unlocks WHERE user_id = %L AND archived_question_id = %L)$q$, :'a2', :'hidden'),
  :'setup_hidden');
SELECT p0r.call('RB-SVC-fit', 'service_role compute_user_fit_scores(a2)', 'ok: rows>0=true',
  'authenticator', 'service_role', p0r.jwt('service_role'),
  format($q$SELECT public.compute_user_fit_scores(%L)$q$, :'a2'),
  format($q$SELECT current_setting('p0.last') || ' rows>0=' || EXISTS (SELECT 1 FROM user_program_fit WHERE user_id = %L)$q$, :'a2'),
  'DELETE FROM user_program_fit');
SELECT p0r.call('RB-SVC-fit-null', 'service_role compute_user_fit_scores(NULL = all users)', 'ok: users>1=true',
  'authenticator', 'service_role', p0r.jwt('service_role'),
  $q$SELECT public.compute_user_fit_scores(NULL)$q$,
  $q$SELECT current_setting('p0.last') || ' users>1=' || ((SELECT count(DISTINCT user_id) FROM user_program_fit) > 1)$q$,
  'DELETE FROM user_program_fit');
SELECT p0r.call('RB-PG-claim', 'postgres (SQL editor) claim_starter_package(a2)', 'ok:3',
  'postgres', 'postgres', NULL, format($q$SELECT public.claim_starter_package(%L)::text$q$, :'a2'), NULL, :'setup_pack');
SELECT p0r.call('RB-PG-drip', 'postgres run_daily_drip(a2)', 'ok:3',
  'postgres', 'postgres', NULL, format($q$SELECT count(*)::text FROM public.run_daily_drip(%L)$q$, :'a2'));
SELECT p0r.call('RB-CRON-fit', 'pg_cron refresh-fit-scores command, run as postgres', 'ok: users>1=true',
  'postgres', 'postgres', NULL,
  (SELECT rtrim(command, '; ') FROM cron.job WHERE jobname = 'refresh-fit-scores'),
  $q$SELECT current_setting('p0.last') || ' users>1=' || ((SELECT count(DISTINCT user_id) FROM user_program_fit) > 1)$q$,
  'DELETE FROM user_program_fit');
SELECT p0r.check('RB-CRON-job', 'refresh-fit-scores job unchanged', 'SELECT compute_user_fit_scores(NULL);',
  (SELECT command FROM cron.job WHERE jobname = 'refresh-fit-scores'));

-- ---------- 5. increment_draft_count / seed_signup_questions ----------
SELECT p0r.call('RB-ANON-draft', 'anon increment_draft_count(a1)', 'error:42501',
  'authenticator', 'anon', p0r.jwt('anon'), format($q$SELECT public.increment_draft_count(%L, '2026-10')$q$, :'a1'));
SELECT p0r.call('RB-ANON-seed', 'anon seed_signup_questions(a1)', 'error:42501',
  'authenticator', 'anon', p0r.jwt('anon'), format($q$SELECT public.seed_signup_questions(%L)::text$q$, :'a1'));
SELECT p0r.call('RB-OWN-draft', 'a1 increment_draft_count(a1): no client caller, EXECUTE not granted', 'error:42501',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'), format($q$SELECT public.increment_draft_count(%L, '2026-10')$q$, :'a1'));
SELECT p0r.call('RB-OWN-seed', 'a1 seed_signup_questions(a1): no client caller, EXECUTE not granted', 'error:42501',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'), format($q$SELECT public.seed_signup_questions(%L)::text$q$, :'a1'));
-- the binding itself, behind a temporary grant (rolled back): defence in depth
SELECT p0r.call('RB-BIND-draft-other', '[grant added] a1 increment_draft_count(a2): forbidden', 'error:42501 forbidden rows=0',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$SELECT public.increment_draft_count(%L, '2026-10')$q$, :'a2'),
  format($q$SELECT current_setting('p0.last') || ' ' || current_setting('p0r.msg') || ' rows=' || (SELECT count(*) FROM ai_usage WHERE user_id = %L AND month_year = '2026-10')$q$, :'a2'),
  'GRANT EXECUTE ON FUNCTION public.increment_draft_count(uuid, text) TO authenticated');
SELECT p0r.call('RB-BIND-draft-own', '[grant added] a1 increment_draft_count(a1): allowed', 'ok: rows=1',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$SELECT public.increment_draft_count(%L, '2026-10')$q$, :'a1'),
  format($q$SELECT current_setting('p0.last') || ' rows=' || (SELECT count(*) FROM ai_usage WHERE user_id = %L AND month_year = '2026-10')$q$, :'a1'),
  'GRANT EXECUTE ON FUNCTION public.increment_draft_count(uuid, text) TO authenticated');
SELECT p0r.call('RB-BIND-seed-other', '[grant added] a1 seed_signup_questions(a2): forbidden', 'error:42501 forbidden',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$SELECT public.seed_signup_questions(%L)::text$q$, :'a2'),
  $q$SELECT current_setting('p0.last') || ' ' || current_setting('p0r.msg')$q$,
  'GRANT EXECUTE ON FUNCTION public.seed_signup_questions(uuid) TO authenticated');
SELECT p0r.call('RB-BIND-fit-other', '[grant added] a1 compute_user_fit_scores(a2): forbidden', 'error:42501 forbidden',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$SELECT public.compute_user_fit_scores(%L)$q$, :'a2'),
  $q$SELECT current_setting('p0.last') || ' ' || current_setting('p0r.msg')$q$,
  'GRANT EXECUTE ON FUNCTION public.compute_user_fit_scores(uuid) TO authenticated');
SELECT p0r.call('RB-BIND-fit-own', '[grant added] a1 compute_user_fit_scores(a1): allowed', 'ok:',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$SELECT public.compute_user_fit_scores(%L)$q$, :'a1'), NULL,
  'GRANT EXECUTE ON FUNCTION public.compute_user_fit_scores(uuid) TO authenticated');
SELECT p0r.call('RB-SVC-draft', 'service_role increment_draft_count(a2) twice', 'ok: count=2',
  'authenticator', 'service_role', p0r.jwt('service_role'),
  format($q$SELECT public.increment_draft_count(%L, '2026-10')$q$, :'a2'),
  format($q$SELECT current_setting('p0.last') || ' count=' || (SELECT draft_count FROM ai_usage WHERE user_id = %L AND month_year = '2026-10')$q$, :'a2'),
  format($q$DELETE FROM ai_usage WHERE user_id = %1$L; SELECT public.increment_draft_count(%1$L, '2026-10')$q$, :'a2'));
SELECT p0r.call('RB-SVC-seed', 'service_role seed_signup_questions(a2)', 'ok: signup>0=true',
  'authenticator', 'service_role', p0r.jwt('service_role'),
  format($q$SELECT public.seed_signup_questions(%L)::text$q$, :'a2'),
  format($q$SELECT regexp_replace(current_setting('p0.last'), ':[0-9]+$', ':') || ' signup>0=' || EXISTS (SELECT 1 FROM user_question_unlocks WHERE user_id = %L AND source = 'signup')$q$, :'a2'),
  format($q$DELETE FROM user_question_unlocks WHERE user_id = %L$q$, :'a2'));
SELECT p0r.call('RB-PG-draft', 'postgres increment_draft_count(a2)', 'ok:',
  'postgres', 'postgres', NULL, format($q$SELECT public.increment_draft_count(%L, '2026-10')$q$, :'a2'));

-- ---------- 6. signup and other triggers still fire after the EXECUTE revoke ----------
-- auth.users is written by the auth service in its own session
-- (supabase_auth_admin; emulated here). The three signup triggers run, and
-- seed_signup_questions accepts the trigger call.
DO $r$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
  END IF;
END $r$;
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT SELECT, INSERT ON auth.users TO supabase_auth_admin;
SELECT p0r.call('RB-TRG-signup', 'auth service signup: profile, free subscription, signup unlocks', 'ok:1 profile=1 sub=1 unlocks>0=true',
  'supabase_auth_admin', 'supabase_auth_admin', NULL,
  $q$WITH u AS (INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-00000000e061', 'signup061@example.test') RETURNING 1)
     SELECT count(*)::text FROM u$q$,
  $q$SELECT current_setting('p0.last')
       || ' profile=' || (SELECT count(*) FROM user_profiles WHERE user_id = '00000000-0000-0000-0000-00000000e061')
       || ' sub=' || (SELECT count(*) FROM user_subscriptions WHERE user_id = '00000000-0000-0000-0000-00000000e061')
       || ' unlocks>0=' || EXISTS (SELECT 1 FROM user_question_unlocks WHERE user_id = '00000000-0000-0000-0000-00000000e061' AND source = 'signup')$q$);
SELECT p0r.call('RB-TRG-submission', 'authenticated import_queue insert: award_submission_credits fires', 'ok:1 credit=1',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$WITH i AS (INSERT INTO import_queue (submitted_by) VALUES (%L) RETURNING 1) SELECT count(*)::text FROM i$q$, :'a1'),
  format($q$SELECT current_setting('p0.last') || ' credit=' || (SELECT count(*) FROM credit_events WHERE user_id = %L AND event_type = 'program_submit')$q$, :'a1'));
SELECT p0r.call('RB-TRG-contribution', 'service_role import_queue accept: award_contribution_credits fires', 'ok:1 contributions=1',
  'authenticator', 'service_role', p0r.jwt('service_role'),
  $q$WITH u AS (UPDATE import_queue SET status = 'accepted' WHERE id = '00000000-0000-0000-0000-00000000d061' RETURNING 1) SELECT count(*)::text FROM u$q$,
  format($q$SELECT current_setting('p0.last') || ' contributions=' || (SELECT count(*) FROM user_contributions WHERE user_id = %L)$q$, :'a1'),
  format($q$INSERT INTO import_queue (id, submitted_by) VALUES ('00000000-0000-0000-0000-00000000d061', %L)$q$, :'a1'));
-- 062 B revoked authenticated INSERT on profile_answers (the local-first
-- backstop no longer depends on the flag row), so the trigger is exercised
-- through service_role, and authenticated is refused whatever the flag says.
SELECT p0r.call('RB-TRG-answer-auth', 'local_first off: authenticated profile_answers insert refused by grant (062 B)', 'error:42501 permission denied for table profile_answers',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$WITH i AS (INSERT INTO profile_answers (user_id, archived_question_id) VALUES (%L, (SELECT min(id::text)::uuid FROM archived_questions)) RETURNING 1) SELECT count(*)::text FROM i$q$, :'a1'),
  $q$SELECT current_setting('p0.last') || ' ' || current_setting('p0r.msg')$q$,
  format($q$DELETE FROM profile_answers WHERE user_id = %L$q$, :'a1'));
SELECT p0r.call('RB-TRG-answer', 'service_role first profile_answers insert: award_answer_credits fires', 'ok:1 credit=1',
  'authenticator', 'service_role', p0r.jwt('service_role'),
  format($q$WITH i AS (INSERT INTO profile_answers (user_id, archived_question_id) VALUES (%L, (SELECT min(id::text)::uuid FROM archived_questions)) RETURNING 1) SELECT count(*)::text FROM i$q$, :'a1'),
  format($q$SELECT current_setting('p0.last') || ' credit=' || (SELECT count(*) FROM credit_events WHERE user_id = %L AND event_type = 'answer_first')$q$, :'a1'),
  format($q$DELETE FROM profile_answers WHERE user_id = %L$q$, :'a1'));
SELECT p0r.call('RB-TRG-localfirst', 'local_first on: authenticated profile_answers insert refused (062 B grant first; the 051 policy is the second layer)', 'error:42501 permission denied for table profile_answers',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  format($q$WITH i AS (INSERT INTO profile_answers (user_id, archived_question_id) VALUES (%L, (SELECT min(id::text)::uuid FROM archived_questions)) RETURNING 1) SELECT count(*)::text FROM i$q$, :'a1'),
  $q$SELECT current_setting('p0.last') || ' ' || current_setting('p0r.msg')$q$,
  format($q$DELETE FROM profile_answers WHERE user_id = %L; INSERT INTO _deploy_flags (key, value) VALUES ('local_first', '1')$q$, :'a1'));
SELECT p0r.call('RB-TRG-asked-insert', 'service_role program_questions insert: increment_asked_by_count fires', 'ok:1 asked_by=2',
  'authenticator', 'service_role', p0r.jwt('service_role'),
  $q$WITH i AS (INSERT INTO program_questions (program_id, archived_question_id, asked_as)
                VALUES ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-00000000f061', 'p0r') RETURNING 1)
     SELECT count(*)::text FROM i$q$,
  $q$SELECT current_setting('p0.last') || ' asked_by=' || (SELECT asked_by_count FROM archived_questions WHERE id = '00000000-0000-0000-0000-00000000f061')$q$,
  :'setup_hidden');
SELECT p0r.call('RB-TRG-asked-delete', 'service_role program_questions delete: decrement_asked_by_count fires', 'ok:1 asked_by=1',
  'authenticator', 'service_role', p0r.jwt('service_role'),
  $q$WITH d AS (DELETE FROM program_questions WHERE archived_question_id = '00000000-0000-0000-0000-00000000f061' RETURNING 1)
     SELECT count(*)::text FROM d$q$,
  $q$SELECT current_setting('p0.last') || ' asked_by=' || (SELECT asked_by_count FROM archived_questions WHERE id = '00000000-0000-0000-0000-00000000f061')$q$,
  :'setup_hidden' || $q$; INSERT INTO program_questions (program_id, archived_question_id, asked_as)
                         VALUES ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-00000000f061', 'p0r')$q$);
SELECT p0r.call('RB-TRG-reward', 'service_role approved contribution_rewards insert: process_reward fires', 'ok:1 receipts=1',
  'authenticator', 'service_role', p0r.jwt('service_role'),
  format($q$WITH i AS (INSERT INTO contribution_rewards (user_id, entity_type, action, status, credit_amount)
                       VALUES (%L, 'p0r', 'p0r', 'approved', 5) RETURNING 1) SELECT count(*)::text FROM i$q$, :'a1'),
  format($q$SELECT current_setting('p0.last') || ' receipts=' || (SELECT count(*) FROM reward_credit_receipts WHERE user_id = %L)$q$, :'a1'));
SELECT p0r.call('RB-TRG-aggregate', 'service_role answer_variants insert: refresh_canonical_aggregate fires', 'ok:1 count=1',
  'authenticator', 'service_role', p0r.jwt('service_role'),
  $q$WITH i AS (INSERT INTO answer_variants (canonical_id, content, fidelity_score)
                VALUES ('00000000-0000-0000-0000-00000000c061', 'p0r variant', 0.9) RETURNING 1) SELECT count(*)::text FROM i$q$,
  $q$SELECT current_setting('p0.last') || ' count=' || coalesce((SELECT aggregate_stats->>'count' FROM canonical_commitments WHERE id = '00000000-0000-0000-0000-00000000c061'), '<null>')$q$,
  $q$INSERT INTO canonical_commitments (id, hash, vertical, title) VALUES ('00000000-0000-0000-0000-00000000c061', 'p0r-hash-061', 'founder', 'p0r')$q$);

-- ---------- 7. platform recompute jobs ----------
SELECT p0r.call('RB-JOB-' || f || '-anon', 'anon ' || f || '()', 'error:42501',
  'authenticator', 'anon', p0r.jwt('anon'), format('SELECT public.%I()', f))
  FROM unnest(ARRAY['compute_heat_scores', 'compute_program_dna', 'compute_significance_scores']) f;
SELECT p0r.call('RB-JOB-' || f || '-auth', 'authenticated ' || f || '()', 'error:42501',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'), format('SELECT public.%I()', f))
  FROM unnest(ARRAY['compute_heat_scores', 'compute_program_dna', 'compute_significance_scores']) f;
SELECT p0r.call('RB-JOB-' || f || '-svc', 'service_role ' || f || '()', 'ok:',
  'authenticator', 'service_role', p0r.jwt('service_role'), format('SELECT public.%I()', f))
  FROM unnest(ARRAY['compute_heat_scores', 'compute_program_dna', 'compute_significance_scores']) f;
SELECT p0r.call('RB-CRON-' || j.jobname, 'pg_cron ' || j.jobname || ' command, run as postgres', 'ok:',
  'postgres', 'postgres', NULL, rtrim(j.command, '; '))
  FROM cron.job j WHERE j.jobname IN ('refresh-program-dna', 'refresh-significance-scores');
SELECT p0r.call('RB-JOB-dna-effect', 'compute_program_dna() as service_role rebuilds program_dna', 'ok: rows>0=true',
  'authenticator', 'service_role', p0r.jwt('service_role'), 'SELECT public.compute_program_dna()',
  $q$SELECT current_setting('p0.last') || ' rows>0=' || EXISTS (SELECT 1 FROM program_dna)$q$,
  'DELETE FROM program_dna');

-- ---------- 8. get_top_programs_by_value ----------
-- every program gets a score; the hidden/community/seeded rows score highest
\set setup_rank 'UPDATE programs SET program_value_score = CASE WHEN source = ''canonical'' THEN 10 ELSE 99 END, status = ''open'', domain = ''founder'''
SELECT p0r.call('RB-RANK-anon', 'anon get_top_programs_by_value', 'error:42501',
  'authenticator', 'anon', p0r.jwt('anon'), 'SELECT count(*)::text FROM public.get_top_programs_by_value()');
SELECT p0r.call('RB-RANK-auth', 'authenticated get_top_programs_by_value', 'error:42501',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'), 'SELECT count(*)::text FROM public.get_top_programs_by_value()');
SELECT p0r.call('RB-RANK-svc', 'service_role (MCP) get_top_programs_by_value: approved programs only', 'ok:match',
  'authenticator', 'service_role', p0r.jwt('service_role'),
  $q$WITH r AS (SELECT * FROM public.get_top_programs_by_value(NULL, 'founder', NULL, NULL, 100)),
          a AS (SELECT id FROM programs WHERE (source = 'canonical' OR slug IN ('yc-summer-2026','founding-500','redbud-vc','cyberfund-monastery','3xcapital'))
                  AND program_value_score IS NOT NULL AND domain = 'founder')
     SELECT CASE WHEN (SELECT count(*) FROM r) > 0
                  AND NOT EXISTS (SELECT id FROM r EXCEPT SELECT id FROM a)
                  AND NOT EXISTS (SELECT id FROM a EXCEPT SELECT id FROM r)
                 THEN 'match' ELSE 'mismatch:' || (SELECT count(*) FROM r) || '/' || (SELECT count(*) FROM a) END$q$,
  NULL, :'setup_rank');
SELECT p0r.call('RB-RANK-registry', 'service_role ranking includes a registry slug that is not source=canonical', 'ok:1',
  'authenticator', 'service_role', p0r.jwt('service_role'),
  $q$SELECT count(*)::text FROM public.get_top_programs_by_value(NULL, 'founder', NULL, NULL, 100) WHERE id = '44444444-4444-4444-4444-444444444444'$q$,
  NULL, :'setup_rank' || $q$; UPDATE programs SET slug = 'yc-summer-2026-x' WHERE slug = 'yc-summer-2026';
                          UPDATE programs SET slug = 'yc-summer-2026' WHERE slug = 't-seeded'$q$);
SELECT p0r.call('RB-RANK-postgres', 'postgres get_top_programs_by_value: same filter (no RLS dependence)', 'ok:0',
  'postgres', 'postgres', NULL,
  $q$SELECT count(*)::text FROM public.get_top_programs_by_value(NULL, NULL, NULL, NULL, 100) WHERE slug IN ('t-owned', 't-seeded')$q$,
  NULL, :'setup_rank');

-- ---------- 9. RLS / guard helpers ----------
SELECT p0r.call('RB-HELP-localfirst-anon', 'anon local_first_active()', 'error:42501',
  'authenticator', 'anon', p0r.jwt('anon'), 'SELECT public.local_first_active()::text');
SELECT p0r.call('RB-HELP-localfirst-auth', 'authenticated local_first_active() (051 policies)', 'ok:false',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'), 'SELECT public.local_first_active()::text');
SELECT p0r.call('RB-HELP-canonical-anon', 'anon is_canonical_program()', 'error:42501',
  'authenticator', 'anon', p0r.jwt('anon'), $q$SELECT public.is_canonical_program('44444444-4444-4444-4444-444444444444')::text$q$);
SELECT p0r.call('RB-HELP-canonical-auth', 'authenticated is_canonical_program() (054/058 guard triggers)', 'ok:false',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'), $q$SELECT public.is_canonical_program('44444444-4444-4444-4444-444444444444')::text$q$);
SELECT p0r.call('RB-HELP-guard-auth', 'authenticated owner edits its own program_questions row (054 guard calls is_canonical_program)', 'ok:1',
  'authenticator', 'authenticated', p0r.jwt('authenticated', :'a1'),
  $q$WITH u AS (UPDATE program_questions SET order_index = order_index WHERE program_id = '11111111-1111-1111-1111-111111111111' RETURNING 1) SELECT (count(*) > 0)::int::text FROM u$q$);

-- ---------- 10. SECURITY DEFINER drift guard ----------
-- anon may EXECUTE no SECURITY DEFINER function in public, except entries
-- on this allowlist (signature + reason). Empty as of 061.
DROP TABLE IF EXISTS p0r.anon_definer_allowlist;
CREATE TABLE p0r.anon_definer_allowlist (sig text PRIMARY KEY, reason text NOT NULL);
-- INSERT INTO p0r.anon_definer_allowlist VALUES ('public.f(uuid)', 'why anon needs it');
SELECT p0r.check('RB-ANON-DEFINER', 'SECURITY DEFINER functions in public executable by anon (not allowlisted)', '<none>',
  coalesce((SELECT string_agg(p.oid::regprocedure::text, ',' ORDER BY 1)
              FROM pg_proc p
             WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
               AND has_function_privilege('anon', p.oid, 'EXECUTE')
               AND ('public.' || p.oid::regprocedure::text) NOT IN (SELECT sig FROM p0r.anon_definer_allowlist)
               AND p.oid::regprocedure::text NOT IN (SELECT sig FROM p0r.anon_definer_allowlist)), '<none>'));
SELECT p0r.check('RB-ANON-DEFINER-stale', 'allowlist entries that are no longer anon-executable SECURITY DEFINER functions', '<none>',
  coalesce((SELECT string_agg(a.sig, ',') FROM p0r.anon_definer_allowlist a
             WHERE to_regprocedure(a.sig) IS NULL
                OR NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure(a.sig) AND p.prosecdef
                                AND has_function_privilege('anon', p.oid, 'EXECUTE'))), '<none>'));
SELECT p0r.check('RB-AUTH-DEFINER', 'SECURITY DEFINER functions in public executable by authenticated (exact set)',
  'accept_team_invite(text),claim_starter_package(uuid),is_canonical_program(uuid),local_first_active()',
  (SELECT string_agg(p.oid::regprocedure::text, ',' ORDER BY p.oid::regprocedure::text)
     FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')));
SELECT p0r.check('RB-TRG-attached', 'triggers on the revoked trigger functions are still attached and enabled', '10',
  (SELECT count(*)::text FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE NOT t.tgisinternal AND t.tgenabled <> 'D' AND p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('auto_seed_questions_on_signup', 'award_answer_credits', 'award_contribution_credits',
                        'award_submission_credits', 'create_free_subscription_on_signup', 'create_user_profile_on_signup',
                        'increment_asked_by_count', 'decrement_asked_by_count', 'process_reward', 'refresh_canonical_aggregate')));

-- ---------- 11. catalog shape ----------
SELECT p0r.check('RB-CAT-secdef', 'SECURITY DEFINER only where still needed',
  'claim_starter_package=t compute_heat_scores=t compute_program_dna=t compute_significance_scores=t compute_user_fit_scores=t get_top_programs_by_value=f increment_draft_count=t run_daily_drip=f seed_signup_questions=t',
  (SELECT string_agg(proname || '=' || CASE WHEN prosecdef THEN 't' ELSE 'f' END, ' ' ORDER BY proname)
     FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('claim_starter_package', 'run_daily_drip', 'compute_user_fit_scores', 'increment_draft_count', 'seed_signup_questions', 'compute_heat_scores', 'compute_program_dna', 'compute_significance_scores', 'get_top_programs_by_value')));
SELECT p0r.check('RB-CAT-path', 'search_path pinned (public, extensions, pg_temp; ranking RPC public, pg_temp)', '8/1',
  (SELECT count(*) FILTER (WHERE proname <> 'get_top_programs_by_value' AND proconfig = ARRAY['search_path=public, extensions, pg_temp'])
          || '/' || count(*) FILTER (WHERE proname = 'get_top_programs_by_value' AND proconfig = ARRAY['search_path=public, pg_temp'])
     FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('claim_starter_package', 'run_daily_drip', 'compute_user_fit_scores', 'increment_draft_count', 'seed_signup_questions', 'compute_heat_scores', 'compute_program_dna', 'compute_significance_scores', 'get_top_programs_by_value')));
SELECT p0r.check('RB-CAT-acl', 'EXECUTE grantees per function',
  'claim_starter_package=authenticated,postgres,service_role compute_heat_scores=postgres,service_role compute_program_dna=postgres,service_role compute_significance_scores=postgres,service_role compute_user_fit_scores=postgres,service_role get_top_programs_by_value=postgres,service_role increment_draft_count=postgres,service_role is_canonical_program=authenticated,postgres,service_role local_first_active=authenticated,postgres,service_role run_daily_drip=authenticated,postgres,service_role seed_signup_questions=postgres,service_role',
  (SELECT string_agg(f, ' ' ORDER BY f) FROM (
     SELECT p.proname || '=' || string_agg(CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END, ',' ORDER BY CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END) f
       FROM pg_proc p, aclexplode(p.proacl) a
      WHERE p.pronamespace = 'public'::regnamespace
        AND (p.proname IN ('claim_starter_package', 'run_daily_drip', 'compute_user_fit_scores', 'increment_draft_count', 'seed_signup_questions', 'compute_heat_scores', 'compute_program_dna', 'compute_significance_scores', 'get_top_programs_by_value') OR p.proname IN ('is_canonical_program', 'local_first_active'))
        AND a.privilege_type = 'EXECUTE'
      GROUP BY p.proname) s));
SELECT p0r.check('RB-CAT-trigger-acl', 'trigger functions: EXECUTE for postgres and service_role only', '10',
  (SELECT count(*)::text FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('auto_seed_questions_on_signup', 'award_answer_credits', 'award_contribution_credits',
                        'award_submission_credits', 'create_free_subscription_on_signup', 'create_user_profile_on_signup',
                        'increment_asked_by_count', 'decrement_asked_by_count', 'process_reward', 'refresh_canonical_aggregate')
      AND (SELECT string_agg(CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END, ',' ORDER BY 1)
             FROM aclexplode(p.proacl) a) IN ('postgres,service_role', 'service_role,postgres')));
SELECT p0r.check('RB-CAT-signature', 'signatures and return types unchanged (app / MCP types stay valid)',
  '5aa9b97b073e8dfcffac6949ae9cf9c3',  -- md5 of the production (pre-061) signatures
  (SELECT md5(string_agg(proname || '(' || pg_get_function_arguments(oid) || ')->' || pg_get_function_result(oid), ' ' ORDER BY proname))
     FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('claim_starter_package', 'run_daily_drip', 'compute_user_fit_scores', 'increment_draft_count', 'seed_signup_questions', 'compute_heat_scores', 'compute_program_dna', 'compute_significance_scores', 'get_top_programs_by_value')));

-- report
DO $rep$
DECLARE r record; v_fail int;
BEGIN
  FOR r IN SELECT * FROM p0.results WHERE test_id LIKE 'RB-%' ORDER BY seq LOOP
    RAISE NOTICE '% | % | % | role=% | expected=% observed=% (stmt: %)%',
      CASE WHEN r.pass THEN 'PASS' ELSE 'FAIL' END, r.test_id, r.descr, r.role_used, r.expected, r.observed,
      r.stmt_outcome, CASE WHEN r.pass THEN '' ELSE ' <<<<<<' END;
  END LOOP;
  SELECT count(*) INTO v_fail FROM p0.results WHERE test_id LIKE 'RB-%' AND NOT pass;
  RAISE NOTICE 'phase=% total=% pass=% fail=%', current_setting('p0.phase'),
    (SELECT count(*) FROM p0.results WHERE test_id LIKE 'RB-%'),
    (SELECT count(*) FROM p0.results WHERE test_id LIKE 'RB-%' AND pass), v_fail;
  IF v_fail > 0 THEN RAISE EXCEPTION 'RPC CALLER BINDING TESTS FAILED: %', v_fail; END IF;
END
$rep$;
