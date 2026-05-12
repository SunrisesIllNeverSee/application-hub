-- seed/programs/job-solutions-engineer.sql
-- Solutions Engineer Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'job-solutions-engineer',
  'Solutions Engineer Application',
  'Job Application Archetype',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['solutions-engineering', 'sales-engineering', 'technical-sales'],
  'Application questions for solutions engineer and sales engineer roles covering technical credibility, customer empathy, and communication.',
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
  VALUES (gen_random_uuid(), 'Tell us about yourself. What should we know about your background and what you are looking for?', 'personal', 300, 1, 0.92, true, ARRAY['Solutions Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Solutions Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about yourself. What should we know about your background and what you are looking for?', 300, true, 1, 'Application Questions');

-- Q2: Technical solution for customer
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a time you helped a customer understand how a technical product solved their specific problem. What was your approach?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a time you helped a customer understand how a technical product solved their specific problem. What was your approach?', 'solution', 400, 1, 0.93, false, ARRAY['Solutions Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Solutions Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a time you helped a customer understand how a technical product solved their specific problem. What was your approach?', 400, true, 2, 'Application Questions');

-- Q3: POC / demo
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a technical proof-of-concept or demo you built for a customer. What were the requirements and what was the outcome?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a technical proof-of-concept or demo you built for a customer. What were the requirements and what was the outcome?', 'technical', 350, 1, 0.91, false, ARRAY['Solutions Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Solutions Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a technical proof-of-concept or demo you built for a customer. What were the requirements and what was the outcome?', 350, true, 3, 'Application Questions');

-- Q4: Technical objection handling
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a situation where a customer had a technical objection you could not fully resolve. How did you handle it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a situation where a customer had a technical objection you could not fully resolve. How did you handle it?', 'personal', 300, 1, 0.88, false, ARRAY['Solutions Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Solutions Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a situation where a customer had a technical objection you could not fully resolve. How did you handle it?', 300, true, 4, 'Application Questions');

-- Q5: Communicating to non-technical audiences
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you communicate complex analyses or model results to non-technical stakeholders?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you communicate complex analyses or model results to non-technical stakeholders?', 'team', 250, 1, 0.89, false, ARRAY['Solutions Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Solutions Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you communicate complex analyses or model results to non-technical stakeholders?', 250, true, 5, 'Application Questions');

-- Q6: AE and product collaboration
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe how you work with account executives and product teams to close deals or improve the product.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe how you work with account executives and product teams to close deals or improve the product.', 'team', 300, 1, 0.86, false, ARRAY['Solutions Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Solutions Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe how you work with account executives and product teams to close deals or improve the product.', 300, true, 6, 'Application Questions');

-- Q7: Career goals / vision
SELECT id INTO q_id FROM archived_questions WHERE text = 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 'vision', 200, 1, 0.87, true, ARRAY['Solutions Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Solutions Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 200, true, 7, 'Application Questions');

END $$;