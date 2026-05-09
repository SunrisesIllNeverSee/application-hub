-- seed/programs/indie-vc.sql
-- Indie.vc — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'indie-vc',
  'Indie.vc',
  'Indie.vc',
  'vc',
  'open',
  10000000,   -- $100k in cents
  100000000,  -- $1M in cents
  NULL,
  ARRAY['US', 'Global'],
  ARRAY['b2b', 'saas', 'bootstrapped', 'profitable', 'sustainable'],
  'Indie.vc backs founders building sustainable, profitable businesses — not just unicorn-chasing startups. The fund provides flexible capital with revenue-based repayment structures, aligned with founders who care about profitability, autonomy, and building something that lasts without needing to raise forever.',
  'https://indie.vc',
  true,
  'seeded'
);

-- Q1: Business description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your business. What do you do and who do you do it for?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your business. What do you do and who do you do it for?', 'solution', 150, 1, 0.95, true, ARRAY['Indie.vc'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Indie.vc') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your business. What do you do and who do you do it for?', 150, true, 1, 'Company');

-- Q2: Revenue
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your current monthly recurring revenue (MRR) or annual revenue?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your current monthly recurring revenue (MRR) or annual revenue?', 'traction', 100, 1, 0.93, true, ARRAY['Indie.vc'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Indie.vc') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your current monthly recurring revenue (MRR) or annual revenue?', 100, true, 2, 'Financials');

-- Q3: Path to profitability
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your path to profitability? Are you profitable today? If not, when do you project break-even?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your path to profitability? Are you profitable today? If not, when do you project break-even?', 'business_model', 200, 1, 0.90, false, ARRAY['Indie.vc'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Indie.vc') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your path to profitability? Are you profitable today? If not, when do you project break-even?', 200, true, 3, 'Financials');

-- Q4: Capital use
SELECT id INTO q_id FROM archived_questions WHERE text = 'What would you do with investment capital, and how would it change your trajectory?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What would you do with investment capital, and how would it change your trajectory?', 'fundraising', 200, 1, 0.87, true, ARRAY['Indie.vc'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Indie.vc') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What would you do with investment capital, and how would it change your trajectory?', 200, true, 4, 'Financing');

-- Q5: Why not VC track
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why are you interested in a non-traditional, revenue-based or sustainable funding model rather than traditional venture capital?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why are you interested in a non-traditional, revenue-based or sustainable funding model rather than traditional venture capital?', 'fit', 250, 1, 0.88, false, ARRAY['Indie.vc'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Indie.vc') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why are you interested in a non-traditional, revenue-based or sustainable funding model rather than traditional venture capital?', 250, true, 5, 'Fit');

-- Q6: What does success look like to you
SELECT id INTO q_id FROM archived_questions WHERE text = 'What does success look like for you personally as a founder? Do you want to build a lifestyle business, a large company, or something in between?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What does success look like for you personally as a founder? Do you want to build a lifestyle business, a large company, or something in between?', 'personal', 200, 1, 0.83, false, ARRAY['Indie.vc'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Indie.vc') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What does success look like for you personally as a founder? Do you want to build a lifestyle business, a large company, or something in between?', 200, true, 6, 'Vision');

-- Q7: Gross margin
SELECT id INTO q_id FROM archived_questions WHERE text = 'What are your gross margins? How do you expect them to evolve as you scale?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What are your gross margins? How do you expect them to evolve as you scale?', 'business_model', 150, 1, 0.84, false, ARRAY['Indie.vc'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Indie.vc') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What are your gross margins? How do you expect them to evolve as you scale?', 150, true, 7, 'Financials');

END $$;
