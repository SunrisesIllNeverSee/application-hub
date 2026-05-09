-- seed/programs/accenture-fintech-lab.sql
-- Accenture FinTech Innovation Lab — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source)
VALUES (
  prog_id,
  'accenture-fintech-lab',
  'Accenture FinTech Innovation Lab',
  'Accenture',
  'accel',
  'open',
  0,
  0,
  0.0,
  ARRAY['US', 'Global'],
  ARRAY['fintech', 'banking', 'insurance', 'payments', 'regtech', 'wealthtech', 'ai'],
  'The Accenture FinTech Innovation Lab connects early- and growth-stage fintech startups with the world''s leading financial institutions. The 12-week program provides mentorship from senior financial industry executives, pilot opportunities with Accenture FS clients, and equity-free support to scale fintech solutions.',
  'https://fintechinnovationlab.com',
  false,
  'seeded'
);

-- Q1: Fintech product description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your fintech product or service. What financial problem does it solve and for whom?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your fintech product or service. What financial problem does it solve and for whom?', 'solution', 250, 1, 0.93, false, ARRAY['Accenture FinTech Lab'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Accenture FinTech Lab') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your fintech product or service. What financial problem does it solve and for whom?', 250, true, 1, 'Company');

-- Q2: Existing FS clients / pilots
SELECT id INTO q_id FROM archived_questions WHERE text = 'Do you have existing relationships with financial institutions? Describe any pilots, contracts, or partnerships.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Do you have existing relationships with financial institutions? Describe any pilots, contracts, or partnerships.', 'traction', 200, 1, 0.90, false, ARRAY['Accenture FinTech Lab'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Accenture FinTech Lab') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Do you have existing relationships with financial institutions? Describe any pilots, contracts, or partnerships.', 200, true, 2, 'Traction');

-- Q3: Technology differentiation
SELECT id INTO q_id FROM archived_questions WHERE text = 'What makes your technology differentiated from other fintech solutions in the market?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What makes your technology differentiated from other fintech solutions in the market?', 'technical', 200, 1, 0.88, false, ARRAY['Accenture FinTech Lab'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Accenture FinTech Lab') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What makes your technology differentiated from other fintech solutions in the market?', 200, true, 3, 'Technical');

-- Q4: Regulatory considerations
SELECT id INTO q_id FROM archived_questions WHERE text = 'What regulatory licenses, compliance requirements, or partnerships are relevant to your business?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What regulatory licenses, compliance requirements, or partnerships are relevant to your business?', 'business_model', 200, 1, 0.85, false, ARRAY['Accenture FinTech Lab'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Accenture FinTech Lab') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What regulatory licenses, compliance requirements, or partnerships are relevant to your business?', 200, true, 4, 'Business Model');

-- Q5: Go-to-market for financial institutions
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you sell to or partner with banks, insurers, or other financial institutions? What is the sales cycle?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you sell to or partner with banks, insurers, or other financial institutions? What is the sales cycle?', 'business_model', 200, 1, 0.87, false, ARRAY['Accenture FinTech Lab'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Accenture FinTech Lab') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you sell to or partner with banks, insurers, or other financial institutions? What is the sales cycle?', 200, true, 5, 'Business Model');

-- Q6: What you want from the lab
SELECT id INTO q_id FROM archived_questions WHERE text = 'What specific introductions, resources, or expertise would you most like to gain from the FinTech Innovation Lab?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What specific introductions, resources, or expertise would you most like to gain from the FinTech Innovation Lab?', 'fit', 200, 1, 0.85, false, ARRAY['Accenture FinTech Lab'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Accenture FinTech Lab') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What specific introductions, resources, or expertise would you most like to gain from the FinTech Innovation Lab?', 200, true, 6, 'Fit');

-- Q7: Security and data privacy
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you approach data security, privacy, and compliance with financial regulations?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you approach data security, privacy, and compliance with financial regulations?', 'technical', 200, 1, 0.83, false, ARRAY['Accenture FinTech Lab'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Accenture FinTech Lab') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you approach data security, privacy, and compliance with financial regulations?', 200, true, 7, 'Technical');

END $$;
