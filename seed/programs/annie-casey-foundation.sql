-- seed/programs/annie-casey-foundation.sql
-- Annie E. Casey Foundation Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'annie-casey-foundation',
  'Annie E. Casey Foundation Grant',
  'Annie E. Casey Foundation',
  'grant',
  'open',
  5000000,
  200000000,
  0.0,
  ARRAY['US'],
  ARRAY['children', 'youth', 'families', 'racial-equity', 'community-development'],
  'Annie E. Casey Foundation builds better futures for disadvantaged children and families in the United States.',
  'https://www.aecf.org/work/grants',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Work to improve outcomes
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your work to improve outcomes for children, youth, and families in poverty.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your work to improve outcomes for children, youth, and families in poverty.', 'solution', 600, 1, 0.92, false, ARRAY['Annie E. Casey Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Annie E. Casey Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your work to improve outcomes for children, youth, and families in poverty.', 600, true, 1, 'Work');

-- Q2: Racial and ethnic equity
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your approach address racial and ethnic equity?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your approach address racial and ethnic equity?', 'impact', 500, 1, 0.93, false, ARRAY['Annie E. Casey Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Annie E. Casey Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your approach address racial and ethnic equity?', 500, true, 2, 'Racial Equity');

-- Q3: Lessons learned
SELECT id INTO q_id FROM archived_questions WHERE text = 'What have you learned from your work, and how has it shaped your approach?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What have you learned from your work, and how has it shaped your approach?', 'traction', 400, 1, 0.89, false, ARRAY['Annie E. Casey Foundation Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Annie E. Casey Foundation Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What have you learned from your work, and how has it shaped your approach?', 400, true, 3, 'Learning');

END $$;
