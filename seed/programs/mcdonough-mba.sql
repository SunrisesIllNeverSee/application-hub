-- seed/programs/mcdonough-mba.sql
-- Georgetown McDonough MBA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'mcdonough-mba',
  'Georgetown McDonough MBA',
  'Georgetown University',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mba', 'graduate', 'business', 'policy', 'global'],
  'Georgetown McDonough MBA is located in Washington D.C. and known for developing global business leaders with a strong sense of social responsibility and ethics.',
  'https://msb.georgetown.edu/programs/mba/full-time/admissions',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: Career goals
SELECT id INTO q_id FROM archived_questions WHERE text = 'Briefly describe your short-term career goals immediately following your MBA, long-term career goals, and how an MBA from Georgetown''s McDonough School of Business will help you achieve these goals.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Briefly describe your short-term career goals immediately following your MBA, long-term career goals, and how an MBA from Georgetown''s McDonough School of Business will help you achieve these goals.', 'fit', 500, 1, 0.91, false, ARRAY['Georgetown McDonough MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Georgetown McDonough MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Briefly describe your short-term career goals immediately following your MBA, long-term career goals, and how an MBA from Georgetown''s McDonough School of Business will help you achieve these goals.', 500, true, 1, 'Essays');

-- Q2: Leadership experience
SELECT id INTO q_id FROM archived_questions WHERE text = 'What leadership experience or example best captures who you are as a leader?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What leadership experience or example best captures who you are as a leader?', 'team', 300, 1, 0.90, false, ARRAY['Georgetown McDonough MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Georgetown McDonough MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What leadership experience or example best captures who you are as a leader?', 300, true, 2, 'Essays');

END $$;
