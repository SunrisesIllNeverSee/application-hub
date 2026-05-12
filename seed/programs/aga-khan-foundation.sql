-- seed/programs/aga-khan-foundation.sql
-- Aga Khan Foundation USA Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'aga-khan-foundation',
  'Aga Khan Foundation USA Grant',
  'Aga Khan Foundation USA',
  'grant',
  'open',
  5000000,
  500000000,
  0.0,
  ARRAY['Asia', 'Africa'],
  ARRAY['international-development', 'health', 'education', 'rural-development', 'civil-society'],
  'Aga Khan Foundation USA supports sustainable development through programs in Asia and Africa focused on health, education, rural development, and civil society.',
  'https://www.akfusa.org/grants/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Development challenge
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the development challenge your project addresses in Asia or Africa.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the development challenge your project addresses in Asia or Africa.', 'problem', 600, 1, 0.91, false, ARRAY['Aga Khan Foundation USA Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Aga Khan Foundation USA Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the development challenge your project addresses in Asia or Africa.', 600, true, 1, 'Challenge');

-- Q2: Promoting self-reliance
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your approach promote self-reliance in the communities you serve?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your approach promote self-reliance in the communities you serve?', 'solution', 500, 1, 0.92, false, ARRAY['Aga Khan Foundation USA Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Aga Khan Foundation USA Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your approach promote self-reliance in the communities you serve?', 500, true, 2, 'Approach');

-- Q3: Evidence of effectiveness
SELECT id INTO q_id FROM archived_questions WHERE text = 'What evidence do you have of your organization''s effectiveness?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What evidence do you have of your organization''s effectiveness?', 'traction', 400, 1, 0.90, false, ARRAY['Aga Khan Foundation USA Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Aga Khan Foundation USA Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What evidence do you have of your organization''s effectiveness?', 400, true, 3, 'Track Record');

END $$;
