-- seed/programs/ashoka.sql
-- Ashoka Fellowship — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'ashoka',
  'Ashoka Fellowship',
  'Ashoka',
  'grant',
  'open',
  200000,
  600000,
  0.0,
  ARRAY['Global'],
  ARRAY['social-entrepreneurship', 'systems-change', 'innovation'],
  'Ashoka identifies and supports the world''s leading social entrepreneurs, providing a stipend, professional support, and access to a global network of peers.',
  'https://www.ashoka.org/en-us/program/ashoka-fellowship',
  true,
  'seeded',
  'fellowship'::opportunity_kind,
  'education'
);

-- Q1: Social innovation
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your social innovation. What is the new idea and how does it change the system?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your social innovation. What is the new idea and how does it change the system?', 'solution', 750, 1, 0.95, false, ARRAY['Ashoka Fellowship'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Ashoka Fellowship') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your social innovation. What is the new idea and how does it change the system?', 750, true, 1, 'Innovation');

-- Q2: Personal vision
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your personal vision? What change in the world will you dedicate your life to creating?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your personal vision? What change in the world will you dedicate your life to creating?', 'personal', 600, 1, 0.93, false, ARRAY['Ashoka Fellowship'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Ashoka Fellowship') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your personal vision? What change in the world will you dedicate your life to creating?', 600, true, 2, 'Personal Vision');

-- Q3: Impact achieved
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the impact you have already achieved. What evidence do you have that your approach works?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the impact you have already achieved. What evidence do you have that your approach works?', 'traction', 600, 1, 0.94, false, ARRAY['Ashoka Fellowship'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Ashoka Fellowship') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the impact you have already achieved. What evidence do you have that your approach works?', 600, true, 3, 'Impact');

END $$;
