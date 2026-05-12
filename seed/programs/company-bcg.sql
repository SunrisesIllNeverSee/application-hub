-- seed/programs/company-bcg.sql
-- BCG Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-bcg',
  'BCG Application',
  'BCG',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['consulting', 'strategy', 'management consulting', 'business'],
  'BCG application questions asked across their online application portal for associate, consultant, and specialist roles.',
  'https://careers.bcg.com',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why BCG?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why BCG?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why BCG?', 'fit', 500, 1, 0.93, false, ARRAY['BCG Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'BCG Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why BCG?', 500, true, 1, 'Application Questions');

-- Q2: Tell me about a time you had to lead through influence, with
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to lead through influence, without formal authority.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to lead through influence, without formal authority.', 'personal', 500, 1, 0.91, false, ARRAY['BCG Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'BCG Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to lead through influence, without formal authority.', 500, true, 2, 'Application Questions');

-- Q3: Describe a situation where your analysis changed a significa
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a situation where your analysis changed a significant decision.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a situation where your analysis changed a significant decision.', 'personal', 500, 1, 0.9, false, ARRAY['BCG Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'BCG Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a situation where your analysis changed a significant decision.', 500, true, 3, 'Application Questions');

-- Q4: Tell me about a time you failed. What did you learn?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you failed. What did you learn?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you failed. What did you learn?', 'personal', 400, 1, 0.89, false, ARRAY['BCG Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'BCG Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you failed. What did you learn?', 400, true, 4, 'Application Questions');

-- Q5: What impact do you want to have in your career?
SELECT id INTO q_id FROM archived_questions WHERE text = 'What impact do you want to have in your career?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What impact do you want to have in your career?', 'vision', 400, 1, 0.88, false, ARRAY['BCG Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'BCG Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What impact do you want to have in your career?', 400, true, 5, 'Application Questions');

END $$;