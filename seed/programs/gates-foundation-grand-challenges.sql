-- seed/programs/gates-foundation-grand-challenges.sql
-- Gates Foundation Grand Challenges — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'gates-foundation-grand-challenges',
  'Gates Foundation Grand Challenges',
  'Bill & Melinda Gates Foundation',
  'grant',
  'open',
              10000000,
  10000000000,
  0.0,
  ARRAY['Global'],
  ARRAY['global-health', 'poverty', 'agriculture', 'education'],
  'Grand Challenges funds bold ideas and innovative approaches to the world''s greatest challenges in health, agriculture, and development.',
  'https://gcgh.grandchallenges.org/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Approach description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your proposed approach to address the Grand Challenges focus area.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your proposed approach to address the Grand Challenges focus area.', 'solution', 500, 1, 0.93, false, ARRAY['Gates Foundation Grand Challenges'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Gates Foundation Grand Challenges') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your proposed approach to address the Grand Challenges focus area.', 500, true, 1, 'Approach');

-- Q2: Transformative impact
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the potential for transformative impact if this approach succeeds?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the potential for transformative impact if this approach succeeds?', 'impact', 400, 1, 0.94, false, ARRAY['Gates Foundation Grand Challenges'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Gates Foundation Grand Challenges') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the potential for transformative impact if this approach succeeds?', 400, true, 2, 'Impact');

-- Q3: Global access and equity
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your plan for global access and equity?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your plan for global access and equity?', 'vision', 300, 1, 0.91, false, ARRAY['Gates Foundation Grand Challenges'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Gates Foundation Grand Challenges') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your plan for global access and equity?', 300, true, 3, 'Access & Equity');

END $$;
