-- seed/programs/fulbright-us-student.sql
-- Fulbright US Student Program — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'fulbright-us-student',
  'Fulbright US Student Program',
  'U.S. Department of State',
  'fellowship',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['fellowship', 'research', 'study abroad', 'international exchange', 'cultural diplomacy'],
  'The Fulbright US Student Program is the largest US exchange program, offering opportunities for recent graduates and graduate students to research or study abroad in over 140 countries.',
  'https://us.fulbrightonline.org/',
  false,
  'seeded',
  'fellowship'::opportunity_kind,
  'education'
);

-- Q1: Proposed project or study plan
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your proposed project or study plan. Include your specific objectives, methodology, and the significance of your work.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your proposed project or study plan. Include your specific objectives, methodology, and the significance of your work.', 'vision', 1000, 1, 0.95, false, ARRAY['Fulbright US Student Program'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Fulbright US Student Program') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your proposed project or study plan. Include your specific objectives, methodology, and the significance of your work.', 1000, true, 1, 'Project Statement');

-- Q2: Personal statement of preparation
SELECT id INTO q_id FROM archived_questions WHERE text = 'What personal, professional, and academic experiences have prepared you to undertake this project?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What personal, professional, and academic experiences have prepared you to undertake this project?', 'personal', 500, 1, 0.93, false, ARRAY['Fulbright US Student Program'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Fulbright US Student Program') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What personal, professional, and academic experiences have prepared you to undertake this project?', 500, true, 2, 'Personal Statement');

-- Q3: Choice of host country
SELECT id INTO q_id FROM archived_questions WHERE text = 'Explain your choice of host country. How do your skills, background, and proposed activities relate to the country you have selected?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Explain your choice of host country. How do your skills, background, and proposed activities relate to the country you have selected?', 'fit', 500, 1, 0.92, false, ARRAY['Fulbright US Student Program'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Fulbright US Student Program') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Explain your choice of host country. How do your skills, background, and proposed activities relate to the country you have selected?', 500, true, 3, 'Personal Statement');

END $$;
