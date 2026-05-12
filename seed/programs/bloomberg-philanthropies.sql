-- seed/programs/bloomberg-philanthropies.sql
-- Bloomberg Philanthropies Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'bloomberg-philanthropies',
  'Bloomberg Philanthropies Grant',
  'Bloomberg Philanthropies',
  'grant',
  'open',
  10000000,
  1000000000,
  0.0,
  ARRAY['US', 'Global'],
  ARRAY['arts', 'environment', 'government-innovation', 'public-health', 'education'],
  'Bloomberg Philanthropies aims to ensure better, longer lives for the greatest number of people through arts, education, environment, government innovation, and public health.',
  'https://www.bloomberg.org/programs/bloomberg-philanthropies/',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Initiative and problem
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your proposed initiative and the problem it addresses.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your proposed initiative and the problem it addresses.', 'problem', 500, 1, 0.91, false, ARRAY['Bloomberg Philanthropies Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Bloomberg Philanthropies Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your proposed initiative and the problem it addresses.', 500, true, 1, 'Initiative');

-- Q2: Evidence of effectiveness
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your evidence that this initiative will be effective?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your evidence that this initiative will be effective?', 'traction', 500, 1, 0.92, false, ARRAY['Bloomberg Philanthropies Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Bloomberg Philanthropies Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your evidence that this initiative will be effective?', 500, true, 2, 'Evidence');

-- Q3: Sustainability beyond grant
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will you sustain this work beyond the grant period?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will you sustain this work beyond the grant period?', 'business_model', 300, 1, 0.88, false, ARRAY['Bloomberg Philanthropies Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Bloomberg Philanthropies Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will you sustain this work beyond the grant period?', 300, true, 3, 'Sustainability');

END $$;
