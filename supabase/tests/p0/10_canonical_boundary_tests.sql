-- ============================================================
-- P0 canonical write-boundary role tests (054)
-- ============================================================
-- LOCAL THROWAWAY POSTGRES ONLY. Requires 00-03 loaded and
-- SELECT set_config('p0.phase','pre'|'post', false) done by the runner.
-- Expected values are (pre-054, post-054).
--   GAP      = EFFECT -> NOEFFECT  (gap reproduced, then closed)
--   BASELINE = NOEFFECT both       (already protected; must stay so)
--   ALLOWED  = EFFECT both         (legitimate flow must keep working)
--   RESIDUAL = EFFECT both         (known, documented, NOT closed by 054)
-- Actors: a1 owner of t-owned, a2 ordinary user, anon, service_role, postgres.
-- ============================================================
\set a1 '00000000-0000-0000-0000-0000000000a1'
\set a2 '00000000-0000-0000-0000-0000000000a2'

-- ---------------- GAP: DBC-01 programs UPDATE -> canonical -------------
SELECT p0.test('DBC-01a','owner flips OWN saved program to source=canonical (PATCH)',
 'EFFECT','NOEFFECT','authenticated',:'a1',
 $q$UPDATE programs SET source='canonical' WHERE id='11111111-1111-1111-1111-111111111111'$q$,
 $q$SELECT p0.effect((SELECT source::text FROM programs WHERE id='11111111-1111-1111-1111-111111111111')='canonical')$q$);

SELECT p0.test('DBC-01b','full 3-step chain: insert own program, save it, flip to canonical (a2)',
 'EFFECT','NOEFFECT','authenticated',:'a2',
 $q$DO $x$ BEGIN
      INSERT INTO programs (id,slug,name,organization,type,kind,source,funder_user_id)
        VALUES ('99999999-9999-9999-9999-999999999999','t-chain','Chain','C','accel','accelerator','community','00000000-0000-0000-0000-0000000000a2');
      INSERT INTO user_applications (user_id, program_id)
        VALUES ('00000000-0000-0000-0000-0000000000a2','99999999-9999-9999-9999-999999999999');
      UPDATE programs SET source='canonical' WHERE id='99999999-9999-9999-9999-999999999999';
    END $x$$q$,
 $q$SELECT p0.effect((SELECT count(*) FROM programs WHERE slug='t-chain' AND source='canonical')=1)$q$);

SELECT p0.test('DBC-01c','owner flips own program via upsert ON CONFLICT DO UPDATE (PostgREST upsert)',
 'EFFECT','NOEFFECT','authenticated',:'a1',
 $q$INSERT INTO programs (id,slug,name,organization,type,kind,source,funder_user_id)
      VALUES ('11111111-1111-1111-1111-111111111111','t-owned','T Owned','T Org','accel','accelerator','community','00000000-0000-0000-0000-0000000000a1')
      ON CONFLICT (slug) DO UPDATE SET source='canonical'$q$,
 $q$SELECT p0.effect((SELECT source::text FROM programs WHERE slug='t-owned')='canonical')$q$);

-- ---------------- GAP/latent: DBC-05 existing canonical rows -----------
-- Latent hazard: a canonical row acquires a funder_user_id (setup as postgres).
SELECT p0.test('DBC-05a','latent: owner of a canonical row downgrades it (source->seeded)',
 'EFFECT','NOEFFECT','authenticated',:'a1',
 $q$UPDATE programs SET source='seeded' WHERE slug='yc-summer-2026'$q$,
 $q$SELECT p0.effect((SELECT source::text FROM programs WHERE slug='yc-summer-2026')<>'canonical')$q$,
 'dml', NULL,
 $q$UPDATE programs SET funder_user_id='00000000-0000-0000-0000-0000000000a1' WHERE slug='yc-summer-2026';
    INSERT INTO user_applications (user_id, program_id) VALUES ('00000000-0000-0000-0000-0000000000a1',(SELECT id FROM programs WHERE slug='yc-summer-2026'))$q$);

SELECT p0.test('DBC-05b','latent: owner of a canonical row edits its name',
 'EFFECT','NOEFFECT','authenticated',:'a1',
 $q$UPDATE programs SET name='pwned' WHERE slug='yc-summer-2026'$q$,
 $q$SELECT p0.effect((SELECT name FROM programs WHERE slug='yc-summer-2026')='pwned')$q$,
 'dml', NULL,
 $q$UPDATE programs SET funder_user_id='00000000-0000-0000-0000-0000000000a1' WHERE slug='yc-summer-2026'$q$);

