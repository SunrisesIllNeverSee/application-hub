-- seed/programs/company-bain.sql
-- Bain & Company Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-bain',
  'Bain & Company Application',
  'Bain & Company',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['consulting', 'strategy', 'management consulting', 'private equity'],
  'Bain & Company application questions asked across their online application portal for associate consultant and consultant roles.',
  'https://www.bain.com/careers',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Bain? Why consulting?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Bain? Why consulting?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Bain? Why consulting?', 'fit', 500, 1, 0.93, false, ARRAY['Bain & Company Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Bain & Company Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Bain? Why consulting?', 500, true, 1, 'Application Questions');

-- Q2: Tell me about a significant accomplishment in your career. W
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a significant accomplishment in your career. What made it meaningful?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a significant accomplishment in your career. What made it meaningful?', 'personal', 500, 1, 0.91, false, ARRAY['Bain & Company Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Bain & Company Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a significant accomplishment in your career. What made it meaningful?', 500, true, 2, 'Application Questions');

-- Q3: Describe a time you had to bring a team along on a difficult
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you had to bring a team along on a difficult change.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you had to bring a team along on a difficult change.', 'personal', 500, 1, 0.9, false, ARRAY['Bain & Company Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Bain & Company Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you had to bring a team along on a difficult change.', 500, true, 3, 'Application Questions');

-- Q4: Tell me about a time you were creative in solving a problem.
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you were creative in solving a problem.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you were creative in solving a problem.', 'personal', 400, 1, 0.89, false, ARRAY['Bain & Company Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Bain & Company Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you were creative in solving a problem.', 400, true, 4, 'Application Questions');

-- Q5: What kind of leader do you want to become?
SELECT id INTO q_id FROM archived_questions WHERE text = 'What kind of leader do you want to become?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What kind of leader do you want to become?', 'vision', 400, 1, 0.88, false, ARRAY['Bain & Company Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Bain & Company Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What kind of leader do you want to become?', 400, true, 5, 'Application Questions');

END $$;