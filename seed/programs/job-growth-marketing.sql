-- seed/programs/job-growth-marketing.sql
-- Growth Marketing Manager Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'job-growth-marketing',
  'Growth Marketing Manager Application',
  'Job Application Archetype',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['marketing', 'growth', 'analytics', 'experimentation'],
  'Application questions for growth marketing roles covering experimentation, metrics, and channel strategy.',
  'https://applicationhub.co/questions',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Introduction / background
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about yourself. What should we know about your background and what you are looking for?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about yourself. What should we know about your background and what you are looking for?', 'personal', 300, 1, 0.92, true, ARRAY['Growth Marketing Manager Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Growth Marketing Manager Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about yourself. What should we know about your background and what you are looking for?', 300, true, 1, 'Application Questions');

-- Q2: Growth experimentation
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a growth experiment you designed and ran. What was the hypothesis, result, and what did you learn?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a growth experiment you designed and ran. What was the hypothesis, result, and what did you learn?', 'traction', 400, 1, 0.93, false, ARRAY['Growth Marketing Manager Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Growth Marketing Manager Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a growth experiment you designed and ran. What was the hypothesis, result, and what did you learn?', 400, true, 2, 'Application Questions');

-- Q3: Growth metrics
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you measure the success of your marketing work? What metrics matter most to you and why?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you measure the success of your marketing work? What metrics matter most to you and why?', 'business_model', 250, 1, 0.89, false, ARRAY['Growth Marketing Manager Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Growth Marketing Manager Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you measure the success of your marketing work? What metrics matter most to you and why?', 250, true, 3, 'Application Questions');

-- Q4: Channel identification framework
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe how you identify the highest-leverage growth channel for a new product. Walk through your framework.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe how you identify the highest-leverage growth channel for a new product. Walk through your framework.', 'market', 300, 1, 0.91, false, ARRAY['Growth Marketing Manager Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Growth Marketing Manager Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe how you identify the highest-leverage growth channel for a new product. Walk through your framework.', 300, true, 4, 'Application Questions');

-- Q5: Growth failure / pivoting
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a time a growth initiative failed. What signals did you use to recognize it and what did you do next?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a time a growth initiative failed. What signals did you use to recognize it and what did you do next?', 'personal', 300, 1, 0.88, false, ARRAY['Growth Marketing Manager Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Growth Marketing Manager Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a time a growth initiative failed. What signals did you use to recognize it and what did you do next?', 300, true, 5, 'Application Questions');

-- Q6: Short-term vs long-term growth
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you balance short-term activation metrics with long-term retention and LTV?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you balance short-term activation metrics with long-term retention and LTV?', 'business_model', 300, 1, 0.87, false, ARRAY['Growth Marketing Manager Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Growth Marketing Manager Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you balance short-term activation metrics with long-term retention and LTV?', 300, true, 6, 'Application Questions');

-- Q7: Career goals / vision
SELECT id INTO q_id FROM archived_questions WHERE text = 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 'vision', 200, 1, 0.87, true, ARRAY['Growth Marketing Manager Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Growth Marketing Manager Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 200, true, 7, 'Application Questions');

END $$;