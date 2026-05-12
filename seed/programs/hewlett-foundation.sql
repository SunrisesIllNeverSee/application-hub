-- seed/programs/hewlett-foundation.sql
-- Hewlett Foundation Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'hewlett-foundation',
  'Hewlett Foundation Grant',
  'William and Flora Hewlett Foundation',
  'grant',
  'open',
  10000000,
  500000000,
  0.0,
  ARRAY['US', 'Global'],
  ARRAY['education', 'environment', 'performing-arts', 'global-development'],
  'The Hewlett Foundation works to advance ideas and support institutions to promote a better world.',
  'https://hewlett.org/grants/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Problem description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the problem you are addressing and why it matters.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the problem you are addressing and why it matters.', 'problem', 500, 1, 0.92, false, ARRAY['Hewlett Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Hewlett Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the problem you are addressing and why it matters.', 500, true, 1, 'Problem');

-- Q2: Proposed approach
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your proposed approach and why do you believe it will work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your proposed approach and why do you believe it will work?', 'solution', 600, 1, 0.93, false, ARRAY['Hewlett Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Hewlett Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your proposed approach and why do you believe it will work?', 600, true, 2, 'Approach');

-- Q3: Knowing if you succeeded
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will you know if you have succeeded?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will you know if you have succeeded?', 'impact', 300, 1, 0.89, false, ARRAY['Hewlett Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Hewlett Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will you know if you have succeeded?', 300, true, 3, 'Evaluation');

END $$;
