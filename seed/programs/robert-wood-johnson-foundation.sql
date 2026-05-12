-- seed/programs/robert-wood-johnson-foundation.sql
-- Robert Wood Johnson Foundation Health Grant — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'robert-wood-johnson-foundation',
  'Robert Wood Johnson Foundation Health Grant',
  'Robert Wood Johnson Foundation',
  'grant',
  'open',
  10000000,
  500000000,
  0.0,
  ARRAY['US'],
  ARRAY['public-health', 'health-equity', 'community-health'],
  'RWJF works to build a Culture of Health that enables everyone in America to live longer, healthier lives.',
  'https://www.rwjf.org/en/grants.html',
  true,
  'seeded',
  'grant'::opportunity_kind,
  'grants'
);

-- Q1: Health issue scope
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is the health issue you are addressing, and what is its scope and severity?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is the health issue you are addressing, and what is its scope and severity?', 'problem', 500, 1, 0.92, false, ARRAY['Robert Wood Johnson Foundation Health Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Robert Wood Johnson Foundation Health Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is the health issue you are addressing, and what is its scope and severity?', 500, true, 1, 'Health Issue');

-- Q2: Approach and evidence
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe your proposed approach to improving health outcomes. What is the evidence base?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe your proposed approach to improving health outcomes. What is the evidence base?', 'solution', 600, 1, 0.93, false, ARRAY['Robert Wood Johnson Foundation Health Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Robert Wood Johnson Foundation Health Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe your proposed approach to improving health outcomes. What is the evidence base?', 600, true, 2, 'Approach');

-- Q3: Health equity
SELECT id INTO q_id FROM archived_questions WHERE text = 'How will your work advance health equity?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How will your work advance health equity?', 'impact', 400, 1, 0.92, false, ARRAY['Robert Wood Johnson Foundation Health Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Robert Wood Johnson Foundation Health Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How will your work advance health equity?', 400, true, 3, 'Equity');

-- Q4: Sustainability plan
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your sustainability plan after the grant period?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your sustainability plan after the grant period?', 'business_model', 300, 1, 0.88, false, ARRAY['Robert Wood Johnson Foundation Health Grant'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Robert Wood Johnson Foundation Health Grant') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your sustainability plan after the grant period?', 300, true, 4, 'Sustainability');

END $$;
