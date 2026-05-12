-- seed/programs/princeton-spia-mpa.sql
-- Princeton SPIA MPA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'princeton-spia-mpa',
  'Princeton SPIA MPA',
  'Princeton University',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US', 'Global'],
  ARRAY['mpa', 'graduate', 'public affairs', 'policy', 'international relations'],
  'Princeton School of Public and International Affairs MPA program trains the next generation of leaders for careers in public service, policy analysis, and international affairs.',
  'https://spia.princeton.edu/graduate-programs/master-public-affairs',
  false,
  'seeded',
  'school_grad'::opportunity_kind,
  'education'
);

-- Q1: Professional goals and research interests
SELECT id INTO q_id FROM archived_questions WHERE text = 'Please describe your professional goals and research interests, and explain how the MPA at Princeton SPIA will contribute to the achievement of those goals.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Please describe your professional goals and research interests, and explain how the MPA at Princeton SPIA will contribute to the achievement of those goals.', 'fit', 1000, 1, 0.93, false, ARRAY['Princeton SPIA MPA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Princeton SPIA MPA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Please describe your professional goals and research interests, and explain how the MPA at Princeton SPIA will contribute to the achievement of those goals.', 1000, true, 1, 'Essays');

-- Q2: Professional challenge
SELECT id INTO q_id FROM archived_questions WHERE text = 'Briefly describe a professional challenge you have faced and how you handled it.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Briefly describe a professional challenge you have faced and how you handled it.', 'personal', 250, 1, 0.87, false, ARRAY['Princeton SPIA MPA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Princeton SPIA MPA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Briefly describe a professional challenge you have faced and how you handled it.', 250, true, 2, 'Essays');

END $$;