SELECT p0.test('DBC-05c','ordinary user claims ownership of a canonical row (SET funder_user_id=self)',
 'NOEFFECT','NOEFFECT','authenticated',:'a2',
 $q$UPDATE programs SET funder_user_id='00000000-0000-0000-0000-0000000000a2' WHERE slug='yc-summer-2026'$q$,
 $q$SELECT p0.effect((SELECT funder_user_id FROM programs WHERE slug='yc-summer-2026') IS NOT NULL)$q$);

SELECT p0.test('DBC-05d','ordinary user edits/downgrades an existing canonical program (data-guarded today)',
 'NOEFFECT','NOEFFECT','authenticated',:'a2',
 $q$UPDATE programs SET source='seeded', name='pwned' WHERE slug='yc-summer-2026'$q$,
 $q$SELECT p0.effect((SELECT count(*) FROM programs WHERE slug='yc-summer-2026' AND source='canonical' AND name='pwned')=1 OR (SELECT source::text FROM programs WHERE slug='yc-summer-2026')<>'canonical')$q$);

-- ---------------- BASELINE: programs INSERT canonical ------------------
SELECT p0.test('DBC-04a','authenticated inserts a program with source=canonical',
 'NOEFFECT','NOEFFECT','authenticated',:'a2',
 $q$INSERT INTO programs (slug,name,organization,type,kind,source) VALUES ('t-mint','x','x','accel','accelerator','canonical')$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM programs WHERE slug='t-mint'))$q$);

SELECT p0.test('DBC-04b','anon inserts any program',
 'NOEFFECT','NOEFFECT','anon',NULL,
 $q$INSERT INTO programs (slug,name,organization,type,kind,source) VALUES ('t-anon','x','x','accel','accelerator','community')$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM programs WHERE slug='t-anon'))$q$);

SELECT p0.test('DBC-04c','authenticated deletes a canonical program (no DELETE policy)',
 'NOEFFECT','NOEFFECT','authenticated',:'a2',
 $q$DELETE FROM programs WHERE slug='yc-summer-2026'$q$,
 $q$SELECT p0.effect(NOT EXISTS (SELECT 1 FROM programs WHERE slug='yc-summer-2026'))$q$);

-- ---------------- GAP: DBC-02 archived_questions UPDATE ----------------
SELECT p0.test('DBC-02a','authenticated edits canonical question text',
 'EFFECT','NOEFFECT','authenticated',:'a2',
 $q$UPDATE archived_questions SET text='tampered' WHERE id='1b57fa6f-183c-4017-89f3-0d2008e22234'$q$,
 $q$SELECT p0.effect((SELECT text FROM archived_questions WHERE id='1b57fa6f-183c-4017-89f3-0d2008e22234')='tampered')$q$);

SELECT p0.test('DBC-02b','authenticated edits every canonical-linked question (mass rewrite)',
 'EFFECT','NOEFFECT','authenticated',:'a2',
 $q$UPDATE archived_questions SET text='tampered' WHERE id IN (SELECT archived_question_id FROM program_questions WHERE program_id=(SELECT id FROM programs WHERE slug='yc-summer-2026'))$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM archived_questions WHERE text='tampered'))$q$);

SELECT p0.test('DBC-02c','anon edits canonical question text',
 'NOEFFECT','NOEFFECT','anon',NULL,
 $q$UPDATE archived_questions SET text='tampered' WHERE id='1b57fa6f-183c-4017-89f3-0d2008e22234'$q$,
 $q$SELECT p0.effect((SELECT text FROM archived_questions WHERE id='1b57fa6f-183c-4017-89f3-0d2008e22234')='tampered')$q$);

-- ---------------- GAP: DBC-03 archived_questions INSERT ----------------
SELECT p0.test('DBC-03a','authenticated inserts an archived question (no RETURNING)',
 'EFFECT','NOEFFECT','authenticated',:'a2',
 $q$INSERT INTO archived_questions (text, theme) VALUES ('t-junk-q','personal')$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM archived_questions WHERE text='t-junk-q'))$q$);

SELECT p0.test('DBC-03b','authenticated inserts archived question WITH RETURNING id (app user-client path; already failing under 052)',
 'error:42501','error:42501','authenticated',:'a2',
 $q$INSERT INTO archived_questions (text, theme) VALUES ('t-junk-q2','personal') RETURNING id$q$,
 $q$SELECT current_setting('p0.last')$q$);

