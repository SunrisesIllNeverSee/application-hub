-- seed/programs/village-capital.sql
-- Village Capital — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'village-capital',
  'Village Capital',
  'Village Capital',
  'accel',
  'open',
  5000000,   -- $50k in cents
  10000000,  -- $100k in cents
  NULL,
  ARRAY['US', 'Global'],
  ARRAY['fintech', 'agtech', 'health', 'climate', 'education', 'impact'],
  'Village Capital runs sector-specific accelerator programs where founders peer-evaluate each other and the top-ranked companies receive investment. The peer-selected model reduces bias in investment decisions and is focused on ventures solving problems for underserved communities and markets.',
  'https://vilcap.com',
  false,
  'seeded'
);

-- Q1: Venture overview
SELECT id INTO q_id FROM archived_questions WHERE text = 'What does your venture do? Who is the customer and what problem does it solve for them?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What does your venture do? Who is the customer and what problem does it solve for them?', 'solution', 250, 1, 0.95, true, ARRAY['Village Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Village Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What does your venture do? Who is the customer and what problem does it solve for them?', 250, true, 1, 'Company');

-- Q2: Underserved market
SELECT id INTO q_id FROM archived_questions WHERE text = 'How does your venture serve underserved or overlooked communities or markets?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How does your venture serve underserved or overlooked communities or markets?', 'impact', 300, 1, 0.90, false, ARRAY['Village Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Village Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How does your venture serve underserved or overlooked communities or markets?', 300, true, 2, 'Impact');

-- Q3: Revenue model
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your revenue model and unit economics.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your revenue model and unit economics.', 'business_model', 200, 1, 0.90, true, ARRAY['Village Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Village Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your revenue model and unit economics.', 200, true, 3, 'Business Model');

-- Q4: Current traction
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your current traction: customers, revenue, and key metrics.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your current traction: customers, revenue, and key metrics.', 'traction', 200, 1, 0.90, true, ARRAY['Village Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Village Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your current traction: customers, revenue, and key metrics.', 200, true, 4, 'Traction');

-- Q5: What makes the team right
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why is your team uniquely positioned to build this company? What relevant expertise or lived experience do you bring?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why is your team uniquely positioned to build this company? What relevant expertise or lived experience do you bring?', 'team', 250, 1, 0.91, true, ARRAY['Village Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Village Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why is your team uniquely positioned to build this company? What relevant expertise or lived experience do you bring?', 250, true, 5, 'Team');

-- Q6: Sector fit
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why are you applying to this specific Village Capital program? How does it align with your venture?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why are you applying to this specific Village Capital program? How does it align with your venture?', 'fit', 200, 1, 0.83, false, ARRAY['Village Capital'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Village Capital') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why are you applying to this specific Village Capital program? How does it align with your venture?', 200, true, 6, 'Fit');

END $$;
