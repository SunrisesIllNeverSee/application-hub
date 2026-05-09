-- seed/programs/capital-factory.sql
-- Capital Factory — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'capital-factory',
  'Capital Factory',
  'Capital Factory',
  'accel',
  'open',
  5000000,    -- $50k in cents
  15000000,   -- $150k in cents
  0.05,
  ARRAY['US'],
  ARRAY['b2b', 'saas', 'defense', 'govtech', 'ai', 'deeptech', 'energy'],
  'Capital Factory is the most active seed investor in Texas and the center of gravity for the Texas startup ecosystem. The accelerator focuses on companies with national defense applications, enterprise SaaS, and high-growth technology startups. Capital Factory has offices in Austin, Dallas, Houston, and San Antonio.',
  'https://capitalfactory.com',
  true,
  'seeded'
);

-- Q1: Company overview
SELECT id INTO q_id FROM archived_questions WHERE text = 'Give us an overview of your company: what you do, who you serve, and what problem you solve.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Give us an overview of your company: what you do, who you serve, and what problem you solve.', 'solution', 200, 1, 0.94, true, ARRAY['Capital Factory'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Capital Factory') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Give us an overview of your company: what you do, who you serve, and what problem you solve.', 200, true, 1, 'Company');

-- Q2: Texas / regional connection
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your connection to Texas? Are you based here or planning to relocate?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your connection to Texas? Are you based here or planning to relocate?', 'fit', 100, 1, 0.75, false, ARRAY['Capital Factory'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Capital Factory') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your connection to Texas? Are you based here or planning to relocate?', 100, true, 2, 'Fit');

-- Q3: Defense / government opportunity
SELECT id INTO q_id FROM archived_questions WHERE text = 'Does your technology have applications in national defense, government, or dual-use scenarios? If so, describe them.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Does your technology have applications in national defense, government, or dual-use scenarios? If so, describe them.', 'market', 200, 1, 0.80, false, ARRAY['Capital Factory'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Capital Factory') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Does your technology have applications in national defense, government, or dual-use scenarios? If so, describe them.', 200, false, 3, 'Market');

-- Q4: Revenue and traction
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your current monthly revenue and customer count? Describe your top 3 customers.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your current monthly revenue and customer count? Describe your top 3 customers.', 'traction', 200, 1, 0.90, false, ARRAY['Capital Factory'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Capital Factory') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your current monthly revenue and customer count? Describe your top 3 customers.', 200, true, 4, 'Traction');

-- Q5: Team backgrounds
SELECT id INTO q_id FROM archived_questions WHERE text = 'Who are the founders and what is each person''s background and role?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Who are the founders and what is each person''s background and role?', 'team', 200, 1, 0.91, true, ARRAY['Capital Factory'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Capital Factory') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Who are the founders and what is each person''s background and role?', 200, true, 5, 'Team');

-- Q6: Investment ask
SELECT id INTO q_id FROM archived_questions WHERE text = 'How much are you raising, at what valuation, and what milestones will the money help you reach?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How much are you raising, at what valuation, and what milestones will the money help you reach?', 'fundraising', 200, 1, 0.90, true, ARRAY['Capital Factory'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Capital Factory') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How much are you raising, at what valuation, and what milestones will the money help you reach?', 200, true, 6, 'Financing');

END $$;
