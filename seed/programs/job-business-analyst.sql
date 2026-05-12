-- seed/programs/job-business-analyst.sql
-- Business Analyst Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'job-business-analyst',
  'Business Analyst Application',
  'Job Application Archetype',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['analytics', 'business', 'strategy'],
  'Application questions for business analyst roles covering data analysis, problem framing, and recommendations.',
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
  VALUES (gen_random_uuid(), 'Tell us about yourself. What should we know about your background and what you are looking for?', 'personal', 300, 1, 0.92, true, ARRAY['Business Analyst Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Business Analyst Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about yourself. What should we know about your background and what you are looking for?', 300, true, 1, 'Application Questions');

-- Q2: Problem analysis / recommendation
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a business problem you analyzed and solved using data. How did you frame the problem and what did you recommend?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a business problem you analyzed and solved using data. How did you frame the problem and what did you recommend?', 'problem', 400, 1, 0.93, false, ARRAY['Business Analyst Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Business Analyst Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a business problem you analyzed and solved using data. How did you frame the problem and what did you recommend?', 400, true, 2, 'Application Questions');

-- Q3: Communicating to non-technical audiences
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you communicate complex analyses or model results to non-technical stakeholders?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you communicate complex analyses or model results to non-technical stakeholders?', 'team', 250, 1, 0.89, false, ARRAY['Business Analyst Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Business Analyst Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you communicate complex analyses or model results to non-technical stakeholders?', 250, true, 3, 'Application Questions');

-- Q4: Analysis to decision impact
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time your analysis led to a business decision. What was the outcome and what would you do differently?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time your analysis led to a business decision. What was the outcome and what would you do differently?', 'traction', 350, 1, 0.9, false, ARRAY['Business Analyst Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Business Analyst Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time your analysis led to a business decision. What was the outcome and what would you do differently?', 350, true, 4, 'Application Questions');

-- Q5: Analytical integrity
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you handle it when a stakeholder asks you to change your analysis to support a predetermined conclusion?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you handle it when a stakeholder asks you to change your analysis to support a predetermined conclusion?', 'personal', 250, 1, 0.88, false, ARRAY['Business Analyst Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Business Analyst Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you handle it when a stakeholder asks you to change your analysis to support a predetermined conclusion?', 250, true, 5, 'Application Questions');

-- Q6: Ambiguity / decision-making
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you had to make an important decision with incomplete information. What was your process?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you had to make an important decision with incomplete information. What was your process?', 'personal', 350, 1, 0.89, true, ARRAY['Business Analyst Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Business Analyst Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you had to make an important decision with incomplete information. What was your process?', 350, true, 6, 'Application Questions');

-- Q7: Failure / growth mindset
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you failed or made a significant mistake. What did you learn?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you failed or made a significant mistake. What did you learn?', 'personal', 300, 1, 0.91, true, ARRAY['Business Analyst Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Business Analyst Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you failed or made a significant mistake. What did you learn?', 300, true, 7, 'Application Questions');

-- Q8: Career goals / vision
SELECT id INTO q_id FROM archived_questions WHERE text = 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 'vision', 200, 1, 0.87, true, ARRAY['Business Analyst Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Business Analyst Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 200, true, 8, 'Application Questions');

END $$;