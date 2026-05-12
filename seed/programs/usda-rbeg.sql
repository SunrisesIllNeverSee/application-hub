-- seed/programs/usda-rbeg.sql
-- USDA Rural Business Enterprise Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'usda-rbeg',
  'USDA Rural Business Enterprise Grant',
  'USDA Rural Development',
  'grant',
  'open',
  50000000,
  50000000,
  0.0,
  ARRAY['US'],
  ARRAY['rural-development', 'small-business', 'economic-development'],
  'RBEG grants support public bodies, nonprofits, and federally recognized tribes in financing and facilitating development of small and emerging private businesses in rural areas.',
  'https://www.rd.usda.gov/programs-services/business-programs/rural-business-enterprise-grants',
  false,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Rural small business description
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe the rural small business you are assisting. What is the business, and what is your relationship to it?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe the rural small business you are assisting. What is the business, and what is your relationship to it?', 'problem', 500, 1, 0.88, false, ARRAY['USDA Rural Business Enterprise Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'USDA Rural Business Enterprise Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe the rural small business you are assisting. What is the business, and what is your relationship to it?', 500, true, 1, 'Project Description');

-- Q2: Rural area benefit
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will this grant benefit the rural area? What economic development impact will result?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will this grant benefit the rural area? What economic development impact will result?', 'impact', 500, 1, 0.92, false, ARRAY['USDA Rural Business Enterprise Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'USDA Rural Business Enterprise Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will this grant benefit the rural area? What economic development impact will result?', 500, true, 2, 'Impact');

-- Q3: Organization capacity
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your organization''s capacity to carry out this project.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your organization''s capacity to carry out this project.', 'team', 400, 1, 0.87, false, ARRAY['USDA Rural Business Enterprise Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'USDA Rural Business Enterprise Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your organization''s capacity to carry out this project.', 400, true, 3, 'Organizational Capacity');

END $$;
