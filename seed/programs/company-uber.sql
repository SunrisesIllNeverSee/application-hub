-- seed/programs/company-uber.sql
-- Uber Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-uber',
  'Uber Application',
  'Uber',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['tech', 'marketplace', 'transportation', 'logistics', 'operations'],
  'Uber application questions asked across Greenhouse applications for engineering, product, operations, and data science roles.',
  'https://www.uber.com/us/en/careers',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Uber?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Uber?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Uber?', 'fit', 300, 1, 0.92, false, ARRAY['Uber Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Uber Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Uber?', 300, true, 1, 'Application Questions');

-- Q2: Tell me about a time you used data to drive a decision.
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you used data to drive a decision.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you used data to drive a decision.', 'personal', 400, 1, 0.9, false, ARRAY['Uber Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Uber Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you used data to drive a decision.', 400, true, 2, 'Application Questions');

-- Q3: Describe a project where you had to work through significant
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a project where you had to work through significant ambiguity.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a project where you had to work through significant ambiguity.', 'personal', 400, 1, 0.89, false, ARRAY['Uber Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Uber Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a project where you had to work through significant ambiguity.', 400, true, 3, 'Application Questions');

-- Q4: Tell me about a time you had to quickly adapt to changing ci
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to quickly adapt to changing circumstances.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to quickly adapt to changing circumstances.', 'personal', 400, 1, 0.88, false, ARRAY['Uber Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Uber Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to quickly adapt to changing circumstances.', 400, true, 4, 'Application Questions');

-- Q5: What does customer obsession mean to you, and give an exampl
SELECT id INTO q_id FROM archived_questions WHERE text = 'What does customer obsession mean to you, and give an example.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What does customer obsession mean to you, and give an example.', 'personal', 400, 1, 0.88, false, ARRAY['Uber Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Uber Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What does customer obsession mean to you, and give an example.', 400, true, 5, 'Application Questions');

END $$;