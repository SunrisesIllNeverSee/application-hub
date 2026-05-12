-- seed/programs/job-senior-product-manager.sql
-- Senior Product Manager Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'job-senior-product-manager',
  'Senior Product Manager Application',
  'Job Application Archetype',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['product', 'strategy', 'leadership', 'tech'],
  'Application questions for senior product manager roles emphasizing vision, roadmap, and strategic leadership.',
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
  VALUES (gen_random_uuid(), 'Tell us about yourself. What should we know about your background and what you are looking for?', 'personal', 300, 1, 0.92, true, ARRAY['Senior Product Manager Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Product Manager Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about yourself. What should we know about your background and what you are looking for?', 300, true, 1, 'Application Questions');

-- Q2: Product ownership / pride
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a product you have worked on that you are proud of. What was your contribution and what was the outcome?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a product you have worked on that you are proud of. What was your contribution and what was the outcome?', 'solution', 400, 1, 0.93, false, ARRAY['Senior Product Manager Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Product Manager Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a product you have worked on that you are proud of. What was your contribution and what was the outcome?', 400, true, 2, 'Application Questions');

-- Q3: Roadmap / vision setting
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you defined and executed a multi-quarter product roadmap. How did you set the vision and get alignment?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you defined and executed a multi-quarter product roadmap. How did you set the vision and get alignment?', 'vision', 400, 1, 0.92, false, ARRAY['Senior Product Manager Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Product Manager Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you defined and executed a multi-quarter product roadmap. How did you set the vision and get alignment?', 400, true, 3, 'Application Questions');

-- Q4: Prioritization framework
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you prioritize features when you have more work than your team can handle? Walk us through your framework.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you prioritize features when you have more work than your team can handle? Walk us through your framework.', 'business_model', 300, 1, 0.91, false, ARRAY['Senior Product Manager Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Product Manager Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you prioritize features when you have more work than your team can handle? Walk us through your framework.', 300, true, 4, 'Application Questions');

-- Q5: Influence without authority
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a time you had to influence without authority to get something important done. What was your approach?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a time you had to influence without authority to get something important done. What was your approach?', 'team', 350, 1, 0.9, false, ARRAY['Senior Product Manager Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Product Manager Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a time you had to influence without authority to get something important done. What was your approach?', 350, true, 5, 'Application Questions');

-- Q6: Developing others
SELECT id INTO q_id FROM archived_questions WHERE text = 'How have you grown and developed other PMs or cross-functional team members?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How have you grown and developed other PMs or cross-functional team members?', 'team', 300, 1, 0.87, false, ARRAY['Senior Product Manager Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Product Manager Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How have you grown and developed other PMs or cross-functional team members?', 300, true, 6, 'Application Questions');

-- Q7: Product failure / learning
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time a product you led did not meet its goals. What did you learn and what would you do differently?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time a product you led did not meet its goals. What did you learn and what would you do differently?', 'personal', 350, 1, 0.89, false, ARRAY['Senior Product Manager Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Product Manager Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time a product you led did not meet its goals. What did you learn and what would you do differently?', 350, true, 7, 'Application Questions');

-- Q8: Career goals / vision
SELECT id INTO q_id FROM archived_questions WHERE text = 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 'vision', 200, 1, 0.87, true, ARRAY['Senior Product Manager Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Product Manager Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 200, true, 8, 'Application Questions');

END $$;