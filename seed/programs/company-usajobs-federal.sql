-- seed/programs/company-usajobs-federal.sql
-- Federal Government (USAJobs) Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-usajobs-federal',
  'Federal Government Application',
  'Federal Government (USAJobs)',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['government', 'public sector', 'federal', 'policy', 'public service'],
  'Federal government application questions commonly asked across USAJobs applications for analyst, specialist, and program officer roles.',
  'https://www.usajobs.gov',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why public service?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why public service?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why public service?', 'fit', 500, 1, 0.92, false, ARRAY['Federal Government Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Federal Government Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why public service?', 500, true, 1, 'Application Questions');

-- Q2: Describe a time you worked within a complex regulatory or bu
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you worked within a complex regulatory or bureaucratic environment.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you worked within a complex regulatory or bureaucratic environment.', 'personal', 500, 1, 0.9, false, ARRAY['Federal Government Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Federal Government Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you worked within a complex regulatory or bureaucratic environment.', 500, true, 2, 'Application Questions');

-- Q3: Tell me about a project that served a diverse public or comm
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a project that served a diverse public or community.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a project that served a diverse public or community.', 'personal', 500, 1, 0.89, false, ARRAY['Federal Government Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Federal Government Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a project that served a diverse public or community.', 500, true, 3, 'Application Questions');

-- Q4: Describe a situation where you had to build consensus among 
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a situation where you had to build consensus among stakeholders with competing interests.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a situation where you had to build consensus among stakeholders with competing interests.', 'personal', 500, 1, 0.89, false, ARRAY['Federal Government Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Federal Government Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a situation where you had to build consensus among stakeholders with competing interests.', 500, true, 4, 'Application Questions');

-- Q5: How do you stay motivated when working on long-term, systemi
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you stay motivated when working on long-term, systemic challenges?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you stay motivated when working on long-term, systemic challenges?', 'personal', 400, 1, 0.87, false, ARRAY['Federal Government Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Federal Government Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you stay motivated when working on long-term, systemic challenges?', 400, true, 5, 'Application Questions');

END $$;