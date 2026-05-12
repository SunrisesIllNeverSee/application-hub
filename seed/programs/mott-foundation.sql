-- seed/programs/mott-foundation.sql
-- Charles Stewart Mott Foundation Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'mott-foundation',
  'Charles Stewart Mott Foundation Grant',
  'Charles Stewart Mott Foundation',
  'grant',
  'open',
  5000000,
  200000000,
  0.0,
  ARRAY['US', 'Global'],
  ARRAY['civil-society', 'environment', 'flint-michigan', 'exploratory'],
  'Mott Foundation supports civil society, environment, exploratory grants, and community development in Flint, Michigan.',
  'https://www.mott.org/grants/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Project description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your project and how it supports civil society, environment, exploratory, or Flint, Michigan.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your project and how it supports civil society, environment, exploratory, or Flint, Michigan.', 'fit', 600, 1, 0.90, false, ARRAY['Charles Stewart Mott Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Charles Stewart Mott Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your project and how it supports civil society, environment, exploratory, or Flint, Michigan.', 600, true, 1, 'Project');

-- Q2: Theory of change
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your theory of change?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your theory of change?', 'vision', 400, 1, 0.91, true, ARRAY['Charles Stewart Mott Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Charles Stewart Mott Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your theory of change?', 400, true, 2, 'Theory of Change');

-- Q3: Measuring progress
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will you measure progress toward your goals?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will you measure progress toward your goals?', 'impact', 300, 1, 0.88, false, ARRAY['Charles Stewart Mott Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Charles Stewart Mott Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will you measure progress toward your goals?', 300, true, 3, 'Evaluation');

END $$;
