-- seed/programs/mit-sloan-mfin.sql
-- MIT Sloan MFin — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'mit-sloan-mfin',
  'MIT Sloan MFin',
  'Massachusetts Institute of Technology',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mfin', 'graduate', 'finance', 'technology', 'quantitative'],
  'MIT Sloan Master of Finance is a rigorous one-year program combining quantitative finance, technology, and leadership development for students pursuing careers in finance.',
  'https://mitsloan.mit.edu/mfin',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: Career goals and MFin fit
SELECT id INTO q_id FROM archived_questions WHERE text = 'What are your career goals? How will the MFin help you achieve these goals?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What are your career goals? How will the MFin help you achieve these goals?', 'fit', 500, 1, 0.92, false, ARRAY['MIT Sloan MFin'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MIT Sloan MFin') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What are your career goals? How will the MFin help you achieve these goals?', 500, true, 1, 'Essays');

-- Q2: Leadership demonstration
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a situation where you demonstrated leadership. What did you do? What was the result?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a situation where you demonstrated leadership. What did you do? What was the result?', 'team', 250, 1, 0.90, true, ARRAY['MIT Sloan MFin'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MIT Sloan MFin') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a situation where you demonstrated leadership. What did you do? What was the result?', 250, true, 2, 'Essays');

END $$;
