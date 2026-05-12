-- seed/programs/purpose-prize.sql
-- CoGenerate Purpose Prize — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'purpose-prize',
  'CoGenerate Purpose Prize',
  'CoGenerate',
  'grant',
  'open',
  10000000,
  10000000,
  0.0,
  ARRAY['US'],
  ARRAY['intergenerational', 'social-entrepreneurship', 'aging', 'social-impact'],
  'The Purpose Prize honors people over 60 who are combining their passion and experience to solve tough social problems, often in partnership with younger generations.',
  'https://cogenerate.org/purpose-prize/',
  false,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Intergenerational work
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe how your work brings generations together to solve social challenges.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe how your work brings generations together to solve social challenges.', 'solution', 600, 1, 0.90, false, ARRAY['CoGenerate Purpose Prize'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'CoGenerate Purpose Prize') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe how your work brings generations together to solve social challenges.', 600, true, 1, 'Intergenerational Work');

-- Q2: Lessons from intergenerational collaboration
SELECT id INTO q_id FROM archived_questions WHERE text = 'What have you learned about intergenerational collaboration through your work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What have you learned about intergenerational collaboration through your work?', 'traction', 500, 1, 0.89, false, ARRAY['CoGenerate Purpose Prize'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'CoGenerate Purpose Prize') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What have you learned about intergenerational collaboration through your work?', 500, true, 2, 'Learning');

-- Q3: Vision for future of work
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your vision for the future of your work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your vision for the future of your work?', 'vision', 400, 1, 0.88, false, ARRAY['CoGenerate Purpose Prize'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'CoGenerate Purpose Prize') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your vision for the future of your work?', 400, true, 3, 'Vision');

END $$;
