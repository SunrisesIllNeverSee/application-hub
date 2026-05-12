-- seed/programs/rockefeller-foundation.sql
-- Rockefeller Foundation Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'rockefeller-foundation',
  'Rockefeller Foundation Grant',
  'Rockefeller Foundation',
  'grant',
  'open',
  50000000,
  500000000,
  0.0,
  ARRAY['Global'],
  ARRAY['food-systems', 'health', 'climate', 'power-systems'],
  'The Rockefeller Foundation promotes the well-being of humanity throughout the world through science-based innovations and systems-level change.',
  'https://www.rockefellerfoundation.org/grants/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Systems-level change
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the systems-level change you are seeking to achieve.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the systems-level change you are seeking to achieve.', 'vision', 500, 1, 0.93, false, ARRAY['Rockefeller Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Rockefeller Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the systems-level change you are seeking to achieve.', 500, true, 1, 'Change Vision');

-- Q2: Contribution
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your proposed work contribute to this change?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your proposed work contribute to this change?', 'solution', 500, 1, 0.91, false, ARRAY['Rockefeller Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Rockefeller Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your proposed work contribute to this change?', 500, true, 2, 'Approach');

-- Q3: Equity and inclusion
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your plan for ensuring equity and inclusion in your approach?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your plan for ensuring equity and inclusion in your approach?', 'impact', 400, 1, 0.90, false, ARRAY['Rockefeller Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Rockefeller Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your plan for ensuring equity and inclusion in your approach?', 400, true, 3, 'Equity');

-- Q4: Measure and communicate impact
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will you measure and communicate impact?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will you measure and communicate impact?', 'impact', 300, 1, 0.89, false, ARRAY['Rockefeller Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Rockefeller Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will you measure and communicate impact?', 300, true, 4, 'Evaluation');

END $$;
