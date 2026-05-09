-- seed/programs/hustle-fund.sql
-- Hustle Fund — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'hustle-fund',
  'Hustle Fund',
  'Hustle Fund',
  'vc',
  'open',
  2500000,    -- $25k in cents
  10000000,   -- $100k in cents
  NULL,
  ARRAY['US', 'Global'],
  ARRAY['b2b', 'saas', 'marketplace', 'consumer', 'fintech', 'asia', 'latam'],
  'Hustle Fund is a pre-seed fund focused on speed and hustle. They make fast decisions (often within 48 hours), write $25k–$100k checks, and look for founders who can build and sell quickly. Known for backing founders in Southeast Asia, Latin America, and the US.',
  'https://www.hustlefund.vc',
  true,
  'seeded'
);

-- Q1: Speed pitch
SELECT id INTO q_id FROM archived_questions WHERE text = 'What does your company do? Keep it concise.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What does your company do? Keep it concise.', 'solution', 50, 1, 0.95, true, ARRAY['Hustle Fund'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Hustle Fund') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What does your company do? Keep it concise.', 50, true, 1, 'Company');

-- Q2: Speed of execution
SELECT id INTO q_id FROM archived_questions WHERE text = 'What have you built or accomplished in the last 30 days? Give us concrete evidence of your execution speed.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What have you built or accomplished in the last 30 days? Give us concrete evidence of your execution speed.', 'traction', 200, 1, 0.92, false, ARRAY['Hustle Fund'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Hustle Fund') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What have you built or accomplished in the last 30 days? Give us concrete evidence of your execution speed.', 200, true, 2, 'Traction');

-- Q3: Revenue or customers
SELECT id INTO q_id FROM archived_questions WHERE text = 'Are you generating any revenue? If so, how much and from how many customers?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Are you generating any revenue? If so, how much and from how many customers?', 'traction', 100, 1, 0.92, true, ARRAY['Hustle Fund'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Hustle Fund') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Are you generating any revenue? If so, how much and from how many customers?', 100, true, 3, 'Traction');

-- Q4: Business model
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you charge customers? What are your unit economics?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you charge customers? What are your unit economics?', 'business_model', 150, 1, 0.90, true, ARRAY['Hustle Fund'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Hustle Fund') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you charge customers? What are your unit economics?', 150, true, 4, 'Business Model');

-- Q5: Why you
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why are you and your co-founders the right people to build this company?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why are you and your co-founders the right people to build this company?', 'team', 150, 1, 0.91, true, ARRAY['Hustle Fund'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Hustle Fund') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why are you and your co-founders the right people to build this company?', 150, true, 5, 'Team');

-- Q6: Raise amount
SELECT id INTO q_id FROM archived_questions WHERE text = 'How much are you raising in your pre-seed round?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How much are you raising in your pre-seed round?', 'fundraising', 50, 1, 0.88, true, ARRAY['Hustle Fund'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Hustle Fund') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How much are you raising in your pre-seed round?', 50, true, 6, 'Financing');

END $$;
