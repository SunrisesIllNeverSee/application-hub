-- seed/programs/kauffman-foundation.sql
-- Kauffman Foundation Entrepreneurship Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'kauffman-foundation',
  'Kauffman Foundation Entrepreneurship Grant',
  'Kauffman Foundation',
  'grant',
  'open',
  5000000,
  500000000,
  0.0,
  ARRAY['US'],
  ARRAY['entrepreneurship', 'education', 'startups', 'innovation'],
  'Kauffman Foundation fosters entrepreneurship as a driver of economic independence and prosperity.',
  'https://www.kauffman.org/grants/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Project to expand entrepreneurship
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your project to expand entrepreneurship or entrepreneurship education.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your project to expand entrepreneurship or entrepreneurship education.', 'solution', 500, 1, 0.90, false, ARRAY['Kauffman Foundation Entrepreneurship Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Kauffman Foundation Entrepreneurship Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your project to expand entrepreneurship or entrepreneurship education.', 500, true, 1, 'Project');

-- Q2: Accessibility for underrepresented founders
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will your project make entrepreneurship more accessible to underrepresented founders?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will your project make entrepreneurship more accessible to underrepresented founders?', 'impact', 400, 1, 0.91, false, ARRAY['Kauffman Foundation Entrepreneurship Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Kauffman Foundation Entrepreneurship Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will your project make entrepreneurship more accessible to underrepresented founders?', 400, true, 2, 'Equity');

-- Q3: Expected outcomes
SELECT id INTO q_id FROM archived_questions WHERE text = 'What are your expected outcomes and how will you measure them?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What are your expected outcomes and how will you measure them?', 'impact', 300, 1, 0.89, false, ARRAY['Kauffman Foundation Entrepreneurship Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Kauffman Foundation Entrepreneurship Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What are your expected outcomes and how will you measure them?', 300, true, 3, 'Evaluation');

END $$;
