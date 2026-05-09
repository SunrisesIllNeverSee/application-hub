-- seed/programs/a16z-start.sql
-- a16z START — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'a16z-start',
  'a16z START',
  'Andreessen Horowitz',
  'accel',
  'open',
  50000000,   -- $500k in cents
  50000000,
  0.0,
  ARRAY['US'],
  ARRAY['ai', 'b2b', 'consumer', 'fintech', 'health', 'crypto', 'deeptech'],
  'a16z START is Andreessen Horowitz''s program for pre-seed and seed-stage founders. The program provides $500k in funding (non-dilutive for select cohorts), access to a16z''s portfolio network, deep-dive sessions with a16z partners, and connections to potential co-founders, early customers, and follow-on investors.',
  'https://a16z.com/start',
  false,
  'seeded'
);

-- Q1: What are you building?
SELECT id INTO q_id FROM archived_questions WHERE text = 'What are you building? Describe your product or service in plain language.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What are you building? Describe your product or service in plain language.', 'solution', 150, 1, 0.96, true, ARRAY['a16z START'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'a16z START') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What are you building? Describe your product or service in plain language.', 150, true, 1, 'Company');

-- Q2: Why now
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why is now the right time to build this? What has changed to make this possible or necessary?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why is now the right time to build this? What has changed to make this possible or necessary?', 'vision', 200, 1, 0.91, true, ARRAY['a16z START'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'a16z START') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why is now the right time to build this? What has changed to make this possible or necessary?', 200, true, 2, 'Company');

-- Q3: Insight / secret
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your key insight or "secret" that most people don''t yet believe but you are confident is true?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your key insight or "secret" that most people don''t yet believe but you are confident is true?', 'vision', 200, 1, 0.88, false, ARRAY['a16z START'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'a16z START') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your key insight or "secret" that most people don''t yet believe but you are confident is true?', 200, true, 3, 'Company');

-- Q4: Team background
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is each founder''s background and why are you the right person to build this?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is each founder''s background and why are you the right person to build this?', 'team', 200, 1, 0.93, true, ARRAY['a16z START'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'a16z START') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is each founder''s background and why are you the right person to build this?', 200, true, 4, 'Team');

-- Q5: Early traction
SELECT id INTO q_id FROM archived_questions WHERE text = 'What early evidence do you have that people want this? (Users, pilots, letters of intent, revenue, etc.)' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What early evidence do you have that people want this? (Users, pilots, letters of intent, revenue, etc.)', 'traction', 200, 1, 0.93, true, ARRAY['a16z START'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'a16z START') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What early evidence do you have that people want this? (Users, pilots, letters of intent, revenue, etc.)', 200, true, 5, 'Traction');

-- Q6: Business model path
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you plan to monetize? What does the long-term business model look like?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you plan to monetize? What does the long-term business model look like?', 'business_model', 200, 1, 0.90, true, ARRAY['a16z START'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'a16z START') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you plan to monetize? What does the long-term business model look like?', 200, true, 6, 'Business Model');

-- Q7: What do you need
SELECT id INTO q_id FROM archived_questions WHERE text = 'What do you most need help with right now, and how could a16z specifically help?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What do you most need help with right now, and how could a16z specifically help?', 'fit', 200, 1, 0.86, false, ARRAY['a16z START'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'a16z START') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What do you most need help with right now, and how could a16z specifically help?', 200, true, 7, 'Fit');

-- Q8: Competition
SELECT id INTO q_id FROM archived_questions WHERE text = 'Who else is working on this problem and why will you win?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Who else is working on this problem and why will you win?', 'market', 200, 1, 0.88, true, ARRAY['a16z START'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'a16z START') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Who else is working on this problem and why will you win?', 200, true, 8, 'Market');

END $$;
