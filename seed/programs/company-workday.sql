-- seed/programs/company-workday.sql
-- Workday Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-workday',
  'Workday Application',
  'Workday',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['tech', 'enterprise software', 'hr tech', 'finance software', 'cloud'],
  'Workday application questions asked across their application portal for engineering, product, sales, and customer success roles.',
  'https://www.workday.com/en-us/company/careers',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Workday?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Workday?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Workday?', 'fit', 300, 1, 0.92, false, ARRAY['Workday Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Workday Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Workday?', 300, true, 1, 'Application Questions');

-- Q2: Tell me about a time you helped a customer solve a complex p
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you helped a customer solve a complex problem.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you helped a customer solve a complex problem.', 'personal', 400, 1, 0.9, false, ARRAY['Workday Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Workday Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you helped a customer solve a complex problem.', 400, true, 2, 'Application Questions');

-- Q3: Describe a project where you balanced speed and quality.
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a project where you balanced speed and quality.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a project where you balanced speed and quality.', 'personal', 400, 1, 0.89, false, ARRAY['Workday Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Workday Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a project where you balanced speed and quality.', 400, true, 3, 'Application Questions');

-- Q4: Tell me about a time you had to explain a technical concept 
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to explain a technical concept to a non-technical audience.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to explain a technical concept to a non-technical audience.', 'personal', 400, 1, 0.88, false, ARRAY['Workday Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Workday Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to explain a technical concept to a non-technical audience.', 400, true, 4, 'Application Questions');

-- Q5: How do you approach continuous learning in your field?
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you approach continuous learning in your field?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you approach continuous learning in your field?', 'personal', 300, 1, 0.86, false, ARRAY['Workday Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Workday Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you approach continuous learning in your field?', 300, true, 5, 'Application Questions');

END $$;