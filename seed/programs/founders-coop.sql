-- seed/programs/founders-coop.sql
-- Founders' Co-op — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'founders-coop',
  'Founders'' Co-op',
  'Founders'' Co-op',
  'vc',
  'open',
  25000000,   -- $250k in cents
  100000000,  -- $1M in cents
  NULL,
  ARRAY['US'],
  ARRAY['b2b', 'saas', 'consumer', 'marketplace', 'ai', 'fintech', 'health'],
  'Founders'' Co-op is a seed-stage venture fund based in Seattle, focused on Pacific Northwest founders. The fund invests in pre-seed and seed companies across all sectors, with particular depth in enterprise software, consumer marketplaces, and AI applications.',
  'https://www.founderscoop.com',
  true,
  'seeded'
);

-- Q1: Company in two sentences
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your company in two sentences: what you do and who you do it for.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your company in two sentences: what you do and who you do it for.', 'solution', 50, 1, 0.95, true, ARRAY['Founders'' Co-op'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Founders'' Co-op') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your company in two sentences: what you do and who you do it for.', 50, true, 1, 'Company');

-- Q2: Stage and status
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the current stage of your company? Do you have a product, paying customers, or revenue?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the current stage of your company? Do you have a product, paying customers, or revenue?', 'traction', 150, 1, 0.88, true, ARRAY['Founders'' Co-op'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Founders'' Co-op') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the current stage of your company? Do you have a product, paying customers, or revenue?', 150, true, 2, 'Company');

-- Q3: Pacific Northwest connection
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your connection to the Pacific Northwest? Are you based in Seattle or elsewhere in the region?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your connection to the Pacific Northwest? Are you based in Seattle or elsewhere in the region?', 'fit', 100, 1, 0.73, false, ARRAY['Founders'' Co-op'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Founders'' Co-op') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your connection to the Pacific Northwest? Are you based in Seattle or elsewhere in the region?', 100, true, 3, 'Fit');

-- Q4: What you're raising
SELECT id INTO q_id FROM archived_questions WHERE text = 'How much are you raising and what will you use the capital for?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How much are you raising and what will you use the capital for?', 'fundraising', 150, 1, 0.90, true, ARRAY['Founders'' Co-op'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Founders'' Co-op') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How much are you raising and what will you use the capital for?', 150, true, 4, 'Financing');

-- Q5: Founder background
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your professional background and how does it prepare you to build this company?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your professional background and how does it prepare you to build this company?', 'team', 200, 1, 0.90, true, ARRAY['Founders'' Co-op'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Founders'' Co-op') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your professional background and how does it prepare you to build this company?', 200, true, 5, 'Team');

END $$;
