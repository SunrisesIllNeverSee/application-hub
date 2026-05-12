-- seed/programs/booth-mba.sql
-- Chicago Booth MBA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'booth-mba',
  'Chicago Booth MBA',
  'University of Chicago',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mba', 'graduate', 'business', 'finance', 'economics'],
  'Chicago Booth MBA program is renowned for its analytical rigor, flexible curriculum, and finance and economics strength backed by an unparalleled research faculty.',
  'https://www.chicagobooth.edu/programs/full-time/admissions',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: How Booth helps achieve career goals
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will the Booth MBA help you achieve your immediate and long-term post-MBA career goals?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will the Booth MBA help you achieve your immediate and long-term post-MBA career goals?', 'fit', 250, 1, 0.93, false, ARRAY['Chicago Booth MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Chicago Booth MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will the Booth MBA help you achieve your immediate and long-term post-MBA career goals?', 250, true, 1, 'Essays');

-- Q2: Personal growth at Booth
SELECT id INTO q_id FROM archived_questions WHERE text = 'An MBA is as much about personal growth as it is about professional development. In addition to sharing how Booth will help you grow professionally, we''d like to know more about how it will help you grow personally.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'An MBA is as much about personal growth as it is about professional development. In addition to sharing how Booth will help you grow professionally, we''d like to know more about how it will help you grow personally.', 'personal', 250, 1, 0.90, false, ARRAY['Chicago Booth MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Chicago Booth MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'An MBA is as much about personal growth as it is about professional development. In addition to sharing how Booth will help you grow professionally, we''d like to know more about how it will help you grow personally.', 250, true, 2, 'Essays');

-- Q3: Optional additional information
SELECT id INTO q_id FROM archived_questions WHERE text = 'Is there any other information that you believe would be helpful to the admissions committee?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Is there any other information that you believe would be helpful to the admissions committee?', 'other', 500, 1, 0.75, true, ARRAY['Chicago Booth MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Chicago Booth MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Is there any other information that you believe would be helpful to the admissions committee?', 500, false, 3, 'Optional Essay');

END $$;
