-- seed/programs/packard-foundation.sql
-- David and Lucile Packard Foundation Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'packard-foundation',
  'David and Lucile Packard Foundation Grant',
  'David and Lucile Packard Foundation',
  'grant',
  'open',
  5000000,
  300000000,
  0.0,
  ARRAY['US', 'Global'],
  ARRAY['conservation', 'science', 'children', 'community'],
  'The Packard Foundation supports science, conservation, population, and children, families, and communities.',
  'https://www.packard.org/grants-and-investments/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Work and alignment
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your organization''s work and how it aligns with Packard''s focus areas.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your organization''s work and how it aligns with Packard''s focus areas.', 'fit', 500, 1, 0.90, false, ARRAY['David and Lucile Packard Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'David and Lucile Packard Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your organization''s work and how it aligns with Packard''s focus areas.', 500, true, 1, 'Alignment');

-- Q2: Specific outcomes
SELECT id INTO q_id FROM archived_questions WHERE text = 'What specific outcomes are you seeking to achieve with this grant?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What specific outcomes are you seeking to achieve with this grant?', 'impact', 400, 1, 0.90, false, ARRAY['David and Lucile Packard Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'David and Lucile Packard Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What specific outcomes are you seeking to achieve with this grant?', 400, true, 2, 'Outcomes');

-- Q3: Just, verdant, peaceful world
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your work support a just, verdant, and peaceful world?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your work support a just, verdant, and peaceful world?', 'vision', 300, 1, 0.89, false, ARRAY['David and Lucile Packard Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'David and Lucile Packard Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your work support a just, verdant, and peaceful world?', 300, true, 3, 'Vision');

END $$;
