-- seed/programs/company-google.sql
-- Google Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-google',
  'Google Application',
  'Google',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['tech', 'engineering', 'product', 'software'],
  'Google application questions asked across Greenhouse applications for engineering, product, and operations roles.',
  'https://careers.google.com',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Tell us about yourself and your background.
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about yourself and your background.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about yourself and your background.', 'personal', 300, 1, 0.95, true, ARRAY['Google Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Google Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about yourself and your background.', 300, true, 1, 'Application Questions');

-- Q2: Why Google?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Google?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Google?', 'fit', 300, 1, 0.92, false, ARRAY['Google Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Google Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Google?', 300, true, 2, 'Application Questions');

-- Q3: Describe a project where you had significant impact. What di
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a project where you had significant impact. What did you do and what was the result?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a project where you had significant impact. What did you do and what was the result?', 'personal', 400, 1, 0.9, false, ARRAY['Google Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Google Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a project where you had significant impact. What did you do and what was the result?', 400, true, 3, 'Application Questions');

-- Q4: Tell us about a time you had to influence without authority.
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a time you had to influence without authority.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a time you had to influence without authority.', 'personal', 400, 1, 0.88, false, ARRAY['Google Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Google Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a time you had to influence without authority.', 400, true, 4, 'Application Questions');

-- Q5: What is your proudest technical or professional achievement?
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your proudest technical or professional achievement?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your proudest technical or professional achievement?', 'personal', 400, 1, 0.88, false, ARRAY['Google Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Google Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your proudest technical or professional achievement?', 400, true, 5, 'Application Questions');

END $$;