SELECT p0.test('DBC-03c','anon inserts an archived question',
 'NOEFFECT','NOEFFECT','anon',NULL,
 $q$INSERT INTO archived_questions (text, theme) VALUES ('t-junk-anon','personal')$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM archived_questions WHERE text='t-junk-anon'))$q$);

-- ---------------- BASELINE/GAP: DBC-06 program_questions ---------------
SELECT p0.test('DBC-06a','program owner forges a relationship onto a canonical program',
 'NOEFFECT','NOEFFECT','authenticated',:'a1',
 $q$INSERT INTO program_questions (program_id, archived_question_id, asked_as)
      VALUES ((SELECT id FROM programs WHERE slug='yc-summer-2026'),'33333333-3333-3333-3333-333333333333','forged')$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM program_questions WHERE asked_as='forged'))$q$);

SELECT p0.test('DBC-06b','program owner reassigns its relationship to a canonical program',
 'NOEFFECT','NOEFFECT','authenticated',:'a1',
 $q$UPDATE program_questions SET program_id=(SELECT id FROM programs WHERE slug='yc-summer-2026') WHERE id='55555555-5555-5555-5555-555555555555'$q$,
 $q$SELECT p0.effect((SELECT program_id FROM program_questions WHERE id='55555555-5555-5555-5555-555555555555')<>'11111111-1111-1111-1111-111111111111')$q$);

SELECT p0.test('DBC-06c','latent: owner of a canonical row forges a relationship onto it',
 'EFFECT','NOEFFECT','authenticated',:'a1',
 $q$INSERT INTO program_questions (program_id, archived_question_id, asked_as)
      VALUES ((SELECT id FROM programs WHERE slug='yc-summer-2026'),'33333333-3333-3333-3333-333333333333','forged')$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM program_questions WHERE asked_as='forged'))$q$,
 'dml', NULL,
 $q$UPDATE programs SET funder_user_id='00000000-0000-0000-0000-0000000000a1' WHERE slug='yc-summer-2026'$q$);

SELECT p0.test('DBC-06d','latent: owner of a canonical row reassigns a relationship onto it',
 'EFFECT','NOEFFECT','authenticated',:'a1',
 $q$UPDATE program_questions SET program_id=(SELECT id FROM programs WHERE slug='yc-summer-2026') WHERE id='55555555-5555-5555-5555-555555555555'$q$,
 $q$SELECT p0.effect((SELECT program_id FROM program_questions WHERE id='55555555-5555-5555-5555-555555555555')<>'11111111-1111-1111-1111-111111111111')$q$,
 'dml', NULL,
 $q$UPDATE programs SET funder_user_id='00000000-0000-0000-0000-0000000000a1' WHERE slug='yc-summer-2026'$q$);

SELECT p0.test('DBC-06e','authenticated deletes a canonical relationship (no DELETE policy)',
 'NOEFFECT','NOEFFECT','authenticated',:'a2',
 $q$DELETE FROM program_questions WHERE program_id=(SELECT id FROM programs WHERE slug='yc-summer-2026')$q$,
 $q$SELECT p0.effect((SELECT count(*) FROM program_questions pq JOIN programs p ON p.id=pq.program_id WHERE p.source='canonical')<103)$q$);

-- ---------------- RESIDUAL: DBC-07 / DBC-09 -----------------------------
SELECT p0.test('DBC-07','RESIDUAL: owner links own program to a canonical question -> asked_by_count inflated',
 'EFFECT','EFFECT','authenticated',:'a1',
 $q$INSERT INTO program_questions (program_id, archived_question_id, asked_as)
      VALUES ('11111111-1111-1111-1111-111111111111','1b57fa6f-183c-4017-89f3-0d2008e22234','inflate')$q$,
 $q$SELECT p0.effect((SELECT asked_by_count FROM archived_questions WHERE id='1b57fa6f-183c-4017-89f3-0d2008e22234')=2)$q$,
 'dml', NULL,
 $q$UPDATE archived_questions SET asked_by_count=1 WHERE id='1b57fa6f-183c-4017-89f3-0d2008e22234'$q$);

