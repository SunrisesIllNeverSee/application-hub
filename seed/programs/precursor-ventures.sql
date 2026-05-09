-- seed/programs/precursor-ventures.sql
-- Precursor Ventures — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'precursor-ventures',
  'Precursor Ventures',
  'Precursor Ventures',
  'vc',
  'open',
  25000000,   -- $250k in cents
  100000000,  -- $1M in cents
  NULL,
  ARRAY['US'],
  ARRAY['b2b', 'b2c', 'saas', 'consumer', 'marketplace', 'fintech', 'health'],
  'Precursor Ventures is a pre-seed focused fund that backs founders very early — often before product-market fit. The fund is known for backing underrepresented founders and being one of the first checks in. Precursor has backed 300+ companies including Propel, Mayvenn, and Gusto.',
  'https://precursorvc.com',
  true,
  'seeded'
);

-- Q1: Brief description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Briefly describe what your company does in 2–3 sentences.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Briefly describe what your company does in 2–3 sentences.', 'solution', 60, 1, 0.96, true, ARRAY['Precursor Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Precursor Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Briefly describe what your company does in 2–3 sentences.', 60, true, 1, 'Company');

-- Q2: Why the founder is right
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why are you the right founder to build this? What is your unique insight, experience, or advantage?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why are you the right founder to build this? What is your unique insight, experience, or advantage?', 'team', 200, 1, 0.93, true, ARRAY['Precursor Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Precursor Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why are you the right founder to build this? What is your unique insight, experience, or advantage?', 200, true, 2, 'Team');

-- Q3: Stage of company
SELECT id INTO q_id FROM archived_questions WHERE text = 'What stage is your company? Do you have a product, users, or revenue yet?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What stage is your company? Do you have a product, users, or revenue yet?', 'traction', 150, 1, 0.88, true, ARRAY['Precursor Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Precursor Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What stage is your company? Do you have a product, users, or revenue yet?', 150, true, 3, 'Traction');

-- Q4: Business model
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your business model? How do you plan to make money?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your business model? How do you plan to make money?', 'business_model', 150, 1, 0.91, true, ARRAY['Precursor Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Precursor Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your business model? How do you plan to make money?', 150, true, 4, 'Business Model');

-- Q5: Round size and timeline
SELECT id INTO q_id FROM archived_questions WHERE text = 'How much are you raising? How long will it last and what will you use it for?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How much are you raising? How long will it last and what will you use it for?', 'fundraising', 150, 1, 0.90, true, ARRAY['Precursor Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Precursor Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How much are you raising? How long will it last and what will you use it for?', 150, true, 5, 'Financing');

-- Q6: What help you need
SELECT id INTO q_id FROM archived_questions WHERE text = 'What kind of support would be most valuable to you beyond capital at this stage?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What kind of support would be most valuable to you beyond capital at this stage?', 'fit', 150, 1, 0.80, false, ARRAY['Precursor Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Precursor Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What kind of support would be most valuable to you beyond capital at this stage?', 150, true, 6, 'Fit');

END $$;
