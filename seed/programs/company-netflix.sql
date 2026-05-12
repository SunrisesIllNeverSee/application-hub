-- seed/programs/company-netflix.sql
-- Netflix Application — Application Hub seed data

DO $$
DECLARE
  prog_id uuid := gen_random_uuid();
  q_id    uuid;
BEGIN

INSERT INTO programs (id, slug, name, organization, type, status, check_size_min, check_size_max, equity_taken, geo_focus, industry_tags, description, url, is_rolling, source, kind, domain)
VALUES (
  prog_id,
  'company-netflix',
  'Netflix Application',
  'Netflix',
  'job',
  'open',
  0,
  0,
  0.0,
  ARRAY['Global'],
  ARRAY['tech', 'streaming', 'media', 'entertainment', 'product'],
  'Netflix application questions asked across Greenhouse applications for engineering, product, content, and operations roles.',
  'https://jobs.netflix.com',
  true,
  'seeded',
  'job_fulltime'::opportunity_kind,
  'jobs'
);

-- Q1: Why Netflix?
SELECT id INTO q_id FROM archived_questions WHERE text = 'Why Netflix?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Why Netflix?', 'fit', 300, 1, 0.92, false, ARRAY['Netflix Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Netflix Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Why Netflix?', 300, true, 1, 'Application Questions');

-- Q2: Tell me about a project where you made a judgment call with 
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a project where you made a judgment call with limited data.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a project where you made a judgment call with limited data.', 'personal', 400, 1, 0.9, false, ARRAY['Netflix Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Netflix Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a project where you made a judgment call with limited data.', 400, true, 2, 'Application Questions');

-- Q3: Describe a time you prioritized long-term thinking over shor
SELECT id INTO q_id FROM archived_questions WHERE text = 'Describe a time you prioritized long-term thinking over short-term results.' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Describe a time you prioritized long-term thinking over short-term results.', 'personal', 400, 1, 0.89, false, ARRAY['Netflix Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Netflix Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Describe a time you prioritized long-term thinking over short-term results.', 400, true, 3, 'Application Questions');

-- Q4: Tell me about a time you were radically candid with a collea
SELECT id INTO q_id FROM archived_questions WHERE text = 'Tell me about a time you were radically candid with a colleague. What happened?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'Tell me about a time you were radically candid with a colleague. What happened?', 'personal', 400, 1, 0.88, false, ARRAY['Netflix Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Netflix Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'Tell me about a time you were radically candid with a colleague. What happened?', 400, true, 4, 'Application Questions');

-- Q5: How do you think about the balance between freedom and respo
SELECT id INTO q_id FROM archived_questions WHERE text = 'How do you think about the balance between freedom and responsibility in your work?' LIMIT 1;
IF q_id IS NULL THEN
  INSERT INTO archived_questions (id, text, theme, typical_word_limit, asked_by_count, importance_score, is_universal, example_programs)
  VALUES (gen_random_uuid(), 'How do you think about the balance between freedom and responsibility in your work?', 'personal', 400, 1, 0.87, false, ARRAY['Netflix Application'])
  RETURNING id INTO q_id;
ELSE
  UPDATE archived_questions SET asked_by_count = asked_by_count + 1, example_programs = array_append(example_programs, 'Netflix Application') WHERE id = q_id;
END IF;
INSERT INTO program_questions (id, program_id, archived_question_id, asked_as, word_limit, is_required, order_index, section)
VALUES (gen_random_uuid(), prog_id, q_id, 'How do you think about the balance between freedom and responsibility in your work?', 400, true, 5, 'Application Questions');

END $$;