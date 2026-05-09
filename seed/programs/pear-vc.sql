-- seed/programs/pear-vc.sql
-- Pear VC — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'pear-vc',
  'Pear VC',
  'Pear VC',
  'vc',
  'open',
  25000000,    -- $250k in cents
  250000000,   -- $2.5M in cents
  NULL,
  ARRAY['US'],
  ARRAY['b2b', 'saas', 'enterprise', 'ai', 'consumer', 'marketplace', 'deeptech'],
  'Pear VC is an early-stage venture fund with a hands-on approach to building companies from day one. Pear focuses on pre-seed and seed investments, and runs PearX — a 3-month startup program for founders at the earliest stages, combining mentorship, community, and capital.',
  'https://pear.vc',
  true,
  'seeded'
);

-- Q1: One-liner
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your company in one sentence.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your company in one sentence.', 'solution', 25, 1, 0.96, true, ARRAY['Pear VC'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Pear VC') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your company in one sentence.', 25, true, 1, 'Company');

-- Q2: What's the problem
SELECT id INTO q_id FROM archived_questions WHERE text = 'What problem does your product solve? Why is the existing solution inadequate?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What problem does your product solve? Why is the existing solution inadequate?', 'problem', 200, 1, 0.93, true, ARRAY['Pear VC'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Pear VC') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What problem does your product solve? Why is the existing solution inadequate?', 200, true, 2, 'Company');

-- Q3: Unique insight
SELECT id INTO q_id FROM archived_questions WHERE text = 'What unique insight or contrarian view do you hold about this market that makes you confident you can win?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What unique insight or contrarian view do you hold about this market that makes you confident you can win?', 'vision', 200, 1, 0.90, false, ARRAY['Pear VC'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Pear VC') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What unique insight or contrarian view do you hold about this market that makes you confident you can win?', 200, true, 3, 'Company');

-- Q4: First customer
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about your first customer or pilot user. How did you get them and what did you learn?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about your first customer or pilot user. How did you get them and what did you learn?', 'traction', 200, 1, 0.88, true, ARRAY['Pear VC'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Pear VC') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about your first customer or pilot user. How did you get them and what did you learn?', 200, true, 4, 'Traction');

-- Q5: Co-founder dynamics
SELECT id INTO q_id FROM archived_questions WHERE text = 'How did you and your co-founder(s) meet? What are each person''s roles and how do you divide responsibilities?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How did you and your co-founder(s) meet? What are each person''s roles and how do you divide responsibilities?', 'team', 200, 1, 0.86, true, ARRAY['Pear VC'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Pear VC') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How did you and your co-founder(s) meet? What are each person''s roles and how do you divide responsibilities?', 200, true, 5, 'Team');

-- Q6: How much are you raising
SELECT id INTO q_id FROM archived_questions WHERE text = 'How much are you raising in your current round?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How much are you raising in your current round?', 'fundraising', 50, 1, 0.88, true, ARRAY['Pear VC'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Pear VC') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How much are you raising in your current round?', 50, true, 6, 'Financing');

END $$;
