-- seed/programs/echoing-green.sql
-- Echoing Green Fellowship — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'echoing-green',
  'Echoing Green Fellowship',
  'Echoing Green',
  'fellowship',
  'open',
  9000000,   -- $90k in cents (individual)
  18000000,  -- $180k in cents (org)
  0.0,
  ARRAY['Global'],
  ARRAY['social-impact', 'equity', 'education', 'health', 'climate', 'economic-mobility', 'justice'],
  'Echoing Green invests in bold social innovators at the earliest stages of launching their ideas. Fellows receive up to $90k (individuals) or $180k (orgs) over two years, plus healthcare subsidies, leadership development, and access to a global community of over 700 Echoing Green fellows.',
  'https://echoinggreen.org/fellowship',
  false,
  'seeded'
);

-- Q1: Social innovation description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your social innovation. What are you doing, for whom, and what change are you trying to create?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your social innovation. What are you doing, for whom, and what change are you trying to create?', 'solution', 300, 1, 0.95, false, ARRAY['Echoing Green'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Echoing Green') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your social innovation. What are you doing, for whom, and what change are you trying to create?', 300, true, 1, 'Idea');

-- Q2: Root cause
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the root cause of the problem you are addressing? How does your approach get at root causes rather than symptoms?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the root cause of the problem you are addressing? How does your approach get at root causes rather than symptoms?', 'problem', 350, 1, 0.90, false, ARRAY['Echoing Green'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Echoing Green') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the root cause of the problem you are addressing? How does your approach get at root causes rather than symptoms?', 350, true, 2, 'Problem');

-- Q3: Evidence of impact
SELECT id INTO q_id FROM archived_questions WHERE text = 'What evidence do you have that your approach works? What impact have you achieved so far?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What evidence do you have that your approach works? What impact have you achieved so far?', 'traction', 300, 1, 0.92, false, ARRAY['Echoing Green'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Echoing Green') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What evidence do you have that your approach works? What impact have you achieved so far?', 300, true, 3, 'Impact');

-- Q4: Personal motivation
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why are you personally committed to this work? What lived experience or connection do you have to this issue?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why are you personally committed to this work? What lived experience or connection do you have to this issue?', 'personal', 350, 1, 0.93, false, ARRAY['Echoing Green'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Echoing Green') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why are you personally committed to this work? What lived experience or connection do you have to this issue?', 350, true, 4, 'Founder');

-- Q5: Theory of change
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your theory of change. What is the chain of causation from your activities to your ultimate vision of change?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your theory of change. What is the chain of causation from your activities to your ultimate vision of change?', 'impact', 400, 1, 0.88, false, ARRAY['Echoing Green'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Echoing Green') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your theory of change. What is the chain of causation from your activities to your ultimate vision of change?', 400, true, 5, 'Impact');

-- Q6: Sustainability model
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will your organization sustain itself financially over time? What is your funding model?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will your organization sustain itself financially over time? What is your funding model?', 'business_model', 300, 1, 0.86, false, ARRAY['Echoing Green'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Echoing Green') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will your organization sustain itself financially over time? What is your funding model?', 300, true, 6, 'Sustainability');

-- Q7: Racial equity lens
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your work center racial equity and the leadership of people most affected by the problem?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your work center racial equity and the leadership of people most affected by the problem?', 'impact', 350, 1, 0.90, false, ARRAY['Echoing Green'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Echoing Green') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your work center racial equity and the leadership of people most affected by the problem?', 350, true, 7, 'Impact');

-- Q8: Leadership development needs
SELECT id INTO q_id FROM archived_questions WHERE text = 'What leadership skills or capacities do you need to develop to be most effective in this work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What leadership skills or capacities do you need to develop to be most effective in this work?', 'personal', 300, 1, 0.82, false, ARRAY['Echoing Green'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Echoing Green') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What leadership skills or capacities do you need to develop to be most effective in this work?', 300, true, 8, 'Personal');

END $$;
