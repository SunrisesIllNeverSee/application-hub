-- seed/programs/wharton-mba.sql
-- Wharton MBA — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'wharton-mba',
  'Wharton MBA',
  'University of Pennsylvania',
  'uni',
  'open',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['mba', 'graduate', 'business', 'finance'],
  'The Wharton School MBA program is known for its rigorous curriculum, finance strength, and diverse global community of future business leaders.',
  'https://mba.wharton.upenn.edu/admissions/',
  false,
  'seeded',
  'school_professional'::opportunity_kind,
  'education'
);

-- Q1: Professional goals from Wharton MBA
SELECT id INTO q_id FROM archived_questions WHERE text = 'What do you hope to gain professionally from the Wharton MBA?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What do you hope to gain professionally from the Wharton MBA?', 'fit', 500, 1, 0.93, false, ARRAY['Wharton MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Wharton MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What do you hope to gain professionally from the Wharton MBA?', 500, true, 1, 'Essays');

-- Q2: Contributions to the Wharton community
SELECT id INTO q_id FROM archived_questions WHERE text = 'Taking into consideration your background — personal, professional, and/or academic — how do you plan to make specific, meaningful contributions to the Wharton community?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Taking into consideration your background — personal, professional, and/or academic — how do you plan to make specific, meaningful contributions to the Wharton community?', 'fit', 400, 1, 0.90, false, ARRAY['Wharton MBA'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Wharton MBA') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Taking into consideration your background — personal, professional, and/or academic — how do you plan to make specific, meaningful contributions to the Wharton community?', 400, true, 2, 'Essays');

END $$;
