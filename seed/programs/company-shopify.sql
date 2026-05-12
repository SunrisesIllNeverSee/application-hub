-- seed/programs/company-shopify.sql
-- Shopify Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-shopify',
  'Shopify Application',
  'Shopify',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['tech', 'ecommerce', 'developer tools', 'entrepreneurship'],
  'Shopify application questions asked across Greenhouse applications for engineering, product, merchant success, and operations roles.',
  'https://www.shopify.com/careers',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Shopify?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Shopify?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Shopify?', 'fit', 300, 1, 0.92, false, ARRAY['Shopify Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Shopify Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Shopify?', 300, true, 1, 'Application Questions');

-- Q2: Tell me about a time you helped someone or a team succeed.
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you helped someone or a team succeed.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you helped someone or a team succeed.', 'personal', 400, 1, 0.89, false, ARRAY['Shopify Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Shopify Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you helped someone or a team succeed.', 400, true, 2, 'Application Questions');

-- Q3: Describe a project you built from scratch. How did you decid
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a project you built from scratch. How did you decide what to prioritize?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a project you built from scratch. How did you decide what to prioritize?', 'personal', 400, 1, 0.88, false, ARRAY['Shopify Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Shopify Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a project you built from scratch. How did you decide what to prioritize?', 400, true, 3, 'Application Questions');

-- Q4: How do you think about the relationship between technology a
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you think about the relationship between technology and entrepreneurs?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you think about the relationship between technology and entrepreneurs?', 'vision', 400, 1, 0.87, false, ARRAY['Shopify Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Shopify Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you think about the relationship between technology and entrepreneurs?', 400, true, 4, 'Application Questions');

-- Q5: Tell me about a time you had to deliver difficult news to a 
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you had to deliver difficult news to a stakeholder.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you had to deliver difficult news to a stakeholder.', 'personal', 400, 1, 0.87, false, ARRAY['Shopify Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Shopify Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you had to deliver difficult news to a stakeholder.', 400, true, 5, 'Application Questions');

END $$;