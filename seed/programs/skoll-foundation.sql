-- seed/programs/skoll-foundation.sql
-- Skoll Foundation Social Entrepreneurship Award — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'skoll-foundation',
  'Skoll Foundation Social Entrepreneurship Award',
  'Skoll Foundation',
  'grant',
  'open',
  125000000,
  125000000,
  0.0,
  ARRAY['Global'],
  ARRAY['social-entrepreneurship', 'systems-change', 'social-impact'],
  'The Skoll Award for Social Entrepreneurship recognizes extraordinary social entrepreneurs who have demonstrated the potential for large-scale, lasting social change.',
  'https://skoll.org/skoll-award/',
  false,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Theory of change
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the social problem you are addressing and your theory of change.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the social problem you are addressing and your theory of change.', 'problem', 750, 1, 0.94, false, ARRAY['Skoll Foundation Social Entrepreneurship Award'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Skoll Foundation Social Entrepreneurship Award') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the social problem you are addressing and your theory of change.', 750, true, 1, 'Problem & Theory of Change');

-- Q2: Evidence of impact
SELECT id INTO q_id FROM archived_questions WHERE text = 'What evidence do you have that your model works? What impact have you achieved?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What evidence do you have that your model works? What impact have you achieved?', 'traction', 750, 1, 0.95, false, ARRAY['Skoll Foundation Social Entrepreneurship Award'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Skoll Foundation Social Entrepreneurship Award') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What evidence do you have that your model works? What impact have you achieved?', 750, true, 2, 'Impact Evidence');

-- Q3: Vision for scale
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your vision for scale? How will your work reach significantly more people?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your vision for scale? How will your work reach significantly more people?', 'vision', 500, 1, 0.92, false, ARRAY['Skoll Foundation Social Entrepreneurship Award'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Skoll Foundation Social Entrepreneurship Award') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your vision for scale? How will your work reach significantly more people?', 500, true, 3, 'Scale');

-- Q4: Personal narrative
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe yourself as a social entrepreneur. What drives your commitment to this work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe yourself as a social entrepreneur. What drives your commitment to this work?', 'personal', 400, 1, 0.90, false, ARRAY['Skoll Foundation Social Entrepreneurship Award'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Skoll Foundation Social Entrepreneurship Award') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe yourself as a social entrepreneur. What drives your commitment to this work?', 400, true, 4, 'Personal');

END $$;
