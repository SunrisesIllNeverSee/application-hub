-- seed/programs/surdna-foundation.sql
-- Surdna Foundation Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'surdna-foundation',
  'Surdna Foundation Grant',
  'Surdna Foundation',
  'grant',
  'open',
  5000000,
  200000000,
  0.0,
  ARRAY['US'],
  ARRAY['arts', 'environment', 'community-development', 'youth'],
  'Surdna Foundation fosters just and sustainable communities in the United States through thriving cultures, just communities, and a sustainable environment.',
  'https://surdna.org/grants/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Project alignment with Surdna focus areas
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your project support thriving cultures, just communities, or a sustainable environment?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your project support thriving cultures, just communities, or a sustainable environment?', 'fit', 600, 1, 0.90, false, ARRAY['Surdna Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Surdna Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your project support thriving cultures, just communities, or a sustainable environment?', 600, true, 1, 'Mission Fit');

-- Q2: Community shaping
SELECT id INTO q_id FROM archived_questions WHERE text = 'How are the communities you serve involved in shaping your work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How are the communities you serve involved in shaping your work?', 'impact', 400, 1, 0.91, false, ARRAY['Surdna Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Surdna Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How are the communities you serve involved in shaping your work?', 400, true, 2, 'Community Voice');

END $$;
