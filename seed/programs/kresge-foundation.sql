-- seed/programs/kresge-foundation.sql
-- Kresge Foundation Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'kresge-foundation',
  'Kresge Foundation Grant',
  'Kresge Foundation',
  'grant',
  'open',
  10000000,
  500000000,
  0.0,
  ARRAY['US'],
  ARRAY['urban-opportunity', 'arts', 'education', 'health'],
  'Kresge Foundation works to expand opportunity in America''s cities through grantmaking and social investing.',
  'https://kresge.org/grants-social-investments/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Project and alignment
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your project and how it aligns with Kresge''s focus on expanding opportunities in America''s cities.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your project and how it aligns with Kresge''s focus on expanding opportunities in America''s cities.', 'fit', 500, 1, 0.91, false, ARRAY['Kresge Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Kresge Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your project and how it aligns with Kresge''s focus on expanding opportunities in America''s cities.', 500, true, 1, 'Project');

-- Q2: Community involvement
SELECT id INTO q_id FROM archived_questions WHERE text = 'Who are the people your project serves, and how are they involved in shaping it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Who are the people your project serves, and how are they involved in shaping it?', 'impact', 400, 1, 0.91, false, ARRAY['Kresge Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Kresge Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Who are the people your project serves, and how are they involved in shaping it?', 400, true, 2, 'Community');

-- Q3: Track record
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your organization''s track record in this area?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your organization''s track record in this area?', 'traction', 300, 1, 0.88, false, ARRAY['Kresge Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Kresge Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your organization''s track record in this area?', 300, true, 3, 'Organization');

END $$;
