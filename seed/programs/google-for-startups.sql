-- seed/programs/google-for-startups.sql
-- Google for Startups Accelerator — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'google-for-startups',
  'Google for Startups Accelerator',
  'Google',
  'accel',
  'open',
  0,
  0,
  0.0,
  ARRAY['US', 'Global'],
  ARRAY['ai', 'cloud', 'b2b', 'saas', 'deeptech'],
  'Google for Startups Accelerator is a 3-month program for Series A and B companies. Participants receive equity-free support including Google Cloud credits (up to $200k), mentorship from Google engineers and experts, technical project support, and connections to Google''s ecosystem of partners and investors.',
  'https://startup.google.com/programs/accelerator/',
  false,
  'seeded'
);

-- Q1: Company Overview
SELECT id INTO q_id FROM archived_questions WHERE text = 'Provide an overview of your company: what you do, who you serve, and the problem you solve.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Provide an overview of your company: what you do, who you serve, and the problem you solve.', 'solution', 250, 1, 0.95, true, ARRAY['Google for Startups'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Google for Startups') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Provide an overview of your company: what you do, who you serve, and the problem you solve.', 250, true, 1, 'Company');

-- Q2: Stage and Funding
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your current funding stage and total amount raised to date?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your current funding stage and total amount raised to date?', 'fundraising', 100, 1, 0.82, true, ARRAY['Google for Startups'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Google for Startups') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your current funding stage and total amount raised to date?', 100, true, 2, 'Company');

-- Q3: Google Cloud usage
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your product use or plan to use Google Cloud, AI/ML, or other Google technologies?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your product use or plan to use Google Cloud, AI/ML, or other Google technologies?', 'technical', 250, 1, 0.88, false, ARRAY['Google for Startups'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Google for Startups') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your product use or plan to use Google Cloud, AI/ML, or other Google technologies?', 250, true, 3, 'Technical');

-- Q4: Key technical challenges
SELECT id INTO q_id FROM archived_questions WHERE text = 'What are the top 1–3 technical challenges you are facing that Google experts could help you solve?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What are the top 1–3 technical challenges you are facing that Google experts could help you solve?', 'technical', 250, 1, 0.90, false, ARRAY['Google for Startups'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Google for Startups') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What are the top 1–3 technical challenges you are facing that Google experts could help you solve?', 250, true, 4, 'Technical');

-- Q5: Growth metrics
SELECT id INTO q_id FROM archived_questions WHERE text = 'What are your key growth metrics over the past 12 months?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What are your key growth metrics over the past 12 months?', 'traction', 200, 1, 0.90, true, ARRAY['Google for Startups'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Google for Startups') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What are your key growth metrics over the past 12 months?', 200, true, 5, 'Traction');

-- Q6: How the program helps
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will this program help you achieve your next major milestone?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will this program help you achieve your next major milestone?', 'fit', 250, 1, 0.85, false, ARRAY['Google for Startups'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Google for Startups') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will this program help you achieve your next major milestone?', 250, true, 6, 'Fit');

-- Q7: AI/ML application
SELECT id INTO q_id FROM archived_questions WHERE text = 'How is AI or machine learning central to your product or business?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How is AI or machine learning central to your product or business?', 'technical', 200, 1, 0.83, false, ARRAY['Google for Startups'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Google for Startups') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How is AI or machine learning central to your product or business?', 200, true, 7, 'Technical');

-- Q8: Team leadership background
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the founding team''s relevant experience and why this team is uniquely positioned to win.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the founding team''s relevant experience and why this team is uniquely positioned to win.', 'team', 250, 1, 0.90, true, ARRAY['Google for Startups'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Google for Startups') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the founding team''s relevant experience and why this team is uniquely positioned to win.', 250, true, 8, 'Team');

END $$;
