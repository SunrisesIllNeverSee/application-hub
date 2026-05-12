-- seed/programs/company-stripe.sql
-- Stripe Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-stripe',
  'Stripe Application',
  'Stripe',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['fintech', 'payments', 'developer tools', 'infrastructure'],
  'Stripe application questions asked across Greenhouse applications for engineering, product, and operations roles.',
  'https://stripe.com/jobs',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Stripe?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Stripe?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Stripe?', 'fit', 300, 1, 0.92, false, ARRAY['Stripe Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Stripe Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Stripe?', 300, true, 1, 'Application Questions');

-- Q2: Tell me about a complex technical or business problem you so
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a complex technical or business problem you solved. How did you approach it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a complex technical or business problem you solved. How did you approach it?', 'personal', 400, 1, 0.9, false, ARRAY['Stripe Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Stripe Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a complex technical or business problem you solved. How did you approach it?', 400, true, 2, 'Application Questions');

-- Q3: Describe a time you had to move fast with limited informatio
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you had to move fast with limited information.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you had to move fast with limited information.', 'personal', 400, 1, 0.89, false, ARRAY['Stripe Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Stripe Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you had to move fast with limited information.', 400, true, 3, 'Application Questions');

-- Q4: How have you made something significantly more efficient or 
SELECT id INTO q_id FROM archived_questions WHERE text = 'How have you made something significantly more efficient or impactful?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How have you made something significantly more efficient or impactful?', 'personal', 400, 1, 0.88, false, ARRAY['Stripe Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Stripe Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How have you made something significantly more efficient or impactful?', 400, true, 4, 'Application Questions');

-- Q5: What do you believe about the future of payments or the inte
SELECT id INTO q_id FROM archived_questions WHERE text = 'What do you believe about the future of payments or the internet economy?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What do you believe about the future of payments or the internet economy?', 'vision', 400, 1, 0.87, false, ARRAY['Stripe Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Stripe Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What do you believe about the future of payments or the internet economy?', 400, true, 5, 'Application Questions');

END $$;