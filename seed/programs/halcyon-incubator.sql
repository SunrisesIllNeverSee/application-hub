-- seed/programs/halcyon-incubator.sql
-- Halcyon Incubator — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'halcyon-incubator',
  'Halcyon Incubator',
  'Halcyon',
  'other',
  0,
  0,
  0.0,
  ARRAY['US'],
  ARRAY['social-impact', 'climate', 'health', 'education', 'equity', 'sustainability'],
  'Halcyon Incubator is an 18-month residential program in Washington DC for social entrepreneurs at the seed stage. Fellows receive free co-working space, mentorship, a small stipend, professional development, and access to Halcyon''s network of funders and social change leaders.',
  'https://halcyon.house',
  false,
  'seeded'
);

-- Q1: Social venture description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your social venture and the change it is working to create in the world.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your social venture and the change it is working to create in the world.', 'solution', 300, 1, 0.90, false, ARRAY['Halcyon Incubator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Halcyon Incubator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your social venture and the change it is working to create in the world.', 300, true, 1, 'Venture');

-- Q2: Stage of development
SELECT id INTO q_id FROM archived_questions WHERE text = 'What stage is your venture at? What have you built or tested so far?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What stage is your venture at? What have you built or tested so far?', 'traction', 200, 1, 0.86, false, ARRAY['Halcyon Incubator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Halcyon Incubator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What stage is your venture at? What have you built or tested so far?', 200, true, 2, 'Venture');

-- Q3: Why Washington DC
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why would being based in Washington, DC be beneficial to your work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why would being based in Washington, DC be beneficial to your work?', 'fit', 200, 1, 0.78, false, ARRAY['Halcyon Incubator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Halcyon Incubator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why would being based in Washington, DC be beneficial to your work?', 200, true, 3, 'Fit');

-- Q4: Personal story
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about yourself and your journey to this work. What drives you?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about yourself and your journey to this work. What drives you?', 'personal', 300, 1, 0.88, false, ARRAY['Halcyon Incubator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Halcyon Incubator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about yourself and your journey to this work. What drives you?', 300, true, 4, 'Founder');

-- Q5: What you need from the incubator
SELECT id INTO q_id FROM archived_questions WHERE text = 'What resources, connections, or support do you most need from the Halcyon program to advance your work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What resources, connections, or support do you most need from the Halcyon program to advance your work?', 'fit', 250, 1, 0.83, false, ARRAY['Halcyon Incubator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Halcyon Incubator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What resources, connections, or support do you most need from the Halcyon program to advance your work?', 250, true, 5, 'Fit');

-- Q6: Impact metrics
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you measure the impact of your work? What metrics matter most to you?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you measure the impact of your work? What metrics matter most to you?', 'impact', 250, 1, 0.87, false, ARRAY['Halcyon Incubator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Halcyon Incubator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you measure the impact of your work? What metrics matter most to you?', 250, true, 6, 'Impact');

END $$;
