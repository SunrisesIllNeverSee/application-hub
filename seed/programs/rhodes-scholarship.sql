-- seed/programs/rhodes-scholarship.sql
-- Rhodes Scholarship — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'rhodes-scholarship',
  'Rhodes Scholarship',
  'Rhodes Trust',
  'fellowship',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['scholarship', 'oxford', 'leadership', 'service', 'academic excellence'],
  'The Rhodes Scholarship is the oldest and most celebrated international scholarship program, enabling exceptional students from around the world to study at Oxford University.',
  'https://www.rhodeshouse.ox.ac.uk/scholarships/the-rhodes-scholarship/',
  false,
  'seeded',
  'fellowship'::opportunity_kind,
  'education'
);

-- Q1: Formative personal achievement or experience
SELECT id INTO q_id FROM archived_questions WHERE text = 'In approximately 1000 words, please describe some personal achievement, professional experience, or aspect of your life story that has been particularly formative and that you would like the Selection Committee to know about.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'In approximately 1000 words, please describe some personal achievement, professional experience, or aspect of your life story that has been particularly formative and that you would like the Selection Committee to know about.', 'personal', 1000, 1, 0.96, false, ARRAY['Rhodes Scholarship'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Rhodes Scholarship') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'In approximately 1000 words, please describe some personal achievement, professional experience, or aspect of your life story that has been particularly formative and that you would like the Selection Committee to know about.', 1000, true, 1, 'Essays');

-- Q2: Proposed course of study at Oxford
SELECT id INTO q_id FROM archived_questions WHERE text = 'In approximately 1000 words, please describe your proposed course of study at Oxford. Why do you wish to study this, and why do you believe Oxford is the right place for this study?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'In approximately 1000 words, please describe your proposed course of study at Oxford. Why do you wish to study this, and why do you believe Oxford is the right place for this study?', 'fit', 1000, 1, 0.95, false, ARRAY['Rhodes Scholarship'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Rhodes Scholarship') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'In approximately 1000 words, please describe your proposed course of study at Oxford. Why do you wish to study this, and why do you believe Oxford is the right place for this study?', 1000, true, 2, 'Essays');

END $$;
