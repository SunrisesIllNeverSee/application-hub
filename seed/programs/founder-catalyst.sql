-- seed/programs/founder-catalyst.sql
-- Founder Catalyst — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'founder-catalyst',
  'Founder Catalyst',
  'Founder Catalyst',
  'accel',
  'open',
  2500000,   -- $25k in cents
  2500000,
  0.0,
  ARRAY['US'],
  ARRAY['early-stage', 'pre-seed', 'b2b', 'b2c', 'deeptech'],
  'Founder Catalyst is an intensive early-stage program designed to help pre-product or pre-revenue founders pressure-test their ideas, validate customer demand, and build the foundations of a scalable company. The program provides equity-free stipends, intensive coaching, and a cohort community.',
  'https://foundercatalyst.com',
  false,
  'seeded'
);

-- Q1: Problem statement
SELECT id INTO q_id FROM archived_questions WHERE text = 'What problem are you trying to solve? Who experiences this problem and how badly?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What problem are you trying to solve? Who experiences this problem and how badly?', 'problem', 250, 1, 0.95, true, ARRAY['Founder Catalyst'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Founder Catalyst') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What problem are you trying to solve? Who experiences this problem and how badly?', 250, true, 1, 'Idea');

-- Q2: Customer discovery done
SELECT id INTO q_id FROM archived_questions WHERE text = 'How many customer discovery interviews have you done? What did you learn?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How many customer discovery interviews have you done? What did you learn?', 'traction', 200, 1, 0.85, true, ARRAY['Founder Catalyst'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Founder Catalyst') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How many customer discovery interviews have you done? What did you learn?', 200, true, 2, 'Validation');

-- Q3: Hypothesis
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your current hypothesis for the solution? How would you test it in the next 30 days?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your current hypothesis for the solution? How would you test it in the next 30 days?', 'solution', 200, 1, 0.85, false, ARRAY['Founder Catalyst'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Founder Catalyst') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your current hypothesis for the solution? How would you test it in the next 30 days?', 200, true, 3, 'Validation');

-- Q4: Founder background
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your background and why are you motivated to solve this problem?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your background and why are you motivated to solve this problem?', 'personal', 200, 1, 0.88, true, ARRAY['Founder Catalyst'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Founder Catalyst') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your background and why are you motivated to solve this problem?', 200, true, 4, 'Founder');

-- Q5: What you want from the program
SELECT id INTO q_id FROM archived_questions WHERE text = 'What specific outcomes are you hoping to achieve by participating in this program?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What specific outcomes are you hoping to achieve by participating in this program?', 'fit', 200, 1, 0.82, false, ARRAY['Founder Catalyst'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Founder Catalyst') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What specific outcomes are you hoping to achieve by participating in this program?', 200, true, 5, 'Fit');

-- Q6: Commitment level
SELECT id INTO q_id FROM archived_questions WHERE text = 'Are you working on this full-time? If not, what is preventing you from doing so?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Are you working on this full-time? If not, what is preventing you from doing so?', 'team', 100, 1, 0.80, true, ARRAY['Founder Catalyst'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Founder Catalyst') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Are you working on this full-time? If not, what is preventing you from doing so?', 100, true, 6, 'Founder');

END $$;
