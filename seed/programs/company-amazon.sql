-- seed/programs/company-amazon.sql
-- Amazon Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-amazon',
  'Amazon Application',
  'Amazon',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['tech', 'ecommerce', 'cloud', 'logistics', 'operations'],
  'Amazon application questions based on Leadership Principles, asked across Workday and internal applications for engineering, product, and operations roles.',
  'https://www.amazon.jobs',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Tell me about a time you delivered results beyond what was r
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you delivered results beyond what was required.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you delivered results beyond what was required.', 'personal', 400, 1, 0.92, false, ARRAY['Amazon Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Amazon Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you delivered results beyond what was required.', 400, true, 1, 'Application Questions');

-- Q2: Describe a time you disagreed with a decision. What did you 
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you disagreed with a decision. What did you do?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you disagreed with a decision. What did you do?', 'personal', 400, 1, 0.91, false, ARRAY['Amazon Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Amazon Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you disagreed with a decision. What did you do?', 400, true, 2, 'Application Questions');

-- Q3: Tell me about a time you had to think long-term despite shor
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to think long-term despite short-term pressure.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to think long-term despite short-term pressure.', 'personal', 400, 1, 0.9, false, ARRAY['Amazon Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Amazon Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to think long-term despite short-term pressure.', 400, true, 3, 'Application Questions');

-- Q4: Describe a time you had to learn something quickly.
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you had to learn something quickly.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you had to learn something quickly.', 'personal', 400, 1, 0.89, false, ARRAY['Amazon Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Amazon Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you had to learn something quickly.', 400, true, 4, 'Application Questions');

-- Q5: Tell me about a time you had to earn the trust of a difficul
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to earn the trust of a difficult stakeholder.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to earn the trust of a difficult stakeholder.', 'personal', 400, 1, 0.89, false, ARRAY['Amazon Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Amazon Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to earn the trust of a difficult stakeholder.', 400, true, 5, 'Application Questions');

END $$;