SELECT p0.test('DBC-09','RESIDUAL: authenticated holds TRUNCATE on program_questions (grants; not exposed via PostgREST)',
 'EFFECT','EFFECT','authenticated',:'a2',
 $q$TRUNCATE program_questions CASCADE$q$,
 $q$SELECT p0.effect((SELECT count(*) FROM program_questions)=0)$q$);

-- ---------------- Defense in depth: guard triggers hold even if a policy regresses
-- (setup creates a deliberately over-permissive policy as postgres)
SELECT p0.test('DD-1a','policy regression: open UPDATE policy on programs; user flips a saved program to canonical',
 'EFFECT','NOEFFECT','authenticated',:'a2',
 $q$UPDATE programs SET source='canonical' WHERE id='44444444-4444-4444-4444-444444444444'$q$,
 $q$SELECT p0.effect((SELECT source::text FROM programs WHERE id='44444444-4444-4444-4444-444444444444')='canonical')$q$,
 'dml', NULL,
 $q$CREATE POLICY zz_open_upd ON programs FOR UPDATE USING (true) WITH CHECK (true)$q$);

SELECT p0.test('DD-1b','policy regression: open UPDATE policy on programs; user downgrades a canonical program',
 'EFFECT','NOEFFECT','authenticated',:'a2',
 $q$UPDATE programs SET source='seeded' WHERE slug='yc-summer-2026'$q$,
 $q$SELECT p0.effect((SELECT source::text FROM programs WHERE slug='yc-summer-2026')<>'canonical')$q$,
 'dml', NULL,
 $q$CREATE POLICY zz_open_upd ON programs FOR UPDATE USING (true) WITH CHECK (true);
    INSERT INTO user_applications (user_id, program_id) VALUES ('00000000-0000-0000-0000-0000000000a2',(SELECT id FROM programs WHERE slug='yc-summer-2026'))$q$);

SELECT p0.test('DD-1c','policy regression: open INSERT policy on programs; user inserts a canonical program',
 'EFFECT','NOEFFECT','authenticated',:'a2',
 $q$INSERT INTO programs (slug,name,organization,type,kind,source) VALUES ('t-mint2','x','x','accel','accelerator','canonical')$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM programs WHERE slug='t-mint2'))$q$,
 'dml', NULL,
 $q$CREATE POLICY zz_open_ins ON programs FOR INSERT WITH CHECK (true)$q$);

SELECT p0.test('DD-1d','policy regression: open DELETE policy on programs; user deletes a canonical program',
 'EFFECT','NOEFFECT','authenticated',:'a2',
 $q$DELETE FROM programs WHERE slug='yc-summer-2026'$q$,
 $q$SELECT p0.effect(NOT EXISTS (SELECT 1 FROM programs WHERE slug='yc-summer-2026'))$q$,
 'dml', NULL,
 $q$CREATE POLICY zz_open_del ON programs FOR DELETE USING (true)$q$);

SELECT p0.test('DD-2a','policy regression: open policy on archived_questions; user edits canonical question text',
 'EFFECT','NOEFFECT','authenticated',:'a2',
 $q$UPDATE archived_questions SET text='tampered' WHERE id='1b57fa6f-183c-4017-89f3-0d2008e22234'$q$,
 $q$SELECT p0.effect((SELECT text FROM archived_questions WHERE id='1b57fa6f-183c-4017-89f3-0d2008e22234')='tampered')$q$,
 'dml', NULL,
 $q$CREATE POLICY zz_open_aq ON archived_questions FOR ALL USING (true) WITH CHECK (true)$q$);

SELECT p0.test('DD-2b','policy regression: open policy on archived_questions; user inserts a question',
 'EFFECT','NOEFFECT','authenticated',:'a2',
 $q$INSERT INTO archived_questions (text, theme) VALUES ('t-junk-dd','personal')$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM archived_questions WHERE text='t-junk-dd'))$q$,
 'dml', NULL,
 $q$CREATE POLICY zz_open_aq ON archived_questions FOR ALL USING (true) WITH CHECK (true)$q$);

SELECT p0.test('DD-3a','policy regression: open policy on program_questions; user forges a relationship on a canonical program',
 'EFFECT','NOEFFECT','authenticated',:'a2',
 $q$INSERT INTO program_questions (program_id, archived_question_id, asked_as)
      VALUES ((SELECT id FROM programs WHERE slug='yc-summer-2026'),'33333333-3333-3333-3333-333333333333','forged-dd')$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM program_questions WHERE asked_as='forged-dd'))$q$,
 'dml', NULL,
 $q$CREATE POLICY zz_open_pq ON program_questions FOR ALL USING (true) WITH CHECK (true)$q$);

