-- seed/programs/company-apple.sql
-- Apple Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-apple',
  'Apple Application',
  'Apple',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['tech', 'hardware', 'software', 'design', 'consumer electronics'],
  'Apple application questions asked across internal Workday applications for engineering, design, product, and operations roles.',
  'https://jobs.apple.com',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Apple?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Apple?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Apple?', 'fit', 300, 1, 0.92, false, ARRAY['Apple Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Apple Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Apple?', 300, true, 1, 'Application Questions');

-- Q2: Describe a complex project where you had to align multiple t
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a complex project where you had to align multiple teams or stakeholders.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a complex project where you had to align multiple teams or stakeholders.', 'personal', 400, 1, 0.9, false, ARRAY['Apple Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Apple Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a complex project where you had to align multiple teams or stakeholders.', 400, true, 2, 'Application Questions');

-- Q3: Tell me about a time you improved a process or product signi
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you improved a process or product significantly.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you improved a process or product significantly.', 'personal', 400, 1, 0.89, false, ARRAY['Apple Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Apple Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you improved a process or product significantly.', 400, true, 3, 'Application Questions');

-- Q4: How do you handle tight deadlines and competing priorities?
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you handle tight deadlines and competing priorities?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you handle tight deadlines and competing priorities?', 'personal', 300, 1, 0.87, false, ARRAY['Apple Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Apple Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you handle tight deadlines and competing priorities?', 300, true, 4, 'Application Questions');

-- Q5: What does innovation mean to you, and give an example of how
SELECT id INTO q_id FROM archived_questions WHERE text = 'What does innovation mean to you, and give an example of how you''ve applied it.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What does innovation mean to you, and give an example of how you''ve applied it.', 'personal', 400, 1, 0.88, false, ARRAY['Apple Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Apple Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What does innovation mean to you, and give an example of how you''ve applied it.', 400, true, 5, 'Application Questions');

END $$;