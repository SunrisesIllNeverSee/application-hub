-- ============================================================
-- M09 W11 grants suite: role probes vs class expectations
-- ============================================================
-- LOCAL THROWAWAY POSTGRES ONLY. Needs p0/03_harness.sql (p0.results)
-- and m09/grants_lib.sql (schema p0g). Run by full_chain.sh after the
-- whole chain 001 -> 059, in both GRANTS_MODE=default and =revoked.
--
-- For every table, view and sequence in public, and for each API role:
--   GR-<rel>-<role>-<p>  the EFFECTIVE privilege equals the current
--                        baseline (the 059 production baseline tightened
--                        by 062, or 058's own grants for objects 058 adds). FAIL = drift: a
--                        missing grant (42501 for a route) or a new grant.
--   Tables are probed by running EXPLAIN <statement> as the role
--   (ExecutorStart performs the privilege check; nothing executes):
--     r: SELECT *   a: INSERT DEFAULT VALUES
--     w: UPDATE SET <first column> = DEFAULT WHERE false   d: DELETE
--   Views use has_table_privilege, sequences has_sequence_privilege
--   (r=SELECT w=UPDATE U=USAGE).
-- Then each baseline is compared with the class IDEAL from
-- docs/DATA-API-GRANTS.md and every difference is recorded in
-- p0g.findings as KNOWN-EXCESSIVE (granted, class does not need it) or
-- MISSING (class needs it, not granted). Findings are reported, not
-- failures. After 062 no finding is expected (0 excessive, 0 missing); GR-NONCRUD
-- fails if any client role holds TRUNCATE/REFERENCES/TRIGGER/MAINTAIN.
-- GR-E1-* exercise the 062 community_messages sender delete policy.
-- Structural checks: GR-COVER (every relation classified), GR-POLDEP
-- (RLS policy subquery dependencies, actual and ideal), GR-RLS (RLS on
-- every table), GR-DEFACL (059 default privileges), GR-RLS-1.
-- ============================================================

DROP TABLE IF EXISTS p0g.expect;
CREATE TABLE p0g.expect (
  relname text PRIMARY KEY, kind char NOT NULL, class char NOT NULL,
  base_anon text NOT NULL, base_auth text NOT NULL, base_svc text NOT NULL,
  ideal_anon text NOT NULL, ideal_auth text NOT NULL, ideal_svc text NOT NULL,
  note text
);
-- letters: tables/views a=INSERT r=SELECT w=UPDATE d=DELETE; sequences
-- r=SELECT w=UPDATE U=USAGE; '-' none. Base = the CRUD grants after 062
-- (production 2026-10-22 = 059 baseline, tightened by 062). Every base
-- now equals its class ideal.
INSERT INTO p0g.expect VALUES
-- (a) public catalog / reference: anon+auth SELECT, service CRUD
 ('programs','r','a','r','arw','arwd','r','arw','arwd','auth: user-owned community programs (insert/owner update); no delete policy'),
 ('program_questions','r','a','r','arw','arwd','r','arw','arwd','auth: intake links, owner relationship edits'),
 ('archived_questions','r','a','r','arw','arwd','r','arw','arwd','auth: intake inserts, embedding update'),
 ('program_cycles','r','a','r','r','arwd','r','r','arwd',NULL),
 ('program_dna','r','a','r','r','arwd','r','r','arwd',NULL),
 ('program_stats','r','a','r','r','arwd','r','r','arwd',NULL),
 ('funders','r','a','r','r','arwd','r','r','arwd',NULL),
 ('subscription_plans','r','a','r','r','arwd','r','r','arwd','read by increment_ai_usage trigger'),
 ('beta_settings','r','a','r','r','arwd','r','r','arwd',NULL),
 ('starter_packages','r','a','r','r','arwd','r','r','arwd','written only via SECURITY DEFINER claim_starter_package'),
 ('aggregate_versions','r','a','r','r','arwd','r','r','arwd',NULL),
 ('canonical_commitments','r','a','r','r','arwd','r','r','arwd',NULL),
 ('lineage_events','r','a','r','r','arwd','r','r','arwd','public select of canonical lineage only (RLS)'),
 ('program_listings','r','a','r','r','arwd','r','r','arwd','funder write policies exist; no code path'),
 ('seeding_entities','r','a','r','r','arwd','r','r','arwd','owner write policies exist; no code path'),
 ('opportunities','v','a','r','r','r','r','r','r','security_invoker view'),
 ('program_next_cycle','v','a','r','r','r','r','r','r','security_invoker view'),
 ('catalog_entities','r','a','r','r','arwd','r','r','arwd','058'),
 ('catalog_serials','r','a','r','r','arwd','r','r','arwd','058'),
 ('catalog_sources','r','a','-','-','arwd','-','-','arwd','058: column-level SELECT for anon/auth'),
 ('program_template_revisions','r','a','-','-','arwd','-','-','arwd','058: column-level SELECT for anon/auth'),
 ('question_mapping_decisions','r','a','-','-','arwd','-','-','arwd','058: column-level SELECT for anon/auth'),
-- (b) user-owned Data API tables: authenticated only, RLS-scoped
 ('user_profiles','r','b','-','arw','arwd','-','arw','arwd','anon: public-profile RLS policy but no anon code path'),
 ('user_applications','r','b','r','arwd','arwd','r','arwd','arwd','anon SELECT: referenced by the programs/program_questions/archived_questions/program_dna/program_stats read policies (policies run as the caller)'),
 ('user_integrations','r','b','-','arwd','arwd','-','arwd','arwd',NULL),
 ('user_question_unlocks','r','b','-','ar','arwd','-','ar','arwd',NULL),
 ('user_subscriptions','r','b','-','r','arwd','-','r','arwd',NULL),
 ('user_program_fit','r','b','-','r','arwd','-','r','arwd',NULL),
 ('user_achievements','r','b','-','r','arwd','-','r','arwd',NULL),
 ('user_contributions','r','b','-','r','arwd','-','r','arwd','read through user_contribution_summary'),
 ('user_starter_claims','r','b','-','r','arwd','-','r','arwd','claims via SECURITY DEFINER rpc'),
 ('credit_events','r','b','-','r','arwd','-','r','arwd','read through user_credit_balance'),
 ('contribution_rewards','r','b','-','r','arwd','-','r','arwd',NULL),
 ('canonical_user_credits','r','b','-','r','arwd','-','r','arwd',NULL),
 ('reward_credit_receipts','r','b','-','r','arwd','-','r','arwd',NULL),
 ('ai_usage','r','b','-','arw','arwd','-','arw','arwd','auth insert/update via increment_ai_usage trigger'),
 ('community_messages','r','b','-','arwd','arwd','-','arwd','arwd','E1 (OWNER 2026-10-24): sender delete policy cm_sender_delete (062)'),
 ('import_queue','r','b','-','ar','arwd','-','ar','arwd',NULL),
 ('deadline_alerts','r','b','-','r','arwd','-','r','arwd','written by the service cron'),
 ('acceptance_reports','r','b','-','ar','arwd','-','ar','arwd',NULL),
 ('intake_entities','r','b','-','arw','arwd','-','arw','arwd',NULL),
 ('intake_applications','r','b','-','arw','arwd','-','arw','arwd',NULL),
 ('intake_questions','r','b','-','arw','arwd','-','arw','arwd',NULL),
 ('intake_application_layers','r','b','-','arw','arwd','-','arw','arwd',NULL),
 ('intake_events','r','b','-','ar','arwd','-','ar','arwd',NULL),
 ('intake_gate_reviews','r','b','-','ar','arwd','-','ar','arwd',NULL),
 ('user_contribution_summary','v','b','-','r','r','-','r','r','security_invoker view'),
 ('user_credit_balance','v','b','-','r','r','-','r','r','security_invoker view'),
 ('catalog_candidates','r','b','-','r','arwd','-','r','arwd','058: submitter reads own'),
 ('catalog_curators','r','b','-','r','arwd','-','r','arwd','058: curator reads own row'),
 ('catalog_candidate_events','r','b','-','-','arwd','-','-','arwd','058: column-level SELECT for auth'),
 ('intake_applications_ref_seq_seq','S','b','-','U','rwU','-','U','rwU','047 BIGSERIAL; auth inserts need USAGE'),
 ('intake_entities_ref_seq_seq','S','b','-','U','rwU','-','U','rwU',NULL),
 ('intake_questions_ref_seq_seq','S','b','-','U','rwU','-','U','rwU',NULL),
 ('intake_submissions_ref_seq_seq','S','b','-','U','rwU','-','U','rwU',NULL),
  ('aqua_workspaces','r','b','-','arwd','arwd','-','arwd','arwd','hosted-MCP: owner CAS manifest; delete cascades (retention path)'),
 ('aqua_workspace_audit_id_seq','S','b','-','-','rU','-','-','rU','064 identity sequence (no grant needed)'), ('aqua_workspace_records','r','b','-','arwd','arwd','-','arwd','arwd','hosted-MCP: owner file rows; UNIQUE(ws,path); replace/move via commit RPC'), ('aqua_workspace_audit','r','b','-','ar','ar','-','ar','ar','hosted-MCP: append-only audit; no update/delete grants'),
 ('catalog_serial_en_seq','S','c','-','-','rU','-','-','rU','058'),
 ('catalog_serial_ap_seq','S','c','-','-','rU','-','-','rU','058'),
 ('catalog_serial_qu_seq','S','c','-','-','rU','-','-','rU','058'),
 ('catalog_serial_aq_seq','S','c','-','-','rU','-','-','rU','058'),
 ('catalog_candidate_events_id_seq','S','c','-','-','rU','-','-','rU','058 identity'),
-- (c) server-only / internal: service_role only
 ('_deploy_flags','r','c','-','r','arwd','-','r','arwd','051 local-first flag; auth read policy by design'),
 ('recruiter_alerts','r','c','-','-','arwd','-','-','arwd',NULL),
 ('stripe_events','r','c','-','-','arwd','-','-','arwd',NULL),
 ('answer_variants','r','c','r','r','arwd','r','r','arwd','edge functions (service role) only; anon/auth SELECT: referenced by the lineage_events read policy'),
 ('application_packages','r','c','r','r','arwd','r','r','arwd','edge functions (service role) only; anon/auth SELECT: referenced by the lineage_events read policy'),
 ('connected_integrations','r','c','-','-','arwd','-','-','arwd','no code path'),
 ('program_signals','r','c','-','-','arwd','-','-','arwd','anon INSERT policy WITH CHECK (true); no code path'),
-- (d) legacy private-answer tables (local-first-off legacy mode)
 ('profile_answers','r','d','-','r','arwd','-','r','arwd','legacy mode writes; 051 RLS denies while local_first=1'),
 ('profile_answer_history','r','d','-','r','arwd','-','r','arwd',NULL),
 ('answer_reviews','r','d','-','r','arwd','-','r','arwd',NULL),
 ('application_answers','r','d','-','r','arwd','-','r','arwd',NULL),
 ('ai_draft_runs','r','d','-','r','arwd','-','r','arwd',NULL),
 ('intake_submissions','r','d','-','r','arwd','-','r','arwd','raw pasted application text'),
 ('app_import_sessions','r','d','-','r','arwd','-','r','arwd','not covered by 051 deny policies'),
 ('answer_stress_tests','r','d','-','r','arwd','-','r','arwd','062 B2 (after GB1): only the deprecated 1.x hub_stress_test_answer wrote it as authenticated'),
-- (e) teams: deferred, client writes locked by 056/057
 ('teams','r','e','-','r','arwd','-','r','arwd','056/057'),
 ('team_members','r','e','-','r','arwd','-','r','arwd','056/057'),
 ('team_invites','r','e','-','r','arwd','-','r','arwd','056/057; accept via SECURITY DEFINER rpc'),
 -- m10 hosted workspaces (064): class b, owner-scoped ciphertext storage
 ('aqua_workspaces','r','b','-','arwd','arwd','-','arwd','arwd','064 hosted-MCP: owner CAS manifest; delete cascades'),
 ('aqua_workspace_records','r','b','-','arwd','arwd','-','arwd','arwd','064 hosted-MCP: owner file rows; ops via aqua_workspace_commit'),
 ('aqua_workspace_audit','r','b','-','ar','ar','-','ar','ar','064 hosted-MCP: append-only audit; no update/delete'),
 ('aqua_workspace_audit_id_seq','S','b','-','-','rU','-','-','rU','064 identity sequence; explicit service_role grant'),
 ('team_answers','r','e','-','r','arwd','-','r','arwd','056/057');

DROP TABLE IF EXISTS p0g.probe_fallbacks;
CREATE TABLE p0g.probe_fallbacks (role text, relname text, priv text, sqlstate text, message text);
DROP TABLE IF EXISTS p0g.findings;
CREATE TABLE p0g.findings (relname text, class char, role text, priv text, finding text, note text);

-- probe one privilege as a role; true = allowed, false = 42501
CREATE OR REPLACE FUNCTION p0g.probe(p_role text, p_rel text, p_kind char, p_priv char)
RETURNS boolean LANGUAGE plpgsql AS $fn$
DECLARE
  v_sql text; v_col text; v_ok boolean;
  v_name text := CASE p_priv WHEN 'a' THEN 'INSERT' WHEN 'r' THEN 'SELECT' WHEN 'w' THEN 'UPDATE'
                             WHEN 'd' THEN 'DELETE' WHEN 'U' THEN 'USAGE' END;
BEGIN
  IF p_kind = 'S' THEN
    RETURN has_sequence_privilege(p_role, 'public.' || quote_ident(p_rel), v_name);
  ELSIF p_kind = 'v' THEN
    RETURN has_table_privilege(p_role, 'public.' || quote_ident(p_rel), v_name);
  END IF;
  SELECT quote_ident(attname) INTO v_col FROM pg_attribute
   WHERE attrelid = ('public.' || quote_ident(p_rel))::regclass AND attnum > 0 AND NOT attisdropped
   ORDER BY attnum LIMIT 1;
  v_sql := CASE p_priv
    WHEN 'r' THEN format('EXPLAIN SELECT * FROM public.%I', p_rel)
    WHEN 'a' THEN format('EXPLAIN INSERT INTO public.%I DEFAULT VALUES', p_rel)
    WHEN 'w' THEN format('EXPLAIN UPDATE public.%I SET %s = DEFAULT WHERE false', p_rel, v_col)
    WHEN 'd' THEN format('EXPLAIN DELETE FROM public.%I', p_rel) END;
  BEGIN
    EXECUTE format('SET LOCAL ROLE %I', p_role);
    EXECUTE v_sql;
    v_ok := true;
    RAISE EXCEPTION 'probe sentinel' USING ERRCODE = 'P0RBK';
  EXCEPTION
    WHEN SQLSTATE 'P0RBK' THEN NULL;
    WHEN insufficient_privilege THEN v_ok := false;
    -- planning can fail before the privilege check for reasons unrelated
    -- to grants (e.g. the self-referencing team_members RLS policy raises
    -- 42P17 infinite recursion); fall back to the catalog for that probe.
    WHEN OTHERS THEN
      INSERT INTO p0g.probe_fallbacks VALUES (p_role, p_rel, v_name, SQLSTATE, SQLERRM);
      v_ok := NULL;
  END;
  RESET ROLE;
  IF v_ok IS NULL THEN
    RETURN has_table_privilege(p_role, 'public.' || quote_ident(p_rel), v_name);
  END IF;
  -- the probe must agree with the catalog's view of the privilege
  IF v_ok IS DISTINCT FROM has_table_privilege(p_role, 'public.' || quote_ident(p_rel), v_name) THEN
    RAISE EXCEPTION 'probe/catalog disagree: % % %', p_role, p_rel, v_name;
  END IF;
  RETURN v_ok;
END
$fn$;

CREATE OR REPLACE FUNCTION p0g.record(p_id text, p_desc text, p_role text, p_expected text, p_observed text)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO p0.results(test_id, descr, phase, role_used, expected, observed, stmt_outcome, pass)
  VALUES (p_id, p_desc, current_setting('p0.phase'), p_role, p_expected, p_observed, 'probe',
          p_expected IS NOT DISTINCT FROM p_observed)
$$;

DO $suite$
DECLARE
  e record; r text; p text; v_base text; v_ideal text; v_has boolean; v_obs text; v_letters text;
  v_roles text[] := ARRAY['anon','authenticated','service_role'];
BEGIN
  FOR e IN SELECT x.* FROM p0g.expect x WHERE to_regclass('public.' || quote_ident(x.relname)) IS NOT NULL
           ORDER BY x.class, x.relname LOOP
    v_letters := CASE WHEN e.kind = 'S' THEN 'rwU' ELSE 'arwd' END;
    FOREACH r IN ARRAY v_roles LOOP
      v_base  := CASE r WHEN 'anon' THEN e.base_anon  WHEN 'authenticated' THEN e.base_auth  ELSE e.base_svc  END;
      v_ideal := CASE r WHEN 'anon' THEN e.ideal_anon WHEN 'authenticated' THEN e.ideal_auth ELSE e.ideal_svc END;
      FOR i IN 1..length(v_letters) LOOP
        p := substr(v_letters, i, 1);
        v_has := p0g.probe(r, e.relname, e.kind, p::char);
        v_obs := CASE WHEN v_has THEN 'granted' ELSE 'denied' END;
        PERFORM p0g.record('GR-' || e.relname || '-' || r || '-' || p,
          format('(%s) %s %s on %s', e.class, r, p, e.relname), r,
          CASE WHEN strpos(v_base, p) > 0 THEN 'granted' ELSE 'denied' END, v_obs);
        IF v_has AND strpos(v_ideal, p) = 0 THEN
          INSERT INTO p0g.findings VALUES (e.relname, e.class, r, p, 'KNOWN-EXCESSIVE', e.note);
        ELSIF NOT v_has AND strpos(v_ideal, p) > 0 THEN
          INSERT INTO p0g.findings VALUES (e.relname, e.class, r, p, 'MISSING', e.note);
        END IF;
      END LOOP;
      -- non-CRUD table privileges on client roles: never needed by the Data API
      IF e.kind <> 'S' AND r <> 'service_role' THEN
        FOREACH p IN ARRAY ARRAY['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
          IF has_table_privilege(r, 'public.' || quote_ident(e.relname), p) THEN
            INSERT INTO p0g.findings VALUES (e.relname, e.class, r, p, 'KNOWN-EXCESSIVE-NONCRUD', e.note);
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END
$suite$;

-- Column-limited 058 tables: the granted columns are readable (named).
SELECT p0g.record('GR-COL-' || t || '-' || r, 'column SELECT on ' || t, r, 'granted',
  CASE WHEN has_column_privilege(r, 'public.' || t, 'id', 'SELECT') THEN 'granted' ELSE 'denied' END)
FROM (VALUES ('catalog_sources','anon'),('catalog_sources','authenticated'),
             ('program_template_revisions','anon'),('program_template_revisions','authenticated'),
             ('question_mapping_decisions','anon'),('question_mapping_decisions','authenticated'),
             ('catalog_candidate_events','authenticated')) v(t, r);

-- Every relation in public is classified, and every classified relation exists.
SELECT p0g.record('GR-COVER-unclassified', 'relations in public without a class expectation', 'postgres', '<none>',
  coalesce((SELECT string_agg(c.relname, ',' ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m','S','p','f')
               AND c.relname NOT IN (SELECT relname FROM p0g.expect)), '<none>'));
SELECT p0g.record('GR-COVER-absent', 'classified relations missing from the rebuild', 'postgres', '<none>',
  coalesce((SELECT string_agg(relname, ',' ORDER BY relname) FROM p0g.expect
             WHERE to_regclass('public.' || quote_ident(relname)) IS NULL), '<none>'));

-- RLS policy dependencies. A policy's subqueries run with the CALLER's
-- privileges, so a role a policy applies to needs SELECT on every
-- relation the policy references. Otherwise even reading the policy's own
-- table fails with 42501 (e.g. anon reading programs needs SELECT on
-- user_applications). Dependencies come from pg_depend. service_role is
-- skipped (BYPASSRLS). Checked against the ACTUAL grants and against the
-- class IDEAL, so a proposed revoke cannot cut a dependency.
CREATE OR REPLACE VIEW p0g.policy_deps AS
  SELECT DISTINCT t.relname AS policy_table, pol.polname, u.relname AS referenced, r.rolname
  FROM pg_policy pol
  JOIN pg_class t ON t.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
  JOIN pg_depend d ON d.classid = 'pg_policy'::regclass AND d.objid = pol.oid
                  AND d.refclassid = 'pg_class'::regclass AND d.refobjid <> pol.polrelid
  JOIN pg_class u ON u.oid = d.refobjid AND u.relkind IN ('r','v','p')
  JOIN pg_roles r ON r.rolname IN ('anon','authenticated')
                 AND (pol.polroles = '{0}' OR r.oid = ANY (pol.polroles));
SELECT p0g.record('GR-POLDEP-actual', 'policy-referenced relations the caller cannot SELECT (actual grants)', 'postgres', '<none>',
  coalesce((SELECT string_agg(DISTINCT rolname || ':' || policy_table || '->' || referenced, ',')
              FROM p0g.policy_deps
             WHERE NOT has_any_column_privilege(rolname, 'public.' || quote_ident(referenced), 'SELECT')
               -- moot when the role holds nothing on the policy's own table
               AND (has_any_column_privilege(rolname, 'public.' || quote_ident(policy_table), 'SELECT')
                    OR has_table_privilege(rolname, 'public.' || quote_ident(policy_table), 'INSERT, UPDATE, DELETE'))),
           '<none>'));
SELECT p0g.record('GR-POLDEP-ideal', 'policy-referenced relations the class IDEAL would make unreadable', 'postgres', '<none>',
  coalesce((SELECT string_agg(DISTINCT dp.rolname || ':' || dp.policy_table || '->' || dp.referenced, ',')
              FROM p0g.policy_deps dp JOIN p0g.expect e ON e.relname = dp.referenced
              JOIN p0g.expect pt ON pt.relname = dp.policy_table
             WHERE strpos(CASE dp.rolname WHEN 'anon' THEN e.ideal_anon ELSE e.ideal_auth END, 'r') = 0
               -- moot when the ideal gives the role nothing on the policy's own table
               AND (CASE dp.rolname WHEN 'anon' THEN pt.ideal_anon ELSE pt.ideal_auth END <> '-'
                    OR has_any_column_privilege(dp.rolname, 'public.' || quote_ident(dp.policy_table), 'SELECT')
                       AND (CASE dp.rolname WHEN 'anon' THEN pt.base_anon ELSE pt.base_auth END) = '-')
               -- column-limited 058 tables: column grants are the ideal
               AND NOT (CASE dp.rolname WHEN 'anon' THEN e.base_anon ELSE e.base_auth END = '-'
                        AND has_any_column_privilege(dp.rolname, 'public.' || quote_ident(dp.referenced), 'SELECT'))),
           '<none>'));

-- RLS is on for every table in public.
SELECT p0g.record('GR-RLS', 'tables in public without row level security', 'postgres', '<none>',
  coalesce((SELECT string_agg(c.relname, ',' ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity), '<none>'));

-- Before 062 the full-chain P-4f 42501 was RLS (no INSERT policy on
-- profile_answer_history while authenticated held the grant). 062 section B
-- revokes the grant itself, so the refusal no longer depends on a policy.
SELECT p0g.record('GR-RLS-1', 'authenticated INSERT grant on profile_answer_history revoked (062 B; was RLS-only)', 'authenticated',
  'denied', CASE WHEN has_table_privilege('authenticated', 'public.profile_answer_history', 'INSERT') THEN 'granted' ELSE 'denied' END);

-- 059 section 4: postgres' default privileges in public match the new
-- Supabase default (no SELECT/INSERT/UPDATE/DELETE on tables, no
-- USAGE/SELECT on sequences, for any API role).
SELECT p0g.record('GR-DEFACL-' || t, 'default privileges for new ' || t || ' in public (postgres)', 'postgres', 'none',
  coalesce((SELECT string_agg(DISTINCT a.privilege_type, ',' ORDER BY a.privilege_type)
              FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace, aclexplode(d.defaclacl) a
             WHERE n.nspname = 'public' AND d.defaclrole = 'postgres'::regrole AND d.defaclobjtype = o
               AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
               AND a.privilege_type = ANY (CASE o WHEN 'r' THEN ARRAY['SELECT','INSERT','UPDATE','DELETE']
                                                   ELSE ARRAY['USAGE','SELECT'] END)), 'none'))
FROM (VALUES ('tables','r'::"char"),('sequences','S'::"char")) v(t, o);

-- 062 section A: no client role holds a non-CRUD table privilege.
SELECT p0g.record('GR-NONCRUD', 'relations where anon/authenticated hold TRUNCATE/REFERENCES/TRIGGER/MAINTAIN (062 A)', 'postgres', '<none>',
  coalesce((SELECT string_agg(DISTINCT relname, ',' ORDER BY relname) FROM p0g.findings
             WHERE finding = 'KNOWN-EXCESSIVE-NONCRUD'), '<none>'));

-- 062 E1: authors may delete their own community messages, nobody else can.
-- a1 sends to a2; a2 replies to it. Each probe runs in its own rolled-back
-- sub-transaction (p0.test), so the setup is repeated.
\set cm_setup 'INSERT INTO public.community_messages (id, from_user_id, to_user_id, subject, body) VALUES (''e1000000-0000-0000-0000-000000000001'', ''00000000-0000-0000-0000-0000000000a1'', ''00000000-0000-0000-0000-0000000000a2'', ''hi'', ''from a1''), (''e1000000-0000-0000-0000-000000000002'', ''00000000-0000-0000-0000-0000000000a2'', ''00000000-0000-0000-0000-0000000000a1'', ''re: hi'', ''reply from a2'')'
SELECT p0.test('GR-E1-sender', 'a1 deletes own message: deleted', 'EFFECT', 'EFFECT', 'authenticated',
  '00000000-0000-0000-0000-0000000000a1',
  $q$DELETE FROM public.community_messages WHERE id = 'e1000000-0000-0000-0000-000000000001'$q$,
  $q$SELECT p0.effect(current_setting('p0.last') = 'rows=1' AND NOT EXISTS (SELECT 1 FROM public.community_messages WHERE id = 'e1000000-0000-0000-0000-000000000001'))$q$,
  'dml', NULL, :'cm_setup');
SELECT p0.test('GR-E1-reply-kept', 'a1 deletes a message a2 replied to: the reply stays, parent_id becomes NULL', 'EFFECT', 'EFFECT', 'authenticated',
  '00000000-0000-0000-0000-0000000000a1',
  $q$DELETE FROM public.community_messages WHERE id = 'e1000000-0000-0000-0000-000000000001'$q$,
  $q$SELECT p0.effect(EXISTS (SELECT 1 FROM public.community_messages WHERE id = 'e1000000-0000-0000-0000-000000000002' AND parent_id IS NULL))$q$,
  'dml', NULL, :'cm_setup' || '; UPDATE public.community_messages SET parent_id = ''e1000000-0000-0000-0000-000000000001'' WHERE id = ''e1000000-0000-0000-0000-000000000002''');
SELECT p0.test('GR-E1-recipient', 'a2 (recipient) deletes a1''s message: nothing deleted', 'NOEFFECT', 'NOEFFECT', 'authenticated',
  '00000000-0000-0000-0000-0000000000a2',
  $q$DELETE FROM public.community_messages WHERE id = 'e1000000-0000-0000-0000-000000000001'$q$,
  $q$SELECT p0.effect(current_setting('p0.last') <> 'rows=0' OR NOT EXISTS (SELECT 1 FROM public.community_messages WHERE id = 'e1000000-0000-0000-0000-000000000001'))$q$,
  'dml', NULL, :'cm_setup');
SELECT p0.test('GR-E1-anon', 'anon deletes a message: 42501', 'error:42501', 'error:42501', 'anon', NULL,
  $q$DELETE FROM public.community_messages WHERE id = 'e1000000-0000-0000-0000-000000000001'$q$,
  $q$SELECT current_setting('p0.last')$q$,
  'dml', NULL, :'cm_setup');

-- report
DO $rep$
DECLARE r record; v_fail int;
BEGIN
  FOR r IN SELECT * FROM p0.results WHERE test_id LIKE 'GR-%' AND NOT pass ORDER BY seq LOOP
    RAISE NOTICE 'FAIL | % | % | expected=% observed=% <<<<<<', r.test_id, r.descr, r.expected, r.observed;
  END LOOP;
  FOR r IN SELECT finding, class, role, string_agg(DISTINCT priv, '' ORDER BY priv) privs,
                  string_agg(DISTINCT relname, ',' ORDER BY relname) rels, count(DISTINCT relname) n
             FROM p0g.findings WHERE finding <> 'KNOWN-EXCESSIVE-NONCRUD'
            GROUP BY finding, class, role ORDER BY finding, class, role LOOP
    RAISE NOTICE '% | class % | % | % relation(s) | privs % | %', r.finding, r.class, r.role, r.n, r.privs, r.rels;
  END LOOP;
  FOR r IN SELECT relname, sqlstate, min(message) msg, count(*) n FROM p0g.probe_fallbacks GROUP BY 1,2 ORDER BY 1 LOOP
    RAISE NOTICE 'grants: probe fallback to catalog | % | % probe(s) | % %', r.relname, r.n, r.sqlstate, r.msg;
  END LOOP;
  RAISE NOTICE 'KNOWN-EXCESSIVE-NONCRUD | anon/authenticated hold TRUNCATE/REFERENCES/TRIGGER/MAINTAIN on % relation(s)',
    (SELECT count(DISTINCT relname) FROM p0g.findings WHERE finding = 'KNOWN-EXCESSIVE-NONCRUD');
  SELECT count(*) INTO v_fail FROM p0.results WHERE test_id LIKE 'GR-%' AND NOT pass;
  RAISE NOTICE 'grants: probes=% pass=% fail=% | excessive=% missing=%',
    (SELECT count(*) FROM p0.results WHERE test_id LIKE 'GR-%'),
    (SELECT count(*) FROM p0.results WHERE test_id LIKE 'GR-%' AND pass), v_fail,
    (SELECT count(*) FROM p0g.findings WHERE finding = 'KNOWN-EXCESSIVE'),
    (SELECT count(*) FROM p0g.findings WHERE finding = 'MISSING');
  RAISE NOTICE 'phase=% total=% pass=% fail=%', current_setting('p0.phase'),
    (SELECT count(*) FROM p0.results WHERE test_id LIKE 'GR-%'),
    (SELECT count(*) FROM p0.results WHERE test_id LIKE 'GR-%' AND pass), v_fail;
  IF v_fail > 0 THEN RAISE EXCEPTION 'GRANTS TESTS FAILED: %', v_fail; END IF;
END
$rep$;