SELECT p0.test('DD-3b','policy regression: open policy on program_questions; user deletes canonical relationships',
 'EFFECT','NOEFFECT','authenticated',:'a2',
 $q$DELETE FROM program_questions WHERE program_id=(SELECT id FROM programs WHERE slug='yc-summer-2026')$q$,
 $q$SELECT p0.effect((SELECT count(*) FROM program_questions pq JOIN programs p ON p.id=pq.program_id WHERE p.source='canonical')<103)$q$,
 'dml', NULL,
 $q$CREATE POLICY zz_open_pq ON program_questions FOR ALL USING (true) WITH CHECK (true)$q$);

-- ---------------- Policy layer alone (guard triggers disabled in setup) ------
-- Proves the RLS policy changes close the gaps by themselves; the triggers
-- are an additional layer, not the only barrier.
SELECT p0.test('PO-1','policies only (triggers disabled): owner flips own program to canonical',
 'n/a','NOEFFECT','authenticated',:'a1',
 $q$UPDATE programs SET source='canonical' WHERE id='11111111-1111-1111-1111-111111111111'$q$,
 $q$SELECT p0.effect((SELECT source::text FROM programs WHERE id='11111111-1111-1111-1111-111111111111')='canonical')$q$,
 'dml', NULL,
 $q$ALTER TABLE programs DISABLE TRIGGER programs_canonical_guard$q$);

SELECT p0.test('PO-2','policies only (triggers disabled): authenticated edits canonical question text',
 'n/a','NOEFFECT','authenticated',:'a2',
 $q$UPDATE archived_questions SET text='tampered' WHERE id='1b57fa6f-183c-4017-89f3-0d2008e22234'$q$,
 $q$SELECT p0.effect((SELECT text FROM archived_questions WHERE id='1b57fa6f-183c-4017-89f3-0d2008e22234')='tampered')$q$,
 'dml', NULL,
 $q$ALTER TABLE archived_questions DISABLE TRIGGER archived_questions_service_only_guard$q$);

SELECT p0.test('PO-3','policies only (triggers disabled): authenticated inserts an archived question',
 'n/a','NOEFFECT','authenticated',:'a2',
 $q$INSERT INTO archived_questions (text, theme) VALUES ('t-junk-po','personal')$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM archived_questions WHERE text='t-junk-po'))$q$,
 'dml', NULL,
 $q$ALTER TABLE archived_questions DISABLE TRIGGER archived_questions_service_only_guard$q$);

SELECT p0.test('PO-4','policies only (triggers disabled): latent canonical owner forges/reassigns relationship + edits program',
 'n/a','NOEFFECT','authenticated',:'a1',
 $q$DO $x$ BEGIN
      INSERT INTO program_questions (program_id, archived_question_id, asked_as)
        VALUES ((SELECT id FROM programs WHERE slug='yc-summer-2026'),'33333333-3333-3333-3333-333333333333','forged-po');
    END $x$$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM program_questions WHERE asked_as='forged-po'))$q$,
 'dml', NULL,
 $q$ALTER TABLE program_questions DISABLE TRIGGER program_questions_canonical_guard;
    UPDATE programs SET funder_user_id='00000000-0000-0000-0000-0000000000a1' WHERE slug='yc-summer-2026'$q$);

SELECT p0.test('PO-5','policies only (triggers disabled): latent canonical owner edits/downgrades program',
 'n/a','NOEFFECT','authenticated',:'a1',
 $q$UPDATE programs SET name='pwned' WHERE slug='yc-summer-2026'$q$,
 $q$SELECT p0.effect((SELECT name FROM programs WHERE slug='yc-summer-2026')='pwned')$q$,
 'dml', NULL,
 $q$ALTER TABLE programs DISABLE TRIGGER programs_canonical_guard;
    UPDATE programs SET funder_user_id='00000000-0000-0000-0000-0000000000a1' WHERE slug='yc-summer-2026'$q$);

-- ---------------- ALLOWED: privileged promotion path -------------------
SELECT p0.test('P-1a','postgres role (migration path) inserts a canonical program',
 'EFFECT','EFFECT','postgres',NULL,
 $q$INSERT INTO programs (id,slug,name,organization,type,kind,source) VALUES ('22222222-2222-2222-2222-222222222222','t-pg-canon','PG','PG','accel','accelerator','canonical')$q$,
 $q$SELECT p0.effect((SELECT count(*) FROM programs WHERE slug='t-pg-canon' AND source='canonical')=1)$q$);

