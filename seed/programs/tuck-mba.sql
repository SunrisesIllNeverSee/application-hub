-- seed/programs/tuck-mba.sql
-- Tuck School of Business MBA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'tuck-mba',
  'Tuck School of Business MBA',
  'Dartmouth College',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mba', 'graduate', 'business', 'leadership', 'community'],
  'Dartmouth Tuck MBA is known for its intimate community, general management focus, and emphasis on developing leaders with the courage to act and the wisdom to lead.',
  'https://www.tuck.dartmouth.edu/admissions',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: Why MBA now
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why is an MBA the right path for you at this point in your professional journey?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why is an MBA the right path for you at this point in your professional journey?', 'fit', 300, 1, 0.92, false, ARRAY['Tuck School of Business MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Tuck School of Business MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why is an MBA the right path for you at this point in your professional journey?', 300, true, 1, 'Essays');

-- Q2: Making others feel welcomed
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tuck students are encouraging, collaborative, and empathetic — values that contribute to a thriving learning community. Provide an example in which you made another individual or group feel welcomed and respected.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tuck students are encouraging, collaborative, and empathetic — values that contribute to a thriving learning community. Provide an example in which you made another individual or group feel welcomed and respected.', 'personal', 300, 1, 0.89, false, ARRAY['Tuck School of Business MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Tuck School of Business MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tuck students are encouraging, collaborative, and empathetic — values that contribute to a thriving learning community. Provide an example in which you made another individual or group feel welcomed and respected.', 300, true, 2, 'Essays');

-- Q3: Leadership experience
SELECT id INTO q_id FROM archived_questions WHERE text = 'Discuss your most meaningful and formative leadership experience. What specific challenges did you face, and how did you address them?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Discuss your most meaningful and formative leadership experience. What specific challenges did you face, and how did you address them?', 'team', 500, 1, 0.92, false, ARRAY['Tuck School of Business MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Tuck School of Business MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Discuss your most meaningful and formative leadership experience. What specific challenges did you face, and how did you address them?', 500, true, 3, 'Essays');

END $$;
