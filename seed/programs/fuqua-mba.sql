-- seed/programs/fuqua-mba.sql
-- Duke Fuqua MBA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'fuqua-mba',
  'Duke Fuqua MBA',
  'Duke University',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mba', 'graduate', 'business', 'leadership', 'team fuqua'],
  'Duke Fuqua MBA is known for its Team Fuqua culture of collaboration, healthcare and global management strengths, and developing leaders who drive positive impact.',
  'https://www.fuqua.duke.edu/programs/daytime-mba/admissions',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: Post-MBA career goals
SELECT id INTO q_id FROM archived_questions WHERE text = 'What are your post-MBA career goals? Share your first choice career plan and your alternate plan.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What are your post-MBA career goals? Share your first choice career plan and your alternate plan.', 'vision', 500, 1, 0.92, false, ARRAY['Duke Fuqua MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Duke Fuqua MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What are your post-MBA career goals? Share your first choice career plan and your alternate plan.', 500, true, 1, 'Essays');

-- Q2: Team Fuqua spirit
SELECT id INTO q_id FROM archived_questions WHERE text = 'The ''Team Fuqua'' spirit and community is one of the unique aspects of the Fuqua experience. As we seek to build a community of T-shaped leaders, we value people who bring both depth and breadth to our community. Please share with us two or three examples of your experience working in teams, building community, or serving others.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'The ''Team Fuqua'' spirit and community is one of the unique aspects of the Fuqua experience. As we seek to build a community of T-shaped leaders, we value people who bring both depth and breadth to our community. Please share with us two or three examples of your experience working in teams, building community, or serving others.', 'team', 500, 1, 0.91, false, ARRAY['Duke Fuqua MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Duke Fuqua MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'The ''Team Fuqua'' spirit and community is one of the unique aspects of the Fuqua experience. As we seek to build a community of T-shaped leaders, we value people who bring both depth and breadth to our community. Please share with us two or three examples of your experience working in teams, building community, or serving others.', 500, true, 2, 'Essays');

END $$;
