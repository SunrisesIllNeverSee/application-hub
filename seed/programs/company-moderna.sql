-- seed/programs/company-moderna.sql
-- Moderna Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-moderna',
  'Moderna Application',
  'Moderna',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['biotech', 'pharma', 'mRNA', 'healthcare', 'science'],
  'Moderna application questions asked across their Workday application portal for research, clinical, commercial, and technology roles.',
  'https://modernatx.com/careers',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Moderna?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Moderna?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Moderna?', 'fit', 400, 1, 0.92, false, ARRAY['Moderna Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Moderna Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Moderna?', 400, true, 1, 'Application Questions');

-- Q2: Tell me about a project where scientific rigor was critical 
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a project where scientific rigor was critical to the outcome.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a project where scientific rigor was critical to the outcome.', 'personal', 500, 1, 0.91, false, ARRAY['Moderna Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Moderna Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a project where scientific rigor was critical to the outcome.', 500, true, 2, 'Application Questions');

-- Q3: Describe a time you had to communicate complex scientific in
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you had to communicate complex scientific information to a non-expert audience.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you had to communicate complex scientific information to a non-expert audience.', 'personal', 400, 1, 0.89, false, ARRAY['Moderna Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Moderna Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you had to communicate complex scientific information to a non-expert audience.', 400, true, 3, 'Application Questions');

-- Q4: Tell me about a failure in your research or professional wor
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a failure in your research or professional work and what you learned.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a failure in your research or professional work and what you learned.', 'personal', 400, 1, 0.88, false, ARRAY['Moderna Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Moderna Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a failure in your research or professional work and what you learned.', 400, true, 4, 'Application Questions');

-- Q5: How do you think about the relationship between scientific i
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you think about the relationship between scientific innovation and access?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you think about the relationship between scientific innovation and access?', 'vision', 400, 1, 0.88, false, ARRAY['Moderna Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Moderna Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you think about the relationship between scientific innovation and access?', 400, true, 5, 'Application Questions');

END $$;