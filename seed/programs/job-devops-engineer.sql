-- seed/programs/job-devops-engineer.sql
-- DevOps and Site Reliability Engineer Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'job-devops-engineer',
  'DevOps and Site Reliability Engineer Application',
  'Job Application Archetype',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['devops', 'SRE', 'infrastructure', 'engineering'],
  'Application questions for DevOps and site reliability engineer roles covering systems, reliability, and incident response.',
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
  VALUES (gen_random_uuid(), 'Tell us about yourself. What should we know about your background and what you are looking for?', 'personal', 300, 1, 0.92, true, ARRAY['DevOps and Site Reliability Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'DevOps and Site Reliability Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about yourself. What should we know about your background and what you are looking for?', 300, true, 1, 'Application Questions');

-- Q2: Incident response
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a significant outage or incident you were involved in. What happened, how did you respond, and what changed afterward?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a significant outage or incident you were involved in. What happened, how did you respond, and what changed afterward?', 'technical', 400, 1, 0.93, false, ARRAY['DevOps and Site Reliability Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'DevOps and Site Reliability Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a significant outage or incident you were involved in. What happened, how did you respond, and what changed afterward?', 400, true, 2, 'Application Questions');

-- Q3: Reliability improvement
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a reliability or performance improvement you implemented. What was the impact?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a reliability or performance improvement you implemented. What was the impact?', 'traction', 350, 1, 0.91, false, ARRAY['DevOps and Site Reliability Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'DevOps and Site Reliability Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a reliability or performance improvement you implemented. What was the impact?', 350, true, 3, 'Application Questions');

-- Q4: Observability / production systems
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you approach building systems that are observable and debuggable in production?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you approach building systems that are observable and debuggable in production?', 'technical', 300, 1, 0.89, false, ARRAY['DevOps and Site Reliability Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'DevOps and Site Reliability Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you approach building systems that are observable and debuggable in production?', 300, true, 4, 'Application Questions');

-- Q5: Speed vs safety trade-off
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you had to make a trade-off between shipping speed and operational risk. How did you decide?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you had to make a trade-off between shipping speed and operational risk. How did you decide?', 'technical', 300, 1, 0.88, false, ARRAY['DevOps and Site Reliability Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'DevOps and Site Reliability Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you had to make a trade-off between shipping speed and operational risk. How did you decide?', 300, true, 5, 'Application Questions');

-- Q6: On-call / team sustainability
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you approach on-call and incident management in a sustainable way for your team?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you approach on-call and incident management in a sustainable way for your team?', 'team', 250, 1, 0.86, false, ARRAY['DevOps and Site Reliability Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'DevOps and Site Reliability Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you approach on-call and incident management in a sustainable way for your team?', 250, true, 6, 'Application Questions');

-- Q7: Post-mortems / blameless culture
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your approach to post-mortems or retrospectives. How do you drive genuine learning from them?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your approach to post-mortems or retrospectives. How do you drive genuine learning from them?', 'personal', 250, 1, 0.85, false, ARRAY['DevOps and Site Reliability Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'DevOps and Site Reliability Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your approach to post-mortems or retrospectives. How do you drive genuine learning from them?', 250, true, 7, 'Application Questions');

-- Q8: Career goals / vision
SELECT id INTO q_id FROM archived_questions WHERE text = 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 'vision', 200, 1, 0.87, true, ARRAY['DevOps and Site Reliability Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'DevOps and Site Reliability Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 200, true, 8, 'Application Questions');

END $$;