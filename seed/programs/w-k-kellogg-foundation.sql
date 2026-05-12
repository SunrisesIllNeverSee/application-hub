-- seed/programs/w-k-kellogg-foundation.sql
-- W.K. Kellogg Foundation Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'w-k-kellogg-foundation',
  'W.K. Kellogg Foundation Grant',
  'W.K. Kellogg Foundation',
  'grant',
  'open',
  10000000,
  300000000,
  0.0,
  ARRAY['US', 'Latin-America', 'Africa'],
  ARRAY['children', 'families', 'racial-equity', 'education', 'food-systems'],
  'W.K. Kellogg Foundation supports children, families, and communities to thrive, with a focus on racial equity.',
  'https://www.wkkf.org/grants',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Communities served
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the children, families, and communities you serve.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the children, families, and communities you serve.', 'impact', 500, 1, 0.90, false, ARRAY['W.K. Kellogg Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'W.K. Kellogg Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the children, families, and communities you serve.', 500, true, 1, 'Communities');

-- Q2: Support for thriving
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your work support thriving children, working families, and equitable communities?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your work support thriving children, working families, and equitable communities?', 'solution', 600, 1, 0.92, false, ARRAY['W.K. Kellogg Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'W.K. Kellogg Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your work support thriving children, working families, and equitable communities?', 600, true, 2, 'Approach');

-- Q3: Theory of change and evidence
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your theory of change, and what evidence supports it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your theory of change, and what evidence supports it?', 'vision', 500, 1, 0.92, false, ARRAY['W.K. Kellogg Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'W.K. Kellogg Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your theory of change, and what evidence supports it?', 500, true, 3, 'Theory of Change');

END $$;
