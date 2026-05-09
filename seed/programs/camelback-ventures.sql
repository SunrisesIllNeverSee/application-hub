-- seed/programs/camelback-ventures.sql
-- Camelback Ventures — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'camelback-ventures',
  'Camelback Ventures',
  'Camelback Ventures',
  'accel',
  'open',
  10000000,   -- $100k in cents
  10000000,
  NULL,
  ARRAY['US'],
  ARRAY['education', 'social-impact', 'equity', 'youth', 'workforce', 'health'],
  'Camelback Ventures provides seed funding and intensive coaching to entrepreneurs of color and women who are building ventures to close opportunity gaps. The program invests $100k in education and social impact entrepreneurs, with a deep focus on leadership development and racial equity.',
  'https://camelbackventures.org',
  false,
  'seeded'
);

-- Q1: Venture summary
SELECT id INTO q_id FROM archived_questions WHERE text = 'Briefly describe your venture: what it does, who it serves, and what impact it creates.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Briefly describe your venture: what it does, who it serves, and what impact it creates.', 'solution', 200, 1, 0.95, false, ARRAY['Camelback Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Camelback Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Briefly describe your venture: what it does, who it serves, and what impact it creates.', 200, true, 1, 'Venture');

-- Q2: Opportunity gap
SELECT id INTO q_id FROM archived_questions WHERE text = 'What opportunity gap are you working to close? What systemic or structural forces created this gap?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What opportunity gap are you working to close? What systemic or structural forces created this gap?', 'problem', 300, 1, 0.91, false, ARRAY['Camelback Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Camelback Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What opportunity gap are you working to close? What systemic or structural forces created this gap?', 300, true, 2, 'Problem');

-- Q3: Founder story
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell us your personal story as a founder of color or woman founder. How has your identity and lived experience shaped your work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell us your personal story as a founder of color or woman founder. How has your identity and lived experience shaped your work?', 'personal', 350, 1, 0.93, false, ARRAY['Camelback Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Camelback Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell us your personal story as a founder of color or woman founder. How has your identity and lived experience shaped your work?', 350, true, 3, 'Founder');

-- Q4: Evidence of impact
SELECT id INTO q_id FROM archived_questions WHERE text = 'What evidence do you have that your venture is creating meaningful impact? What have you measured?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What evidence do you have that your venture is creating meaningful impact? What have you measured?', 'traction', 250, 1, 0.89, false, ARRAY['Camelback Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Camelback Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What evidence do you have that your venture is creating meaningful impact? What have you measured?', 250, true, 4, 'Impact');

-- Q5: Leadership development
SELECT id INTO q_id FROM archived_questions WHERE text = 'What are your most important areas for leadership growth? What do you most want to work on?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What are your most important areas for leadership growth? What do you most want to work on?', 'personal', 250, 1, 0.83, false, ARRAY['Camelback Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Camelback Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What are your most important areas for leadership growth? What do you most want to work on?', 250, true, 5, 'Personal');

-- Q6: Financial model
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your financial model. How does money flow into and out of your organization?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your financial model. How does money flow into and out of your organization?', 'business_model', 200, 1, 0.85, false, ARRAY['Camelback Ventures'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Camelback Ventures') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your financial model. How does money flow into and out of your organization?', 200, true, 6, 'Financials');

END $$;
