-- seed/programs/visible-hands.sql
-- Visible Hands — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'visible-hands',
  'Visible Hands',
  'Visible Hands',
  'accel',
  'open',
  10000000,   -- $100k in cents
  10000000,
  0.05,
  ARRAY['US'],
  ARRAY['b2b', 'b2c', 'saas', 'consumer', 'fintech', 'health', 'impact'],
  'Visible Hands is a 14-week accelerator investing in pre-seed startups led by founders from underrepresented backgrounds. The program provides $100k for 5% equity, coaching from experienced operators, and a community-first approach to building durable, impactful companies.',
  'https://www.visiblehands.vc',
  false,
  'seeded'
);

-- Q1: Company elevator pitch
SELECT id INTO q_id FROM archived_questions WHERE text = 'In one to two sentences, tell us what your company does.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'In one to two sentences, tell us what your company does.', 'solution', 40, 1, 0.95, true, ARRAY['Visible Hands'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Visible Hands') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'In one to two sentences, tell us what your company does.', 40, true, 1, 'Company');

-- Q2: Problem and opportunity
SELECT id INTO q_id FROM archived_questions WHERE text = 'What problem are you solving and why is now the right time to solve it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What problem are you solving and why is now the right time to solve it?', 'problem', 200, 1, 0.92, true, ARRAY['Visible Hands'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Visible Hands') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What problem are you solving and why is now the right time to solve it?', 200, true, 2, 'Company');

-- Q3: Underrepresented founder background
SELECT id INTO q_id FROM archived_questions WHERE text = 'Visible Hands supports founders from underrepresented backgrounds. How do you identify and how has your background shaped your perspective as a founder?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Visible Hands supports founders from underrepresented backgrounds. How do you identify and how has your background shaped your perspective as a founder?', 'personal', 250, 1, 0.92, false, ARRAY['Visible Hands'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Visible Hands') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Visible Hands supports founders from underrepresented backgrounds. How do you identify and how has your background shaped your perspective as a founder?', 250, true, 3, 'Founder');

-- Q4: Traction or validation
SELECT id INTO q_id FROM archived_questions WHERE text = 'What have you built or validated so far? Share any traction, users, revenue, or customer feedback.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What have you built or validated so far? Share any traction, users, revenue, or customer feedback.', 'traction', 200, 1, 0.90, true, ARRAY['Visible Hands'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Visible Hands') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What have you built or validated so far? Share any traction, users, revenue, or customer feedback.', 200, true, 4, 'Traction');

-- Q5: Community commitment
SELECT id INTO q_id FROM archived_questions WHERE text = 'Visible Hands is a community-first program. How do you plan to contribute to and learn from other founders in the cohort?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Visible Hands is a community-first program. How do you plan to contribute to and learn from other founders in the cohort?', 'fit', 200, 1, 0.82, false, ARRAY['Visible Hands'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Visible Hands') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Visible Hands is a community-first program. How do you plan to contribute to and learn from other founders in the cohort?', 200, true, 5, 'Fit');

-- Q6: Revenue model
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your company make or plan to make money?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your company make or plan to make money?', 'business_model', 150, 1, 0.90, true, ARRAY['Visible Hands'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Visible Hands') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your company make or plan to make money?', 150, true, 6, 'Business Model');

END $$;
