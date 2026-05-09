-- seed/programs/kapor-capital.sql
-- Kapor Capital — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'kapor-capital',
  'Kapor Capital',
  'Kapor Capital',
  'vc',
  'open',
  50000000,    -- $500k in cents
  300000000,   -- $3M in cents
  NULL,
  ARRAY['US'],
  ARRAY['fintech', 'health', 'education', 'workforce', 'b2b', 'b2c', 'impact', 'ai'],
  'Kapor Capital is an impact-first seed fund that invests in tech startups that are closing gaps of access and opportunity for underserved communities. Portfolio companies must demonstrate both a compelling business model and positive social impact — especially for low-income communities and communities of color.',
  'https://www.kaporcapital.com',
  true,
  'seeded'
);

-- Q1: Company description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your company and what it does. Who does it serve and what problem does it solve?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your company and what it does. Who does it serve and what problem does it solve?', 'solution', 200, 1, 0.95, true, ARRAY['Kapor Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Kapor Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your company and what it does. Who does it serve and what problem does it solve?', 200, true, 1, 'Company');

-- Q2: Gap thesis
SELECT id INTO q_id FROM archived_questions WHERE text = 'Kapor Capital invests in companies closing gaps of access or opportunity. What gap does your company close and for whom?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Kapor Capital invests in companies closing gaps of access or opportunity. What gap does your company close and for whom?', 'impact', 300, 1, 0.95, false, ARRAY['Kapor Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Kapor Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Kapor Capital invests in companies closing gaps of access or opportunity. What gap does your company close and for whom?', 300, true, 2, 'Impact');

-- Q3: Defensibility
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your competitive moat? Why can''t a large company simply replicate your solution?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your competitive moat? Why can''t a large company simply replicate your solution?', 'vision', 200, 1, 0.88, true, ARRAY['Kapor Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Kapor Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your competitive moat? Why can''t a large company simply replicate your solution?', 200, true, 3, 'Company');

-- Q4: Traction
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your traction to date. Include any revenue, users, or other key metrics.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your traction to date. Include any revenue, users, or other key metrics.', 'traction', 200, 1, 0.92, true, ARRAY['Kapor Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Kapor Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your traction to date. Include any revenue, users, or other key metrics.', 200, true, 4, 'Traction');

-- Q5: Diverse team
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your founding team reflect the communities you serve? What is the diversity of the leadership team?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your founding team reflect the communities you serve? What is the diversity of the leadership team?', 'team', 200, 1, 0.87, false, ARRAY['Kapor Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Kapor Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your founding team reflect the communities you serve? What is the diversity of the leadership team?', 200, true, 5, 'Team');

-- Q6: Round and use of funds
SELECT id INTO q_id FROM archived_questions WHERE text = 'What stage are you at and how much are you raising? What will you use the capital for?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What stage are you at and how much are you raising? What will you use the capital for?', 'fundraising', 200, 1, 0.90, true, ARRAY['Kapor Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Kapor Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What stage are you at and how much are you raising? What will you use the capital for?', 200, true, 6, 'Financing');

END $$;
