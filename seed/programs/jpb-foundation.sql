-- seed/programs/jpb-foundation.sql
-- JPB Foundation Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'jpb-foundation',
  'JPB Foundation Grant',
  'JPB Foundation',
  'grant',
  'open',
  10000000,
  500000000,
  0.0,
  ARRAY['US'],
  ARRAY['poverty', 'environment', 'medical-research'],
  'JPB Foundation is committed to advancing opportunity for those living in poverty, protecting the environment, and furthering medical research.',
  'https://www.jpbfoundation.org/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Poverty problem
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the poverty-related problem your project addresses.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the poverty-related problem your project addresses.', 'problem', 500, 1, 0.91, false, ARRAY['JPB Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'JPB Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the poverty-related problem your project addresses.', 500, true, 1, 'Problem');

-- Q2: Root causes of poverty
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your approach address the root causes of poverty?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your approach address the root causes of poverty?', 'solution', 500, 1, 0.92, false, ARRAY['JPB Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'JPB Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your approach address the root causes of poverty?', 500, true, 2, 'Approach');

-- Q3: Demonstrated impact
SELECT id INTO q_id FROM archived_questions WHERE text = 'What impact has your organization already demonstrated?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What impact has your organization already demonstrated?', 'traction', 400, 1, 0.91, false, ARRAY['JPB Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'JPB Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What impact has your organization already demonstrated?', 400, true, 3, 'Impact');

END $$;
