-- ============================================================
-- P0 local role-boundary harness: 03 test harness
-- ============================================================
-- LOCAL THROWAWAY POSTGRES ONLY.
-- p0.test() runs ONE statement inside a sub-transaction as a real DB role
-- (SET LOCAL ROLE + request.jwt.claims), optionally after a setup statement
-- run as the superuser, then evaluates a verify query as the superuser and
-- ALWAYS rolls the sub-transaction back, so tests are independent.
--
--   observed = text returned by p_verify (superuser, after the statement)
--   p_verify may read current_setting('p0.last'):
--       'rows=N'          for DML
--       'error:<SQLSTATE>' when the statement raised
--       the scalar text   for p_mode='scalar'
--   PASS when observed = p_pre (phase 'pre') or p_post (phase 'post').
--   An expectation of 'n/a' skips the test in that phase.
-- ============================================================
CREATE SCHEMA IF NOT EXISTS p0;
DROP TABLE IF EXISTS p0.results;
CREATE TABLE p0.results (
  seq serial PRIMARY KEY, test_id text, descr text, phase text, role_used text,
  expected text, observed text, stmt_outcome text, pass boolean
);

DROP TABLE IF EXISTS p0.cursor;
CREATE TABLE p0.cursor (last_seq int NOT NULL);
INSERT INTO p0.cursor VALUES (0);

CREATE OR REPLACE FUNCTION p0.test(
  p_id text, p_desc text, p_pre text, p_post text,
  p_role text, p_uid uuid, p_sql text, p_verify text,
  p_mode text DEFAULT 'dml', p_email text DEFAULT NULL, p_setup text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_phase text := current_setting('p0.phase');
  v_expected text := CASE v_phase WHEN 'pre' THEN p_pre ELSE p_post END;
  v_claims text;
  v_n bigint;
  v_stmt text;
  v_obs text;
BEGIN
  IF v_expected = 'n/a' THEN RETURN; END IF;

  v_claims := CASE
    WHEN p_role IN ('authenticated') THEN
      json_strip_nulls(json_build_object('sub', p_uid, 'role', 'authenticated', 'aud', 'authenticated', 'email', p_email))::text
    WHEN p_role = 'anon' THEN '{"role":"anon"}'
    WHEN p_role = 'service_role' THEN '{"role":"service_role"}'
    ELSE ''
  END;

  BEGIN  -- sub-transaction, always rolled back via sentinel
    IF p_setup IS NOT NULL THEN EXECUTE p_setup; END IF;
    PERFORM set_config('request.jwt.claims', v_claims, true);
    EXECUTE format('SET LOCAL ROLE %I', p_role);
    BEGIN
      IF p_mode = 'scalar' THEN
        EXECUTE p_sql INTO v_stmt;
        v_stmt := coalesce(v_stmt, '<null>');
      ELSE
        EXECUTE p_sql;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_stmt := 'rows=' || v_n;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_stmt := 'error:' || SQLSTATE;
    END;
    RESET ROLE;
    PERFORM set_config('p0.last', v_stmt, true);
    PERFORM set_config('request.jwt.claims', '', true);
    EXECUTE p_verify INTO v_obs;
    RAISE EXCEPTION 'p0 rollback sentinel' USING ERRCODE = 'P0RBK';
  EXCEPTION WHEN SQLSTATE 'P0RBK' THEN
    NULL;
  END;

  INSERT INTO p0.results(test_id, descr, phase, role_used, expected, observed, stmt_outcome, pass)
  VALUES (p_id, p_desc, v_phase, p_role, v_expected, v_obs, v_stmt, v_obs IS NOT DISTINCT FROM v_expected);
END
$fn$;

-- verify-query helpers (superuser context)
CREATE OR REPLACE FUNCTION p0.effect(b boolean) RETURNS text LANGUAGE sql AS $$ SELECT CASE WHEN b THEN 'EFFECT' ELSE 'NOEFFECT' END $$;
CREATE OR REPLACE FUNCTION p0.canon_prog() RETURNS uuid LANGUAGE sql AS
  $$ SELECT id FROM programs WHERE source='canonical' ORDER BY slug LIMIT 1 $$;
CREATE OR REPLACE FUNCTION p0.canon_q() RETURNS uuid LANGUAGE sql AS
  $$ SELECT pq.archived_question_id FROM program_questions pq JOIN programs p ON p.id=pq.program_id
      WHERE p.source='canonical' ORDER BY pq.order_index, pq.id LIMIT 1 $$;
CREATE OR REPLACE FUNCTION p0.report() RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record; v_fail int;
BEGIN
  RAISE NOTICE '--- phase=% ---', current_setting('p0.phase');
  FOR r IN SELECT * FROM p0.results WHERE seq > (SELECT last_seq FROM p0.cursor) ORDER BY seq LOOP
    RAISE NOTICE '% | % | % | role=% | expected=% observed=% (stmt: %) | %',
      CASE WHEN r.pass THEN 'PASS' ELSE 'FAIL' END, r.test_id, r.descr, r.role_used, r.expected, r.observed, r.stmt_outcome,
      CASE WHEN r.pass THEN '' ELSE '<<<<<<' END;
  END LOOP;
  UPDATE p0.cursor SET last_seq = (SELECT coalesce(max(seq),0) FROM p0.results);
  SELECT count(*) INTO v_fail FROM p0.results WHERE phase = current_setting('p0.phase') AND NOT pass;
  RAISE NOTICE 'phase=% total=% pass=% fail=%', current_setting('p0.phase'),
    (SELECT count(*) FROM p0.results WHERE phase=current_setting('p0.phase')),
    (SELECT count(*) FROM p0.results WHERE phase=current_setting('p0.phase') AND pass), v_fail;
  IF v_fail > 0 THEN RAISE EXCEPTION 'P0 TESTS FAILED: % failing in phase %', v_fail, current_setting('p0.phase'); END IF;
END $$;
