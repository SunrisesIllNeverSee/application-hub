-- seed/programs/company-jpmorgan.sql
-- JPMorgan Chase Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-jpmorgan',
  'JPMorgan Chase Application',
  'JPMorgan Chase',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['finance', 'banking', 'investment banking', 'financial services'],
  'JPMorgan Chase application questions asked across their application portal for analyst, associate, and technology roles.',
  'https://careers.jpmorgan.com',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why JPMorgan?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why JPMorgan?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why JPMorgan?', 'fit', 400, 1, 0.92, false, ARRAY['JPMorgan Chase Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'JPMorgan Chase Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why JPMorgan?', 400, true, 1, 'Application Questions');

-- Q2: Tell me about a time you managed a complex project with mult
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you managed a complex project with multiple stakeholders.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you managed a complex project with multiple stakeholders.', 'personal', 400, 1, 0.9, false, ARRAY['JPMorgan Chase Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'JPMorgan Chase Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you managed a complex project with multiple stakeholders.', 400, true, 2, 'Application Questions');

-- Q3: Describe a situation where you had to analyze data to drive 
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a situation where you had to analyze data to drive a recommendation.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a situation where you had to analyze data to drive a recommendation.', 'personal', 400, 1, 0.89, false, ARRAY['JPMorgan Chase Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'JPMorgan Chase Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a situation where you had to analyze data to drive a recommendation.', 400, true, 3, 'Application Questions');

-- Q4: Tell me about a time you worked through a significant challe
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you worked through a significant challenge in your career.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you worked through a significant challenge in your career.', 'personal', 400, 1, 0.88, false, ARRAY['JPMorgan Chase Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'JPMorgan Chase Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you worked through a significant challenge in your career.', 400, true, 4, 'Application Questions');

-- Q5: What does risk management mean to you in the context of your
SELECT id INTO q_id FROM archived_questions WHERE text = 'What does risk management mean to you in the context of your work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What does risk management mean to you in the context of your work?', 'personal', 300, 1, 0.87, false, ARRAY['JPMorgan Chase Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'JPMorgan Chase Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What does risk management mean to you in the context of your work?', 300, true, 5, 'Application Questions');

END $$;