SELECT p0.test('P-1b','postgres role promotes an existing program to canonical (UPDATE)',
 'EFFECT','EFFECT','postgres',NULL,
 $q$UPDATE programs SET source='canonical' WHERE id='44444444-4444-4444-4444-444444444444'$q$,
 $q$SELECT p0.effect((SELECT source::text FROM programs WHERE id='44444444-4444-4444-4444-444444444444')='canonical')$q$);

SELECT p0.test('P-1c','postgres role re-runs 053-style ON CONFLICT DO NOTHING promotion (no error, no dup)',
 'EFFECT','EFFECT','postgres',NULL,
 $q$INSERT INTO programs (slug,name,organization,type,kind,source) VALUES ('yc-summer-2026','dup','dup','accel','accelerator','canonical') ON CONFLICT (slug) DO NOTHING$q$,
 $q$SELECT p0.effect((SELECT count(*) FROM programs WHERE source='canonical')=5 AND current_setting('p0.last')='rows=0')$q$);

SELECT p0.test('P-2a','service_role inserts a canonical program',
 'EFFECT','EFFECT','service_role',NULL,
 $q$INSERT INTO programs (slug,name,organization,type,kind,source) VALUES ('t-svc-canon','S','S','accel','accelerator','canonical')$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM programs WHERE slug='t-svc-canon' AND source='canonical'))$q$);

SELECT p0.test('P-2b','service_role edits a canonical program',
 'EFFECT','EFFECT','service_role',NULL,
 $q$UPDATE programs SET description='svc edit' WHERE slug='yc-summer-2026'$q$,
 $q$SELECT p0.effect((SELECT description FROM programs WHERE slug='yc-summer-2026')='svc edit')$q$);

SELECT p0.test('P-2c','service_role edits a canonical question',
 'EFFECT','EFFECT','service_role',NULL,
 $q$UPDATE archived_questions SET typical_word_limit=77 WHERE id='1b57fa6f-183c-4017-89f3-0d2008e22234'$q$,
 $q$SELECT p0.effect((SELECT typical_word_limit FROM archived_questions WHERE id='1b57fa6f-183c-4017-89f3-0d2008e22234')=77)$q$);

SELECT p0.test('P-2d','service_role inserts an archived question WITH RETURNING (intake route admin client)',
 'EFFECT','EFFECT','service_role',NULL,
 $q$INSERT INTO archived_questions (text, theme) VALUES ('t-svc-q','personal') RETURNING id$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM archived_questions WHERE text='t-svc-q'))$q$);

SELECT p0.test('P-2e','service_role links a question to a canonical program (counter trigger fires)',
 'EFFECT','EFFECT','service_role',NULL,
 $q$INSERT INTO program_questions (program_id, archived_question_id, asked_as)
      VALUES ((SELECT id FROM programs WHERE slug='yc-summer-2026'),'33333333-3333-3333-3333-333333333333','svc-link')$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM program_questions WHERE asked_as='svc-link') AND (SELECT asked_by_count FROM archived_questions WHERE id='33333333-3333-3333-3333-333333333333')=2)$q$);

SELECT p0.test('P-2f','service_role deletes a relationship (decrement trigger fires)',
 'EFFECT','EFFECT','service_role',NULL,
 $q$DELETE FROM program_questions WHERE id='55555555-5555-5555-5555-555555555555'$q$,
 $q$SELECT p0.effect(NOT EXISTS (SELECT 1 FROM program_questions WHERE id='55555555-5555-5555-5555-555555555555') AND (SELECT asked_by_count FROM archived_questions WHERE id='33333333-3333-3333-3333-333333333333')=0)$q$);

SELECT p0.test('SIG-1','signal-trigger path: anon UPDATE programs SET applicant_count on a canonical row is RLS-filtered (0 rows, no error), guard never fires',
 'rows=0','rows=0','anon',NULL,
 $q$UPDATE programs SET applicant_count = applicant_count + 1 WHERE slug='yc-summer-2026'$q$,
 $q$SELECT current_setting('p0.last')$q$);

