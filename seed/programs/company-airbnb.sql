-- seed/programs/company-airbnb.sql
-- Airbnb Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-airbnb',
  'Airbnb Application',
  'Airbnb',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['tech', 'marketplace', 'travel', 'hospitality', 'product'],
  'Airbnb application questions asked across Greenhouse applications for engineering, product, design, and operations roles.',
  'https://careers.airbnb.com',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Airbnb?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Airbnb?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Airbnb?', 'fit', 300, 1, 0.92, false, ARRAY['Airbnb Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Airbnb Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Airbnb?', 300, true, 1, 'Application Questions');

-- Q2: Tell me about a time you went above and beyond for a custome
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you went above and beyond for a customer or user.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you went above and beyond for a customer or user.', 'personal', 400, 1, 0.9, false, ARRAY['Airbnb Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Airbnb Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you went above and beyond for a customer or user.', 400, true, 2, 'Application Questions');

-- Q3: Describe a time you had to build consensus in a cross-functi
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you had to build consensus in a cross-functional team.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you had to build consensus in a cross-functional team.', 'personal', 400, 1, 0.89, false, ARRAY['Airbnb Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Airbnb Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you had to build consensus in a cross-functional team.', 400, true, 3, 'Application Questions');

-- Q4: Tell me about a project where you had to balance user needs 
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a project where you had to balance user needs with business constraints.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a project where you had to balance user needs with business constraints.', 'personal', 400, 1, 0.88, false, ARRAY['Airbnb Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Airbnb Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a project where you had to balance user needs with business constraints.', 400, true, 4, 'Application Questions');

-- Q5: What does belonging mean to you?
SELECT id INTO q_id FROM archived_questions WHERE text = 'What does belonging mean to you?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What does belonging mean to you?', 'personal', 300, 1, 0.87, false, ARRAY['Airbnb Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Airbnb Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What does belonging mean to you?', 300, true, 5, 'Application Questions');

END $$;