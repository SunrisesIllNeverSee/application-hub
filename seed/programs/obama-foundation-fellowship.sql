-- seed/programs/obama-foundation-fellowship.sql
-- Obama Foundation Fellowship — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'obama-foundation-fellowship',
  'Obama Foundation Fellowship',
  'Obama Foundation',
  'fellowship',
  'open',
  0,
  0,
  0.0,
  ARRAY['US', 'Global'],
  ARRAY['fellowship', 'civic engagement', 'leadership', 'community', 'social change'],
  'The Obama Foundation Fellowship supports emerging civic leaders as they develop innovative approaches to social change, providing skills, networks, and support to amplify their impact.',
  'https://www.obama.org/fellowship/',
  false,
  'seeded',
  'fellowship'::opportunity_kind,
  'education'
);

-- Q1: Community and issue description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the community you serve and the issue you''re working to address. Why does this issue matter, and what makes you uniquely positioned to address it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the community you serve and the issue you''re working to address. Why does this issue matter, and what makes you uniquely positioned to address it?', 'impact', 600, 1, 0.95, false, ARRAY['Obama Foundation Fellowship'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Obama Foundation Fellowship') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the community you serve and the issue you''re working to address. Why does this issue matter, and what makes you uniquely positioned to address it?', 600, true, 1, 'Essays');

-- Q2: Vision of change
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the vision of change you''re working toward. What would your community look like if your work was successful?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the vision of change you''re working toward. What would your community look like if your work was successful?', 'vision', 600, 1, 0.94, false, ARRAY['Obama Foundation Fellowship'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Obama Foundation Fellowship') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the vision of change you''re working toward. What would your community look like if your work was successful?', 600, true, 2, 'Essays');

END $$;
