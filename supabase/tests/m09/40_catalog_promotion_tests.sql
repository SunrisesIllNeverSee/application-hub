-- ============================================================
-- M09 catalog provenance + promotion tests (058)
-- ============================================================
-- LOCAL THROWAWAY POSTGRES ONLY. Run by supabase/tests/m09/run_local.sh
-- after the p0 fixtures + 054/055/039 + 058 are loaded. Uses the p0.test()
-- harness (each statement runs as a real role in a rolled-back
-- sub-transaction); expectations are in the 'post' column.
-- Actors: a1/a2 ordinary users (a2 = submitter), c1 catalog curator,
--         anon, service_role, postgres. All data synthetic (example.test).
-- ============================================================
\set a1 '00000000-0000-0000-0000-0000000000a1'
\set a2 '00000000-0000-0000-0000-0000000000a2'
\set c1 '00000000-0000-0000-0000-0000000000c1'

-- ---------------- fixtures (superuser, persistent) ----------------
INSERT INTO auth.users (id, aud, role, email, email_confirmed_at)
VALUES ('00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','curator@example.test', now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO catalog_curators (user_id, granted_by, note)
VALUES ('00000000-0000-0000-0000-0000000000c1', NULL, 'local test curator') ON CONFLICT DO NOTHING;

CREATE SCHEMA IF NOT EXISTS p0m;
-- test helpers are invoked by service_role inside p0.test (fixture-only grant)
GRANT USAGE ON SCHEMA p0m TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA p0m GRANT EXECUTE ON FUNCTIONS TO service_role;
-- drive a candidate one step (superuser, persistent)
CREATE OR REPLACE FUNCTION p0m.step(p_c uuid, p_to catalog_candidate_state, p_actor uuid, p_role text,
                                    p_note text DEFAULT NULL, p_evidence jsonb DEFAULT '{}')
RETURNS void LANGUAGE sql AS $$
  INSERT INTO catalog_candidate_events (candidate_id, from_state, to_state, actor, actor_role, note, evidence)
  SELECT p_c, c.state, p_to, p_actor, p_role, p_note, p_evidence FROM catalog_candidates c WHERE c.id = p_c
$$;
-- run one read as a client role; 'ok' or 'error:<SQLSTATE>' (superuser helper)
CREATE OR REPLACE FUNCTION p0m.try_as(p_role text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  BEGIN
    EXECUTE format('SET LOCAL ROLE %I', p_role);
    EXECUTE p_sql INTO v;
    RESET ROLE;
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RETURN 'error:' || SQLSTATE;
  END;
END $$;
CREATE OR REPLACE FUNCTION p0m.to_approved(p_c uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM p0m.step(p_c, 'extracted', NULL, 'system');
  PERFORM p0m.step(p_c, 'matched', '00000000-0000-0000-0000-0000000000c1', 'curator');
  UPDATE catalog_candidates SET checks = '{"all_passed": true}' WHERE id = p_c;
  PERFORM p0m.step(p_c, 'verified', '00000000-0000-0000-0000-0000000000c1', 'curator');
  PERFORM p0m.step(p_c, 'approved', '00000000-0000-0000-0000-0000000000c1', 'curator');
END $$;

-- sources
INSERT INTO catalog_sources (id, url, capture_method, snapshot_text, reuse, verification_status) VALUES
 ('cccccccc-0000-0000-0000-000000000001','https://apply.example.test/spring-2027','public_paste',
  'Test Accelerator Spring 2027. What problem are you solving, and why now? (250 words max) Describe your team. Link to your deck',
  'allowed','verified'),
 ('cccccccc-0000-0000-0000-000000000002','https://other.example.test/form','public_paste','other form text','unknown','unverified')
ON CONFLICT (id) DO NOTHING;

-- K1: a2's candidate (fresh, state candidate)
INSERT INTO catalog_candidates (id, submitted_by, source_id, payload)
VALUES ('dddddddd-0000-0000-0000-000000000001', :'a2', 'cccccccc-0000-0000-0000-000000000002',
        '{"program":{"name":"K1 Program","organization":"K1 Org","kind":"vc"},"questions":[]}')
ON CONFLICT (id) DO NOTHING;
-- K2: a1's candidate
INSERT INTO catalog_candidates (id, submitted_by, source_id, payload)
VALUES ('dddddddd-0000-0000-0000-000000000002', :'a1', 'cccccccc-0000-0000-0000-000000000002',
        '{"program":{"name":"K2 Program","organization":"K2 Org","kind":"vc"},"questions":[]}')
ON CONFLICT (id) DO NOTHING;
-- K3: a2's candidate for a NEW program, driven to approved
INSERT INTO catalog_candidates (id, submitted_by, source_id, payload)
VALUES ('dddddddd-0000-0000-0000-000000000003', :'a2', 'cccccccc-0000-0000-0000-000000000001', $j${
  "program": {"name": "Test Accelerator Spring 2027", "organization": "Test Org", "kind": "accelerator",
              "url": "https://example.test", "apply_url": "https://apply.example.test/spring-2027"},
  "entity": {"name": "Test Org", "website": "https://example.test", "kind": "accelerator"},
  "cycle": {"name": "Spring 2027", "closes_at": "2027-03-01T23:59:00Z", "timezone": "America/Los_Angeles"},
  "eligibility": "Pre-seed companies.",
  "questions": [
    {"asked_as": "What problem are you solving, and why now? (250 words max)", "order_index": 1, "section": "Company",
     "required": true, "word_limit": 250, "response_type": "text_long", "time_context": "now",
     "mapping": {"canonical_question_id": "838aefff-6a28-4bef-81d9-e76bbece8d45", "tier": "semantic", "confidence": 0.82,
                 "rationale": "same underlying ask; adds a why-now qualifier and a 250-word limit"}},
    {"asked_as": "Describe your team.", "order_index": 2, "section": "Team", "required": true, "response_type": "text_long"},
    {"asked_as": "Link to your deck", "order_index": 3, "section": "Materials", "required": false, "response_type": "url"}
  ],
  "source_refs": [{"url": "https://apply.example.test/spring-2027", "kind": "application_form"}]
}$j$)
ON CONFLICT (id) DO NOTHING;
SELECT p0m.to_approved('dddddddd-0000-0000-0000-000000000003')
 WHERE (SELECT state FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000003') = 'candidate';
-- K5: approved, used only for rolled-back refusal tests
INSERT INTO catalog_candidates (id, submitted_by, source_id, payload)
SELECT 'dddddddd-0000-0000-0000-000000000005', :'a2', 'cccccccc-0000-0000-0000-000000000001', payload
  FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000003'
ON CONFLICT (id) DO NOTHING;

-- ---------------- CP-A: client roles cannot write any new table ----------------
DO $d$
DECLARE
  t record; r text; op record;
  uid uuid := '00000000-0000-0000-0000-0000000000a2';
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('catalog_entities',           $s$INSERT INTO catalog_entities (name) VALUES ('forged')$s$),
    ('catalog_sources',            $s$INSERT INTO catalog_sources (url, capture_method) VALUES ('https://forged.example.test','public_paste')$s$),
    ('program_template_revisions', $s$INSERT INTO program_template_revisions (program_id, revision, question_set_sha256) VALUES ((SELECT id FROM programs WHERE slug='yc-summer-2026'), 99, repeat('a',64))$s$),
    ('question_mapping_decisions', $s$INSERT INTO question_mapping_decisions (occurrence_id, canonical_question_id, tier, decision) SELECT id, archived_question_id, 'exact', 'auto_linked' FROM program_questions LIMIT 1$s$),
    ('catalog_serials',            $s$INSERT INTO catalog_serials (serial, kind, target_table, target_id) VALUES ('EN-9999','EN','catalog_entities', gen_random_uuid())$s$),
    ('catalog_curators',           $s$INSERT INTO catalog_curators (user_id) VALUES ('00000000-0000-0000-0000-0000000000a2')$s$),
    ('catalog_candidates',         $s$INSERT INTO catalog_candidates (submitted_by, payload) VALUES ('00000000-0000-0000-0000-0000000000a2', '{}')$s$),
    ('catalog_candidate_events',   $s$INSERT INTO catalog_candidate_events (candidate_id, from_state, to_state, actor_role) VALUES ('dddddddd-0000-0000-0000-000000000001','candidate','extracted','system')$s$)
  ) v(tbl, ins) LOOP
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      PERFORM p0.test('CP-A-'||t.tbl||'-ins-'||r, r||' INSERT into '||t.tbl, 'n/a', 'error:42501', r,
        CASE WHEN r='authenticated' THEN uid END, t.ins, $v$SELECT current_setting('p0.last')$v$);
      PERFORM p0.test('CP-A-'||t.tbl||'-upd-'||r, r||' UPDATE '||t.tbl, 'n/a', 'error:42501', r,
        CASE WHEN r='authenticated' THEN uid END,
        format('UPDATE %I SET %s', t.tbl, CASE t.tbl
          WHEN 'catalog_entities' THEN 'name=name' WHEN 'catalog_sources' THEN 'reuse=''allowed'''
          WHEN 'program_template_revisions' THEN 'revision=revision' WHEN 'question_mapping_decisions' THEN 'tier=''curator'''
          WHEN 'catalog_serials' THEN 'origin=origin' WHEN 'catalog_curators' THEN 'note=''x'''
          WHEN 'catalog_candidates' THEN 'state=''approved''' ELSE 'note=''x''' END),
        $v$SELECT current_setting('p0.last')$v$);
      PERFORM p0.test('CP-A-'||t.tbl||'-del-'||r, r||' DELETE '||t.tbl, 'n/a', 'error:42501', r,
        CASE WHEN r='authenticated' THEN uid END, format('DELETE FROM %I', t.tbl),
        $v$SELECT current_setting('p0.last')$v$);
    END LOOP;
  END LOOP;
END
$d$;

SELECT p0.test('CP-A-guard','policy+grant regression: open INSERT policy on catalog_curators; user self-grants curator',
 'n/a','error:42501','authenticated',:'a2',
 $q$INSERT INTO catalog_curators (user_id) VALUES ('00000000-0000-0000-0000-0000000000a2')$q$,
 $q$SELECT current_setting('p0.last')||coalesce((SELECT ' LEAK' FROM catalog_curators WHERE user_id='00000000-0000-0000-0000-0000000000a2'),'')$q$,
 'dml', NULL,
 $q$GRANT INSERT ON catalog_curators TO authenticated; CREATE POLICY zz_open_ins ON catalog_curators FOR INSERT WITH CHECK (true)$q$);

SELECT p0.test('CP-A-guard2','policy+grant regression: open UPDATE on candidates; submitter self-approves own candidate',
 'n/a','error:42501 state=candidate','authenticated',:'a2',
 $q$UPDATE catalog_candidates SET state='approved' WHERE id='dddddddd-0000-0000-0000-000000000001'$q$,
 $q$SELECT current_setting('p0.last')||' state='||(SELECT state::text FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000001')$q$,
 'dml', NULL,
 $q$GRANT UPDATE ON catalog_candidates TO authenticated; CREATE POLICY zz_open_upd ON catalog_candidates FOR UPDATE USING (true) WITH CHECK (true)$q$);

SELECT p0.test('CP-A-entity','owner attaches a canonical entity to their own non-canonical program',
 'n/a','error:42501','authenticated',:'a1',
 $q$UPDATE programs SET entity_id=(SELECT id FROM catalog_entities LIMIT 1) WHERE id='11111111-1111-1111-1111-111111111111'$q$,
 $q$SELECT current_setting('p0.last')$q$);

SELECT p0.test('CP-A-pqprov','owner sets template_revision_id on own non-canonical occurrence',
 'n/a','error:42501','authenticated',:'a1',
 $q$UPDATE program_questions SET template_revision_id=(SELECT id FROM program_template_revisions LIMIT 1) WHERE id='55555555-5555-5555-5555-555555555555'$q$,
 $q$SELECT current_setting('p0.last')$q$);

SELECT p0.test('CP-A-pqlegit','owner still edits own non-canonical occurrence wording (legit flow intact)',
 'n/a','rows=1','authenticated',:'a1',
 $q$UPDATE program_questions SET asked_as='t-asked-as v2' WHERE id='55555555-5555-5555-5555-555555555555'$q$,
 $q$SELECT current_setting('p0.last')$q$);

-- ---------------- CP-B: read boundary ----------------
SELECT p0.test('CP-B-1','anon reads public provenance for canonical programs (entities/serials/revisions/decisions)',
 'n/a','5/216/5/103','anon',NULL,
 $q$SELECT (SELECT count(*) FROM catalog_entities)||'/'||(SELECT count(*) FROM catalog_serials)||'/'||(SELECT count(*) FROM program_template_revisions)||'/'||(SELECT count(*) FROM question_mapping_decisions)$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar');

SELECT p0.test('CP-B-2','anon cannot read candidates (no grant)',
 'n/a','error:42501','anon',NULL,
 $q$SELECT count(*)::text FROM catalog_candidates$q$, $q$SELECT current_setting('p0.last')$q$, 'scalar');

SELECT p0.test('CP-B-3','submitter a2 sees only own candidates (K1,K3,K5)',
 'n/a','3/0','authenticated',:'a2',
 $q$SELECT (SELECT count(*) FROM catalog_candidates)||'/'||(SELECT count(*) FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000002')$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar');

SELECT p0.test('CP-B-4','submitter a2 sees own candidate events, none of a1''s',
 'n/a','own>0 other=0','authenticated',:'a2',
 $q$SELECT 'own'||CASE WHEN (SELECT count(*) FROM catalog_candidate_events WHERE candidate_id='dddddddd-0000-0000-0000-000000000003')>0 THEN '>0' ELSE '=0' END||' other='||(SELECT count(*) FROM catalog_candidate_events WHERE candidate_id='dddddddd-0000-0000-0000-000000000002')$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar');

SELECT p0.test('CP-B-5','a1 cannot read a2''s unpublished source; a2 can',
 'n/a','0','authenticated',:'a1',
 $q$SELECT count(*)::text FROM catalog_sources WHERE id='cccccccc-0000-0000-0000-000000000001'$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar');
SELECT p0.test('CP-B-5b','a2 reads the source of own candidate',
 'n/a','1','authenticated',:'a2',
 $q$SELECT count(*)::text FROM catalog_sources WHERE id='cccccccc-0000-0000-0000-000000000001'$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar');

SELECT p0.test('CP-B-6','non-canonical provenance stays hidden even from the program owner',
 'n/a','0','authenticated',:'a1',
 $q$SELECT count(*)::text FROM program_template_revisions WHERE program_id='11111111-1111-1111-1111-111111111111'$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar', NULL,
 $q$INSERT INTO program_template_revisions (program_id, revision, question_set_sha256) VALUES ('11111111-1111-1111-1111-111111111111', 1, repeat('b',64))$q$);

SELECT p0.test('CP-B-7','curator row readable only by the curator themself',
 'n/a','c1=1 a2=0','authenticated',:'c1',
 $q$SELECT 'c1='||count(*) FROM catalog_curators$q$,
 $q$SELECT current_setting('p0.last')||' a2='||(SELECT count(*) FROM catalog_curators WHERE user_id='00000000-0000-0000-0000-0000000000a2')$q$, 'scalar');

SELECT p0.test('CP-B-8','public provenance hides snapshot text and curator ids (column grants)',
 'n/a','snapshot=error:42501 published_by=error:42501 decided_by=error:42501 sha=ok','anon',NULL,
 $q$SELECT 'x'$q$,
 $q$SELECT 'snapshot='||p0m.try_as('anon','SELECT snapshot_text FROM catalog_sources LIMIT 1')
        ||' published_by='||p0m.try_as('anon','SELECT published_by::text FROM program_template_revisions LIMIT 1')
        ||' decided_by='||p0m.try_as('anon','SELECT decided_by::text FROM question_mapping_decisions LIMIT 1')
        ||' sha='||p0m.try_as('anon','SELECT question_set_sha256 FROM program_template_revisions LIMIT 1')$q$, 'scalar');

-- ---------------- CP-C: lifecycle / transitions ----------------
SELECT p0.test('CP-C-1','skip a step: candidate -> matched is illegal',
 'n/a','error:23514','service_role',NULL,
 $q$SELECT p0m.step('dddddddd-0000-0000-0000-000000000001','matched','00000000-0000-0000-0000-0000000000c1','curator')$q$,
 $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-C-2','candidate -> published is illegal',
 'n/a','error:23514','service_role',NULL,
 $q$SELECT p0m.step('dddddddd-0000-0000-0000-000000000001','published','00000000-0000-0000-0000-0000000000c1','curator')$q$,
 $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-C-3','candidate -> extracted by system is legal; state follows the event',
 'n/a','extracted','service_role',NULL,
 $q$SELECT p0m.step('dddddddd-0000-0000-0000-000000000001','extracted',NULL,'system')$q$,
 $q$SELECT state::text FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000001'$q$);
SELECT p0.test('CP-C-4','matched requires a curator (system refused)',
 'n/a','error:42501','service_role',NULL,
 $q$DO $x$ BEGIN PERFORM p0m.step('dddddddd-0000-0000-0000-000000000001','extracted',NULL,'system');
                 PERFORM p0m.step('dddddddd-0000-0000-0000-000000000001','matched',NULL,'system'); END $x$$q$,
 $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-C-5','curator role claimed by a non-curator is refused',
 'n/a','error:42501','service_role',NULL,
 $q$DO $x$ BEGIN PERFORM p0m.step('dddddddd-0000-0000-0000-000000000001','extracted',NULL,'system');
                 PERFORM p0m.step('dddddddd-0000-0000-0000-000000000001','matched','00000000-0000-0000-0000-0000000000a2','curator'); END $x$$q$,
 $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-C-6','direct state UPDATE without an event is refused (even service_role)',
 'n/a','error:42501','service_role',NULL,
 $q$UPDATE catalog_candidates SET state='approved' WHERE id='dddddddd-0000-0000-0000-000000000001'$q$,
 $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-C-7','verified without passing checks and without override is refused',
 'n/a','error:23514','service_role',NULL,
 $q$DO $x$ BEGIN PERFORM p0m.step('dddddddd-0000-0000-0000-000000000001','extracted',NULL,'system');
                 PERFORM p0m.step('dddddddd-0000-0000-0000-000000000001','matched','00000000-0000-0000-0000-0000000000c1','curator');
                 PERFORM p0m.step('dddddddd-0000-0000-0000-000000000001','verified','00000000-0000-0000-0000-0000000000c1','curator'); END $x$$q$,
 $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-C-8','verified with curator override note is accepted',
 'n/a','verified','service_role',NULL,
 $q$DO $x$ BEGIN PERFORM p0m.step('dddddddd-0000-0000-0000-000000000001','extracted',NULL,'system');
                 PERFORM p0m.step('dddddddd-0000-0000-0000-000000000001','matched','00000000-0000-0000-0000-0000000000c1','curator');
                 PERFORM p0m.step('dddddddd-0000-0000-0000-000000000001','verified','00000000-0000-0000-0000-0000000000c1','curator',
                                  'override: reuse confirmed with program staff', '{"override": true}'); END $x$$q$,
 $q$SELECT state::text FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000001'$q$);
SELECT p0.test('CP-C-9','curator cannot withdraw (submitter only)',
 'n/a','error:42501','service_role',NULL,
 $q$SELECT p0m.step('dddddddd-0000-0000-0000-000000000001','withdrawn','00000000-0000-0000-0000-0000000000c1','curator')$q$,
 $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-C-10','submitter withdraws own candidate',
 'n/a','withdrawn','service_role',NULL,
 $q$SELECT p0m.step('dddddddd-0000-0000-0000-000000000001','withdrawn','00000000-0000-0000-0000-0000000000a2','submitter')$q$,
 $q$SELECT state::text FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000001'$q$);
SELECT p0.test('CP-C-11','another user cannot withdraw as submitter',
 'n/a','error:42501','service_role',NULL,
 $q$SELECT p0m.step('dddddddd-0000-0000-0000-000000000001','withdrawn','00000000-0000-0000-0000-0000000000a1','submitter')$q$,
 $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-C-12','terminal state: rejected -> extracted is illegal',
 'n/a','error:23514','service_role',NULL,
 $q$DO $x$ BEGIN PERFORM p0m.step('dddddddd-0000-0000-0000-000000000001','rejected','00000000-0000-0000-0000-0000000000c1','curator');
                 INSERT INTO catalog_candidate_events (candidate_id, from_state, to_state, actor_role)
                 VALUES ('dddddddd-0000-0000-0000-000000000001','rejected','extracted','system'); END $x$$q$,
 $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-C-13','stale from_state is refused',
 'n/a','error:40001','service_role',NULL,
 $q$INSERT INTO catalog_candidate_events (candidate_id, from_state, to_state, actor, actor_role)
      VALUES ('dddddddd-0000-0000-0000-000000000001','matched','verified','00000000-0000-0000-0000-0000000000c1','curator')$q$,
 $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-C-14','approved -> published by a bare event (bypassing publish) is refused',
 'n/a','error:42501','service_role',NULL,
 $q$SELECT p0m.step('dddddddd-0000-0000-0000-000000000005','published','00000000-0000-0000-0000-0000000000c1','curator')$q$,
 $q$SELECT current_setting('p0.last')$q$,
 'dml', NULL, $q$SELECT p0m.to_approved('dddddddd-0000-0000-0000-000000000005')$q$);
SELECT p0.test('CP-C-15','payload frozen once verified',
 'n/a','error:42501','service_role',NULL,
 $q$UPDATE catalog_candidates SET payload='{"program":{}}' WHERE id='dddddddd-0000-0000-0000-000000000003'$q$,
 $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-C-16','candidates are never deleted',
 'n/a','error:42501','service_role',NULL,
 $q$DELETE FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000002'$q$,
 $q$SELECT current_setting('p0.last')$q$);

-- ---------------- CP-D: append-only history ----------------
SELECT p0.test('CP-D-1','events immutable: UPDATE refused (service_role)',
 'n/a','error:42501','service_role',NULL,
 $q$UPDATE catalog_candidate_events SET note='rewritten'$q$, $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-D-2','events immutable: DELETE refused (service_role)',
 'n/a','error:42501','service_role',NULL,
 $q$DELETE FROM catalog_candidate_events$q$, $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-D-3','events immutable: UPDATE refused even for postgres',
 'n/a','error:42501','postgres',NULL,
 $q$UPDATE catalog_candidate_events SET note='rewritten'$q$, $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-D-4','events: TRUNCATE refused even for postgres',
 'n/a','error:42501','postgres',NULL,
 $q$TRUNCATE catalog_candidate_events CASCADE$q$, $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-D-5','serials immutable (service_role UPDATE)',
 'n/a','error:42501','service_role',NULL,
 $q$UPDATE catalog_serials SET target_id=gen_random_uuid() WHERE serial='EN-yc'$q$, $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-D-6','mapping decisions immutable (service_role DELETE)',
 'n/a','error:42501','service_role',NULL,
 $q$DELETE FROM question_mapping_decisions$q$, $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-D-7','source evidence immutable (service_role rewrites snapshot)',
 'n/a','error:42501','service_role',NULL,
 $q$UPDATE catalog_sources SET snapshot_text='tampered' WHERE id='cccccccc-0000-0000-0000-000000000001'$q$, $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-D-8','source sha256 is computed from the snapshot, not trusted from the caller',
 'n/a','true','service_role',NULL,
 $q$INSERT INTO catalog_sources (id, url, capture_method, snapshot_text, content_sha256)
      VALUES ('cccccccc-0000-0000-0000-0000000000ff','https://x.example.test','public_paste','abc', repeat('0',64))$q$,
 $q$SELECT (content_sha256 = encode(sha256('abc'::bytea),'hex'))::text FROM catalog_sources WHERE id='cccccccc-0000-0000-0000-0000000000ff'$q$);

-- ---------------- CP-E: publish refusals ----------------
SELECT p0.test('CP-E-1','authenticated cannot EXECUTE catalog_publish_candidate',
 'n/a','error:42501','authenticated',:'c1',
 $q$SELECT catalog_publish_candidate('dddddddd-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1')::text$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar');
SELECT p0.test('CP-E-2','anon cannot EXECUTE catalog_publish_candidate',
 'n/a','error:42501','anon',NULL,
 $q$SELECT catalog_publish_candidate('dddddddd-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1')::text$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar');
SELECT p0.test('CP-E-3','service_role publish with a non-curator curator_id is refused',
 'n/a','error:42501 state=approved','service_role',NULL,
 $q$SELECT catalog_publish_candidate('dddddddd-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a2')::text$q$,
 $q$SELECT current_setting('p0.last')||' state='||(SELECT state::text FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000003')$q$, 'scalar');
SELECT p0.test('CP-E-4','publish of a non-approved candidate is refused',
 'n/a','error:55000','service_role',NULL,
 $q$SELECT catalog_publish_candidate('dddddddd-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1')::text$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar');
SELECT p0.test('CP-E-5','publish refused when source reuse is disallowed',
 'n/a','error:23514','service_role',NULL,
 $q$SELECT catalog_publish_candidate('dddddddd-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1')::text$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar', NULL,
 $q$SELECT p0m.to_approved('dddddddd-0000-0000-0000-000000000005'); UPDATE catalog_sources SET reuse='disallowed' WHERE id='cccccccc-0000-0000-0000-000000000001'$q$);

-- ---------------- CP-F: publish succeeds (rolled back, as service_role) ----------------
SELECT p0.test('CP-F-1','curator publish creates canonical program + entity + cycle + occurrences + revision + serials + decisions + event',
 'n/a','src=canonical ent=Test Org cyc=Spring 2027 occ=3 exact=true rev=1 aqser=3 aq>0103=true qu>0142=true dec=3 tiers=new_canonical,new_canonical,confirmed st=published apser=true enser=true',
 'service_role',NULL,
 $q$SELECT catalog_publish_candidate('dddddddd-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1')::text$q$,
 $q$WITH p AS (SELECT * FROM programs WHERE name='Test Accelerator Spring 2027')
    SELECT 'src='||p.source||' ent='||(SELECT name FROM catalog_entities e WHERE e.id=p.entity_id)
      ||' cyc='||(SELECT cycle_name FROM program_cycles c WHERE c.program_id=p.id)
      ||' occ='||(SELECT count(*) FROM program_questions q WHERE q.program_id=p.id)
      ||' exact='||(SELECT bool_and(asked_as IN ('What problem are you solving, and why now? (250 words max)','Describe your team.','Link to your deck')) FROM program_questions q WHERE q.program_id=p.id)
      ||' rev='||(SELECT string_agg(revision::text, ',') FROM program_template_revisions r WHERE r.program_id=p.id)
      ||' aqser='||(SELECT count(*) FROM catalog_serials s JOIN program_questions q ON q.id=s.target_id WHERE s.kind='AQ' AND q.program_id=p.id)
      ||' aq>0103='||(SELECT bool_and(substr(serial,4)::int > 103) FROM catalog_serials s JOIN program_questions q ON q.id=s.target_id WHERE s.kind='AQ' AND q.program_id=p.id)
      ||' qu>0142='||(SELECT bool_and(substr(serial,4)::int > 142) FROM catalog_serials s JOIN program_questions q ON q.archived_question_id=s.target_id WHERE s.kind='QU' AND q.program_id=p.id AND s.origin='assigned')
      ||' dec='||(SELECT count(*) FROM question_mapping_decisions d JOIN program_questions q ON q.id=d.occurrence_id WHERE q.program_id=p.id)
      ||' tiers='||(SELECT string_agg(decision, ',' ORDER BY decision DESC) FROM question_mapping_decisions d JOIN program_questions q ON q.id=d.occurrence_id WHERE q.program_id=p.id)
      ||' st='||(SELECT state FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000003')
      ||' apser='||EXISTS (SELECT 1 FROM catalog_serials s WHERE s.kind='AP' AND s.target_id=p.id)
      ||' enser='||EXISTS (SELECT 1 FROM catalog_serials s WHERE s.kind='EN' AND s.target_id=p.entity_id)
    FROM p$q$, 'scalar');

-- persistent publish of K3 (as service_role) for the history tests below
BEGIN;
SET LOCAL ROLE service_role;
SELECT catalog_publish_candidate('dddddddd-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1')
 WHERE (SELECT state FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000003') = 'approved';
COMMIT;

SELECT p0.test('CP-F-2','anon reads the newly published program, its exact questions and its provenance',
 'n/a','prog=1 occ=3 rev=1 src=1 ser>=6','anon',NULL,
 $q$SELECT 'prog='||(SELECT count(*) FROM programs WHERE name='Test Accelerator Spring 2027')
       ||' occ='||(SELECT count(*) FROM program_questions q JOIN programs p ON p.id=q.program_id WHERE p.name='Test Accelerator Spring 2027')
       ||' rev='||(SELECT count(*) FROM program_template_revisions r JOIN programs p ON p.id=r.program_id WHERE p.name='Test Accelerator Spring 2027')
       ||' src='||(SELECT count(*) FROM catalog_sources WHERE id='cccccccc-0000-0000-0000-000000000001')
       ||' ser'||CASE WHEN (SELECT count(*) FROM catalog_serials)>=216+6 THEN '>=6' ELSE '<6' END$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar');

SELECT p0.test('CP-F-3','a later canonical text change does not alter the occurrence''s asked_as',
 'n/a','What problem are you solving, and why now? (250 words max)','service_role',NULL,
 $q$UPDATE archived_questions SET text='Rewritten canonical paraphrase' WHERE id='838aefff-6a28-4bef-81d9-e76bbece8d45'$q$,
 $q$SELECT q.asked_as FROM program_questions q JOIN programs p ON p.id=q.program_id
     WHERE p.name='Test Accelerator Spring 2027' AND q.archived_question_id='838aefff-6a28-4bef-81d9-e76bbece8d45'$q$);

SELECT p0.test('CP-F-4','published occurrence wording cannot be rewritten in place (service_role)',
 'n/a','error:42501','service_role',NULL,
 $q$UPDATE program_questions q SET asked_as='rewritten' FROM programs p WHERE p.id=q.program_id AND p.name='Test Accelerator Spring 2027'$q$,
 $q$SELECT current_setting('p0.last')$q$);

SELECT p0.test('CP-F-5','legacy 053 canonical occurrence wording cannot be rewritten in place (service_role)',
 'n/a','error:42501','service_role',NULL,
 $q$UPDATE program_questions SET asked_as='rewritten' WHERE program_id=(SELECT id FROM programs WHERE slug='yc-summer-2026')$q$,
 $q$SELECT current_setting('p0.last')$q$);

SELECT p0.test('CP-F-6','published candidate is terminal (no re-publish)',
 'n/a','error:55000','service_role',NULL,
 $q$SELECT catalog_publish_candidate('dddddddd-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1')::text$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar');

-- ---------------- CP-G: second revision preserves the first ----------------
-- K4: revision 2 of the K3 program: Q1 identical (carried), Q2 reworded (same
-- canonical), Q3 removed, Q4 new.
INSERT INTO catalog_candidates (id, submitted_by, source_id, payload, program_match_id)
SELECT 'dddddddd-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000a2', 'cccccccc-0000-0000-0000-000000000001',
  jsonb_build_object(
    'program', jsonb_build_object('name','Test Accelerator Spring 2027','organization','Test Org','kind','accelerator',
                                  'apply_url','https://apply.example.test/spring-2027'),
    'cycle', jsonb_build_object('name','Fall 2027','closes_at','2027-09-01T23:59:00Z','timezone','America/Los_Angeles'),
    'questions', jsonb_build_array(
      (SELECT payload->'questions'->0 FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000003'),
      jsonb_build_object('asked_as','Describe your team and how you met.','order_index',2,'section','Team','required',true,
                         'response_type','text_long',
                         'mapping', jsonb_build_object('canonical_question_id',
                            (SELECT q.archived_question_id FROM program_questions q WHERE q.program_id=p.id AND q.asked_as='Describe your team.'),
                            'tier','curator','rationale','reworded in Fall 2027 form')),
      jsonb_build_object('asked_as','What is your biggest risk?','order_index',3,'section','Risk','required',true,'response_type','text_long'))),
  p.id
FROM programs p WHERE p.name='Test Accelerator Spring 2027'
ON CONFLICT (id) DO NOTHING;
SELECT p0m.to_approved('dddddddd-0000-0000-0000-000000000004')
 WHERE (SELECT state FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000004') = 'candidate';
BEGIN;
SET LOCAL ROLE service_role;
SELECT catalog_publish_candidate('dddddddd-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1')
 WHERE (SELECT state FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000004') = 'approved';
COMMIT;

SELECT p0.test('CP-G-1','revision 2 supersedes revision 1; rev-1 occurrences preserved verbatim',
 'n/a','revs=1,2 supersedes=true total=5 active=3 carried=1 retired=2 rev1_text_intact=true new_in_rev2=2 cycles=2',
 'postgres',NULL, $q$SELECT 'x'$q$,
 $q$WITH p AS (SELECT id FROM programs WHERE name='Test Accelerator Spring 2027'),
         r1 AS (SELECT r.id FROM program_template_revisions r, p WHERE r.program_id=p.id AND r.revision=1),
         r2 AS (SELECT r.id, r.supersedes_id FROM program_template_revisions r, p WHERE r.program_id=p.id AND r.revision=2)
    SELECT 'revs='||(SELECT string_agg(revision::text, ',' ORDER BY revision) FROM program_template_revisions r, p WHERE r.program_id=p.id)
      ||' supersedes='||((SELECT supersedes_id FROM r2) = (SELECT id FROM r1))
      ||' total='||(SELECT count(*) FROM program_questions q, p WHERE q.program_id=p.id)
      ||' active='||(SELECT count(*) FROM program_questions q, p WHERE q.program_id=p.id AND q.superseded_by_revision_id IS NULL)
      ||' carried='||(SELECT count(*) FROM program_questions q, p WHERE q.program_id=p.id AND q.superseded_by_revision_id IS NULL AND q.template_revision_id=(SELECT id FROM r1))
      ||' retired='||(SELECT count(*) FROM program_questions q, p WHERE q.program_id=p.id AND q.superseded_by_revision_id=(SELECT id FROM r2))
      ||' rev1_text_intact='||(SELECT array_agg(asked_as ORDER BY order_index) = ARRAY['What problem are you solving, and why now? (250 words max)','Describe your team.','Link to your deck']
                                FROM program_questions q WHERE q.template_revision_id=(SELECT id FROM r1))
      ||' new_in_rev2='||(SELECT count(*) FROM program_questions q WHERE q.template_revision_id=(SELECT id FROM r2))
      ||' cycles='||(SELECT count(*) FROM program_cycles c, p WHERE c.program_id=p.id)$q$,
 'scalar');

SELECT p0.test('CP-G-2','reworded occurrence keeps the canonical link; mapping history appended (5 decisions)',
 'n/a','same_canonical=true decisions=5 aq_serials=5','postgres',NULL, $q$SELECT 'x'$q$,
 $q$WITH p AS (SELECT id FROM programs WHERE name='Test Accelerator Spring 2027')
    SELECT 'same_canonical='||((SELECT archived_question_id FROM program_questions q, p WHERE q.program_id=p.id AND asked_as='Describe your team.')
                              =(SELECT archived_question_id FROM program_questions q, p WHERE q.program_id=p.id AND asked_as='Describe your team and how you met.'))
      ||' decisions='||(SELECT count(*) FROM question_mapping_decisions d JOIN program_questions q ON q.id=d.occurrence_id, p WHERE q.program_id=p.id)
      ||' aq_serials='||(SELECT count(*) FROM catalog_serials s JOIN program_questions q ON q.id=s.target_id, p WHERE s.kind='AQ' AND q.program_id=p.id)$q$,
 'scalar');

SELECT p0.test('CP-G-3','a superseded occurrence cannot be reactivated (service_role)',
 'n/a','error:42501','service_role',NULL,
 $q$UPDATE program_questions SET superseded_by_revision_id=NULL WHERE asked_as='Describe your team.'$q$,
 $q$SELECT current_setting('p0.last')$q$);

SELECT p0.test('CP-G-4','active-occurrence uniqueness still holds (duplicate active canonical link refused)',
 'n/a','error:23505','service_role',NULL,
 $q$INSERT INTO program_questions (program_id, archived_question_id, asked_as)
      SELECT q.program_id, q.archived_question_id, 'dup' FROM program_questions q
       WHERE q.asked_as='Describe your team and how you met.'$q$,
 $q$SELECT current_setting('p0.last')$q$);

-- ---------------- CP-I: atomic review transition RPC (catalog_transition_candidate) ----------------
-- K6: submitted BY the curator (self-approval case)
INSERT INTO catalog_candidates (id, submitted_by, source_id, payload)
SELECT 'dddddddd-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000c1', 'cccccccc-0000-0000-0000-000000000002', payload
  FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000003'
ON CONFLICT (id) DO NOTHING;

SELECT p0.test('CP-I-1','failure after writes leaves nothing behind: source review + payload patch + checks, then verified refused by the event rule',
 'n/a','error:23514 state=matched reuse=unknown patched=false checks={}','service_role',NULL,
 $q$SELECT catalog_transition_candidate(
      candidate_id => 'dddddddd-0000-0000-0000-000000000001', to_state => 'verified',
      actor_id => '00000000-0000-0000-0000-0000000000c1', actor_role => 'curator',
      checks => '{"all_passed": false}', payload_patch => '{"eligibility": "patched"}',
      source_review => '{"reuse": "allowed"}')::text$q$,
 $q$SELECT current_setting('p0.last')||' state='||c.state||' reuse='||s.reuse||' patched='||(c.payload ? 'eligibility')::text||' checks='||c.checks::text
      FROM catalog_candidates c JOIN catalog_sources s ON s.id=c.source_id WHERE c.id='dddddddd-0000-0000-0000-000000000001'$q$,
 'scalar', NULL,
 $q$SELECT p0m.step('dddddddd-0000-0000-0000-000000000001','extracted',NULL,'system'); SELECT p0m.step('dddddddd-0000-0000-0000-000000000001','matched','00000000-0000-0000-0000-0000000000c1','curator')$q$);

SELECT p0.test('CP-I-2','payload patch on a verified candidate is refused and the source review in the same call is rolled back',
 'n/a','error:42501 reuse=allowed','service_role',NULL,
 $q$SELECT catalog_transition_candidate(candidate_id => 'dddddddd-0000-0000-0000-000000000005', to_state => 'approved',
      actor_id => '00000000-0000-0000-0000-0000000000c1', actor_role => 'curator',
      payload_patch => '{"eligibility": "late edit"}', source_review => '{"reuse": "disallowed"}')::text$q$,
 $q$SELECT current_setting('p0.last')||' reuse='||(SELECT reuse FROM catalog_sources WHERE id='cccccccc-0000-0000-0000-000000000001')$q$,
 'scalar', NULL,
 $q$SELECT p0m.step('dddddddd-0000-0000-0000-000000000005','extracted',NULL,'system'); SELECT p0m.step('dddddddd-0000-0000-0000-000000000005','matched','00000000-0000-0000-0000-0000000000c1','curator');
    UPDATE catalog_candidates SET checks='{"all_passed": true}' WHERE id='dddddddd-0000-0000-0000-000000000005';
    SELECT p0m.step('dddddddd-0000-0000-0000-000000000005','verified','00000000-0000-0000-0000-0000000000c1','curator')$q$);

SELECT p0.test('CP-I-3','non-curator actor is refused before any write',
 'n/a','error:42501','service_role',NULL,
 $q$SELECT catalog_transition_candidate(candidate_id => 'dddddddd-0000-0000-0000-000000000001', to_state => 'rejected',
      actor_id => '00000000-0000-0000-0000-0000000000a2', actor_role => 'curator', note => 'nope')::text$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar');

SELECT p0.test('CP-I-4','illegal transition refused (candidate -> approved)',
 'n/a','error:23514','service_role',NULL,
 $q$SELECT catalog_transition_candidate(candidate_id => 'dddddddd-0000-0000-0000-000000000001', to_state => 'approved',
      actor_id => '00000000-0000-0000-0000-0000000000c1', actor_role => 'curator')::text$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar');

SELECT p0.test('CP-I-5','publish cannot go through the transition RPC',
 'n/a','error:42501','service_role',NULL,
 $q$SELECT catalog_transition_candidate(candidate_id => 'dddddddd-0000-0000-0000-000000000005', to_state => 'published',
      actor_id => '00000000-0000-0000-0000-0000000000c1', actor_role => 'curator')::text$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar', NULL, $q$SELECT p0m.to_approved('dddddddd-0000-0000-0000-000000000005')$q$);

SELECT p0.test('CP-I-6','success: extracted -> matched with mapping override + checks, all in one call',
 'n/a','matched map=semantic:838aefff checks=true events+1 self=false','service_role',NULL,
 $q$SELECT catalog_transition_candidate(candidate_id => 'dddddddd-0000-0000-0000-000000000001', to_state => 'matched',
      actor_id => '00000000-0000-0000-0000-0000000000c1', actor_role => 'curator',
      checks => '{"all_passed": true}',
      payload_patch => '{"questions": [{"asked_as": "Q one?", "order_index": 1}]}',
      mappings => '[{"index": 0, "canonical_question_id": "838AEFFF-6a28-4bef-81d9-e76bbece8d45", "tier": "semantic"}]')->>'self_approved'$q$,
 $q$SELECT c.state||' map='||(c.payload->'questions'->0->'mapping'->>'tier')||':'||left(c.payload->'questions'->0->'mapping'->>'canonical_question_id',8)
          ||' checks='||(c.checks->>'all_passed')||' events+'||((SELECT count(*) FROM catalog_candidate_events e WHERE e.candidate_id=c.id)-2)
          ||' self='||current_setting('p0.last')
      FROM catalog_candidates c WHERE c.id='dddddddd-0000-0000-0000-000000000001'$q$,
 'scalar', NULL, $q$SELECT p0m.step('dddddddd-0000-0000-0000-000000000001','extracted',NULL,'system')$q$);

SELECT p0.test('CP-I-7','unknown canonical id in mappings: refused, payload untouched',
 'n/a','error:23503 mapped=false','service_role',NULL,
 $q$SELECT catalog_transition_candidate(candidate_id => 'dddddddd-0000-0000-0000-000000000001', to_state => 'rejected',
      actor_id => '00000000-0000-0000-0000-0000000000c1', actor_role => 'curator', note => 'x',
      payload_patch => '{"questions": [{"asked_as": "Q one?", "order_index": 1}]}',
      mappings => '[{"index": 0, "canonical_question_id": "00000000-0000-4000-8000-000000000000"}]')::text$q$,
 $q$SELECT current_setting('p0.last')||' mapped='||((SELECT payload->'questions' FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000001') <> '[]'::jsonb)::text$q$,
 'scalar');

SELECT p0.test('CP-I-8','self-approval allowed but recorded on the approval event (self_approved=true)',
 'n/a','approved self=true evidence=true','service_role',NULL,
 $q$SELECT catalog_transition_candidate(candidate_id => 'dddddddd-0000-0000-0000-000000000006', to_state => 'approved',
      actor_id => '00000000-0000-0000-0000-0000000000c1', actor_role => 'curator')->>'self_approved'$q$,
 $q$SELECT (SELECT state::text FROM catalog_candidates WHERE id='dddddddd-0000-0000-0000-000000000006')||' self='||current_setting('p0.last')
       ||' evidence='||(SELECT evidence->>'self_approved' FROM catalog_candidate_events WHERE candidate_id='dddddddd-0000-0000-0000-000000000006' AND to_state='approved')$q$,
 'scalar', NULL,
 $q$SELECT p0m.step('dddddddd-0000-0000-0000-000000000006','extracted',NULL,'system'); SELECT p0m.step('dddddddd-0000-0000-0000-000000000006','matched','00000000-0000-0000-0000-0000000000c1','curator');
    UPDATE catalog_candidates SET checks='{"all_passed": true}' WHERE id='dddddddd-0000-0000-0000-000000000006';
    SELECT p0m.step('dddddddd-0000-0000-0000-000000000006','verified','00000000-0000-0000-0000-0000000000c1','curator')$q$);

SELECT p0.test('CP-I-9','approval by a different curator carries no self_approved flag',
 'n/a','approved flag=<null>','service_role',NULL,
 $q$SELECT catalog_transition_candidate(candidate_id => 'dddddddd-0000-0000-0000-000000000005', to_state => 'approved',
      actor_id => '00000000-0000-0000-0000-0000000000c1', actor_role => 'curator')->>'to_state'$q$,
 $q$SELECT current_setting('p0.last')||' flag='||coalesce((SELECT evidence->>'self_approved' FROM catalog_candidate_events WHERE candidate_id='dddddddd-0000-0000-0000-000000000005' AND to_state='approved'),'<null>')$q$,
 'scalar', NULL,
 $q$SELECT p0m.step('dddddddd-0000-0000-0000-000000000005','extracted',NULL,'system'); SELECT p0m.step('dddddddd-0000-0000-0000-000000000005','matched','00000000-0000-0000-0000-0000000000c1','curator');
    UPDATE catalog_candidates SET checks='{"all_passed": true}' WHERE id='dddddddd-0000-0000-0000-000000000005';
    SELECT p0m.step('dddddddd-0000-0000-0000-000000000005','verified','00000000-0000-0000-0000-0000000000c1','curator')$q$);

SELECT p0.test('CP-I-10','client roles cannot EXECUTE the transition RPC',
 'n/a','anon=false auth=false svc=true','postgres',NULL, $q$SELECT 'x'$q$,
 $q$SELECT 'anon='||has_function_privilege('anon','public.catalog_transition_candidate(uuid,catalog_candidate_state,uuid,text,text,jsonb,jsonb,uuid,jsonb,jsonb,jsonb,boolean)','EXECUTE')
        ||' auth='||has_function_privilege('authenticated','public.catalog_transition_candidate(uuid,catalog_candidate_state,uuid,text,text,jsonb,jsonb,uuid,jsonb,jsonb,jsonb,boolean)','EXECUTE')
        ||' svc='||has_function_privilege('service_role','public.catalog_transition_candidate(uuid,catalog_candidate_state,uuid,text,text,jsonb,jsonb,uuid,jsonb,jsonb,jsonb,boolean)','EXECUTE')$q$,
 'scalar');

-- ---------------- CP-J: server-captured (url_fetch) source evidence ----------------
SELECT p0.test('CP-J-1','url_fetch source requires fetched_at + server content digest',
 'n/a','error:23514','service_role',NULL,
 $q$INSERT INTO catalog_sources (url, capture_method, snapshot_text) VALUES ('https://apply.northwind.vc/f','url_fetch','text')$q$,
 $q$SELECT current_setting('p0.last')$q$);
SELECT p0.test('CP-J-2','url_fetch keeps the server raw-content digest; snapshot digest computed separately',
 'n/a','raw_kept=true snap=true signals=1','service_role',NULL,
 $q$INSERT INTO catalog_sources (id, url, final_url, capture_method, snapshot_text, content_sha256, fetched_at, reuse, reuse_signals)
      VALUES ('cccccccc-0000-0000-0000-0000000000f1','https://apply.northwind.vc/f','https://apply.northwind.vc/f/','url_fetch','public text', repeat('a',64), now(), 'allowed', '{robots.txt:allow}')$q$,
 $q$SELECT 'raw_kept='||(content_sha256=repeat('a',64))::text||' snap='||(snapshot_sha256=encode(sha256('public text'::bytea),'hex'))::text||' signals='||cardinality(reuse_signals)
      FROM catalog_sources WHERE id='cccccccc-0000-0000-0000-0000000000f1'$q$);
SELECT p0.test('CP-J-3','client-supplied capture cannot claim server fetch fields',
 'n/a','fetched=<null> signals=0','service_role',NULL,
 $q$INSERT INTO catalog_sources (id, url, capture_method, snapshot_text, fetched_at, reuse_signals)
      VALUES ('cccccccc-0000-0000-0000-0000000000f2','https://apply.northwind.vc/f','public_paste','pasted', now(), '{robots.txt:allow}')$q$,
 $q$SELECT 'fetched='||coalesce(fetched_at::text,'<null>')||' signals='||cardinality(reuse_signals) FROM catalog_sources WHERE id='cccccccc-0000-0000-0000-0000000000f2'$q$);
SELECT p0.test('CP-J-4','re-check writes last_check/status; fetched_at stays immutable',
 'n/a','recheck=rows=1 fetched_at=error:42501','service_role',NULL,
 $q$UPDATE catalog_sources SET last_check='{"ok":true,"changed":true}', verification_status='stale', last_checked_at=now() WHERE id='cccccccc-0000-0000-0000-0000000000f1'$q$,
 $q$SELECT 'recheck='||current_setting('p0.last')||' fetched_at='||p0m.try_as('service_role', $s$UPDATE catalog_sources SET fetched_at=now()+interval '1 day' WHERE id='cccccccc-0000-0000-0000-0000000000f1' RETURNING 'x'$s$)$q$,
 'dml', NULL,
 $q$INSERT INTO catalog_sources (id, url, capture_method, snapshot_text, content_sha256, fetched_at)
      VALUES ('cccccccc-0000-0000-0000-0000000000f1','https://apply.northwind.vc/f','url_fetch','t', repeat('a',64), now())$q$);

-- ---------------- CP-H: backfill + catalog shape ----------------
SELECT p0.test('CP-H-1','serial backfill preserves QA-archive refs and maps them to the right rows',
 'n/a','EN-yc=Y Combinator AP-yc-2026-05=yc-summer-2026 AP-cyberfund-2026-05=cyberfund-monastery QU-0030=What problem are you solving? QU-0003=LinkedIn URL AQ-0001=Company / project name',
 'postgres',NULL, $q$SELECT 'x'$q$,
 $q$SELECT 'EN-yc='||(SELECT e.name FROM catalog_serials s JOIN catalog_entities e ON e.id=s.target_id WHERE s.serial='EN-yc')
      ||' AP-yc-2026-05='||(SELECT p.slug FROM catalog_serials s JOIN programs p ON p.id=s.target_id WHERE s.serial='AP-yc-2026-05')
      ||' AP-cyberfund-2026-05='||(SELECT p.slug FROM catalog_serials s JOIN programs p ON p.id=s.target_id WHERE s.serial='AP-cyberfund-2026-05')
      ||' QU-0030='||(SELECT CASE WHEN q.text='Rewritten canonical paraphrase' THEN 'What problem are you solving?' ELSE q.text END FROM catalog_serials s JOIN archived_questions q ON q.id=s.target_id WHERE s.serial='QU-0030')
      ||' QU-0003='||(SELECT q.text FROM catalog_serials s JOIN archived_questions q ON q.id=s.target_id WHERE s.serial='QU-0003')
      ||' AQ-0001='||(SELECT q.asked_as FROM catalog_serials s JOIN program_questions q ON q.id=s.target_id WHERE s.serial='AQ-0001')$q$,
 'scalar');

SELECT p0.test('CP-H-2','backfill counts: EN 5, AP 5, QU 103 (5 preserved), AQ 103; legacy occurrences not relinked',
 'n/a','AP/qa_archive=5 AQ/backfill_058=103 EN/qa_archive=5 QU/backfill_058=98 QU/qa_archive=5 legacy_untouched=103',
 'postgres',NULL, $q$SELECT 'x'$q$,
 $q$SELECT string_agg(k||'='||n, ' ' ORDER BY k)||' legacy_untouched='||(SELECT count(*) FROM program_questions q JOIN programs p ON p.id=q.program_id
           WHERE p.slug IN ('yc-summer-2026','founding-500','redbud-vc','cyberfund-monastery','3xcapital')
             AND q.template_revision_id IS NULL AND q.superseded_by_revision_id IS NULL)
    FROM (SELECT kind||'/'||origin k, count(*) n FROM catalog_serials WHERE origin <> 'assigned' GROUP BY 1) s$q$,
 'scalar');

SELECT p0.test('CP-H-3','RLS enabled on all 8 new tables; every policy on them is SELECT-only',
 'n/a','rls=8 nonselect=0','postgres',NULL, $q$SELECT 'x'$q$,
 $q$SELECT 'rls='||(SELECT count(*) FROM pg_class WHERE relname IN ('catalog_entities','catalog_sources','program_template_revisions','question_mapping_decisions','catalog_serials','catalog_curators','catalog_candidates','catalog_candidate_events') AND relrowsecurity)
      ||' nonselect='||(SELECT count(*) FROM pg_policies WHERE tablename IN ('catalog_entities','catalog_sources','program_template_revisions','question_mapping_decisions','catalog_serials','catalog_curators','catalog_candidates','catalog_candidate_events') AND cmd <> 'SELECT')$q$,
 'scalar');

SELECT p0.test('CP-H-4','no new SECURITY DEFINER function; publish RPC executable by service_role only',
 'n/a','definer=0 publish: anon=false auth=false public=false svc=true invoker=true','postgres',NULL, $q$SELECT 'x'$q$,
 $q$SELECT 'definer='||(SELECT count(*) FROM pg_proc WHERE (proname LIKE 'catalog\_%' OR proname LIKE 'guard\_catalog%' OR proname IN ('guard_programs_entity','guard_program_questions_provenance')) AND prosecdef)
      ||' publish: anon='||has_function_privilege('anon','public.catalog_publish_candidate(uuid,uuid)','EXECUTE')
      ||' auth='||has_function_privilege('authenticated','public.catalog_publish_candidate(uuid,uuid)','EXECUTE')
      ||' public='||has_function_privilege('public','public.catalog_publish_candidate(uuid,uuid)','EXECUTE')
      ||' svc='||has_function_privilege('service_role','public.catalog_publish_candidate(uuid,uuid)','EXECUTE')
      ||' invoker='||(SELECT NOT prosecdef FROM pg_proc WHERE proname='catalog_publish_candidate')$q$,
 'scalar');

SELECT p0.test('CP-H-5','client roles hold no DML/TRUNCATE privilege on any new table or sequence',
 'n/a','0','postgres',NULL, $q$SELECT 'x'$q$,
 $q$SELECT count(*)::text FROM (VALUES ('catalog_entities'),('catalog_sources'),('program_template_revisions'),('question_mapping_decisions'),('catalog_serials'),('catalog_curators'),('catalog_candidates'),('catalog_candidate_events')) t(n),
         (VALUES ('anon'),('authenticated')) r(role), (VALUES ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('TRIGGER'),('REFERENCES')) pr(p)
     WHERE has_table_privilege(r.role, 'public.'||t.n, pr.p)$q$,
 'scalar');

SELECT p0.test('CP-H-6','002 unique index replaced by active-only uniqueness',
 'n/a','active=1 legacy=0','postgres',NULL, $q$SELECT 'x'$q$,
 $q$SELECT 'active='||(SELECT count(*) FROM pg_indexes WHERE indexname='program_questions_active_unique')||' legacy='||(SELECT count(*) FROM pg_indexes WHERE indexname='idx_program_questions_unique')$q$,
 'scalar');

SELECT p0.test('CP-H-7','forward serial assignment is idempotent and never collides',
 'n/a','same=true digits=true','service_role',NULL,
 $q$SELECT (catalog_assign_serial('AP', (SELECT id FROM programs WHERE slug='t-seeded')) = catalog_assign_serial('AP', (SELECT id FROM programs WHERE slug='t-seeded')))::text$q$,
 $q$SELECT 'same='||(current_setting('p0.last')='true')::text||' digits='||((SELECT serial FROM catalog_serials WHERE kind='AP' AND target_id=(SELECT id FROM programs WHERE slug='t-seeded')) ~ '^AP-[0-9]{4,}$')::text$q$,
 'scalar');

-- ---------------- CP-L: submitter event view hides curator identity / note (M09 hardening L6) ----------------
SELECT p0.test('CP-L-1','submitter reads own events'' actor_role + outcome, but not actor / note / evidence',
 'n/a','role=ok outcome=ok to_state=ok actor=error:42501 note=error:42501 evidence=error:42501 star=error:42501','postgres',NULL, $q$SELECT 'x'$q$,
 $q$SELECT 'role='||p0m.try_as('authenticated','SELECT actor_role FROM catalog_candidate_events LIMIT 1')
        ||' outcome='||p0m.try_as('authenticated','SELECT public_outcome FROM catalog_candidate_events LIMIT 1')
        ||' to_state='||p0m.try_as('authenticated','SELECT to_state::text FROM catalog_candidate_events LIMIT 1')
        ||' actor='||p0m.try_as('authenticated','SELECT actor::text FROM catalog_candidate_events LIMIT 1')
        ||' note='||p0m.try_as('authenticated','SELECT note FROM catalog_candidate_events LIMIT 1')
        ||' evidence='||p0m.try_as('authenticated','SELECT evidence::text FROM catalog_candidate_events LIMIT 1')
        ||' star='||p0m.try_as('authenticated','SELECT count(*)::text FROM (SELECT * FROM catalog_candidate_events) e')$q$,
 'scalar');

SELECT p0.test('CP-L-2','submitter a2 sees the curator-driven lifecycle of K3 as roles + outcomes only',
 'n/a','submitter:submitted,system:in_review,curator:in_review,curator:in_review,curator:in_review,curator:published','authenticated',:'a2',
 $q$SELECT string_agg(actor_role||':'||public_outcome, ',' ORDER BY id) FROM catalog_candidate_events WHERE candidate_id='dddddddd-0000-0000-0000-000000000003'$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar');

SELECT p0.test('CP-L-3','public_outcome is derived (published / rejected / withdrawn / submitted / in_review)',
 'n/a','rejected','service_role',NULL,
 $q$SELECT (catalog_transition_candidate(candidate_id => 'dddddddd-0000-0000-0000-000000000001', to_state => 'rejected',
      actor_id => '00000000-0000-0000-0000-0000000000c1', actor_role => 'curator', note => 'curator-only reason'))::text$q$,
 $q$SELECT public_outcome FROM catalog_candidate_events WHERE candidate_id='dddddddd-0000-0000-0000-000000000001' ORDER BY id DESC LIMIT 1$q$,
 'scalar');

-- ---------------- CP-K: atomic candidate submission RPC (M09 hardening L8) ----------------
SELECT p0.test('CP-K-1','service_role submit inserts source + candidate in one call and auto-extracts',
 'n/a','extracted src=1 linked=true sha=true events=2','service_role',NULL,
 $q$SELECT catalog_submit_candidate(
      p_submitted_by => '00000000-0000-0000-0000-0000000000a2',
      p_source => '{"url":"https://apply.example.test/k-1","capture_method":"public_paste","snapshot_text":"K one snapshot"}',
      p_payload => '{"program":{"name":"K-1 Program","organization":"K Org","kind":"vc"},"questions":[{"asked_as":"Why you?","order_index":1}]}',
      p_auto_extract => true)::text$q$,
 $q$SELECT (current_setting('p0.last')::jsonb->>'state')
        ||' src='||(SELECT count(*) FROM catalog_sources WHERE url='https://apply.example.test/k-1')
        ||' linked='||(SELECT (c.source_id = (current_setting('p0.last')::jsonb->>'source_id')::uuid)::text FROM catalog_candidates c WHERE c.id=(current_setting('p0.last')::jsonb->>'id')::uuid)
        ||' sha='||(SELECT (content_sha256 = encode(sha256(convert_to('K one snapshot','UTF8')),'hex'))::text FROM catalog_sources WHERE url='https://apply.example.test/k-1')
        ||' events='||(SELECT count(*) FROM catalog_candidate_events WHERE candidate_id=(current_setting('p0.last')::jsonb->>'id')::uuid)$q$,
 'scalar');

SELECT p0.test('CP-K-2','a failing candidate insert leaves NO orphan source row (atomic)',
 'n/a','error:23514 orphans=0','service_role',NULL,
 $q$SELECT catalog_submit_candidate(
      p_submitted_by => '00000000-0000-0000-0000-0000000000a2',
      p_source => '{"url":"https://apply.example.test/k-2","capture_method":"public_paste","snapshot_text":"K two"}',
      p_payload => '["not an object"]')::text$q$,
 $q$SELECT current_setting('p0.last')||' orphans='||(SELECT count(*) FROM catalog_sources WHERE url='https://apply.example.test/k-2')$q$,
 'scalar');

SELECT p0.test('CP-K-3','review signals cannot be set through submit (unknown source field refused, nothing written)',
 'n/a','error:22023 rows=0','service_role',NULL,
 $q$SELECT catalog_submit_candidate(
      p_submitted_by => '00000000-0000-0000-0000-0000000000a2',
      p_source => '{"url":"https://apply.example.test/k-3","capture_method":"public_paste","verification_status":"verified"}',
      p_payload => '{"program":{"name":"K-3"},"questions":[]}')::text$q$,
 $q$SELECT current_setting('p0.last')||' rows='||(SELECT count(*) FROM catalog_sources WHERE url='https://apply.example.test/k-3')$q$,
 'scalar');

SELECT p0.test('CP-K-4','submit without questions stays in candidate (no auto step)',
 'n/a','candidate','service_role',NULL,
 $q$SELECT catalog_submit_candidate(
      p_submitted_by => '00000000-0000-0000-0000-0000000000a2',
      p_source => '{"url":"https://apply.example.test/k-4","capture_method":"public_paste"}',
      p_payload => '{"program":{"name":"K-4"},"questions":[]}',
      p_auto_extract => false)->>'state'$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar');

SELECT p0.test('CP-K-5','client roles cannot EXECUTE the submit RPC; service_role can',
 'n/a','anon=false auth=false svc=true','postgres',NULL, $q$SELECT 'x'$q$,
 $q$SELECT 'anon='||has_function_privilege('anon','public.catalog_submit_candidate(uuid,jsonb,jsonb,boolean)','EXECUTE')
        ||' auth='||has_function_privilege('authenticated','public.catalog_submit_candidate(uuid,jsonb,jsonb,boolean)','EXECUTE')
        ||' svc='||has_function_privilege('service_role','public.catalog_submit_candidate(uuid,jsonb,jsonb,boolean)','EXECUTE')$q$,
 'scalar');

SELECT p0.test('CP-K-6','authenticated calling submit directly is refused',
 'n/a','error:42501','authenticated',:'a2',
 $q$SELECT catalog_submit_candidate('00000000-0000-0000-0000-0000000000a2', '{"url":"https://apply.example.test/k-6","capture_method":"public_paste"}', '{"program":{"name":"K-6"},"questions":[]}')::text$q$,
 $q$SELECT current_setting('p0.last')$q$, 'scalar');

SELECT p0.report();
