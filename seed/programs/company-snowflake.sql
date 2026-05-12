-- seed/programs/company-snowflake.sql
-- Snowflake Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-snowflake',
  'Snowflake Application',
  'Snowflake',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['tech', 'cloud data', 'data infrastructure', 'analytics', 'saas'],
  'Snowflake application questions asked across their Greenhouse application portal for engineering, product, sales, and data roles.',
  'https://careers.snowflake.com',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Snowflake?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Snowflake?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Snowflake?', 'fit', 300, 1, 0.92, false, ARRAY['Snowflake Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Snowflake Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Snowflake?', 300, true, 1, 'Application Questions');

-- Q2: Tell me about a time you worked on a technically challenging
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you worked on a technically challenging data problem.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you worked on a technically challenging data problem.', 'personal', 400, 1, 0.9, false, ARRAY['Snowflake Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Snowflake Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you worked on a technically challenging data problem.', 400, true, 2, 'Application Questions');

-- Q3: Describe a time you had to move quickly while maintaining qu
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you had to move quickly while maintaining quality.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you had to move quickly while maintaining quality.', 'personal', 400, 1, 0.89, false, ARRAY['Snowflake Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Snowflake Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you had to move quickly while maintaining quality.', 400, true, 3, 'Application Questions');

-- Q4: Tell me about a project where you had significant customer i
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a project where you had significant customer impact.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a project where you had significant customer impact.', 'personal', 400, 1, 0.89, false, ARRAY['Snowflake Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Snowflake Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a project where you had significant customer impact.', 400, true, 4, 'Application Questions');

-- Q5: How do you think about the future of cloud data infrastructu
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you think about the future of cloud data infrastructure?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you think about the future of cloud data infrastructure?', 'vision', 400, 1, 0.88, false, ARRAY['Snowflake Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Snowflake Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you think about the future of cloud data infrastructure?', 400, true, 5, 'Application Questions');

END $$;