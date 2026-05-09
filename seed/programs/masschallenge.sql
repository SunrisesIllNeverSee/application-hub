-- seed/programs/masschallenge.sql
-- MassChallenge — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'masschallenge',
  'MassChallenge',
  'MassChallenge',
  'accel',
  'open',
  0,
  125000000,  -- $1.25M in cents (top awards)
  0.0,
  ARRAY['US', 'Global'],
  ARRAY['health', 'climate', 'fintech', 'ai', 'b2b', 'impact', 'deeptech'],
  'MassChallenge is a global zero-equity startup accelerator and startup competition. Startup founders receive expert mentorship, access to corporate partners, resources and workspace, and compete for equity-free cash awards of up to $1M+. Programs run in Boston, UK, Switzerland, Israel, and Mexico.',
  'https://masschallenge.org',
  false,
  'seeded'
);

-- Q1: Company description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Provide a brief description of your company and what you do.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Provide a brief description of your company and what you do.', 'solution', 150, 1, 0.95, true, ARRAY['MassChallenge'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MassChallenge') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Provide a brief description of your company and what you do.', 150, true, 1, 'Company');

-- Q2: Problem and customer pain
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the problem you are solving and the pain your customers experience today.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the problem you are solving and the pain your customers experience today.', 'problem', 250, 1, 0.93, true, ARRAY['MassChallenge'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MassChallenge') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the problem you are solving and the pain your customers experience today.', 250, true, 2, 'Problem');

-- Q3: Product / solution
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your product or service solution and its key features.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your product or service solution and its key features.', 'solution', 250, 1, 0.93, true, ARRAY['MassChallenge'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MassChallenge') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your product or service solution and its key features.', 250, true, 3, 'Solution');

-- Q4: Impact potential
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the positive impact your company has on society? How do you measure it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the positive impact your company has on society? How do you measure it?', 'impact', 250, 1, 0.88, false, ARRAY['MassChallenge'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MassChallenge') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the positive impact your company has on society? How do you measure it?', 250, true, 4, 'Impact');

-- Q5: Commercial traction
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your commercial traction: customers, revenue, growth rate.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your commercial traction: customers, revenue, growth rate.', 'traction', 200, 1, 0.91, true, ARRAY['MassChallenge'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MassChallenge') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your commercial traction: customers, revenue, growth rate.', 200, true, 5, 'Traction');

-- Q6: Competitive landscape
SELECT id INTO q_id FROM archived_questions WHERE text = 'Who are your main competitors and how is your solution differentiated?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Who are your main competitors and how is your solution differentiated?', 'market', 200, 1, 0.88, true, ARRAY['MassChallenge'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MassChallenge') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Who are your main competitors and how is your solution differentiated?', 200, true, 6, 'Market');

-- Q7: Team overview
SELECT id INTO q_id FROM archived_questions WHERE text = 'Briefly describe your founding team and their relevant experience.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Briefly describe your founding team and their relevant experience.', 'team', 200, 1, 0.90, true, ARRAY['MassChallenge'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MassChallenge') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Briefly describe your founding team and their relevant experience.', 200, true, 7, 'Team');

-- Q8: Resources needed
SELECT id INTO q_id FROM archived_questions WHERE text = 'What resources, partnerships, or expertise does MassChallenge offer that would most benefit your company?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What resources, partnerships, or expertise does MassChallenge offer that would most benefit your company?', 'fit', 200, 1, 0.83, false, ARRAY['MassChallenge'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'MassChallenge') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What resources, partnerships, or expertise does MassChallenge offer that would most benefit your company?', 200, true, 8, 'Fit');

END $$;
