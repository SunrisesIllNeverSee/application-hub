-- seed/programs/yale-som-mba.sql
-- Yale School of Management MBA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'yale-som-mba',
  'Yale School of Management MBA',
  'Yale University',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mba', 'graduate', 'business', 'social enterprise', 'impact'],
  'Yale School of Management MBA program is uniquely focused on educating leaders for business and society, integrating business and social impact in its mission and curriculum.',
  'https://som.yale.edu/programs/mba/admissions',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: Biggest commitment
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the biggest commitment you have ever made. Why is this commitment meaningful to you and what actions have you taken to fulfill it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the biggest commitment you have ever made. Why is this commitment meaningful to you and what actions have you taken to fulfill it?', 'personal', 500, 1, 0.90, false, ARRAY['Yale School of Management MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Yale School of Management MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the biggest commitment you have ever made. Why is this commitment meaningful to you and what actions have you taken to fulfill it?', 500, true, 1, 'Essays');

-- Q2: Significant risk
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time when you''ve taken a significant risk — in your career, your personal life, or your education. What was the situation, and what was the result?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time when you''ve taken a significant risk — in your career, your personal life, or your education. What was the situation, and what was the result?', 'personal', 500, 1, 0.89, false, ARRAY['Yale School of Management MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Yale School of Management MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time when you''ve taken a significant risk — in your career, your personal life, or your education. What was the situation, and what was the result?', 500, true, 2, 'Essays');

END $$;
