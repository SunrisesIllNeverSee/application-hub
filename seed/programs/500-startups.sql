-- seed/programs/500-startups.sql
-- 500 Startups — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  '500-startups',
  '500 Global',
  '500 Global',
  'accel',
  'open',
  15000000,   -- $150k in cents
  15000000,
  0.06,
  ARRAY['Global'],
  ARRAY['b2b', 'b2c', 'fintech', 'marketplace', 'saas', 'consumer', 'health', 'ai'],
  '500 Global (formerly 500 Startups) is one of the world''s most active seed funds and accelerators with offices in over 20 countries. The 4-month accelerator program invests $150k for 6% equity and provides hands-on support to build and scale globally. 500 has funded 2,700+ companies including Canva, Grab, and Twilio.',
  'https://500.co',
  false,
  'seeded'
);

-- Q1: One-liner
SELECT id INTO q_id FROM archived_questions WHERE text = 'What does your startup do in one sentence?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What does your startup do in one sentence?', 'solution', 25, 1, 0.96, true, ARRAY['500 Global'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, '500 Global') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What does your startup do in one sentence?', 25, true, 1, 'Company');

-- Q2: Problem and market
SELECT id INTO q_id FROM archived_questions WHERE text = 'What problem are you solving and how big is the market opportunity?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What problem are you solving and how big is the market opportunity?', 'problem', 250, 1, 0.94, true, ARRAY['500 Global'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, '500 Global') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What problem are you solving and how big is the market opportunity?', 250, true, 2, 'Company');

-- Q3: Solution
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your product or service solve the problem? What makes it unique?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your product or service solve the problem? What makes it unique?', 'solution', 200, 1, 0.93, true, ARRAY['500 Global'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, '500 Global') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your product or service solve the problem? What makes it unique?', 200, true, 3, 'Solution');

-- Q4: Traction
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your current traction? Provide metrics including users, revenue, and growth rate.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your current traction? Provide metrics including users, revenue, and growth rate.', 'traction', 200, 1, 0.93, true, ARRAY['500 Global'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, '500 Global') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your current traction? Provide metrics including users, revenue, and growth rate.', 200, true, 4, 'Traction');

-- Q5: Business model
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you make money? Describe your revenue model and pricing.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you make money? Describe your revenue model and pricing.', 'business_model', 200, 1, 0.92, true, ARRAY['500 Global'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, '500 Global') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you make money? Describe your revenue model and pricing.', 200, true, 5, 'Business Model');

-- Q6: Team
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about your founding team. What makes you the right team to build this?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about your founding team. What makes you the right team to build this?', 'team', 200, 1, 0.92, true, ARRAY['500 Global'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, '500 Global') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about your founding team. What makes you the right team to build this?', 200, true, 6, 'Team');

-- Q7: Global ambition
SELECT id INTO q_id FROM archived_questions WHERE text = 'Where do you plan to expand geographically and why? What markets are you targeting beyond your home country?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Where do you plan to expand geographically and why? What markets are you targeting beyond your home country?', 'vision', 200, 1, 0.80, false, ARRAY['500 Global'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, '500 Global') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Where do you plan to expand geographically and why? What markets are you targeting beyond your home country?', 200, true, 7, 'Vision');

-- Q8: Fundraising
SELECT id INTO q_id FROM archived_questions WHERE text = 'How much have you raised to date and from whom? How much are you currently raising?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How much have you raised to date and from whom? How much are you currently raising?', 'fundraising', 150, 1, 0.88, true, ARRAY['500 Global'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, '500 Global') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How much have you raised to date and from whom? How much are you currently raising?', 150, true, 8, 'Financing');

END $$;
