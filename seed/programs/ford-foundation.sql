-- seed/programs/ford-foundation.sql
-- Ford Foundation Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'ford-foundation',
  'Ford Foundation Grant',
  'Ford Foundation',
  'grant',
  'open',
  10000000,
  300000000,
  0.0,
  ARRAY['Global'],
  ARRAY['inequality', 'justice', 'civic-engagement', 'arts'],
  'The Ford Foundation works to reduce inequality and strengthen democratic values, free expression, and human achievement worldwide.',
  'https://www.fordfoundation.org/work/our-grants/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Inequality addressed
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the inequality or injustice you are addressing and why it persists.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the inequality or injustice you are addressing and why it persists.', 'problem', 500, 1, 0.93, false, ARRAY['Ford Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Ford Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the inequality or injustice you are addressing and why it persists.', 500, true, 1, 'Problem');

-- Q2: Root causes approach
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your approach to reducing inequality. How does your work address root causes?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your approach to reducing inequality. How does your work address root causes?', 'solution', 500, 1, 0.93, false, ARRAY['Ford Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Ford Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your approach to reducing inequality. How does your work address root causes?', 500, true, 2, 'Approach');

-- Q3: Centering affected communities
SELECT id INTO q_id FROM archived_questions WHERE text = 'Who are the people most affected by this issue, and how are they centered in your work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Who are the people most affected by this issue, and how are they centered in your work?', 'impact', 400, 1, 0.92, false, ARRAY['Ford Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Ford Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Who are the people most affected by this issue, and how are they centered in your work?', 400, true, 3, 'Community');

END $$;
