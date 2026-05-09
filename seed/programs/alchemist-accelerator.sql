-- seed/programs/alchemist-accelerator.sql
-- Alchemist Accelerator — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'alchemist-accelerator',
  'Alchemist Accelerator',
  'Alchemist Accelerator',
  'accel',
  'open',
  3600000,    -- $36k in cents
  3600000,
  0.05,
  ARRAY['US', 'Global'],
  ARRAY['b2b', 'enterprise', 'saas', 'deeptech', 'ai', 'defense', 'data'],
  'Alchemist Accelerator is a 6-month program exclusively for enterprise-facing startups. Graduates have raised over $2B+. The program provides $36k for 5% equity, intense mentorship from enterprise executives, and access to Alchemist''s network of Fortune 500 customers and VCs.',
  'https://alchemistaccelerator.com',
  false,
  'seeded'
);

-- Q1: Enterprise product pitch
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your enterprise product: what it does, who buys it, and what business problem it solves.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your enterprise product: what it does, who buys it, and what business problem it solves.', 'solution', 200, 1, 0.94, false, ARRAY['Alchemist Accelerator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Alchemist Accelerator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your enterprise product: what it does, who buys it, and what business problem it solves.', 200, true, 1, 'Company');

-- Q2: Enterprise customer discovery
SELECT id INTO q_id FROM archived_questions WHERE text = 'Have you spoken with enterprise buyers? What did you learn about their budget, approval process, and key pain points?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Have you spoken with enterprise buyers? What did you learn about their budget, approval process, and key pain points?', 'traction', 250, 1, 0.90, false, ARRAY['Alchemist Accelerator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Alchemist Accelerator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Have you spoken with enterprise buyers? What did you learn about their budget, approval process, and key pain points?', 250, true, 2, 'Traction');

-- Q3: ICP and buyer persona
SELECT id INTO q_id FROM archived_questions WHERE text = 'Who is your ideal customer profile (ICP)? Describe the company size, industry, and buyer persona.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Who is your ideal customer profile (ICP)? Describe the company size, industry, and buyer persona.', 'market', 200, 1, 0.88, false, ARRAY['Alchemist Accelerator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Alchemist Accelerator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Who is your ideal customer profile (ICP)? Describe the company size, industry, and buyer persona.', 200, true, 3, 'Market');

-- Q4: Pilot or paying customers
SELECT id INTO q_id FROM archived_questions WHERE text = 'Do you have any paying enterprise customers or signed pilot agreements? Describe them.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Do you have any paying enterprise customers or signed pilot agreements? Describe them.', 'traction', 200, 1, 0.92, false, ARRAY['Alchemist Accelerator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Alchemist Accelerator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Do you have any paying enterprise customers or signed pilot agreements? Describe them.', 200, true, 4, 'Traction');

-- Q5: Sales motion
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your sales motion? How do you find, qualify, and close enterprise deals?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your sales motion? How do you find, qualify, and close enterprise deals?', 'business_model', 200, 1, 0.87, false, ARRAY['Alchemist Accelerator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Alchemist Accelerator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your sales motion? How do you find, qualify, and close enterprise deals?', 200, true, 5, 'Business Model');

-- Q6: Team
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the founding team. What enterprise or domain experience does each founder bring?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the founding team. What enterprise or domain experience does each founder bring?', 'team', 200, 1, 0.90, true, ARRAY['Alchemist Accelerator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Alchemist Accelerator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the founding team. What enterprise or domain experience does each founder bring?', 200, true, 6, 'Team');

-- Q7: Why Alchemist
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why are you applying to Alchemist specifically? What introductions or resources would be most valuable?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why are you applying to Alchemist specifically? What introductions or resources would be most valuable?', 'fit', 200, 1, 0.82, false, ARRAY['Alchemist Accelerator'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Alchemist Accelerator') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why are you applying to Alchemist specifically? What introductions or resources would be most valuable?', 200, true, 7, 'Fit');

END $$;
