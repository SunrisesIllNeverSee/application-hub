-- seed/programs/company-world-bank.sql
-- World Bank Group Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-world-bank',
  'World Bank Group Application',
  'World Bank Group',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['international development', 'finance', 'public sector', 'global development', 'policy'],
  'World Bank Group application questions asked across their online application portal for analyst, specialist, and Young Professionals Program roles.',
  'https://www.worldbank.org/en/about/careers',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why the World Bank?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why the World Bank?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why the World Bank?', 'fit', 500, 1, 0.92, false, ARRAY['World Bank Group Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'World Bank Group Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why the World Bank?', 500, true, 1, 'Application Questions');

-- Q2: Tell me about a time you worked on development challenges in
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you worked on development challenges in emerging markets or low-income contexts.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you worked on development challenges in emerging markets or low-income contexts.', 'personal', 500, 1, 0.91, false, ARRAY['World Bank Group Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'World Bank Group Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you worked on development challenges in emerging markets or low-income contexts.', 500, true, 2, 'Application Questions');

-- Q3: Describe a project where you had to navigate political or in
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a project where you had to navigate political or institutional complexity.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a project where you had to navigate political or institutional complexity.', 'personal', 500, 1, 0.9, false, ARRAY['World Bank Group Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'World Bank Group Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a project where you had to navigate political or institutional complexity.', 500, true, 3, 'Application Questions');

-- Q4: Tell me about a time you advocated for an underrepresented p
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you advocated for an underrepresented population.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you advocated for an underrepresented population.', 'personal', 500, 1, 0.9, false, ARRAY['World Bank Group Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'World Bank Group Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you advocated for an underrepresented population.', 500, true, 4, 'Application Questions');

-- Q5: What is your view on the role of multilateral institutions i
SELECT id INTO q_id FROM archived_questions WHERE text = 'What is your view on the role of multilateral institutions in global development?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'What is your view on the role of multilateral institutions in global development?', 'vision', 500, 1, 0.91, false, ARRAY['World Bank Group Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'World Bank Group Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'What is your view on the role of multilateral institutions in global development?', 500, true, 5, 'Application Questions');

END $$;