-- seed/programs/first-round-capital.sql
-- First Round Capital — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'first-round-capital',
  'First Round Capital',
  'First Round Capital',
  'vc',
  'open',
  50000000,    -- $500k in cents
  300000000,   -- $3M in cents
  NULL,
  ARRAY['US'],
  ARRAY['b2b', 'saas', 'consumer', 'fintech', 'health', 'ai', 'marketplace'],
  'First Round Capital is a seed-stage venture fund focused on building the best companies from the very beginning. Known for investing in Uber, Square, Warby Parker, and Roblox, First Round provides hands-on support through its platform team, First Round Review, and a robust community of over 300 portfolio companies.',
  'https://firstround.com',
  true,
  'seeded'
);

-- Q1: What do you do in two sentences
SELECT id INTO q_id FROM archived_questions WHERE text = 'What does your company do? Explain it in two sentences or fewer.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What does your company do? Explain it in two sentences or fewer.', 'solution', 50, 1, 0.96, true, ARRAY['First Round Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'First Round Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What does your company do? Explain it in two sentences or fewer.', 50, true, 1, 'Company');

-- Q2: Problem
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the core problem you are solving and why does it matter?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the core problem you are solving and why does it matter?', 'problem', 200, 1, 0.95, true, ARRAY['First Round Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'First Round Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the core problem you are solving and why does it matter?', 200, true, 2, 'Company');

-- Q3: Founder-market fit
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why are you specifically the right person to solve this problem? What is your founder-market fit?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why are you specifically the right person to solve this problem? What is your founder-market fit?', 'team', 200, 1, 0.91, true, ARRAY['First Round Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'First Round Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why are you specifically the right person to solve this problem? What is your founder-market fit?', 200, true, 3, 'Team');

-- Q4: Traction and metrics
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your most impressive traction metric? Share the numbers.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your most impressive traction metric? Share the numbers.', 'traction', 150, 1, 0.90, true, ARRAY['First Round Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'First Round Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your most impressive traction metric? Share the numbers.', 150, true, 4, 'Traction');

-- Q5: Market opportunity
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the total addressable market and how did you size it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the total addressable market and how did you size it?', 'market', 200, 1, 0.88, true, ARRAY['First Round Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'First Round Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the total addressable market and how did you size it?', 200, true, 5, 'Market');

-- Q6: Round details
SELECT id INTO q_id FROM archived_questions WHERE text = 'How much are you raising, at what valuation, and what will you use the funds for?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How much are you raising, at what valuation, and what will you use the funds for?', 'fundraising', 200, 1, 0.90, true, ARRAY['First Round Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'First Round Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How much are you raising, at what valuation, and what will you use the funds for?', 200, true, 6, 'Financing');

-- Q7: Who referred you
SELECT id INTO q_id FROM archived_questions WHERE text = 'How did you hear about us? Is there someone in our portfolio or network who recommended you apply?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How did you hear about us? Is there someone in our portfolio or network who recommended you apply?', 'fit', 100, 1, 0.60, false, ARRAY['First Round Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'First Round Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How did you hear about us? Is there someone in our portfolio or network who recommended you apply?', 100, false, 7, 'Fit');

END $$;
