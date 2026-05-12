-- seed/programs/job-ux-researcher.sql
-- UX Researcher Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'job-ux-researcher',
  'UX Researcher Application',
  'Job Application Archetype',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['research', 'UX', 'design', 'product'],
  'Application questions for UX researcher roles covering research methodology, insight generation, and impact.',
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
  VALUES (gen_random_uuid(), 'Tell us about yourself. What should we know about your background and what you are looking for?', 'personal', 300, 1, 0.92, true, ARRAY['UX Researcher Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'UX Researcher Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about yourself. What should we know about your background and what you are looking for?', 300, true, 1, 'Application Questions');

-- Q2: Research project end-to-end
SELECT id INTO q_id FROM archived_questions WHERE text = 'Walk us through a research project from start to finish. How did you decide on your methodology and what did you find?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Walk us through a research project from start to finish. How did you decide on your methodology and what did you find?', 'technical', 400, 1, 0.93, false, ARRAY['UX Researcher Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'UX Researcher Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Walk us through a research project from start to finish. How did you decide on your methodology and what did you find?', 400, true, 2, 'Application Questions');

-- Q3: Research impact on decisions
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a time your research findings changed the direction of a product or decision. What was the impact?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a time your research findings changed the direction of a product or decision. What was the impact?', 'traction', 350, 1, 0.92, false, ARRAY['UX Researcher Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'UX Researcher Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a time your research findings changed the direction of a product or decision. What was the impact?', 350, true, 3, 'Application Questions');

-- Q4: Methodology selection
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you decide which research methodology to use for a given question? Walk us through your reasoning.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you decide which research methodology to use for a given question? Walk us through your reasoning.', 'technical', 300, 1, 0.89, false, ARRAY['UX Researcher Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'UX Researcher Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you decide which research methodology to use for a given question? Walk us through your reasoning.', 300, true, 4, 'Application Questions');

-- Q5: Research credibility / pushback
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time when stakeholders pushed back on your research findings. How did you respond?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time when stakeholders pushed back on your research findings. How did you respond?', 'team', 300, 1, 0.87, false, ARRAY['UX Researcher Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'UX Researcher Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time when stakeholders pushed back on your research findings. How did you respond?', 300, true, 5, 'Application Questions');

-- Q6: Research communication
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you communicate research insights to non-researchers? What makes research actionable?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you communicate research insights to non-researchers? What makes research actionable?', 'team', 250, 1, 0.88, false, ARRAY['UX Researcher Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'UX Researcher Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you communicate research insights to non-researchers? What makes research actionable?', 250, true, 6, 'Application Questions');

-- Q7: Failure / growth mindset
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you failed or made a significant mistake. What did you learn?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you failed or made a significant mistake. What did you learn?', 'personal', 300, 1, 0.91, true, ARRAY['UX Researcher Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'UX Researcher Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you failed or made a significant mistake. What did you learn?', 300, true, 7, 'Application Questions');

-- Q8: Career goals / vision
SELECT id INTO q_id FROM archived_questions WHERE text = 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 'vision', 200, 1, 0.87, true, ARRAY['UX Researcher Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'UX Researcher Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 200, true, 8, 'Application Questions');

END $$;