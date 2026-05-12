-- seed/programs/bush-foundation.sql
-- Bush Foundation Community Innovation Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'bush-foundation',
  'Bush Foundation Community Innovation Grant',
  'Bush Foundation',
  'grant',
  'open',
  10000000,
  100000000,
  0.0,
  ARRAY['US'],
  ARRAY['community-development', 'innovation', 'leadership', 'native-communities'],
  'Bush Foundation invests in great ideas and the people who power them in Minnesota, North Dakota, South Dakota, and 23 Native nations.',
  'https://www.bushfoundation.org/grants/',
  false,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Community challenge
SELECT id INTO q_id FROM archived_questions WHERE text = 'What community challenge are you addressing, and why is it important?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What community challenge are you addressing, and why is it important?', 'problem', 500, 1, 0.91, false, ARRAY['Bush Foundation Community Innovation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Bush Foundation Community Innovation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What community challenge are you addressing, and why is it important?', 500, true, 1, 'Challenge');

-- Q2: Innovative approach
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your innovative approach to this challenge.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your innovative approach to this challenge.', 'solution', 500, 1, 0.91, false, ARRAY['Bush Foundation Community Innovation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Bush Foundation Community Innovation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your innovative approach to this challenge.', 500, true, 2, 'Innovation');

-- Q3: Knowing if approach works
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will you know if your approach is working?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will you know if your approach is working?', 'impact', 300, 1, 0.88, false, ARRAY['Bush Foundation Community Innovation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Bush Foundation Community Innovation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will you know if your approach is working?', 300, true, 3, 'Learning');

-- Q4: Unique positioning
SELECT id INTO q_id FROM archived_questions WHERE text = 'What makes your organization uniquely positioned to do this work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What makes your organization uniquely positioned to do this work?', 'team', 300, 1, 0.89, false, ARRAY['Bush Foundation Community Innovation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Bush Foundation Community Innovation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What makes your organization uniquely positioned to do this work?', 300, true, 4, 'Organization');

END $$;
