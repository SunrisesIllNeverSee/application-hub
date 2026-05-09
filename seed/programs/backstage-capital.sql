-- seed/programs/backstage-capital.sql
-- Backstage Capital — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'backstage-capital',
  'Backstage Capital',
  'Backstage Capital',
  'vc',
  'open',
  2500000,    -- $25k in cents
  100000000,  -- $1M in cents
  NULL,
  ARRAY['US'],
  ARRAY['b2b', 'b2c', 'saas', 'consumer', 'health', 'fintech', 'impact'],
  'Backstage Capital is a VC fund dedicated to minimizing funding disparities by investing in high-potential founders who are people of color, women, and/or LGBTQ+. The fund has invested in 200+ companies and focuses on underrepresented founders at the pre-seed and seed stage.',
  'https://backstagecapital.com',
  true,
  'seeded'
);

-- Q1: Company pitch
SELECT id INTO q_id FROM archived_questions WHERE text = 'Give us your best pitch: what does your company do, for whom, and why does it matter?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Give us your best pitch: what does your company do, for whom, and why does it matter?', 'solution', 200, 1, 0.95, true, ARRAY['Backstage Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Backstage Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Give us your best pitch: what does your company do, for whom, and why does it matter?', 200, true, 1, 'Company');

-- Q2: Founder identity
SELECT id INTO q_id FROM archived_questions WHERE text = 'Backstage Capital invests in founders who are people of color, women, and/or LGBTQ+. Please describe how you identify.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Backstage Capital invests in founders who are people of color, women, and/or LGBTQ+. Please describe how you identify.', 'personal', 100, 1, 0.93, false, ARRAY['Backstage Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Backstage Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Backstage Capital invests in founders who are people of color, women, and/or LGBTQ+. Please describe how you identify.', 100, true, 2, 'Founder');

-- Q3: Traction metrics
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your current revenue, user count, or other key traction metrics?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your current revenue, user count, or other key traction metrics?', 'traction', 150, 1, 0.92, true, ARRAY['Backstage Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Backstage Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your current revenue, user count, or other key traction metrics?', 150, true, 3, 'Traction');

-- Q4: Ask and use of funds
SELECT id INTO q_id FROM archived_questions WHERE text = 'How much are you raising and what will you use it for?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How much are you raising and what will you use it for?', 'fundraising', 150, 1, 0.90, true, ARRAY['Backstage Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Backstage Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How much are you raising and what will you use it for?', 150, true, 4, 'Financing');

-- Q5: Why Backstage
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why are you interested in working with Backstage Capital specifically?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why are you interested in working with Backstage Capital specifically?', 'fit', 150, 1, 0.83, false, ARRAY['Backstage Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Backstage Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why are you interested in working with Backstage Capital specifically?', 150, true, 5, 'Fit');

-- Q6: Team composition
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us about your team. Who are the founders and what do they each bring to the company?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us about your team. Who are the founders and what do they each bring to the company?', 'team', 200, 1, 0.90, true, ARRAY['Backstage Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Backstage Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us about your team. Who are the founders and what do they each bring to the company?', 200, true, 6, 'Team');

END $$;