SELECT p0.test('SIG-2','job path: postgres role (cron / definer jobs) updates a canonical program status',
 'EFFECT','EFFECT','postgres',NULL,
 $q$UPDATE programs SET status='closed' WHERE slug='yc-summer-2026'$q$,
 $q$SELECT p0.effect((SELECT status::text FROM programs WHERE slug='yc-summer-2026')='closed')$q$);

-- ---------------- ALLOWED: ordinary user flows -------------------------
SELECT p0.test('P-3a','owner edits non-canonical fields of own non-canonical program',
 'EFFECT','EFFECT','authenticated',:'a1',
 $q$UPDATE programs SET name='T Owned renamed', description='d', url='https://example.test' WHERE id='11111111-1111-1111-1111-111111111111'$q$,
 $q$SELECT p0.effect((SELECT name FROM programs WHERE id='11111111-1111-1111-1111-111111111111')='T Owned renamed')$q$);

SELECT p0.test('P-3b','owner moves own program between non-canonical sources (community -> funder)',
 'EFFECT','EFFECT','authenticated',:'a1',
 $q$UPDATE programs SET source='funder' WHERE id='11111111-1111-1111-1111-111111111111'$q$,
 $q$SELECT p0.effect((SELECT source::text FROM programs WHERE id='11111111-1111-1111-1111-111111111111')='funder')$q$);

SELECT p0.test('P-3c','a different user cannot edit the owner''s program',
 'NOEFFECT','NOEFFECT','authenticated',:'a2',
 $q$UPDATE programs SET name='x' WHERE id='11111111-1111-1111-1111-111111111111'$q$,
 $q$SELECT p0.effect((SELECT name FROM programs WHERE id='11111111-1111-1111-1111-111111111111')='x')$q$);

SELECT p0.test('P-3d','user inserts own non-canonical program (+ saves it)',
 'EFFECT','EFFECT','authenticated',:'a2',
 $q$DO $x$ BEGIN
      INSERT INTO programs (id,slug,name,organization,type,kind,source,funder_user_id)
        VALUES ('88888888-8888-8888-8888-888888888888','t-mine','Mine','M','grant','grant','community','00000000-0000-0000-0000-0000000000a2');
      INSERT INTO user_applications (user_id, program_id) VALUES ('00000000-0000-0000-0000-0000000000a2','88888888-8888-8888-8888-888888888888');
    END $x$$q$,
 $q$SELECT p0.effect((SELECT count(*) FROM programs WHERE slug='t-mine' AND source='community')=1)$q$);

SELECT p0.test('P-3e','owner links own program to own non-canonical question (counter trigger increments)',
 'EFFECT','EFFECT','authenticated',:'a1',
 $q$INSERT INTO program_questions (program_id, archived_question_id, asked_as)
      VALUES ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','second link')$q$,
 $q$SELECT p0.effect((SELECT asked_by_count FROM archived_questions WHERE id='33333333-3333-3333-3333-333333333333')=2)$q$);

SELECT p0.test('P-3f','owner updates own relationship fields (asked_as/order)',
 'EFFECT','EFFECT','authenticated',:'a1',
 $q$UPDATE program_questions SET asked_as='edited', order_index=9 WHERE id='55555555-5555-5555-5555-555555555555'$q$,
 $q$SELECT p0.effect((SELECT asked_as FROM program_questions WHERE id='55555555-5555-5555-5555-555555555555')='edited')$q$);

SELECT p0.test('P-4a','saved-application: save a canonical program',
 'EFFECT','EFFECT','authenticated',:'a2',
 $q$INSERT INTO user_applications (user_id, program_id) VALUES ('00000000-0000-0000-0000-0000000000a2',(SELECT id FROM programs WHERE slug='yc-summer-2026'))$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM user_applications WHERE user_id='00000000-0000-0000-0000-0000000000a2' AND program_id=(SELECT id FROM programs WHERE slug='yc-summer-2026')))$q$);

SELECT p0.test('P-4b','saved-application: workspace status/notes update',
 'EFFECT','EFFECT','authenticated',:'a2',
 $q$UPDATE user_applications SET status='drafting', notes='n', completion_pct=40 WHERE program_id='44444444-4444-4444-4444-444444444444'$q$,
 $q$SELECT p0.effect((SELECT status::text FROM user_applications WHERE program_id='44444444-4444-4444-4444-444444444444' AND user_id='00000000-0000-0000-0000-0000000000a2')='drafting')$q$);

