-- seed/programs/job-research-scientist.sql
-- Research Scientist Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'job-research-scientist',
  'Research Scientist Application',
  'Job Application Archetype',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['research', 'science', 'academia', 'R&D'],
  'Application questions for research scientist roles covering research design, publication, and collaboration.',
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
  VALUES (gen_random_uuid(), 'Tell us about yourself. What should we know about your background and what you are looking for?', 'personal', 300, 1, 0.92, true, ARRAY['Research Scientist Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Research Scientist Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about yourself. What should we know about your background and what you are looking for?', 300, true, 1, 'Application Questions');

-- Q2: Signature research project
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a research project you are most proud of. What was the question, your methodology, and what did you find?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a research project you are most proud of. What was the question, your methodology, and what did you find?', 'solution', 400, 1, 0.93, false, ARRAY['Research Scientist Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Research Scientist Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a research project you are most proud of. What was the question, your methodology, and what did you find?', 400, true, 2, 'Application Questions');

-- Q3: Negative results / adaptability
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time your research did not yield the results you expected. How did you interpret and respond to the negative or null findings?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time your research did not yield the results you expected. How did you interpret and respond to the negative or null findings?', 'personal', 350, 1, 0.91, false, ARRAY['Research Scientist Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Research Scientist Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time your research did not yield the results you expected. How did you interpret and respond to the negative or null findings?', 350, true, 3, 'Application Questions');

-- Q4: Rigor vs speed
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you balance the rigor required for publication with the speed required in an applied or industry research setting?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you balance the rigor required for publication with the speed required in an applied or industry research setting?', 'technical', 300, 1, 0.89, false, ARRAY['Research Scientist Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Research Scientist Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you balance the rigor required for publication with the speed required in an applied or industry research setting?', 300, true, 4, 'Application Questions');

-- Q5: Interdisciplinary collaboration
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a time you collaborated with researchers or teams from other disciplines. What made it challenging and what made it work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a time you collaborated with researchers or teams from other disciplines. What made it challenging and what made it work?', 'team', 350, 1, 0.88, false, ARRAY['Research Scientist Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Research Scientist Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a time you collaborated with researchers or teams from other disciplines. What made it challenging and what made it work?', 350, true, 5, 'Application Questions');

-- Q6: Communicating to non-technical audiences
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you communicate complex analyses or model results to non-technical stakeholders?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you communicate complex analyses or model results to non-technical stakeholders?', 'team', 250, 1, 0.89, false, ARRAY['Research Scientist Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Research Scientist Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you communicate complex analyses or model results to non-technical stakeholders?', 250, true, 6, 'Application Questions');

-- Q7: Research direction / field currency
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe how you keep up with your field and evaluate which new research directions are worth pursuing.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe how you keep up with your field and evaluate which new research directions are worth pursuing.', 'personal', 250, 1, 0.84, false, ARRAY['Research Scientist Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Research Scientist Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe how you keep up with your field and evaluate which new research directions are worth pursuing.', 250, true, 7, 'Application Questions');

-- Q8: Career goals / vision
SELECT id INTO q_id FROM archived_questions WHERE text = 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 'vision', 200, 1, 0.87, true, ARRAY['Research Scientist Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Research Scientist Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 200, true, 8, 'Application Questions');

END $$;