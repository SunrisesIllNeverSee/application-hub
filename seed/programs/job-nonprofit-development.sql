-- seed/programs/job-nonprofit-development.sql
-- Nonprofit Development Director Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'job-nonprofit-development',
  'Nonprofit Development Director Application',
  'Job Application Archetype',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['nonprofit', 'fundraising', 'development', 'grants'],
  'Application questions for nonprofit development director roles covering donor relations, grant writing, and fundraising strategy.',
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
  VALUES (gen_random_uuid(), 'Tell us about yourself. What should we know about your background and what you are looking for?', 'personal', 300, 1, 0.92, true, ARRAY['Nonprofit Development Director Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Nonprofit Development Director Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about yourself. What should we know about your background and what you are looking for?', 300, true, 1, 'Application Questions');

-- Q2: Fundraising success
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about your most successful fundraising campaign or major gift. What was your strategy and how did you close it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about your most successful fundraising campaign or major gift. What was your strategy and how did you close it?', 'traction', 400, 1, 0.93, false, ARRAY['Nonprofit Development Director Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Nonprofit Development Director Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about your most successful fundraising campaign or major gift. What was your strategy and how did you close it?', 400, true, 2, 'Application Questions');

-- Q3: Grant writing
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your experience writing a successful grant application. What was the grant and what made the proposal effective?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your experience writing a successful grant application. What was the grant and what made the proposal effective?', 'solution', 350, 1, 0.91, false, ARRAY['Nonprofit Development Director Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Nonprofit Development Director Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your experience writing a successful grant application. What was the grant and what made the proposal effective?', 350, true, 3, 'Application Questions');

-- Q4: Donor relationship management
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you build and sustain long-term relationships with major donors? Give a specific example.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you build and sustain long-term relationships with major donors? Give a specific example.', 'team', 350, 1, 0.9, false, ARRAY['Nonprofit Development Director Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Nonprofit Development Director Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you build and sustain long-term relationships with major donors? Give a specific example.', 350, true, 4, 'Application Questions');

-- Q5: Funding loss / resilience
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about a time a major funding source fell through. How did you respond and what was the outcome?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about a time a major funding source fell through. How did you respond and what was the outcome?', 'personal', 300, 1, 0.88, false, ARRAY['Nonprofit Development Director Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Nonprofit Development Director Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about a time a major funding source fell through. How did you respond and what was the outcome?', 300, true, 5, 'Application Questions');

-- Q6: Development strategy
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you build a development strategy that balances short-term revenue needs with long-term donor stewardship?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you build a development strategy that balances short-term revenue needs with long-term donor stewardship?', 'business_model', 300, 1, 0.87, false, ARRAY['Nonprofit Development Director Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Nonprofit Development Director Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you build a development strategy that balances short-term revenue needs with long-term donor stewardship?', 300, true, 6, 'Application Questions');

-- Q7: Team building / development systems
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe how you have built or scaled a development team or function. What processes or systems did you put in place?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe how you have built or scaled a development team or function. What processes or systems did you put in place?', 'vision', 350, 1, 0.86, false, ARRAY['Nonprofit Development Director Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Nonprofit Development Director Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe how you have built or scaled a development team or function. What processes or systems did you put in place?', 350, true, 7, 'Application Questions');

-- Q8: Career goals / vision
SELECT id INTO q_id FROM archived_questions WHERE text = 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 'vision', 200, 1, 0.87, true, ARRAY['Nonprofit Development Director Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Nonprofit Development Director Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Where do you see yourself in 3-5 years, and how does this role fit into that trajectory?', 200, true, 8, 'Application Questions');

END $$;