SELECT p0.test('P-4c','saved-application: unsave',
 'EFFECT','EFFECT','authenticated',:'a2',
 $q$DELETE FROM user_applications WHERE program_id='44444444-4444-4444-4444-444444444444'$q$,
 $q$SELECT p0.effect(NOT EXISTS (SELECT 1 FROM user_applications WHERE program_id='44444444-4444-4444-4444-444444444444'))$q$);

SELECT p0.test('P-4d','workspace: write application_answers for a saved canonical program',
 'EFFECT','EFFECT','authenticated',:'a2',
 $q$INSERT INTO application_answers (user_id, application_id, program_question_id, content)
      SELECT '00000000-0000-0000-0000-0000000000a2', ua.id, pq.id, 'my answer'
        FROM user_applications ua, program_questions pq
       WHERE ua.user_id='00000000-0000-0000-0000-0000000000a2'
         AND ua.program_id=(SELECT id FROM programs WHERE slug='yc-summer-2026')
         AND pq.program_id=ua.program_id ORDER BY pq.order_index LIMIT 1$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM application_answers WHERE content='my answer'))$q$,
 'dml', NULL,
 $q$INSERT INTO user_applications (user_id, program_id) VALUES ('00000000-0000-0000-0000-0000000000a2',(SELECT id FROM programs WHERE slug='yc-summer-2026'))$q$);

SELECT p0.test('P-4e','personal answers: upsert profile_answers against a canonical question (FK to archived_questions)',
 'EFFECT','EFFECT','authenticated',:'a2',
 $q$INSERT INTO profile_answers (user_id, archived_question_id, content)
      VALUES ('00000000-0000-0000-0000-0000000000a2','1b57fa6f-183c-4017-89f3-0d2008e22234','v1')
      ON CONFLICT (user_id, archived_question_id) DO UPDATE SET content='v2'$q$,
 $q$SELECT p0.effect(EXISTS (SELECT 1 FROM profile_answers WHERE content='v1'))$q$);

SELECT p0.test('P-4f','personal answers: second upsert updates the existing answer',
 'EFFECT','EFFECT','authenticated',:'a2',
 $q$INSERT INTO profile_answers (user_id, archived_question_id, content)
      VALUES ('00000000-0000-0000-0000-0000000000a2','1b57fa6f-183c-4017-89f3-0d2008e22234','v1')
      ON CONFLICT (user_id, archived_question_id) DO UPDATE SET content='v2'$q$,
 $q$SELECT p0.effect((SELECT content FROM profile_answers WHERE user_id='00000000-0000-0000-0000-0000000000a2')='v2')$q$,
 'dml', NULL,
 $q$INSERT INTO profile_answers (user_id, archived_question_id, content) VALUES ('00000000-0000-0000-0000-0000000000a2','1b57fa6f-183c-4017-89f3-0d2008e22234','v1')$q$);

-- ---------------- ALLOWED: reads --------------------------------------
SELECT p0.test('P-5a','anon reads: 5 canonical programs, 103 canonical relationships, canonical-linked questions only',
 'OK','OK','anon',NULL,
 $q$SELECT (SELECT count(*) FROM programs)||'/'||(SELECT count(*) FROM program_questions)||'/'||(SELECT count(*) FROM archived_questions)$q$,
 $q$SELECT CASE WHEN current_setting('p0.last') = '5/103/'||(SELECT count(DISTINCT pq.archived_question_id) FROM program_questions pq JOIN programs p ON p.id=pq.program_id WHERE p.source='canonical')
        THEN 'OK' ELSE 'MISMATCH '||current_setting('p0.last') END$q$,
 'scalar');

SELECT p0.test('P-5b','authenticated a2 reads canonical + own saved (6 programs) but not a1''s private program',
 '6/false','6/false','authenticated',:'a2',
 $q$SELECT (SELECT count(*) FROM programs)||'/'||EXISTS(SELECT 1 FROM programs WHERE slug='t-owned')::text$q$,
 $q$SELECT current_setting('p0.last')$q$,
 'scalar');

SELECT p0.test('P-5c','authenticated a1 reads canonical + own saved program (6 programs, incl. t-owned)',
 '6/true','6/true','authenticated',:'a1',
 $q$SELECT (SELECT count(*) FROM programs)||'/'||EXISTS(SELECT 1 FROM programs WHERE slug='t-owned')::text$q$,
 $q$SELECT current_setting('p0.last')$q$,
 'scalar');

SELECT p0.report();
