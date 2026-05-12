-- seed/programs/job-senior-software-engineer.sql
-- Senior Software Engineer Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'job-senior-software-engineer',
  'Senior Software Engineer Application',
  'Job Application Archetype',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['tech', 'engineering', 'software', 'senior'],
  'Application questions for senior software engineer roles emphasizing leadership, system design, and organizational impact.',
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
  VALUES (gen_random_uuid(), 'Tell us about yourself. What should we know about your background and what you are looking for?', 'personal', 300, 1, 0.92, true, ARRAY['Senior Software Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Software Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about yourself. What should we know about your background and what you are looking for?', 300, true, 1, 'Application Questions');

-- Q2: Technical complexity
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a technically complex project you worked on. What was the hardest part and how did you solve it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a technically complex project you worked on. What was the hardest part and how did you solve it?', 'technical', 400, 1, 0.93, false, ARRAY['Senior Software Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Software Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a technically complex project you worked on. What was the hardest part and how did you solve it?', 400, true, 2, 'Application Questions');

-- Q3: Technical leadership
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a time you led a significant technical initiative. How did you get buy-in and drive it to completion?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a time you led a significant technical initiative. How did you get buy-in and drive it to completion?', 'team', 400, 1, 0.91, false, ARRAY['Senior Software Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Software Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a time you led a significant technical initiative. How did you get buy-in and drive it to completion?', 400, true, 3, 'Application Questions');

-- Q4: System design impact
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a system design decision you made that had a major impact on your team or product. What were the trade-offs?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a system design decision you made that had a major impact on your team or product. What were the trade-offs?', 'technical', 400, 1, 0.92, false, ARRAY['Senior Software Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Software Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a system design decision you made that had a major impact on your team or product. What were the trade-offs?', 400, true, 4, 'Application Questions');

-- Q5: Mentorship / growing others
SELECT id INTO q_id FROM archived_questions WHERE text = 'How have you mentored or grown junior engineers? Give a specific example.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How have you mentored or grown junior engineers? Give a specific example.', 'team', 350, 1, 0.88, false, ARRAY['Senior Software Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Software Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How have you mentored or grown junior engineers? Give a specific example.', 350, true, 5, 'Application Questions');

-- Q6: Conflict / stakeholder management
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a time you had to work with a difficult colleague or stakeholder. How did you handle it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a time you had to work with a difficult colleague or stakeholder. How did you handle it?', 'team', 300, 1, 0.9, true, ARRAY['Senior Software Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Software Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a time you had to work with a difficult colleague or stakeholder. How did you handle it?', 300, true, 6, 'Application Questions');

-- Q7: Technical debt / quality
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a time you identified and addressed significant technical debt. How did you prioritize and execute?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a time you identified and addressed significant technical debt. How did you prioritize and execute?', 'technical', 350, 1, 0.87, false, ARRAY['Senior Software Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Software Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a time you identified and addressed significant technical debt. How did you prioritize and execute?', 350, true, 7, 'Application Questions');

-- Q8: Impact / contribution
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the most impactful project you have worked on? What made it impactful and what was your specific contribution?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the most impactful project you have worked on? What made it impactful and what was your specific contribution?', 'traction', 400, 1, 0.91, true, ARRAY['Senior Software Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Software Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the most impactful project you have worked on? What made it impactful and what was your specific contribution?', 400, true, 8, 'Application Questions');

-- Q9: Career goals / vision
SELECT id INTO q_id FROM archived_questions WHERE text = 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 'vision', 200, 1, 0.87, true, ARRAY['Senior Software Engineer Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Senior Software Engineer Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 200, true, 9, 'Application Questions');

END $$;