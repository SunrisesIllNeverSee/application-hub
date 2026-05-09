-- seed/programs/nea-venture-studio.sql
-- NEA Venture Studio — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'nea-venture-studio',
  'NEA Venture Studio',
  'New Enterprise Associates',
  'vc',
  'open',
  50000000,    -- $500k in cents
  500000000,   -- $5M in cents
  NULL,
  ARRAY['US'],
  ARRAY['health', 'enterprise', 'ai', 'saas', 'deeptech', 'fintech'],
  'NEA is one of the world''s largest and most active venture capital firms. The NEA Venture Studio co-founds companies alongside experienced entrepreneurs, providing capital, operational expertise, and NEA''s global network. NEA focuses on healthcare, technology, and energy at seed through growth stages.',
  'https://www.nea.com',
  true,
  'seeded'
);

-- Q1: Company thesis
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the central thesis of your company? What change in the world are you betting on?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the central thesis of your company? What change in the world are you betting on?', 'vision', 200, 1, 0.91, false, ARRAY['NEA Venture Studio'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NEA Venture Studio') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the central thesis of your company? What change in the world are you betting on?', 200, true, 1, 'Company');

-- Q2: Market opportunity
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the market opportunity. What is the TAM and how will you capture a meaningful portion of it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the market opportunity. What is the TAM and how will you capture a meaningful portion of it?', 'market', 250, 1, 0.91, true, ARRAY['NEA Venture Studio'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NEA Venture Studio') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the market opportunity. What is the TAM and how will you capture a meaningful portion of it?', 250, true, 2, 'Market');

-- Q3: Founders' prior exits or experience
SELECT id INTO q_id FROM archived_questions WHERE text = 'Have the founders previously built and exited a company? What is your most significant prior achievement?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Have the founders previously built and exited a company? What is your most significant prior achievement?', 'team', 200, 1, 0.88, false, ARRAY['NEA Venture Studio'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NEA Venture Studio') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Have the founders previously built and exited a company? What is your most significant prior achievement?', 200, true, 3, 'Team');

-- Q4: Product and tech differentiation
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the core technical or product innovation that will be difficult for competitors to replicate?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the core technical or product innovation that will be difficult for competitors to replicate?', 'technical', 200, 1, 0.89, true, ARRAY['NEA Venture Studio'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NEA Venture Studio') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the core technical or product innovation that will be difficult for competitors to replicate?', 200, true, 4, 'Technical');

-- Q5: Round details
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your current round, valuation, and how much have you raised so far in this round?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your current round, valuation, and how much have you raised so far in this round?', 'fundraising', 150, 1, 0.88, true, ARRAY['NEA Venture Studio'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NEA Venture Studio') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your current round, valuation, and how much have you raised so far in this round?', 150, true, 5, 'Financing');

-- Q6: Revenue and growth
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your current ARR or MRR? What is your month-over-month growth rate?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your current ARR or MRR? What is your month-over-month growth rate?', 'traction', 150, 1, 0.90, true, ARRAY['NEA Venture Studio'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NEA Venture Studio') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your current ARR or MRR? What is your month-over-month growth rate?', 150, true, 6, 'Traction');

END $$;
