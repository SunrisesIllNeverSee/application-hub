-- seed/programs/robert-bosch-stiftung.sql
-- Robert Bosch Stiftung Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'robert-bosch-stiftung',
  'Robert Bosch Stiftung Grant',
  'Robert Bosch Stiftung',
  'grant',
  'open',
  5000000,
  200000000,
  0.0,
  ARRAY['Global', 'Europe'],
  ARRAY['civil-society', 'international-understanding', 'health', 'education', 'science'],
  'Robert Bosch Stiftung supports projects that advance international understanding and civil society, primarily in Germany and internationally.',
  'https://www.bosch-stiftung.de/en/grants',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: International project and goals
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your proposed international project and its goals.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your proposed international project and its goals.', 'solution', 500, 1, 0.89, false, ARRAY['Robert Bosch Stiftung Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Robert Bosch Stiftung Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your proposed international project and its goals.', 500, true, 1, 'Project');

-- Q2: Contribution to civil society
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will this project contribute to civil society or international understanding?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will this project contribute to civil society or international understanding?', 'impact', 500, 1, 0.90, false, ARRAY['Robert Bosch Stiftung Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Robert Bosch Stiftung Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will this project contribute to civil society or international understanding?', 500, true, 2, 'Impact');

-- Q3: Sustainability plan
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your sustainability plan?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your sustainability plan?', 'business_model', 300, 1, 0.87, true, ARRAY['Robert Bosch Stiftung Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Robert Bosch Stiftung Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your sustainability plan?', 300, true, 3, 'Sustainability');

END $$;
