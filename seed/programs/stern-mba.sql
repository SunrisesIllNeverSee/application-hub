-- seed/programs/stern-mba.sql
-- NYU Stern MBA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'stern-mba',
  'NYU Stern MBA',
  'New York University',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mba', 'graduate', 'business', 'finance', 'new york'],
  'NYU Stern MBA program leverages its New York City location to prepare students for careers in finance, luxury, entertainment, fashion, and media industries.',
  'https://www.stern.nyu.edu/programs-admissions/full-time-mba/admissions',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: Introduce yourself to classmates
SELECT id INTO q_id FROM archived_questions WHERE text = 'Introduce yourself to your future classmates. The best submissions will be tight, creative, informative, and memorable.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Introduce yourself to your future classmates. The best submissions will be tight, creative, informative, and memorable.', 'personal', 300, 1, 0.90, false, ARRAY['NYU Stern MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NYU Stern MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Introduce yourself to your future classmates. The best submissions will be tight, creative, informative, and memorable.', 300, true, 1, 'Essays');

-- Q2: Why NYU Stern
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why NYU Stern?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why NYU Stern?', 'fit', 50, 1, 0.88, false, ARRAY['NYU Stern MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'NYU Stern MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why NYU Stern?', 50, true, 2, 'Essays');

END $$;
